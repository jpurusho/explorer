use crate::db::DbState;
use crate::utils::errors::AppError;
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i32,
}

#[tauri::command]
pub fn get_all_tags(db: State<DbState>) -> Result<Vec<Tag>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT id, name, color, sort_order FROM tags ORDER BY sort_order, name")
        .map_err(|e| AppError::Other(e.to_string()))?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                sort_order: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Other(e.to_string()))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(db: State<DbState>, name: String, color: String) -> Result<Tag, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        rusqlite::params![name, color],
    )
    .map_err(|e| AppError::Other(e.to_string()))?;
    let id = conn.last_insert_rowid();
    Ok(Tag { id, name, color, sort_order: 0 })
}

#[tauri::command]
pub fn update_tag(
    db: State<DbState>,
    id: i64,
    name: Option<String>,
    color: Option<String>,
    sort_order: Option<i32>,
) -> Result<Tag, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;

    if let Some(ref n) = name {
        conn.execute("UPDATE tags SET name = ?1 WHERE id = ?2", rusqlite::params![n, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(ref c) = color {
        conn.execute("UPDATE tags SET color = ?1 WHERE id = ?2", rusqlite::params![c, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    if let Some(o) = sort_order {
        conn.execute("UPDATE tags SET sort_order = ?1 WHERE id = ?2", rusqlite::params![o, id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }

    let tag = conn
        .query_row("SELECT id, name, color, sort_order FROM tags WHERE id = ?1", [id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                sort_order: row.get(3)?,
            })
        })
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(tag)
}

#[tauri::command]
pub fn delete_tag(db: State<DbState>, id: i64) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    conn.execute("DELETE FROM file_tags WHERE tag_id = ?1", [id])
        .map_err(|e| AppError::Other(e.to_string()))?;
    conn.execute("DELETE FROM tags WHERE id = ?1", [id])
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn tag_files(db: State<DbState>, paths: Vec<String>, tag_id: i64) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("INSERT OR IGNORE INTO file_tags (file_path, tag_id) VALUES (?1, ?2)")
        .map_err(|e| AppError::Other(e.to_string()))?;
    for path in &paths {
        stmt.execute(rusqlite::params![path, tag_id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn untag_files(db: State<DbState>, paths: Vec<String>, tag_id: i64) -> Result<(), AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("DELETE FROM file_tags WHERE file_path = ?1 AND tag_id = ?2")
        .map_err(|e| AppError::Other(e.to_string()))?;
    for path in &paths {
        stmt.execute(rusqlite::params![path, tag_id])
            .map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_tags_for_files(
    db: State<DbState>,
    paths: Vec<String>,
) -> Result<HashMap<String, Vec<Tag>>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut result: HashMap<String, Vec<Tag>> = HashMap::new();

    if paths.is_empty() {
        return Ok(result);
    }

    let placeholders: String = paths.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT ft.file_path, t.id, t.name, t.color, t.sort_order
         FROM file_tags ft JOIN tags t ON ft.tag_id = t.id
         WHERE ft.file_path IN ({})
         ORDER BY t.sort_order, t.name",
        placeholders
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| AppError::Other(e.to_string()))?;
    let params: Vec<&dyn rusqlite::types::ToSql> = paths.iter().map(|p| p as &dyn rusqlite::types::ToSql).collect();
    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                Tag {
                    id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                    sort_order: row.get(4)?,
                },
            ))
        })
        .map_err(|e| AppError::Other(e.to_string()))?;

    for row in rows {
        let (path, tag) = row.map_err(|e| AppError::Other(e.to_string()))?;
        result.entry(path).or_default().push(tag);
    }

    Ok(result)
}

#[tauri::command]
pub fn get_files_by_tag(db: State<DbState>, tag_id: i64) -> Result<Vec<String>, AppError> {
    let conn = db.conn.lock().map_err(|e| AppError::Other(e.to_string()))?;
    let mut stmt = conn
        .prepare("SELECT file_path FROM file_tags WHERE tag_id = ?1")
        .map_err(|e| AppError::Other(e.to_string()))?;
    let paths = stmt
        .query_map([tag_id], |row| row.get(0))
        .map_err(|e| AppError::Other(e.to_string()))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(paths)
}
