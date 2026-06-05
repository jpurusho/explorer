use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use notify::event::{EventKind, CreateKind, ModifyKind, RemoveKind, RenameMode};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

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
            let dominated_by_watched_dir = event.paths.iter().any(|p| {
                p.parent().map(|parent| parent == PathBuf::from(&watched_dir)).unwrap_or(false)
            });

            if !dominated_by_watched_dir {
                return;
            }

            let should_emit = matches!(
                event.kind,
                EventKind::Create(CreateKind::File | CreateKind::Folder | CreateKind::Any)
                | EventKind::Remove(RemoveKind::File | RemoveKind::Folder | RemoveKind::Any)
                | EventKind::Modify(ModifyKind::Name(RenameMode::Any | RenameMode::From | RenameMode::To | RenameMode::Both))
                | EventKind::Modify(ModifyKind::Data(_))
            );

            if should_emit {
                emit_app.emit("directory-changed", &watched_dir).ok();
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
