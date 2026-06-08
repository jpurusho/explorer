use crate::indexer::IndexDb;
use crate::utils::errors::AppError;
use crate::log_info;
use serde::Serialize;
use std::path::Path;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct FileOpResult {
    pub succeeded: u32,
    pub failed: Vec<FileOpError>,
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

    Ok(FileOpResult { succeeded, failed })
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
                index.remove_path(source);
                index.upsert_path(&target);
            }
            Err(e) => {
                // Cross-device: fallback to copy + delete
                if e.raw_os_error() == Some(18) {
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

    Ok(FileOpResult { succeeded, failed })
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

        match copy_recursive(source, &target) {
            Ok(_) => {
                succeeded += 1;
                index.upsert_path(&target);
            }
            Err(e) => failed.push(FileOpError {
                path: path_str.clone(),
                error: e.to_string(),
            }),
        }
    }

    Ok(FileOpResult { succeeded, failed })
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
