use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new() -> Self {
        let db_path = get_db_path();
        std::fs::create_dir_all(db_path.parent().unwrap()).ok();
        let conn = Connection::open(&db_path).expect("Failed to open database");
        run_migrations(&conn);
        DbState {
            conn: Mutex::new(conn),
        }
    }
}

fn get_db_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let config_dir = PathBuf::from(&home).join(".config").join("explorer");
    std::fs::create_dir_all(&config_dir).ok();
    config_dir.join("explorer.db")
}

fn run_migrations(conn: &Connection) {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#6366f1',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS file_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(file_path, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_file_tags_path ON file_tags(file_path);
        CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);

        CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dir_path TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#6366f1',
            sort_order INTEGER NOT NULL DEFAULT 0,
            collapsed INTEGER NOT NULL DEFAULT 0,
            hidden INTEGER NOT NULL DEFAULT 0,
            UNIQUE(dir_path, name)
        );

        CREATE INDEX IF NOT EXISTS idx_sections_dir ON sections(dir_path);

        CREATE TABLE IF NOT EXISTS section_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            UNIQUE(section_id, file_path)
        );

        CREATE INDEX IF NOT EXISTS idx_section_files_section ON section_files(section_id);
        CREATE INDEX IF NOT EXISTS idx_section_files_path ON section_files(file_path);

        PRAGMA journal_mode=WAL;
    ").expect("Failed to run migrations");
}
