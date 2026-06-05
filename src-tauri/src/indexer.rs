use rusqlite::{Connection, params};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

const EXCLUDED_DIRS: &[&str] = &[
    ".git", "node_modules", "target", ".Trash", ".cache",
    "Library", ".npm", ".cargo",
    "__pycache__", ".venv", "venv", ".DS_Store",
    "bin", ".orbstack", ".docker",
    "Pods", "DerivedData", "Build",
];

pub struct IndexDb {
    pub conn: Arc<Mutex<Connection>>,       // Write connection (indexer)
    pub read_conn: Arc<Mutex<Connection>>,  // Read connection (search queries)
    pub indexing: Arc<std::sync::atomic::AtomicBool>,
}

impl IndexDb {
    pub fn new() -> Self {
        let db_path = get_index_db_path();
        fs::create_dir_all(db_path.parent().unwrap()).ok();

        // Write connection
        let conn = Connection::open(&db_path).expect("Failed to open index database");
        init_schema(&conn);

        // Separate read-only connection — never blocks on writer in WAL mode
        let read_conn = Connection::open_with_flags(
            &db_path,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ).expect("Failed to open read connection");
        read_conn.pragma_update(None, "journal_mode", "WAL").ok();

        // Check schema version — force rebuild if outdated
        let version: i64 = conn.query_row(
            "SELECT COALESCE((SELECT CAST(value AS INTEGER) FROM index_settings WHERE key='schema_version'), 0)",
            [], |row| row.get(0)
        ).unwrap_or(0);

        if version < 2 {
            // Schema v2: tighter exclusions + trigrams. Wipe and rebuild.
            conn.execute("DROP TRIGGER IF EXISTS files_ai", []).ok();
            conn.execute("DROP TRIGGER IF EXISTS files_ad", []).ok();
            conn.execute("DROP TRIGGER IF EXISTS files_au", []).ok();
            conn.execute("DELETE FROM files", []).ok();
            conn.execute("DELETE FROM trigrams", []).ok();
            conn.execute("DELETE FROM files_fts", []).ok();
            conn.execute_batch("
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
            ").ok();
            conn.execute("INSERT OR REPLACE INTO index_settings (key, value) VALUES ('schema_version', '2')", []).ok();
            conn.execute("VACUUM", []).ok();
        }

        IndexDb {
            conn: Arc::new(Mutex::new(conn)),
            read_conn: Arc::new(Mutex::new(read_conn)),
            indexing: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }

    pub fn is_indexing(&self) -> bool {
        self.indexing.load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn save_shutdown_time(&self) {
        let conn = self.conn.lock().unwrap();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        conn.execute(
            "INSERT OR REPLACE INTO index_settings (key, value) VALUES ('last_shutdown', ?1)",
            params![now.to_string()],
        ).ok();
    }

    pub fn get_last_shutdown(&self) -> Option<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM index_settings WHERE key = 'last_shutdown'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
    }

    pub fn seconds_since_shutdown(&self) -> i64 {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
        let last = self.get_last_shutdown().unwrap_or(0);
        if last == 0 { return i64::MAX; }
        now - last
    }

    pub fn incremental_sync(&self, root: &Path) {
        self.indexing.store(true, std::sync::atomic::Ordering::Relaxed);

        // 1. Remove stale entries (files that no longer exist)
        {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare("SELECT path FROM files").unwrap();
            let paths: Vec<String> = stmt.query_map([], |row| row.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();
            drop(stmt);

            let mut to_delete = Vec::new();
            for path in &paths {
                if !Path::new(path).exists() {
                    to_delete.push(path.clone());
                }
            }

            if !to_delete.is_empty() {
                conn.execute("BEGIN", []).ok();
                for path in &to_delete {
                    conn.execute("DELETE FROM files WHERE path = ?1", params![path]).ok();
                }
                conn.execute("COMMIT", []).ok();
            }
        }

        // 2. Walk filesystem and add/update only new or modified files
        let mut paths_to_check = vec![root.to_path_buf()];
        let mut count = 0u64;

        while let Some(path) = paths_to_check.pop() {
            let relative = path.strip_prefix(root).unwrap_or(&path);
            if should_exclude(relative) {
                continue;
            }

            {
                let conn = self.conn.lock().unwrap();
                conn.execute("BEGIN", []).ok();

                if path.is_dir() {
                    if let Ok(entries) = fs::read_dir(&path) {
                        for entry in entries.flatten() {
                            let child = entry.path();
                            let child_rel = child.strip_prefix(root).unwrap_or(&child);
                            if should_exclude(child_rel) {
                                continue;
                            }

                            // Check if file needs update
                            if needs_reindex(&conn, &child) {
                                index_single_path(&conn, &child);
                                count += 1;
                            }

                            if child.is_dir() {
                                paths_to_check.push(child);
                            }
                        }
                    }
                }

                conn.execute("COMMIT", []).ok();
            }

            if count % 1000 == 0 && count > 0 {
                std::thread::sleep(std::time::Duration::from_millis(1));
            }
        }

        self.indexing.store(false, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn search(&self, query: &str, limit: u32) -> Vec<FileResult> {
        use strsim::levenshtein;
        use std::collections::HashMap;

        let conn = self.read_conn.lock().unwrap();
        let q = query.trim().to_lowercase();

        // --- Layer 1: FTS5 prefix search ---
        let tokens: Vec<&str> = q.split(|c: char| c == '.' || c == ' ' || c == '-' || c == '_')
            .filter(|s| !s.is_empty())
            .collect();
        let fts_query = tokens.iter().map(|t| format!("{}*", t)).collect::<Vec<_>>().join(" ");

        let mut seen: HashMap<String, FileResult> = HashMap::new();

        if let Ok(mut stmt) = conn.prepare(
            "SELECT f.path, f.name, f.size_bytes, f.modified_at, f.is_dir
             FROM files_fts fts
             JOIN files f ON f.rowid = fts.rowid
             WHERE files_fts MATCH ?1
             ORDER BY rank
             LIMIT 100"
        ) {
            if let Ok(rows) = stmt.query_map(params![fts_query], |row| {
                Ok(FileResult {
                    path: row.get(0)?,
                    name: row.get(1)?,
                    size_bytes: row.get(2)?,
                    modified_at: row.get(3)?,
                    is_dir: row.get(4)?,
                })
            }) {
                for r in rows.flatten() {
                    seen.insert(r.path.clone(), r);
                }
            }
        }

        // --- Layer 2: Trigram candidate search (for typo tolerance) ---
        let tris = generate_trigrams(&q);
        if tris.len() >= 2 && seen.len() < limit as usize {
            let placeholders = tris.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT f.path, f.name, f.size_bytes, f.modified_at, f.is_dir
                 FROM trigrams t
                 JOIN files f ON f.path = t.path
                 WHERE t.trigram IN ({})
                 GROUP BY t.path
                 HAVING COUNT(*) >= ?
                 LIMIT 200",
                placeholders
            );

            if let Ok(mut stmt) = conn.prepare(&sql) {
                let min_matches = (tris.len() / 2).max(2);
                let mut idx = 1;
                for tri in &tris {
                    stmt.raw_bind_parameter(idx, tri.as_str()).ok();
                    idx += 1;
                }
                stmt.raw_bind_parameter(idx, min_matches as i64).ok();

                if let Ok(rows) = stmt.raw_query().mapped(|row| {
                    Ok(FileResult {
                        path: row.get(0)?,
                        name: row.get(1)?,
                        size_bytes: row.get(2)?,
                        modified_at: row.get(3)?,
                        is_dir: row.get(4)?,
                    })
                }).collect::<Result<Vec<_>, _>>() {
                    for r in rows {
                        seen.entry(r.path.clone()).or_insert(r);
                    }
                }
            }
        }

        // --- Layer 3: Levenshtein scoring ---
        let threshold = match q.len() {
            0..=4 => 1,
            5..=8 => 2,
            _ => 3,
        };

        let mut scored: Vec<(FileResult, usize)> = seen
            .into_values()
            .map(|f| {
                let name_lower = f.name.to_lowercase();
                // Use minimum of: full name distance, or prefix distance
                let dist = levenshtein(&q, &name_lower)
                    .min(levenshtein(&q, &name_lower.get(..q.len().min(name_lower.len())).unwrap_or(&name_lower)));
                (f, dist)
            })
            .filter(|(_, dist)| *dist <= threshold + 2) // slightly generous filter
            .collect();

        scored.sort_by_key(|(_, dist)| *dist);
        scored.into_iter().take(limit as usize).map(|(f, _)| f).collect()
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
        let conn = self.read_conn.lock().unwrap();
        let file_count: u64 = conn
            .query_row("SELECT COUNT(*) FROM files WHERE is_dir = 0", [], |row| row.get(0))
            .unwrap_or(0);
        let dir_count: u64 = conn
            .query_row("SELECT COUNT(*) FROM files WHERE is_dir = 1", [], |row| row.get(0))
            .unwrap_or(0);
        (file_count, dir_count)
    }

    pub fn get_detailed_stats(&self) -> IndexStats {
        let conn = self.read_conn.lock().unwrap();
        let file_count: u64 = conn.query_row("SELECT COUNT(*) FROM files WHERE is_dir = 0", [], |row| row.get(0)).unwrap_or(0);
        let dir_count: u64 = conn.query_row("SELECT COUNT(*) FROM files WHERE is_dir = 1", [], |row| row.get(0)).unwrap_or(0);
        let trigram_count: u64 = conn.query_row("SELECT COUNT(*) FROM trigrams", [], |row| row.get(0)).unwrap_or(0);
        let db_path = get_index_db_path();
        let db_size = fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
        IndexStats { file_count, dir_count, trigram_count, db_size_bytes: db_size }
    }

    pub fn rebuild_trigrams(&self) {
        self.indexing.store(true, std::sync::atomic::Ordering::Relaxed);
        let conn = self.conn.lock().unwrap();

        // Clear existing trigrams
        conn.execute("DELETE FROM trigrams", []).ok();

        // Rebuild from all file names
        let mut stmt = conn.prepare("SELECT path, name FROM files").unwrap();
        let rows: Vec<(String, String)> = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).unwrap().filter_map(|r| r.ok()).collect();
        drop(stmt);

        let _total = rows.len();
        let mut count = 0;
        conn.execute("BEGIN", []).ok();
        for (path, name) in &rows {
            index_trigrams(&conn, path, name);
            count += 1;
            if count % 10000 == 0 {
                conn.execute("COMMIT", []).ok();
                conn.execute("BEGIN", []).ok();
            }
        }
        conn.execute("COMMIT", []).ok();

        self.indexing.store(false, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn clear_and_reindex(&self, root: &Path) {
        {
            let conn = self.conn.lock().unwrap();
            // Drop triggers to avoid FTS overhead during bulk delete
            conn.execute("DROP TRIGGER IF EXISTS files_ai", []).ok();
            conn.execute("DROP TRIGGER IF EXISTS files_ad", []).ok();
            conn.execute("DROP TRIGGER IF EXISTS files_au", []).ok();
            conn.execute("DELETE FROM files", []).ok();
            conn.execute("DELETE FROM trigrams", []).ok();
            conn.execute("DELETE FROM files_fts", []).ok();
            // Recreate triggers
            conn.execute_batch("
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
            ").ok();
            conn.execute("VACUUM", []).ok();
        }
        self.index_directory(root);
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct IndexStats {
    pub file_count: u64,
    pub dir_count: u64,
    pub trigram_count: u64,
    pub db_size_bytes: u64,
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

        CREATE TABLE IF NOT EXISTS trigrams (
            trigram TEXT NOT NULL,
            path    TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
            PRIMARY KEY (trigram, path)
        );
        CREATE INDEX IF NOT EXISTS idx_trigram ON trigrams(trigram);

        CREATE TABLE IF NOT EXISTS index_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
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


fn generate_trigrams(s: &str) -> Vec<String> {
    let s = s.to_lowercase();
    let chars: Vec<char> = s.chars().collect();
    if chars.len() < 3 {
        return vec![s.clone()];
    }
    chars.windows(3).map(|w| w.iter().collect::<String>()).collect()
}

fn index_trigrams(conn: &Connection, path_str: &str, name: &str) {
    conn.execute("DELETE FROM trigrams WHERE path = ?1", params![path_str]).ok();
    let tris = generate_trigrams(name);
    for tri in &tris {
        conn.execute(
            "INSERT OR IGNORE INTO trigrams (trigram, path) VALUES (?1, ?2)",
            params![tri, path_str],
        ).ok();
    }
}

fn needs_reindex(conn: &Connection, path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let existing: Option<i64> = conn
        .query_row("SELECT modified_at FROM files WHERE path = ?1", params![path_str.as_ref()], |row| row.get(0))
        .ok();

    match existing {
        None => true, // Not in index
        Some(indexed_mtime) => {
            // Check if file was modified since last index
            let current_mtime = fs::metadata(path).ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);
            current_mtime > indexed_mtime
        }
    }
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

    let path_str = path.to_string_lossy().to_string();
    conn.execute(
        "INSERT OR REPLACE INTO files (path, name, extension, size_bytes, modified_at, is_dir, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            path_str,
            name,
            extension,
            size_bytes,
            modified_at,
            is_dir,
            now
        ],
    ).ok();

    // Index trigrams for fuzzy search
    index_trigrams(conn, &path_str, &name);
}
