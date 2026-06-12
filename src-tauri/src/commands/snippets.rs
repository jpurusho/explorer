use crate::utils::errors::AppError;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Snippet storage tier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SnippetTier {
    Local,
    Secret,
    Public,
}

impl SnippetTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            SnippetTier::Local => "local",
            SnippetTier::Secret => "secret",
            SnippetTier::Public => "public",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, AppError> {
        match s {
            "local" => Ok(SnippetTier::Local),
            "secret" => Ok(SnippetTier::Secret),
            "public" => Ok(SnippetTier::Public),
            _ => Err(AppError::Other(format!("Unknown tier: {}", s))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub tier: SnippetTier,
    pub gist_id: Option<String>,
    pub language: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Root directory for all snippet storage: ~/.explorer/snippets/
pub fn snippets_root() -> Result<PathBuf, AppError> {
    let dirs = directories::ProjectDirs::from("com", "explorer", "Explorer")
        .ok_or_else(|| AppError::Other("Could not determine project dir".to_string()))?;
    let root = dirs.data_dir().join("snippets");
    std::fs::create_dir_all(&root)?;
    Ok(root)
}

/// Path to the snippet's file on disk. For local: snippets/local/<title>.
/// For gists: snippets/gists/<gist-id>/<filename>.
pub fn snippet_path(snippet: &Snippet) -> Result<PathBuf, AppError> {
    let root = snippets_root()?;
    match snippet.tier {
        SnippetTier::Local => {
            let local_dir = root.join("local");
            std::fs::create_dir_all(&local_dir)?;
            Ok(local_dir.join(&snippet.title))
        }
        SnippetTier::Secret | SnippetTier::Public => {
            let gist_id = snippet
                .gist_id
                .as_ref()
                .ok_or_else(|| AppError::Other("Gist tier requires gist_id".to_string()))?;
            let gist_dir = root.join("gists").join(gist_id);
            std::fs::create_dir_all(&gist_dir)?;
            // Gist may contain multiple files; we use the first matching the title.
            // For now assume single-file gists.
            Ok(gist_dir.join(&snippet.title))
        }
    }
}

/// Initialize the snippets table in the tags.db SQLite file (reusing existing DB).
pub fn init_snippets_table(conn: &Connection) -> Result<(), AppError> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            tier TEXT NOT NULL,
            gist_id TEXT,
            language TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// List all snippets from the DB.
#[tauri::command]
pub async fn list_snippets(db_path: String) -> Result<Vec<Snippet>, AppError> {
    let conn = Connection::open(&db_path)?;
    init_snippets_table(&conn)?;

    let mut stmt = conn.prepare(
        "SELECT id, title, tier, gist_id, language, created_at, updated_at FROM snippets ORDER BY updated_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            title: row.get(1)?,
            tier: SnippetTier::from_str(&row.get::<_, String>(2)?).unwrap_or(SnippetTier::Local),
            gist_id: row.get(3)?,
            language: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let mut snippets = Vec::new();
    for row in rows {
        snippets.push(row?);
    }
    Ok(snippets)
}

/// Create a new snippet in the specified tier. Returns the created snippet.
#[tauri::command]
pub async fn create_snippet(
    db_path: String,
    title: String,
    tier: SnippetTier,
    content: String,
    language: Option<String>,
) -> Result<Snippet, AppError> {
    let conn = Connection::open(&db_path)?;
    init_snippets_table(&conn)?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let gist_id: Option<String> = None; // Will be set when we push to GitHub

    let snippet = Snippet {
        id: id.clone(),
        title: title.clone(),
        tier: tier.clone(),
        gist_id,
        language,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    conn.execute(
        "INSERT INTO snippets (id, title, tier, gist_id, language, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            &snippet.id,
            &snippet.title,
            snippet.tier.as_str(),
            &snippet.gist_id,
            &snippet.language,
            &snippet.created_at,
            &snippet.updated_at,
        ],
    )?;

    // Write the content to disk
    let path = snippet_path(&snippet)?;
    std::fs::write(&path, content)?;

    Ok(snippet)
}

/// Delete a snippet (removes from DB and disk).
#[tauri::command]
pub async fn delete_snippet(db_path: String, id: String) -> Result<(), AppError> {
    let conn = Connection::open(&db_path)?;
    init_snippets_table(&conn)?;

    // Fetch to get the path
    let mut stmt = conn.prepare("SELECT id, title, tier, gist_id, language, created_at, updated_at FROM snippets WHERE id = ?1")?;
    let snippet: Snippet = stmt.query_row([&id], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            title: row.get(1)?,
            tier: SnippetTier::from_str(&row.get::<_, String>(2)?).unwrap_or(SnippetTier::Local),
            gist_id: row.get(3)?,
            language: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    // Delete from disk
    let path = snippet_path(&snippet)?;
    if path.exists() {
        if path.is_dir() {
            std::fs::remove_dir_all(&path)?;
        } else {
            std::fs::remove_file(&path)?;
        }
    }

    // Delete from DB
    conn.execute("DELETE FROM snippets WHERE id = ?1", [&id])?;

    Ok(())
}

/// Update a snippet's content (writes to disk, updates updated_at in DB).
#[tauri::command]
pub async fn update_snippet_content(
    db_path: String,
    id: String,
    content: String,
) -> Result<(), AppError> {
    let conn = Connection::open(&db_path)?;
    init_snippets_table(&conn)?;

    let mut stmt = conn.prepare("SELECT id, title, tier, gist_id, language, created_at, updated_at FROM snippets WHERE id = ?1")?;
    let snippet: Snippet = stmt.query_row([&id], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            title: row.get(1)?,
            tier: SnippetTier::from_str(&row.get::<_, String>(2)?).unwrap_or(SnippetTier::Local),
            gist_id: row.get(3)?,
            language: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
        })
    })?;

    let path = snippet_path(&snippet)?;
    std::fs::write(&path, content)?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE snippets SET updated_at = ?1 WHERE id = ?2",
        params![now, &id],
    )?;

    Ok(())
}
