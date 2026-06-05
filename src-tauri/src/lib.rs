mod commands;
mod db;
mod indexer;
mod models;
mod utils;

use commands::file_ops::{copy_items, create_folder, move_items, rename_item, trash_items};
use commands::search::{search_files, get_index_stats, is_indexing, reindex, rebuild_trigrams};
use commands::filesystem::{generate_thumbnail, get_file_entries, get_file_metadata, get_git_status, get_home_directory, list_directory, read_exif_data, read_file_content, read_image_base64, write_file};
use commands::sections::{get_all_sections, get_sections, create_section, update_section, delete_section, assign_files_to_section, remove_files_from_section, reorder_sections};
use commands::settings::{load_settings, save_settings, list_font_themes, load_font_theme, write_log};
use commands::tags::{get_all_tags, create_tag, update_tag, delete_tag, tag_files, untag_files, get_tags_for_files, get_files_by_tag};
use std::path::PathBuf;
use std::io::{Read, Seek, SeekFrom};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let index_db = indexer::IndexDb::new();

    // Background indexing — Option 4: smart catch-up strategy
    let (file_count, _) = index_db.get_stats();
    let gap_seconds = index_db.seconds_since_shutdown();
    let index_conn = index_db.conn.clone();
    let index_read = index_db.read_conn.clone();
    let index_flag = index_db.indexing.clone();
    std::thread::spawn(move || {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        let db = indexer::IndexDb { conn: index_conn, read_conn: index_read, indexing: index_flag };
        if file_count == 0 {
            // First launch — full scan
            db.index_directory(std::path::Path::new(&home));
        } else if gap_seconds > 172800 {
            // Gap > 48 hours — full incremental mtime rescan
            db.incremental_sync(std::path::Path::new(&home));
        } else {
            // Gap < 48 hours — quick incremental (only check recent dirs)
            // For now, still does incremental sync but could use FSEvents replay
            db.incremental_sync(std::path::Path::new(&home));
        }
    });

    // Save shutdown time on app exit
    let shutdown_db = index_db.conn.clone();
    let shutdown_read = index_db.read_conn.clone();
    let shutdown_flag = index_db.indexing.clone();

    tauri::Builder::default()
        .manage(index_db)
        .manage(db::DbState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .register_asynchronous_uri_scheme_protocol("media", |_ctx, request, responder| {
            std::thread::spawn(move || {
                let response = handle_media_request(&request);
                responder.respond(response);
            });
        })
        .invoke_handler(tauri::generate_handler![
            list_directory,
            read_file_content,
            get_file_metadata,
            get_file_entries,
            get_git_status,
            get_home_directory,
            read_image_base64,
            write_file,
            load_settings,
            save_settings,
            read_exif_data,
            generate_thumbnail,
            trash_items,
            move_items,
            copy_items,
            rename_item,
            create_folder,
            get_all_tags,
            create_tag,
            update_tag,
            delete_tag,
            tag_files,
            untag_files,
            get_tags_for_files,
            get_files_by_tag,
            get_all_sections,
            get_sections,
            create_section,
            update_section,
            delete_section,
            assign_files_to_section,
            remove_files_from_section,
            reorder_sections,
            search_files,
            get_index_stats,
            is_indexing,
            reindex,
            rebuild_trigrams,
            list_font_themes,
            load_font_theme,
            write_log,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app, event| {
            if let tauri::RunEvent::Exit = event {
                let db = indexer::IndexDb { conn: shutdown_db.clone(), read_conn: shutdown_read.clone(), indexing: shutdown_flag.clone() };
                db.save_shutdown_time();
            }
        });
}

fn handle_media_request(request: &http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
    let uri = request.uri().path();
    // URI path is /<encoded_path>
    let path_str = &uri[1..]; // skip leading /
    let decoded = urlencoding::decode(path_str).unwrap_or_default();
    let file_path = PathBuf::from(decoded.as_ref());

    if !file_path.exists() {
        return http::Response::builder()
            .status(404)
            .body(b"File not found".to_vec())
            .unwrap();
    }

    let mime = mime_from_path(&file_path);
    let file_size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);

    // Check for Range header (needed for video seeking)
    let range_header = request.headers()
        .get("range")
        .and_then(|v| v.to_str().ok())
        .map(String::from);

    if let Some(range) = range_header {
        let range = range.strip_prefix("bytes=").unwrap_or(&range);
        let parts: Vec<&str> = range.split('-').collect();
        let start: u64 = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
        let end: u64 = parts.get(1)
            .and_then(|s| if s.is_empty() { None } else { s.parse().ok() })
            .unwrap_or_else(|| (start + 1024 * 1024).min(file_size - 1)); // 1MB chunks

        let end = end.min(file_size - 1);
        let length = end - start + 1;

        let mut file = match std::fs::File::open(&file_path) {
            Ok(f) => f,
            Err(_) => return http::Response::builder().status(500).body(vec![]).unwrap(),
        };

        if file.seek(SeekFrom::Start(start)).is_err() {
            return http::Response::builder().status(500).body(vec![]).unwrap();
        }

        let mut buf = vec![0u8; length as usize];
        let bytes_read = file.read(&mut buf).unwrap_or(0);
        buf.truncate(bytes_read);

        http::Response::builder()
            .status(206)
            .header("content-type", &mime)
            .header("content-length", bytes_read.to_string())
            .header("content-range", format!("bytes {}-{}/{}", start, start + bytes_read as u64 - 1, file_size))
            .header("accept-ranges", "bytes")
            .body(buf)
            .unwrap()
    } else {
        // For small files, read entirely; for large ones, still support range on subsequent requests
        let data = std::fs::read(&file_path).unwrap_or_default();

        http::Response::builder()
            .status(200)
            .header("content-type", &mime)
            .header("content-length", data.len().to_string())
            .header("accept-ranges", "bytes")
            .body(data)
            .unwrap()
    }
}

fn mime_from_path(path: &PathBuf) -> String {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    match ext.as_str() {
        "mp4" | "m4v" => "video/mp4".to_string(),
        "mov" => "video/mp4".to_string(), // WebKit handles mp4 better than quicktime
        "webm" => "video/webm".to_string(),
        "avi" => "video/x-msvideo".to_string(),
        "mkv" => "video/x-matroska".to_string(),
        "mp3" => "audio/mpeg".to_string(),
        "wav" => "audio/wav".to_string(),
        "flac" => "audio/flac".to_string(),
        "ogg" => "audio/ogg".to_string(),
        "m4a" | "aac" => "audio/mp4".to_string(),
        "png" => "image/png".to_string(),
        "jpg" | "jpeg" => "image/jpeg".to_string(),
        "gif" => "image/gif".to_string(),
        "svg" => "image/svg+xml".to_string(),
        "webp" => "image/webp".to_string(),
        "heic" => "image/heic".to_string(),
        "pdf" => "application/pdf".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}
