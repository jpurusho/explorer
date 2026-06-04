use crate::models::settings::{config_file_path, config_dir, AppSettings};
use crate::utils::errors::AppError;
use std::fs;

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
