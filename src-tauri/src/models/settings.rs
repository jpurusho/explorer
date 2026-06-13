use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub theme: String,
    pub default_view: String,
    pub show_hidden_files: bool,
    pub sort_by: String,
    pub sort_direction: String,
    pub sidebar_width: u32,
    pub preview_width: u32,
    pub favorites: Vec<String>,
    pub recent_paths: Vec<String>,
    pub show_row_lines: bool,
    pub column_name_width: u32,
    pub column_type_width: u32,
    pub column_size_width: u32,
    pub column_modified_width: u32,
    pub column_type_visible: bool,
    pub column_size_visible: bool,
    pub column_modified_visible: bool,
    pub font_theme: String,
    pub index_paths: Vec<String>,
    // Sidebar section visibility + layout
    pub show_favorites_section: bool,
    pub show_folders_section: bool,
    pub show_tags_section: bool,
    pub show_snippets_section: bool,
    pub favorites_height: u32,
    pub folders_height: u32,
    pub tags_height: u32,
    pub preview_max_mb: u32,
    pub grid_card_size: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        let home = dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());

        Self {
            theme: "system".to_string(),
            default_view: "list".to_string(),
            show_hidden_files: false,
            sort_by: "name".to_string(),
            sort_direction: "asc".to_string(),
            sidebar_width: 240,
            preview_width: 420,
            favorites: vec![
                home.clone(),
                format!("{}/Documents", home),
                format!("{}/Downloads", home),
                format!("{}/Desktop", home),
            ],
            recent_paths: vec![],
            show_row_lines: false,
            column_name_width: 300,
            column_type_width: 50,
            column_size_width: 58,
            column_modified_width: 90,
            column_type_visible: true,
            column_size_visible: true,
            column_modified_visible: true,
            font_theme: "default".to_string(),
            index_paths: vec![],
            show_favorites_section: true,
            show_folders_section: true,
            show_tags_section: true,
            show_snippets_section: true,
            favorites_height: 140,
            folders_height: 300,
            tags_height: 200,
            preview_max_mb: 5,
            grid_card_size: 175,
        }
    }
}

use std::path::PathBuf;

pub fn config_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    let dir = home.join(".config").join("explorer");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn config_file_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn themes_dir() -> PathBuf {
    let dir = config_dir().join("themes");
    std::fs::create_dir_all(&dir).ok();
    dir
}

mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        directories::UserDirs::new().map(|d| d.home_dir().to_path_buf())
    }
}
