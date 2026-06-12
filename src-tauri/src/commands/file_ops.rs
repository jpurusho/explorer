use crate::indexer::IndexDb;
use crate::utils::errors::AppError;
use crate::log_info;
use serde::Serialize;
use std::path::Path;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

/// Show a native "Save As" dialog and write `content` to the chosen path.
/// Returns the saved path, or None if the user cancelled. `default_name` seeds
/// the filename; `start_dir` (if any) opens the dialog there.
#[tauri::command]
pub async fn save_text_file(
    app: tauri::AppHandle,
    content: String,
    default_name: String,
    start_dir: Option<String>,
) -> Result<Option<String>, AppError> {
    let mut builder = app.dialog().file().set_file_name(&default_name);
    if let Some(dir) = start_dir.as_ref().filter(|d| !d.is_empty()) {
        builder = builder.set_directory(dir);
    }

    let chosen = builder.blocking_save_file();
    let path = match chosen {
        Some(p) => p.into_path().map_err(|e| AppError::Other(e.to_string()))?,
        None => return Ok(None),
    };

    std::fs::write(&path, content.as_bytes())?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[derive(Debug, Clone, Serialize)]
pub struct FileOpResult {
    pub succeeded: u32,
    pub failed: Vec<FileOpError>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub created_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileOpError {
    pub path: String,
    pub error: String,
}

#[tauri::command]
pub async fn trash_items(paths: Vec<String>, index: State<'_, IndexDb>) -> Result<FileOpResult, AppError> {
    log_info!("trash_items: {} items", paths.len());
    let mut succeeded = 0u32;
    let mut failed = Vec::new();

    for path_str in &paths {
        let path = Path::new(path_str);
        if !path.exists() {
            failed.push(FileOpError {
                path: path_str.clone(),
                error: "File not found".to_string(),
            });
            continue;
        }
        match trash::delete(path) {
            Ok(_) => {
                succeeded += 1;
                index.remove_path(Path::new(path_str));
            }
            Err(e) => failed.push(FileOpError {
                path: path_str.clone(),
                error: e.to_string(),
            }),
        }
    }

    Ok(FileOpResult { succeeded, failed, created_paths: vec![] })
}

#[tauri::command]
pub async fn move_items(paths: Vec<String>, destination: String, index: State<'_, IndexDb>) -> Result<FileOpResult, AppError> {
    log_info!("move_items: {} items -> {}", paths.len(), destination);
    let dest = Path::new(&destination);
    if !dest.is_dir() {
        return Err(AppError::Other(format!("Destination is not a directory: {}", destination)));
    }

    let mut succeeded = 0u32;
    let mut failed = Vec::new();
    let mut created_paths = Vec::new();

    for path_str in &paths {
        let source = Path::new(path_str);
        if !source.exists() {
            failed.push(FileOpError {
                path: path_str.clone(),
                error: "Source not found".to_string(),
            });
            continue;
        }

        let file_name = source.file_name().unwrap_or_default();
        let target = dest.join(file_name);

        if target.exists() {
            failed.push(FileOpError {
                path: path_str.clone(),
                error: format!("Already exists: {}", target.display()),
            });
            continue;
        }

        match std::fs::rename(source, &target) {
            Ok(_) => {
                succeeded += 1;
                created_paths.push(target.to_string_lossy().to_string());
                index.remove_path(source);
                index.upsert_path(&target);
            }
            Err(e) => {
                // Cross-device (EXDEV): fall back to copy + delete.
                if is_cross_device(&e) {
                    match copy_recursive(source, &target) {
                        Ok(_) => {
                            if source.is_dir() {
                                std::fs::remove_dir_all(source).ok();
                            } else {
                                std::fs::remove_file(source).ok();
                            }
                            index.remove_path(source);
                            index.upsert_path(&target);
                            succeeded += 1;
                            created_paths.push(target.to_string_lossy().to_string());
                        }
                        Err(ce) => failed.push(FileOpError {
                            path: path_str.clone(),
                            error: ce.to_string(),
                        }),
                    }
                } else {
                    failed.push(FileOpError {
                        path: path_str.clone(),
                        error: e.to_string(),
                    });
                }
            }
        }
    }

    Ok(FileOpResult { succeeded, failed, created_paths })
}

/// EXDEV detection. `ErrorKind::CrossesDevices` is the portable check; fall back
/// to the raw errno (18 on macOS/Linux) on older toolchains.
fn is_cross_device(e: &std::io::Error) -> bool {
    #[allow(unreachable_patterns)]
    match e.kind() {
        std::io::ErrorKind::CrossesDevices => true,
        _ => e.raw_os_error() == Some(18),
    }
}

#[tauri::command]
pub async fn copy_items(paths: Vec<String>, destination: String, index: State<'_, IndexDb>) -> Result<FileOpResult, AppError> {
    log_info!("copy_items: {} items -> {}", paths.len(), destination);
    let dest = Path::new(&destination);
    if !dest.is_dir() {
        return Err(AppError::Other(format!("Destination is not a directory: {}", destination)));
    }

    let mut succeeded = 0u32;
    let mut failed = Vec::new();
    let mut created_paths = Vec::new();

    for path_str in &paths {
        let source = Path::new(path_str);
        if !source.exists() {
            failed.push(FileOpError {
                path: path_str.clone(),
                error: "Source not found".to_string(),
            });
            continue;
        }

        let file_name = source.file_name().unwrap_or_default();
        let mut target = dest.join(file_name);

        // If target already exists (e.g. pasting into same directory), generate a unique name
        if target.exists() {
            target = generate_copy_name(source, dest);
        }

        match copy_recursive(source, &target) {
            Ok(_) => {
                succeeded += 1;
                created_paths.push(target.to_string_lossy().to_string());
                index.upsert_path(&target);
            }
            Err(e) => {
                // Drag-in from other apps can deliver promise files whose bytes
                // haven't materialized yet — copy_recursive may create the
                // target before failing, leaving a 0-byte stub. Always clean up
                // the partial target on error.
                if target.is_dir() {
                    std::fs::remove_dir_all(&target).ok();
                } else if target.exists() {
                    std::fs::remove_file(&target).ok();
                }
                failed.push(FileOpError {
                    path: path_str.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    Ok(FileOpResult { succeeded, failed, created_paths })
}

#[tauri::command]
pub async fn rename_item(path: String, new_name: String, index: State<'_, IndexDb>) -> Result<String, AppError> {
    if new_name.is_empty() || new_name.contains('/') || new_name == "." || new_name == ".." {
        return Err(AppError::Other("Invalid filename".to_string()));
    }

    let source = Path::new(&path);
    if !source.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", path)));
    }

    let parent = source.parent().ok_or_else(|| AppError::Other("No parent directory".to_string()))?;
    let target = parent.join(&new_name);

    if target.exists() {
        return Err(AppError::Other(format!("Already exists: {}", target.display())));
    }

    std::fs::rename(source, &target)?;
    index.remove_path(source);
    index.upsert_path(&target);
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn create_folder(path: String, index: State<'_, IndexDb>) -> Result<(), AppError> {
    let folder_path = Path::new(&path);
    if folder_path.exists() {
        return Err(AppError::Other(format!("Already exists: {}", path)));
    }
    std::fs::create_dir(&folder_path)?;
    index.upsert_path(folder_path);
    Ok(())
}

#[tauri::command]
pub async fn duplicate_items(paths: Vec<String>, index: State<'_, IndexDb>) -> Result<FileOpResult, AppError> {
    log_info!("duplicate_items: {} items", paths.len());
    let mut succeeded = 0u32;
    let mut failed = Vec::new();
    let mut created_paths = Vec::new();

    for path_str in &paths {
        let source = Path::new(path_str);
        if !source.exists() {
            failed.push(FileOpError {
                path: path_str.clone(),
                error: "Source not found".to_string(),
            });
            continue;
        }

        let parent = match source.parent() {
            Some(p) => p,
            None => {
                failed.push(FileOpError { path: path_str.clone(), error: "No parent".to_string() });
                continue;
            }
        };

        let target = generate_copy_name(source, parent);

        match copy_recursive(source, &target) {
            Ok(_) => {
                succeeded += 1;
                created_paths.push(target.to_string_lossy().to_string());
                index.upsert_path(&target);
            }
            Err(e) => failed.push(FileOpError {
                path: path_str.clone(),
                error: e.to_string(),
            }),
        }
    }

    Ok(FileOpResult { succeeded, failed, created_paths })
}

fn generate_copy_name(source: &Path, parent: &Path) -> std::path::PathBuf {
    let stem = source.file_stem().unwrap_or_default().to_string_lossy();
    let ext = source.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let is_dir = source.is_dir();

    let candidate = if is_dir {
        parent.join(format!("{} copy", stem))
    } else {
        parent.join(format!("{} copy{}", stem, ext))
    };
    if !candidate.exists() {
        return candidate;
    }

    for i in 2..1000 {
        let candidate = if is_dir {
            parent.join(format!("{} copy {}", stem, i))
        } else {
            parent.join(format!("{} copy {}{}", stem, i, ext))
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    parent.join(format!("{} copy{}", stem, ext))
}

fn copy_recursive(source: &Path, target: &Path) -> std::io::Result<()> {
    if source.is_dir() {
        std::fs::create_dir_all(target)?;
        for entry in std::fs::read_dir(source)? {
            let entry = entry?;
            let child_target = target.join(entry.file_name());
            copy_recursive(&entry.path(), &child_target)?;
        }
    } else {
        std::fs::copy(source, target)?;
    }
    Ok(())
}
