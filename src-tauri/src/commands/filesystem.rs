use crate::models::file_entry::{classify_file_type, ExifData, FileContent, FileEntry, FileMetadata};
use crate::utils::errors::AppError;
use crate::log_info;
use chrono::{DateTime, Utc};
use serde::Serialize;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, AppError> {
    let start = std::time::Instant::now();
    log_info!("list_directory: {}", path);

    // Push the blocking read_dir + per-entry stat off the Tokio runtime so the
    // UI thread (and other commands) keep flowing. Per-entry metadata can each
    // be a syscall; on a slow disk a 5k-entry folder could otherwise block all
    // async work for a few hundred ms.
    let path_for_task = path.clone();
    let entries = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<FileEntry>, AppError> {
        let dir_path = Path::new(&path_for_task);
        if !dir_path.exists() {
            return Err(AppError::NotFound(format!("Path does not exist: {}", path_for_task)));
        }
        if !dir_path.is_dir() {
            return Err(AppError::Other(format!("Not a directory: {}", path_for_task)));
        }

        let read_dir = fs::read_dir(dir_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::PermissionDenied(path_for_task.clone())
            } else {
                AppError::Io(e)
            }
        })?;

        let mut out = Vec::new();
        for entry in read_dir {
            let entry = match entry { Ok(e) => e, Err(_) => continue };
            let name = entry.file_name().to_string_lossy().to_string();
            let entry_path = entry.path();
            let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };

            let is_dir = metadata.is_dir();
            let is_hidden = name.starts_with('.');
            let size = if is_dir { 0 } else { metadata.len() };
            let modified = metadata
                .modified()
                .ok()
                .map(|t| {
                    let dt: DateTime<Utc> = t.into();
                    dt.to_rfc3339()
                })
                .unwrap_or_default();
            let file_type = if is_dir { "directory".to_string() } else { classify_file_type(&name) };

            out.push(FileEntry {
                name,
                path: entry_path.to_string_lossy().to_string(),
                is_dir,
                is_hidden,
                size,
                modified,
                file_type,
            });
        }
        Ok(out)
    })
    .await
    .map_err(|e| AppError::Other(format!("list_directory join error: {}", e)))??;

    let elapsed = start.elapsed();
    log_info!("list_directory: {} -> {} entries ({}ms)", path, entries.len(), elapsed.as_millis());
    Ok(entries)
}

#[tauri::command]
pub async fn read_file_content(
    path: String,
    max_bytes: Option<u64>,
) -> Result<FileContent, AppError> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", path)));
    }

    let metadata = fs::metadata(file_path)?;
    let size = metadata.len();
    let limit = max_bytes.unwrap_or(1_000_000); // Default 1MB limit

    let truncated = size > limit;
    let content = if truncated {
        let bytes = fs::read(file_path)?;
        String::from_utf8_lossy(&bytes[..limit as usize]).to_string()
    } else {
        fs::read_to_string(file_path).unwrap_or_else(|_| {
            // Binary file — return empty content
            String::new()
        })
    };

    let mime_type = mime_from_extension(
        file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or(""),
    );

    Ok(FileContent {
        content,
        mime_type,
        size,
        truncated,
    })
}

#[tauri::command]
pub async fn get_file_metadata(path: String) -> Result<FileMetadata, AppError> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(AppError::NotFound(format!("Path not found: {}", path)));
    }

    let metadata = fs::symlink_metadata(file_path)?;
    let name = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let modified = metadata
        .modified()
        .ok()
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    let created = metadata
        .created()
        .ok()
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_default();

    let is_hidden = name.starts_with('.');
    let permissions = format!("{:o}", metadata.permissions().mode() & 0o777);

    Ok(FileMetadata {
        path,
        name,
        size: metadata.len(),
        modified,
        created,
        is_dir: metadata.is_dir(),
        is_symlink: metadata.is_symlink(),
        is_hidden,
        permissions,
    })
}

#[tauri::command]
pub fn get_home_directory() -> Result<String, AppError> {
    directories::UserDirs::new()
        .map(|d| d.home_dir().to_string_lossy().to_string())
        .ok_or_else(|| AppError::Other("Could not determine home directory".to_string()))
}

#[tauri::command]
pub async fn get_file_entries(paths: Vec<String>) -> Result<Vec<FileEntry>, AppError> {
    let mut entries = Vec::new();
    for path_str in &paths {
        let path = Path::new(path_str);
        if !path.exists() {
            continue;
        }
        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        let is_dir = metadata.is_dir();
        let is_hidden = name.starts_with('.');
        let size = if is_dir { 0 } else { metadata.len() };
        let modified = metadata.modified().ok().and_then(|t| {
            let dt: DateTime<Utc> = t.into();
            Some(dt.to_rfc3339())
        }).unwrap_or_default();
        let file_type = if is_dir { "directory".to_string() } else { classify_file_type(&name) };

        entries.push(FileEntry {
            name,
            path: path_str.clone(),
            is_dir,
            is_hidden,
            size,
            modified,
            file_type,
        });
    }
    Ok(entries)
}

