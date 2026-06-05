use crate::indexer::{FileResult, IndexDb, IndexStats};
use crate::utils::errors::AppError;
use tauri::State;

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
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    let index_clone = IndexDb { conn: index.conn.clone(), read_conn: index.read_conn.clone(), indexing: index.indexing.clone() };
    std::thread::spawn(move || {
        index_clone.clear_and_reindex(std::path::Path::new(&home));
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
