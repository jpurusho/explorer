use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify::event::{EventKind, CreateKind, ModifyKind, RemoveKind, RenameMode};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use serde::Serialize;

#[derive(Clone, Serialize)]
struct FileChangeEvent {
    kind: String, // "created", "modified", "removed"
    path: String,
}

#[derive(Clone, Serialize)]
struct DirectoryChangeEvent {
    path: String,
}

pub struct WatcherState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched_path: Mutex<Option<String>>,
}

impl WatcherState {
    pub fn new() -> Self {
        WatcherState {
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub fn watch_directory(path: String, app: AppHandle, state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut watched_guard = state.watched_path.lock().map_err(|e| e.to_string())?;

    // If already watching the same path, no-op
    if watched_guard.as_deref() == Some(&path) {
        return Ok(());
    }

    // Drop old watcher
    *watcher_guard = None;

    let emit_app = app.clone();
    let watched_dir = path.clone();

    let watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            let watched_path = PathBuf::from(&watched_dir);
            // FSEvents on macOS may emit the directory itself (metadata change),
            // direct children, or nested descendants. Accept all three; ignore
            // events whose paths are entirely outside the watched tree.
            let relevant = event.paths.is_empty() || event.paths.iter().any(|p| {
                p == &watched_path
                    || p.parent().map(|parent| parent == watched_path).unwrap_or(false)
                    || p.starts_with(&watched_path)
            });

            if !relevant {
                return;
            }

            // Emit directory-changed for UI refresh
            let should_emit = matches!(
                event.kind,
                EventKind::Create(CreateKind::File | CreateKind::Folder | CreateKind::Any)
                | EventKind::Remove(RemoveKind::File | RemoveKind::Folder | RemoveKind::Any)
                | EventKind::Modify(ModifyKind::Name(RenameMode::Any | RenameMode::From | RenameMode::To | RenameMode::Both))
                | EventKind::Modify(ModifyKind::Data(_))
            );

            if should_emit {
                emit_app.emit("directory-changed", DirectoryChangeEvent { path: watched_dir.clone() }).ok();
            }

            // Emit granular file-change events for search indexing
            for affected_path in &event.paths {
                let path_str = affected_path.to_string_lossy().to_string();
                match event.kind {
                    EventKind::Create(CreateKind::File | CreateKind::Any) => {
                        emit_app.emit("file-created", FileChangeEvent { kind: "created".to_string(), path: path_str }).ok();
                    }
                    EventKind::Remove(RemoveKind::File | RemoveKind::Any) => {
                        emit_app.emit("file-removed", FileChangeEvent { kind: "removed".to_string(), path: path_str }).ok();
                    }
                    EventKind::Modify(ModifyKind::Name(RenameMode::To)) => {
                        emit_app.emit("file-created", FileChangeEvent { kind: "created".to_string(), path: path_str }).ok();
                    }
                    EventKind::Modify(ModifyKind::Name(RenameMode::From)) => {
                        emit_app.emit("file-removed", FileChangeEvent { kind: "removed".to_string(), path: path_str }).ok();
                    }
                    EventKind::Modify(ModifyKind::Data(_)) => {
                        emit_app.emit("file-modified", FileChangeEvent { kind: "modified".to_string(), path: path_str }).ok();
                    }
                    _ => {}
                }
            }
        }
    }).map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);

    if let Some(ref mut w) = *watcher_guard {
        w.watch(path.as_ref(), RecursiveMode::NonRecursive)
            .map_err(|e| e.to_string())?;
    }

    *watched_guard = Some(path);
    Ok(())
}

#[tauri::command]
pub fn unwatch_directory(state: State<'_, WatcherState>) -> Result<(), String> {
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    let mut watched_guard = state.watched_path.lock().map_err(|e| e.to_string())?;
    *watcher_guard = None;
    *watched_guard = None;
    Ok(())
}
