use crate::models::settings::{config_file_path, config_dir, themes_dir, AppSettings};
use crate::utils::errors::AppError;
use chrono::Local;
use serde_json::Value;
use std::fs;
use std::io::Write;

#[tauri::command]
pub async fn load_settings() -> Result<AppSettings, AppError> {
    let path = config_file_path();

    if !path.exists() {
        let settings = AppSettings::default();
        // Create config dir and save defaults
        let dir = config_dir();
        fs::create_dir_all(&dir)?;
        let json = serde_json::to_string_pretty(&settings)?;
        fs::write(&path, json)?;
        return Ok(settings);
    }

    let content = fs::read_to_string(&path)?;
    let settings: AppSettings = serde_json::from_str(&content).unwrap_or_default();
    Ok(settings)
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), AppError> {
    let dir = config_dir();
    fs::create_dir_all(&dir)?;

    let path = config_file_path();
    let json = serde_json::to_string_pretty(&settings)?;
    fs::write(&path, json)?;
    Ok(())
}

#[tauri::command]
pub async fn list_font_themes() -> Result<Vec<Value>, AppError> {
    let dir = themes_dir();
    let mut themes = Vec::new();

    if dir.exists() {
        for entry in fs::read_dir(&dir).map_err(|e| AppError::Io(e))? {
            let entry = entry.map_err(|e| AppError::Io(e))?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<Value>(&content) {
                        themes.push(val);
                    }
                }
            }
        }
    }

    Ok(themes)
}

#[tauri::command]
pub async fn load_font_theme(name: String) -> Result<Value, AppError> {
    let dir = themes_dir();
    let path = dir.join(format!("{}.json", name.to_lowercase()));

    if !path.exists() {
        return Err(AppError::NotFound(format!("Theme not found: {}", name)));
    }

    let content = fs::read_to_string(&path)?;
    let val: Value = serde_json::from_str(&content)
        .map_err(|e| AppError::Other(format!("Invalid theme JSON: {}", e)))?;
    Ok(val)
}

#[tauri::command]
pub async fn write_log(level: String, message: String) -> Result<(), AppError> {
    let dir = config_dir();
    let log_path = dir.join("explorer.log");

    // Rotate if > 500MB
    if let Ok(meta) = fs::metadata(&log_path) {
        if meta.len() > 500 * 1024 * 1024 {
            let rotated = dir.join("explorer.log.1");
            fs::rename(&log_path, &rotated).ok();
        }
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let line = format!("[{}] [{}] {}\n", timestamp, level.to_uppercase(), message);

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}
