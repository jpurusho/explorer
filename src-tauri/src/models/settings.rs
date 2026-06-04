use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub default_view: String,
    pub show_hidden_files: bool,
    pub sort_by: String,
    pub sort_direction: String,
    pub sidebar_width: u32,
    pub favorites: Vec<String>,
    pub recent_paths: Vec<String>,
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
            favorites: vec![
                home.clone(),
                format!("{}/Documents", home),
                format!("{}/Downloads", home),
                format!("{}/Desktop", home),
            ],
            recent_paths: vec![],
        }
    }
}

use directories::ProjectDirs;
use std::path::PathBuf;

pub fn config_dir() -> PathBuf {
    if let Some(proj) = ProjectDirs::from("com", "jpurshot", "explorer") {
        proj.config_dir().to_path_buf()
    } else {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
        home.join(".explorer")
    }
}

pub fn config_file_path() -> PathBuf {
    config_dir().join("config.json")
}

mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        directories::UserDirs::new().map(|d| d.home_dir().to_path_buf())
    }
}
