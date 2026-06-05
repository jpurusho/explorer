use crate::indexer::{FileResult, IndexDb};
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
pub fn get_index_stats(index: State<IndexDb>) -> Result<(u64, u64), AppError> {
    Ok(index.get_stats())
}

#[tauri::command]
pub fn reindex(index: State<IndexDb>) -> Result<(), AppError> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    index.index_directory(std::path::Path::new(&home));
    Ok(())
}