#[derive(Debug, Clone, Serialize)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: String,
    pub changed: u32,
    pub staged: u32,
    pub untracked: u32,
    pub ahead: u32,
    pub behind: u32,
}

#[tauri::command]
pub async fn get_git_status(path: String) -> Result<GitStatus, AppError> {
    let repo = match git2::Repository::discover(&path) {
        Ok(r) => r,
        Err(_) => return Ok(GitStatus { is_repo: false, branch: String::new(), changed: 0, staged: 0, untracked: 0, ahead: 0, behind: 0 }),
    };

    let branch = repo.head().ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_else(|| "HEAD".to_string());

    let mut changed = 0u32;
    let mut staged = 0u32;
    let mut untracked = 0u32;

    if let Ok(statuses) = repo.statuses(None) {
        for s in statuses.iter() {
            let st = s.status();
            if st.intersects(git2::Status::WT_MODIFIED | git2::Status::WT_DELETED | git2::Status::WT_RENAMED | git2::Status::WT_TYPECHANGE) {
                changed += 1;
            }
            if st.intersects(git2::Status::INDEX_NEW | git2::Status::INDEX_MODIFIED | git2::Status::INDEX_DELETED | git2::Status::INDEX_RENAMED | git2::Status::INDEX_TYPECHANGE) {
                staged += 1;
            }
            if st.contains(git2::Status::WT_NEW) {
                untracked += 1;
            }
        }
    }

    Ok(GitStatus { is_repo: true, branch, changed, staged, untracked, ahead: 0, behind: 0 })
}

#[tauri::command]
pub async fn get_sync_statuses(path: String) -> Result<std::collections::HashMap<String, String>, AppError> {
    use std::collections::HashMap;

    let path_clone = path.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<HashMap<String, String>, AppError> {
        let dir_path = Path::new(&path_clone);
        let repo = match git2::Repository::discover(dir_path) {
            Ok(r) => r,
            Err(_) => return Ok(HashMap::new()),
        };

        // Find upstream remote tree for the current branch
        let remote_tree = (|| -> Option<git2::Tree> {
            let head = repo.head().ok()?;
            let branch_name = head.shorthand()?;
            let upstream = repo.find_branch(
                &format!("origin/{}", branch_name),
                git2::BranchType::Remote,
            ).ok()?;
            let commit = upstream.get().peel_to_commit().ok()?;
            commit.tree().ok()
        })();

        let remote_tree = match remote_tree {
            Some(t) => t,
            None => {
                // No upstream — everything is local
                let mut map = HashMap::new();
                if let Ok(rd) = fs::read_dir(dir_path) {
                    for entry in rd.flatten() {
                        map.insert(
                            entry.path().to_string_lossy().to_string(),
                            "local".to_string(),
                        );
                    }
                }
                return Ok(map);
            }
        };

        let workdir = repo.workdir().unwrap_or(dir_path);
        let mut map = HashMap::new();

        if let Ok(rd) = fs::read_dir(dir_path) {
            for entry in rd.flatten() {
                let entry_path = entry.path();
                let rel = match entry_path.strip_prefix(workdir) {
                    Ok(r) => r,
                    Err(_) => {
                        map.insert(entry_path.to_string_lossy().to_string(), "local".to_string());
                        continue;
                    }
                };

                let rel_str = rel.to_string_lossy().replace('\\', "/");
                let status = if remote_tree.get_path(std::path::Path::new(&rel_str)).is_ok() {
                    // Check if the working tree version differs from remote
                    let remote_entry = remote_tree.get_path(std::path::Path::new(&rel_str)).unwrap();
                    let in_index = repo.index().ok().and_then(|idx| {
                        idx.get_path(std::path::Path::new(&rel_str), 0)
                    });
                    match in_index {
                        Some(idx_entry) if idx_entry.id == remote_entry.id() => {
                            // Index matches remote — check if working tree is clean
                            let st = repo.status_file(std::path::Path::new(&rel_str))
                                .unwrap_or(git2::Status::WT_NEW);
                            if st.is_empty() {
                                "pushed"
                            } else {
                                "local"
                            }
                        }
                        _ => "local",
                    }
                } else {
                    "local"
                };

                map.insert(entry_path.to_string_lossy().to_string(), status.to_string());
            }
        }

        Ok(map)
    }).await.map_err(|e| AppError::Other(e.to_string()))?
}

