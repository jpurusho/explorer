use rusqlite::{Connection, params};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::fs;
use std::time::SystemTime;

const EXCLUDED_DIRS: &[&str] = &[
    ".git", "node_modules", "target", ".Trash", ".cache",
    "Library/Caches", "Library/Logs", ".npm", ".cargo/registry",
    "__pycache__", ".venv", "venv", ".DS_Store",
];

pub struct IndexDb {
    pub conn: Arc<Mutex<Connection>>,
    pub indexing: Arc<std::sync::atomic::AtomicBool>,
}

impl IndexDb {
    pub fn new() -> Self {
        let db_path = get_index_db_path();
        fs::create_dir_all(db_path.parent().unwrap()).ok();
        let conn = Connection::open(&db_path).expect("Failed to open index database");
        init_schema(&conn);
        IndexDb {
            conn: Arc::new(Mutex::new(conn)),
            indexing: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub fn is_indexing(&self) -> bool {
        self.indexing.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn search(&self, query: &str, limit: u32) -> Vec<FileResult> {
        let conn = self.conn.lock().unwrap();
        // Split on dots, spaces, dashes, underscores — add wildcard to each token
        let tokens: Vec<&str> = query.split(|c: char| c == '.' || c == ' ' || c == '-' || c == '_')
            .filter(|s| !s.is_empty())
            .collect();
        let fts_query = tokens.iter().map(|t| format!("{}*", t)).collect::<Vec<_>>().join(" ");
        let mut stmt = conn
            .prepare(
                "SELECT f.path, f.name, f.size_bytes, f.modified_at, f.is_dir
                 FROM files_fts fts
                 JOIN files f ON f.rowid = fts.rowid
                 WHERE files_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2"
            )
            .unwrap();

        stmt.query_map(params![fts_query, limit], |row| {
            Ok(FileResult {
                path: row.get(0)?,
                name: row.get(1)?,
                size_bytes: row.get(2)?,
                modified_at: row.get(3)?,
                is_dir: row.get(4)?,
            })
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    pub fn index_directory(&self, root: &Path) {
        self.indexing.store(true, std::sync::atomic::Ordering::Relaxed);
        let mut count = 0u64;
        let mut paths_to_index = vec![root.to_path_buf()];

        while let Some(path) = paths_to_index.pop() {
            let relative = path.strip_prefix(root).unwrap_or(&path);
            if should_exclude(relative) {
                continue;
            }

            // Lock briefly for a batch of inserts
            {
                let conn = self.conn.lock().unwrap();
                conn.execute("BEGIN", []).ok();

                index_single_path(&conn, &path);
                count += 1;

                // Index immediate children
                if path.is_dir() {
                    if let Ok(entries) = fs::read_dir(&path) {
                        for entry in entries.flatten() {
                            let child = entry.path();
                            let child_rel = child.strip_prefix(root).unwrap_or(&child);
                            if should_exclude(child_rel) {
                                continue;
                            }
                            index_single_path(&conn, &child);
                            count += 1;
                            if child.is_dir() {
                                paths_to_index.push(child);
                            }
                        }
                    }
                }

                conn.execute("COMMIT", []).ok();
            }
            // Lock released here — search queries can run between batches

            // Small yield every 1000 items to not starve other threads
            if count % 1000 == 0 {
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        }
        self.indexing.store(false, std::sync::atomic::Ordering::Relaxed);
    }

    #[allow(dead_code)]
    pub fn upsert_path(&self, path: &Path) {
        let conn = self.conn.lock().unwrap();
        index_single_path(&conn, path);
    }

    #[allow(dead_code)]
    pub fn remove_path(&self, path: &Path) {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM files WHERE path = ?1", params![path.to_string_lossy().as_ref()])
            .ok();
    }

    pub fn get_stats(&self) -> (u64, u64) {
        let conn = self.conn.lock().unwrap();
        let file_count: u64 = conn
            .query_row("SELECT COUNT(*) FROM files WHERE is_dir = 0", [], |row| row.get(0))
            .unwrap_or(0);
        let dir_count: u64 = conn
            .query_row("SELECT COUNT(*) FROM files WHERE is_dir = 1", [], |row| row.get(0))
            .unwrap_or(0);
        (file_count, dir_count)
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct FileResult {
    pub path: String,
    pub name: String,
    pub size_bytes: i64,
    pub modified_at: i64,
    pub is_dir: bool,
}

fn get_index_db_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(&home).join(".config").join("explorer").join("index.db")
}

fn init_schema(conn: &Connection) {
    conn.pragma_update(None, "journal_mode", "WAL").ok();
    conn.pragma_update(None, "synchronous", "NORMAL").ok();
    conn.pragma_update(None, "cache_size", "-65536").ok();
    conn.pragma_update(None, "temp_store", "MEMORY").ok();
    conn.pragma_update(None, "mmap_size", "536870912").ok();

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS files (
            path         TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            extension    TEXT,
            size_bytes   INTEGER NOT NULL DEFAULT 0,
            modified_at  INTEGER NOT NULL DEFAULT 0,
            is_dir       INTEGER NOT NULL DEFAULT 0,
            indexed_at   INTEGER NOT NULL DEFAULT 0
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
            name, path, extension,
            content='files',
            content_rowid='rowid'
        );

        CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
            INSERT INTO files_fts(rowid, name, path, extension)
            VALUES (new.rowid, new.name, new.path, new.extension);
        END;

        CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path, extension)
            VALUES ('delete', old.rowid, old.name, old.path, old.extension);
        END;

        CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
            INSERT INTO files_fts(files_fts, rowid, name, path, extension)
            VALUES ('delete', old.rowid, old.name, old.path, old.extension);
            INSERT INTO files_fts(rowid, name, path, extension)
            VALUES (new.rowid, new.name, new.path, new.extension);
        END;

        CREATE INDEX IF NOT EXISTS idx_ext ON files(extension);
        CREATE INDEX IF NOT EXISTS idx_modified ON files(modified_at);
    ").expect("Failed to initialize index schema");
}

fn should_exclude(path: &Path) -> bool {
    for component in path.components() {
        let name = component.as_os_str().to_string_lossy();
        if EXCLUDED_DIRS.iter().any(|e| name.as_ref() == *e) {
            return true;
        }
        if name.starts_with('.') && name.len() > 1 && name != ".config" {
            return true;
        }
    }
    false
}


fn index_single_path(conn: &Connection, path: &Path) {
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return,
    };

    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let extension = path.extension().map(|e| e.to_string_lossy().to_string());
    let size_bytes = if metadata.is_dir() { 0 } else { metadata.len() as i64 };
    let modified_at = metadata.modified().ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let is_dir = metadata.is_dir();
    let now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as i64;

    conn.execute(
        "INSERT OR REPLACE INTO files (path, name, extension, size_bytes, modified_at, is_dir, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            path.to_string_lossy().as_ref(),
            name,
            extension,
            size_bytes,
            modified_at,
            is_dir,
            now
        ],
    ).ok();
}
