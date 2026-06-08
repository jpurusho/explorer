use crate::models::settings::config_dir;
use chrono::Local;
use std::fs;
use std::io::Write;

pub fn app_log(level: &str, message: &str) {
    let dir = config_dir();
    let log_path = dir.join("explorer.log");

    // Rotate if > 10MB
    if let Ok(meta) = fs::metadata(&log_path) {
        if meta.len() > 10 * 1024 * 1024 {
            let rotated = dir.join("explorer.log.1");
            fs::rename(&log_path, &rotated).ok();
        }
    }

    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let line = format!("[{}] [{}] {}\n", timestamp, level, message);

    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        file.write_all(line.as_bytes()).ok();
    }
}

#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::utils::log::app_log("INFO", &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::utils::log::app_log("ERROR", &format!($($arg)*));
    };
}

#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::utils::log::app_log("DEBUG", &format!($($arg)*));
    };
}
