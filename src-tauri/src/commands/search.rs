use crate::commands::snippets::snippets_root;
use crate::indexer::{FileResult, IndexDb, IndexStats};
use crate::models::settings::config_file_path;
use crate::utils::errors::AppError;
use tauri::State;

pub fn get_index_roots_from_settings() -> Vec<String> {
    let mut roots = if let Ok(content) = std::fs::read_to_string(config_file_path()) {
        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(paths) = settings.get("index_paths").and_then(|v| v.as_array()) {
                let custom: Vec<String> = paths.iter()
                    .filter_map(|p| p.as_str().map(String::from))
                    .filter(|p| !p.is_empty())
                    .collect();
                if !custom.is_empty() {
                    custom
                } else {
                    vec![std::env::var("HOME").unwrap_or_else(|_| "/".to_string())]
                }
            } else {
                vec![std::env::var("HOME").unwrap_or_else(|_| "/".to_string())]
            }
        } else {
            vec![std::env::var("HOME").unwrap_or_else(|_| "/".to_string())]
        }
    } else {
        vec![std::env::var("HOME").unwrap_or_else(|_| "/".to_string())]
    };

    // Always include snippets directory in the index
    if let Ok(snippets_path) = snippets_root() {
        if let Some(snippets_str) = snippets_path.to_str() {
            roots.push(snippets_str.to_string());
        }
    }

    roots
}

#[tauri::command]
pub fn search_files(query: String, limit: Option<u32>, index: State<IndexDb>) -> Result<Vec<FileResult>, AppError> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    Ok(index.search(&query, limit.unwrap_or(100)))
}

#[tauri::command]
pub fn get_index_stats(index: State<IndexDb>) -> Result<IndexStats, AppError> {
    Ok(index.get_detailed_stats())
}

#[tauri::command]
pub fn is_indexing(index: State<IndexDb>) -> Result<bool, AppError> {
    Ok(index.is_indexing())
}

#[tauri::command]
pub fn reindex(index: State<IndexDb>) -> Result<(), AppError> {
    let roots = get_index_roots_from_settings();
    let index_clone = IndexDb { conn: index.conn.clone(), read_conn: index.read_conn.clone(), indexing: index.indexing.clone() };
    std::thread::spawn(move || {
        index_clone.clear_and_reindex_paths(&roots);
    });
    Ok(())
}

#[tauri::command]
pub fn rebuild_trigrams(index: State<IndexDb>) -> Result<(), AppError> {
    let index_clone = IndexDb { conn: index.conn.clone(), read_conn: index.read_conn.clone(), indexing: index.indexing.clone() };
    std::thread::spawn(move || {
        index_clone.rebuild_trigrams();
    });
    Ok(())
}
