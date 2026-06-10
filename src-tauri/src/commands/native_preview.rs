//! Native macOS Quick Look preview via `qlmanage -p`.
//!
//! Earlier attempts embedded `QLPreviewView` in a Tauri-owned NSWindow, but that
//! private API asserts (SIGABRT) on a fragile internal-state machine that we
//! can't reliably satisfy from outside AppKit's view-activation cycle — it
//! crashed the whole app every time.
//!
//! Instead we invoke `qlmanage -p`, the command-line entry point to the system
//! Quick Look panel. It uses the *same* Quick Look generator plugins Finder's
//! spacebar preview uses (full multi-page/slide navigation for Keynote, PPT,
//! Pages, PDF, etc.), but runs in its OWN process. If Quick Look has trouble
//! with a document it fails in that child process — it can never abort Explorer.

use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// Tracks the running `qlmanage -p` child so we can replace it when the user
/// previews a different document (one preview window at a time, like Finder).
#[derive(Default)]
pub struct NativePreviewState {
    child: Mutex<Option<std::process::Child>>,
}

impl NativePreviewState {
    pub fn new() -> Self {
        Self::default()
    }
}

#[tauri::command]
pub fn show_native_preview(app: AppHandle, path: String, title: String) -> Result<(), String> {
    let _ = title; // qlmanage titles the panel from the file itself
    let state = app.state::<NativePreviewState>();
    let mut guard = state.child.lock().unwrap();

    // Replace any previous preview so we don't stack panels.
    if let Some(mut prev) = guard.take() {
        let _ = prev.kill();
        let _ = prev.wait();
    }

    let child = Command::new("qlmanage")
        .arg("-p")
        .arg(&path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch Quick Look: {}", e))?;

    *guard = Some(child);
    Ok(())
}

#[tauri::command]
pub fn close_native_preview(app: AppHandle) -> Result<(), String> {
    let state = app.state::<NativePreviewState>();
    let mut guard = state.child.lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    Ok(())
}
