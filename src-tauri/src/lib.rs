mod commands;
mod db;
mod indexer;
mod models;
mod utils;

use commands::archive::{list_archive_contents, extract_archive};
use commands::file_ops::{copy_items, create_folder, duplicate_items, move_items, rename_item, trash_items};
use commands::preview::{convert_document_to_pdf, generate_document_preview, get_document_page_count};
use commands::search::{search_files, get_index_stats, is_indexing, reindex, rebuild_trigrams};
use commands::filesystem::{generate_thumbnail, get_file_entries, get_file_metadata, get_git_status, get_home_directory, list_directory, read_exif_data, read_file_content, read_image_base64, write_file};
use commands::settings::{load_settings, save_settings, list_font_themes, load_font_theme, write_log};
use commands::tags::{get_all_tags, create_tag, update_tag, delete_tag, tag_files, untag_files, get_tags_for_files, get_files_by_tag};
use commands::watcher::{watch_directory, unwatch_directory, WatcherState};
use std::path::PathBuf;
use std::io::{Read, Seek, SeekFrom};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let index_db = indexer::IndexDb::new();

    let (file_count, _) = index_db.get_stats();
    let needs_rebuild = index_db.needs_rebuild();
    let _gap_seconds = index_db.seconds_since_shutdown();
    let index_conn = index_db.conn.clone();
    let index_read = index_db.read_conn.clone();
    let index_flag = index_db.indexing.clone();
    std::thread::spawn(move || {
        let db = indexer::IndexDb { conn: index_conn, read_conn: index_read, indexing: index_flag };
        let roots = crate::commands::search::get_index_roots_from_settings();
        if needs_rebuild || file_count == 0 {
            db.clear_and_reindex_paths(&roots);
        } else {
            for root in &roots {
                db.incremental_sync(std::path::Path::new(root));
            }
        }
    });

    // Save shutdown time on app exit
    let shutdown_db = index_db.conn.clone();
    let shutdown_read = index_db.read_conn.clone();
    let shutdown_flag = index_db.indexing.clone();

    log_info!("Explorer app starting");

    tauri::Builder::default()
        .manage(index_db)
        .manage(db::DbState::new())
        .manage(WatcherState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            duplicate_items,
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
            search_files,
            get_index_stats,
            is_indexing,
            reindex,
            rebuild_trigrams,
            list_font_themes,
            load_font_theme,
            write_log,
            watch_directory,
            unwatch_directory,
            list_archive_contents,
            extract_archive,
            convert_document_to_pdf,
            generate_document_preview,
            get_document_page_count,
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
    let path_str = match uri.strip_prefix('/') {
        Some(s) => s,
        None => return http::Response::builder().status(400).body(b"Invalid path".to_vec()).unwrap_or_default(),
    };
    let decoded = urlencoding::decode(path_str).unwrap_or_default();
    let file_path = PathBuf::from(decoded.as_ref());

    if !file_path.exists() {
        return http::Response::builder().status(404).body(b"File not found".to_vec()).unwrap_or_default();
    }

    let mime = mime_from_path(&file_path);
    let file_size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);

    if file_size == 0 {
        return http::Response::builder()
            .status(200)
            .header("content-type", &mime)
            .header("content-length", "0")
            .body(vec![])
            .unwrap_or_default();
    }

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
            .unwrap_or_else(|| (start + 1024 * 1024).min(file_size.saturating_sub(1)));

        let end = end.min(file_size.saturating_sub(1));
        let length = end - start + 1;

        let mut file = match std::fs::File::open(&file_path) {
            Ok(f) => f,
            Err(_) => return http::Response::builder().status(500).body(vec![]).unwrap_or_default(),
        };

        if file.seek(SeekFrom::Start(start)).is_err() {
            return http::Response::builder().status(500).body(vec![]).unwrap_or_default();
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
            .unwrap_or_default()
    } else {
        let data = std::fs::read(&file_path).unwrap_or_default();

        http::Response::builder()
            .status(200)
            .header("content-type", &mime)
            .header("content-length", data.len().to_string())
            .header("accept-ranges", "bytes")
            .body(data)
            .unwrap_or_default()
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
        "doc" => "application/msword".to_string(),
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
        "ppt" => "application/vnd.ms-powerpoint".to_string(),
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation".to_string(),
        "xls" => "application/vnd.ms-excel".to_string(),
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
        "key" => "application/x-iwork-keynote-sffkey".to_string(),
        "pages" => "application/x-iwork-pages-sffpages".to_string(),
        "numbers" => "application/x-iwork-numbers-sffnumbers".to_string(),
        "rtf" => "application/rtf".to_string(),
        _ => "application/octet-stream".to_string(),
    }
}
