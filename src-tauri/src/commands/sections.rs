use crate::db::DbState;
use crate::utils::errors::AppError;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SectionFile {
    pub file_path: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Section {
    pub id: i64,
    pub dir_path: String,
    pub name: String,
    pub color: String,
    pub sort_order: i32,
    pub collapsed: bool,
    pub hidden: bool,
    pub files: Vec<SectionFile>,
}

#[tauri::command]
pub fn get_all_sections(db: State<DbState>) -> Result<Vec<Section>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut sect_stmt = conn
        .prepare("SELECT id, dir_path, name, color, sort_order, collapsed, hidden FROM sections ORDER BY sort_order")
        .map_err(|e| AppError::Other(e.to_string()))?;
    let mut file_stmt = conn
        .prepare("SELECT file_path, sort_order FROM section_files WHERE section_id = ?1 ORDER BY sort_order")
        .map_err(|e| AppError::Other(e.to_string()))?;

    let sections = sect_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, bool>(6)?,
            ))
        })
        .map_err(|e| AppError::Other(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Other(e.to_string()))?;

    let mut result = Vec::new();
    for (id, dir_path, name, color, sort_order, collapsed, hidden) in sections {
        let files = file_stmt
            .query_map([id], |row| {
                Ok(SectionFile {
                    file_path: row.get(0)?,
                    sort_order: row.get(1)?,
                })
            })
            .map_err(|e| AppError::Other(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Other(e.to_string()))?;

        result.push(Section { id, dir_path, name, color, sort_order, collapsed, hidden, files });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_sections(db: State<DbState>, dir_path: String) -> Result<Vec<Section>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut sect_stmt = conn
        .prepare("SELECT id, dir_path, name, color, sort_order, collapsed, hidden FROM sections WHERE dir_path = ?1 ORDER BY sort_order")
        .map_err(|e| AppError::Other(e.to_string()))?;
    let mut file_stmt = conn
        .prepare("SELECT file_path, sort_order FROM section_files WHERE section_id = ?1 ORDER BY sort_order")
        .map_err(|e| AppError::Other(e.to_string()))?;

    let sections = sect_stmt
        .query_map([&dir_path], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, bool>(6)?,
            ))
        })
        .map_err(|e| AppError::Other(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Other(e.to_string()))?;

    let mut result = Vec::new();
    for (id, dir_path, name, color, sort_order, collapsed, hidden) in sections {
        let files = file_stmt
            .query_map([id], |row| {
                Ok(SectionFile {
                    file_path: row.get(0)?,
                    sort_order: row.get(1)?,
                })
            })
            .map_err(|e| AppError::Other(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Other(e.to_string()))?;

        result.push(Section { id, dir_path: dir_path.clone(), name, color, sort_order, collapsed, hidden, files });
    }

    Ok(result)
}

#[tauri::command]
pub fn create_section(db: State<DbState>, dir_path: String, name: String, color: String) -> Result<Section, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) FROM sections WHERE dir_path = ?1", [&dir_path], |row| row.get(0))
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO sections (dir_path, name, color, sort_order) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![dir_path, name, color, max_order + 1],
    )
    .map_err(|e| AppError::Other(e.to_string()))?;

    let id = conn.last_insert_rowid();
    Ok(Section {
        id,
        dir_path,
        name,
        color,
        sort_order: max_order + 1,
        collapsed: false,
        hidden: false,
        files: vec![],
    })
}

#[tauri::command]
pub fn update_section(
    db: State<DbState>,
    id: i64,
    name: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
    collapsed: Option<bool>,
    hidden: Option<bool>,
) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;

    if let Some(ref n) = name {
        conn.execute("UPDATE sections SET name = ?1 WHERE id = ?2", rusqlite::params![n, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(ref c) = color {
        conn.execute("UPDATE sections SET color = ?1 WHERE id = ?2", rusqlite::params![c, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(o) = sort_order {
        conn.execute("UPDATE sections SET sort_order = ?1 WHERE id = ?2", rusqlite::params![o, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(c) = collapsed {
        conn.execute("UPDATE sections SET collapsed = ?1 WHERE id = ?2", rusqlite::params![c, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(h) = hidden {
        conn.execute("UPDATE sections SET hidden = ?1 WHERE id = ?2", rusqlite::params![h, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_section(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    conn.execute("DELETE FROM section_files WHERE section_id = ?1", [id])
        .map_err(|e| AppError::Other(e.to_string()))?;
    conn.execute("DELETE FROM sections WHERE id = ?1", [id])
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn assign_files_to_section(db: State<DbState>, section_id: i64, paths: Vec<String>) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;

    // Remove from any other section in the same directory
    let dir_path: String = conn
        .query_row("SELECT dir_path FROM sections WHERE id = ?1", [section_id], |row| row.get(0))
        .map_err(|e| AppError::Other(e.to_string()))?;

    for path in &paths {
        conn.execute(
            "DELETE FROM section_files WHERE file_path = ?1 AND section_id IN (SELECT id FROM sections WHERE dir_path = ?2)",
            rusqlite::params![path, dir_path],
        )
        .map_err(|e| AppError::Other(e.to_string()))?;
    }

    // Get current max order in target section
    let max_order: i32 = conn
        .query_row("SELECT COALESCE(MAX(sort_order), 0) FROM section_files WHERE section_id = ?1", [section_id], |row| row.get(0))
        .unwrap_or(0);

    let mut stmt = conn
        .prepare("INSERT OR IGNORE INTO section_files (section_id, file_path, sort_order) VALUES (?1, ?2, ?3)")
        .map_err(|e| AppError::Other(e.to_string()))?;

    for (i, path) in paths.iter().enumerate() {
        stmt.execute(rusqlite::params![section_id, path, max_order + 1 + i as i32])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn remove_files_from_section(db: State<DbState>, section_id: i64, paths: Vec<String>) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("DELETE FROM section_files WHERE section_id = ?1 AND file_path = ?2")
        .map_err(|e| AppError::Other(e.to_string()))?;
    for path in &paths {
        stmt.execute(rusqlite::params![section_id, path])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn reorder_sections(db: State<DbState>, dir_path: String, section_ids: Vec<i64>) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("UPDATE sections SET sort_order = ?1 WHERE id = ?2 AND dir_path = ?3")
        .map_err(|e| AppError::Other(e.to_string()))?;
    for (i, id) in section_ids.iter().enumerate() {
        stmt.execute(rusqlite::params![i as i32, id, dir_path])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}