#[tauri::command]
pub async fn read_image_base64(path: String) -> Result<String, AppError> {
    use base64::Engine;
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::NotFound(format!("Image not found: {}", path)));
    }
    let bytes = fs::read(file_path)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), AppError> {
    let file_path = Path::new(&path);
    fs::write(file_path, content.as_bytes())?;
    Ok(())
}

#[tauri::command]
pub async fn read_exif_data(path: String) -> Result<ExifData, AppError> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", path)));
    }

    let file = std::fs::File::open(file_path)?;
    let mut buf_reader = std::io::BufReader::new(&file);
    let exif_reader = exif::Reader::new();
    let exif = exif_reader
        .read_from_container(&mut buf_reader)
        .map_err(|e| AppError::Other(format!("No EXIF data: {}", e)))?;

    let get_field = |tag: exif::Tag| -> Option<String> {
        exif.get_field(tag, exif::In::PRIMARY)
            .map(|f| f.display_value().with_unit(&exif).to_string())
    };

    Ok(ExifData {
        camera_make: get_field(exif::Tag::Make),
        camera_model: get_field(exif::Tag::Model),
        lens_model: get_field(exif::Tag::LensModel),
        focal_length: get_field(exif::Tag::FocalLength),
        aperture: get_field(exif::Tag::FNumber),
        shutter_speed: get_field(exif::Tag::ExposureTime),
        iso: get_field(exif::Tag::PhotographicSensitivity),
        date_taken: get_field(exif::Tag::DateTimeOriginal),
        width: exif.get_field(exif::Tag::PixelXDimension, exif::In::PRIMARY)
            .and_then(|f| f.value.get_uint(0)),
        height: exif.get_field(exif::Tag::PixelYDimension, exif::In::PRIMARY)
            .and_then(|f| f.value.get_uint(0)),
        orientation: exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
            .and_then(|f| f.value.get_uint(0))
            .map(|v| v as u8),
    })
}

#[tauri::command]
pub async fn generate_thumbnail(path: String, size: u32) -> Result<String, AppError> {
    // Image decode + encode is CPU-heavy and blocking; run it off the async
    // runtime so concurrent gallery thumbnails don't starve runtime workers.
    tauri::async_runtime::spawn_blocking(move || generate_thumbnail_blocking(&path, size))
        .await
        .map_err(|e| AppError::Other(format!("thumbnail task failed: {}", e)))?
}

fn generate_thumbnail_blocking(path: &str, size: u32) -> Result<String, AppError> {
    use base64::Engine;
    use image::GenericImageView;
    use sha2::{Sha256, Digest};

    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(AppError::NotFound(format!("File not found: {}", path)));
    }

    // Cache directory
    let cache_dir = directories::ProjectDirs::from("com", "explorer", "Explorer")
        .map(|d| d.cache_dir().to_path_buf())
        .unwrap_or_else(|| std::env::temp_dir().join("explorer-thumbs"));

    fs::create_dir_all(&cache_dir).ok();

    // Cache key based on path + modification time + size
    let metadata = fs::metadata(file_path)?;
    let modified = metadata.modified().ok().map(|t| {
        let dt: DateTime<Utc> = t.into();
        dt.timestamp()
    }).unwrap_or(0);

    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update(modified.to_le_bytes());
    hasher.update(size.to_le_bytes());
    let hash = format!("{:x}", hasher.finalize());
    let cache_path = cache_dir.join(format!("{}.jpg", &hash[..16]));

    // Return cached if exists
    if cache_path.exists() {
        let bytes = fs::read(&cache_path)?;
        return Ok(base64::engine::general_purpose::STANDARD.encode(&bytes));
    }

    // Generate thumbnail
    let img = image::open(file_path)
        .map_err(|e| AppError::Other(format!("Failed to open image: {}", e)))?;

    let (w, h) = img.dimensions();
    let thumb = if w > size || h > size {
        img.thumbnail(size, size)
    } else {
        img
    };

    // Save as JPEG to cache
    let mut output = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut output);
    thumb.write_to(&mut cursor, image::ImageFormat::Jpeg)
        .map_err(|e| AppError::Other(format!("Failed to encode thumbnail: {}", e)))?;

    fs::write(&cache_path, &output).ok();

    Ok(base64::engine::general_purpose::STANDARD.encode(&output))
}

fn mime_from_extension(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "txt" | "log" => "text/plain".to_string(),
        "md" | "mdx" => "text/markdown".to_string(),
        "json" => "application/json".to_string(),
        "yml" | "yaml" => "text/yaml".to_string(),
        "html" | "htm" => "text/html".to_string(),
        "css" => "text/css".to_string(),
        "js" | "mjs" => "text/javascript".to_string(),
        "ts" | "tsx" => "text/typescript".to_string(),
        "rs" => "text/x-rust".to_string(),
        "py" => "text/x-python".to_string(),
        "go" => "text/x-go".to_string(),
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "webp" => "image/webp".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}
