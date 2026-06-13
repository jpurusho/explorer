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

/// Root directory for all snippet storage: ~/.config/explorer/snippets/
pub fn snippets_root() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/tmp".to_string());
    let root = PathBuf::from(&home).join(".config").join("explorer").join("snippets");
    std::fs::create_dir_all(&root)?;
    Ok(root)
}

/// Old snippet root (pre-v1.7.10): ~/Library/Application Support/com.explorer.Explorer/snippets/
fn old_snippets_root() -> Option<PathBuf> {
    directories::ProjectDirs::from("com", "explorer", "Explorer")
        .map(|dirs| dirs.data_dir().join("snippets"))
}

/// Migrate snippets from old Application Support location to ~/.config/explorer/snippets/
fn migrate_old_snippets() -> Result<(), AppError> {
    let old_root = match old_snippets_root() {
        Some(r) if r.exists() => r,
        _ => return Ok(()), // Nothing to migrate
    };

    let new_root = snippets_root()?;

    // Migrate local/ folder
    let old_local = old_root.join("local");
    let new_local = new_root.join("local");
    if old_local.exists() {
        std::fs::create_dir_all(&new_local)?;
        for entry in std::fs::read_dir(&old_local)? {
            let entry = entry?;
            let file_name = entry.file_name();
            let old_path = entry.path();
            let new_path = new_local.join(&file_name);
            // Only move if target doesn't exist (avoid overwriting)
            if old_path.is_file() && !new_path.exists() {
                std::fs::rename(&old_path, &new_path)?;
            }
        }
    }

    // Migrate gists/ folder (if it exists in future)
    let old_gists = old_root.join("gists");
    let new_gists = new_root.join("gists");
    if old_gists.exists() {
        std::fs::create_dir_all(&new_gists)?;
        for entry in std::fs::read_dir(&old_gists)? {
            let entry = entry?;
            let gist_id = entry.file_name();
            let old_gist_dir = entry.path();
            let new_gist_dir = new_gists.join(&gist_id);
            if old_gist_dir.is_dir() && !new_gist_dir.exists() {
                std::fs::rename(&old_gist_dir, &new_gist_dir)?;
            }
        }
    }

    Ok(())
}

const MARKDOWN_REFERENCE: &str = r#"# Markdown Quick Reference

Each section shows the **raw syntax** followed by the **rendered result**.

---

## Headers

**Syntax:**
```
# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6
```

**Rendered:**

# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6

---

## Emphasis

**Syntax:**
```
*italic* or _italic_
**bold** or __bold__
***bold italic***
~~strikethrough~~
H~2~O (subscript)
X^2^ (superscript)
```

**Rendered:**

*italic* or _italic_

**bold** or __bold__

***bold italic***

~~strikethrough~~

H~2~O (subscript)

X^2^ (superscript)

---

## Lists

**Syntax:**
```
- First item
- Second item
  - Nested item
    - Deeper nesting

1. First item
2. Second item
   1. Nested ordered

- [ ] Uncompleted task
- [x] Completed task
```

**Rendered:**

- First item
- Second item
  - Nested item
    - Deeper nesting

1. First item
2. Second item
   1. Nested ordered

- [ ] Uncompleted task
- [x] Completed task
- [ ] Another pending task

---

## Links

**Syntax:**
```
[Link text](./markdown-reference.md)
Autolink: <https://github.com>
```

**Rendered:**

[Link text](./markdown-reference.md)

Autolink: <https://github.com>

---

## Code

**Syntax:**

````
Inline: `const x = 42;`

Color codes: `#ff6600` `#4da8ff` `rgb(255, 100, 50)`

```javascript
function hello() {
  console.log("Hello!");
}
```
````

**Rendered:**

Inline: `const x = 42;`

Color codes: `#ff6600` `#4da8ff` `#22c55e` `rgb(255, 100, 50)`

```javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(`Fibonacci(10) = ${result}`);
```

```rust
fn main() {
    let names = vec!["Alice", "Bob", "Charlie"];
    for name in &names {
        println!("Hello, {}!", name);
    }
}
```

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def distance(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5
```

```css
.container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}
```

```bash
#!/bin/bash
for file in *.md; do
  echo "Processing: $file"
  wc -w "$file"
done
```

---

## Blockquotes

**Syntax:**
```
> A single line quote.

> Multi-line quote
> continues here.

> Nested quotes:
>> Second level
>>> Third level
```

**Rendered:**

> A single line quote.

> Multi-line quote
> continues here.
>
> With a paragraph break.

> Nested quotes:
>> Second level
>>> Third level

---

## Tables

**Syntax:**
```
| Left | Center | Right |
|:-----|:------:|------:|
| A    | B      | C     |
| D    | E      | F     |
```

**Rendered:**

| Feature | Status | Notes |
|:--------|:------:|------:|
| Syntax highlighting | ✅ | highlight.js |
| Math rendering | ✅ | KaTeX |
| Mermaid diagrams | ✅ | Built-in |
| Color swatches | ✅ | Inline code |
| Admonitions | ✅ | GFM style |

---

## Horizontal Rules

**Syntax:**
```
---
***
___
```

**Rendered:**

---

***

___

---

## Footnotes

**Syntax:**
```
Sentence with a footnote.[^1]
Another with a named one.[^named]

[^1]: Footnote content.
[^named]: Named footnote content.
```

**Rendered:**

Here's a sentence with a footnote.[^1]

And another with a named footnote.[^named]

[^1]: This is the first footnote content.
[^named]: Named footnotes work the same way.

---

## HTML Elements

**Syntax:**
```html
<details>
<summary>Click to expand</summary>
Hidden content with **markdown** inside.
</details>

<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
<mark>Highlighted text</mark>
Text with <sup>super</sup> and <sub>sub</sub>
```

**Rendered:**

<details>
<summary>Click to expand this section</summary>

This content is hidden by default.

**Markdown** works *inside* HTML blocks.

- List item one
- List item two

</details>

Keyboard shortcuts: <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>

<mark>Highlighted text</mark> stands out.

Text with <sup>superscript</sup> and <sub>subscript</sub> elements.

---

## Math (KaTeX)

**Syntax:**
```
Inline: $E = mc^2$

Block:
$$
\frac{n!}{k!(n-k)!} = \binom{n}{k}
$$
```

**Rendered:**

Inline math: $E = mc^2$ and $\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$

$$
\frac{n!}{k!(n-k)!} = \binom{n}{k}
$$

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

---

## Mermaid Diagrams

**Syntax:**
````
```mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[OK]
  B -->|No| D[Cancel]
```
````

**Rendered:**

```mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Process]
  B -->|No| D[Skip]
  C --> E[End]
  D --> E
```

```mermaid
sequenceDiagram
  participant U as User
  participant A as App
  participant S as Server
  U->>A: Click button
  A->>S: API request
  S-->>A: Response
  A-->>U: Update UI
```

```mermaid
pie title Language Usage
  "TypeScript" : 45
  "Rust" : 30
  "CSS" : 15
  "Other" : 10
```

---

## Admonitions

**Syntax:**
```
> [!NOTE]
> Informational note.

> [!TIP]
> Helpful advice.

> [!WARNING]
> Important warning.

> [!CAUTION]
> Critical information.

> [!IMPORTANT]
> Key information.
```

**Rendered:**

> [!NOTE]
> This is an informational note. Use it for general information.

> [!TIP]
> This is a helpful tip. Use it for best practices and suggestions.

> [!WARNING]
> This is a warning. Use it for potential issues to watch out for.

> [!CAUTION]
> This is a caution notice. Use it for dangerous or destructive actions.

> [!IMPORTANT]
> This is important information that should not be missed.

---

## Line Breaks

**Syntax:**
```
First line with two trailing spaces
creates a hard line break.

Or use a backslash\
at the end of a line.
```

**Rendered:**

First line with two trailing spaces
creates a hard line break.

Or use a backslash\
at the end of a line.

---

## Escape Characters

**Syntax:**
```
\* \# \[ \] \\ \` \| \_ \~
```

**Rendered:**

These are literal: \* \# \[ \] \\ \` \| \_ \~
"#;

/// Create the default markdown-reference.md snippet if it doesn't exist.
pub fn ensure_markdown_reference(db_path: &str) -> Result<(), AppError> {
    let conn = Connection::open(db_path)?;
    init_snippets_table(&conn)?;

    // Check if markdown-reference.md already exists
    let exists: bool = conn
        .query_row(
            "SELECT 1 FROM snippets WHERE title = 'markdown-reference.md' LIMIT 1",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if exists {
        return Ok(());
    }

    // Create it
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let snippet = Snippet {
        id: id.clone(),
        title: "markdown-reference.md".to_string(),
        tier: SnippetTier::Local,
        gist_id: None,
        language: Some("markdown".to_string()),
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

    let path = snippet_path(&snippet)?;
    std::fs::write(&path, MARKDOWN_REFERENCE)?;

    Ok(())
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
    migrate_old_snippets()?;
    ensure_markdown_reference(&db_path)?;

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

// ======================== Git operations for gist tiers ========================

use git2::{Cred, PushOptions, RemoteCallbacks, Repository};
use serde_json::json;

/// Get the GitHub PAT from keychain (helper for git auth).
async fn get_pat() -> Result<String, AppError> {
    use crate::commands::auth::get_github_pat;
    get_github_pat()
        .await?
        .ok_or_else(|| AppError::Other("No GitHub PAT configured. Set it in Settings → Gists.".to_string()))
}

/// Create a new gist via GitHub API. Returns the gist_id.
async fn create_gist_on_github(
    pat: &str,
    title: &str,
    content: &str,
    is_public: bool,
) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let body = json!({
        "description": format!("Explorer snippet: {}", title),
        "public": is_public,
        "files": {
            title: {
                "content": content
            }
        }
    });

    let resp = client
        .post("https://api.github.com/gists")
        .header("Authorization", format!("token {}", pat))
        .header("User-Agent", "explorer-app")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Other(format!("GitHub API request failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Other(format!(
            "GitHub API error {}: {}",
            status, text
        )));
    }

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::Other(format!("Failed to parse GitHub response: {}", e)))?;

    json["id"]
        .as_str()
        .ok_or_else(|| AppError::Other("GitHub response missing gist id".to_string()))
        .map(String::from)
}

/// Clone a gist repo from GitHub.
async fn clone_gist(gist_id: &str, pat: &str) -> Result<PathBuf, AppError> {
    let root = snippets_root()?;
    let gist_dir = root.join("gists").join(gist_id);

    if gist_dir.exists() {
        return Ok(gist_dir);
    }

    let url = format!("https://gist.github.com/{}.git", gist_id);

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        Cred::userpass_plaintext(
            username_from_url.unwrap_or("git"),
            pat,
        )
    });

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_opts);

    builder
        .clone(&url, &gist_dir)
        .map_err(|e| AppError::Other(format!("Git clone failed: {}", e)))?;

    Ok(gist_dir)
}

/// Commit and push changes in a gist directory.
async fn commit_and_push_gist(gist_id: &str, pat: &str, message: &str) -> Result<(), AppError> {
    let root = snippets_root()?;
    let gist_dir = root.join("gists").join(gist_id);

    let repo = Repository::open(&gist_dir)
        .map_err(|e| AppError::Other(format!("Failed to open git repo: {}", e)))?;

    // Stage all changes
    let mut index = repo.index()
        .map_err(|e| AppError::Other(format!("Failed to get git index: {}", e)))?;
    index.add_all(["."].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| AppError::Other(format!("Git add failed: {}", e)))?;
    index.write()
        .map_err(|e| AppError::Other(format!("Git index write failed: {}", e)))?;

    // Check if there are changes to commit
    let tree_id = index.write_tree()
        .map_err(|e| AppError::Other(format!("Git write tree failed: {}", e)))?;
    let tree = repo.find_tree(tree_id)
        .map_err(|e| AppError::Other(format!("Git find tree failed: {}", e)))?;

    let head = repo.head()
        .map_err(|e| AppError::Other(format!("Git head failed: {}", e)))?;
    let parent_commit = head.peel_to_commit()
        .map_err(|e| AppError::Other(format!("Git parent commit failed: {}", e)))?;

    // Check if tree is identical to parent (no changes)
    if parent_commit.tree_id() == tree_id {
        // No changes, skip commit but still pull to check for remote updates
        return Ok(());
    }

    // Create commit
    let sig = repo.signature()
        .map_err(|e| AppError::Other(format!("Git signature failed: {}", e)))?;
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        message,
        &tree,
        &[&parent_commit],
    )
    .map_err(|e| AppError::Other(format!("Git commit failed: {}", e)))?;

    // Push to origin
    let mut remote = repo.find_remote("origin")
        .map_err(|e| AppError::Other(format!("Git remote not found: {}", e)))?;

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, _allowed_types| {
        Cred::userpass_plaintext(
            username_from_url.unwrap_or("git"),
            pat,
        )
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    remote
        .push(&["refs/heads/master:refs/heads/master"], Some(&mut push_opts))
        .map_err(|e| AppError::Other(format!("Git push failed: {}", e)))?;

    Ok(())
}

/// Delete a gist via GitHub API.
async fn delete_gist_on_github(gist_id: &str, pat: &str) -> Result<(), AppError> {
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/gists/{}", gist_id);

    let resp = client
        .delete(&url)
        .header("Authorization", format!("token {}", pat))
        .header("User-Agent", "explorer-app")
        .send()
        .await
        .map_err(|e| AppError::Other(format!("GitHub API delete failed: {}", e)))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Other(format!(
            "GitHub delete error {}: {}",
            status, text
        )));
    }

    Ok(())
}

// ======================== Tier transitions ========================

/// Move a snippet to a different tier (local/secret/public).
#[tauri::command]
pub async fn move_snippet_tier(
    db_path: String,
    id: String,
    new_tier: SnippetTier,
) -> Result<Snippet, AppError> {
    // Fetch current snippet (complete all DB work before any await)
    let mut snippet: Snippet = {
        let conn = Connection::open(&db_path)?;
        init_snippets_table(&conn)?;
        let mut stmt = conn.prepare("SELECT id, title, tier, gist_id, language, created_at, updated_at FROM snippets WHERE id = ?1")?;
        stmt.query_row([&id], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                title: row.get(1)?,
                tier: SnippetTier::from_str(&row.get::<_, String>(2)?).unwrap_or(SnippetTier::Local),
                gist_id: row.get(3)?,
                language: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
    };

    if snippet.tier == new_tier {
        return Ok(snippet); // No-op
    }

    let old_path = snippet_path(&snippet)?;
    let content = std::fs::read_to_string(&old_path)?;

    match (&snippet.tier, &new_tier) {
        // Local → Gist (secret or public)
        (SnippetTier::Local, SnippetTier::Secret | SnippetTier::Public) => {
            let pat = get_pat().await?;
            let is_public = new_tier == SnippetTier::Public;
            let gist_id = create_gist_on_github(&pat, &snippet.title, &content, is_public).await?;
            clone_gist(&gist_id, &pat).await?;

            snippet.tier = new_tier;
            snippet.gist_id = Some(gist_id.clone());

            // Remove old local file
            std::fs::remove_file(&old_path)?;
        }

        // Gist → Local
        (SnippetTier::Secret | SnippetTier::Public, SnippetTier::Local) => {
            if let Some(gist_id) = &snippet.gist_id {
                let pat = get_pat().await?;
                delete_gist_on_github(gist_id, &pat).await?;

                // Remove gist directory
                let root = snippets_root()?;
                let gist_dir = root.join("gists").join(gist_id);
                if gist_dir.exists() {
                    std::fs::remove_dir_all(&gist_dir)?;
                }
            }

            snippet.tier = SnippetTier::Local;
            snippet.gist_id = None;

            // Write to local
            let new_path = snippet_path(&snippet)?;
            std::fs::write(&new_path, content)?;
        }

        // Secret ↔ Public (GitHub doesn't support changing visibility, so we recreate)
        (SnippetTier::Secret, SnippetTier::Public) | (SnippetTier::Public, SnippetTier::Secret) => {
            let pat = get_pat().await?;
            let is_public = new_tier == SnippetTier::Public;

            // Create new gist with new visibility
            let new_gist_id = create_gist_on_github(&pat, &snippet.title, &content, is_public).await?;
            clone_gist(&new_gist_id, &pat).await?;

            // Delete old gist
            if let Some(old_gist_id) = &snippet.gist_id {
                delete_gist_on_github(old_gist_id, &pat).await?;
                let root = snippets_root()?;
                let old_gist_dir = root.join("gists").join(old_gist_id);
                if old_gist_dir.exists() {
                    std::fs::remove_dir_all(&old_gist_dir)?;
                }
            }

            snippet.tier = new_tier;
            snippet.gist_id = Some(new_gist_id);
        }

        _ => {}
    }

    let now = chrono::Utc::now().to_rfc3339();
    snippet.updated_at = now.clone();

    // Update DB after all async operations complete
    {
        let conn = Connection::open(&db_path)?;
        conn.execute(
            "UPDATE snippets SET tier = ?1, gist_id = ?2, updated_at = ?3 WHERE id = ?4",
            params![snippet.tier.as_str(), &snippet.gist_id, &now, &id],
        )?;
    }

    Ok(snippet)
}

/// Save snippet content and optionally push to GitHub (for gist tiers).
#[tauri::command]
pub async fn save_and_push_snippet(
    db_path: String,
    id: String,
    content: String,
) -> Result<(), AppError> {
    // Fetch snippet data and write to disk before any async operations
    let snippet: Snippet = {
        let conn = Connection::open(&db_path)?;
        init_snippets_table(&conn)?;
        let mut stmt = conn.prepare("SELECT id, title, tier, gist_id, language, created_at, updated_at FROM snippets WHERE id = ?1")?;
        stmt.query_row([&id], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                title: row.get(1)?,
                tier: SnippetTier::from_str(&row.get::<_, String>(2)?).unwrap_or(SnippetTier::Local),
                gist_id: row.get(3)?,
                language: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?
    };

    // Write to disk
    let path = snippet_path(&snippet)?;
    std::fs::write(&path, &content)?;

    // Update DB
    let now = chrono::Utc::now().to_rfc3339();
    {
        let conn = Connection::open(&db_path)?;
        conn.execute(
            "UPDATE snippets SET updated_at = ?1 WHERE id = ?2",
            params![now, &id],
        )?;
    }

    // If it's a gist, commit and push
    if matches!(snippet.tier, SnippetTier::Secret | SnippetTier::Public) {
        if let Some(gist_id) = snippet.gist_id {
            let pat = get_pat().await?;
            commit_and_push_gist(&gist_id, &pat, "Update from Explorer").await?;
        }
    }

    Ok(())
}

/// Pull all gists from the user's GitHub account.
/// Imports any gists not already tracked in the local DB.
#[tauri::command]
pub async fn pull_gists(db_path: String) -> Result<Vec<Snippet>, AppError> {
    let pat = get_pat().await?;
    let client = reqwest::Client::new();

    // Fetch all gists (paginated)
    let mut all_gists: Vec<serde_json::Value> = Vec::new();
    let mut page = 1u32;
    loop {
        let resp = client
            .get("https://api.github.com/gists")
            .query(&[("per_page", "100"), ("page", &page.to_string())])
            .header("Authorization", format!("token {}", pat))
            .header("User-Agent", "explorer-app")
            .send()
            .await
            .map_err(|e| AppError::Other(format!("GitHub API request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(AppError::Other(format!("GitHub API error {}: {}", status, text)));
        }

        let gists: Vec<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::Other(format!("Failed to parse GitHub response: {}", e)))?;

        if gists.is_empty() {
            break;
        }
        all_gists.extend(gists);
        page += 1;
    }

    // Get existing gist_ids to skip (scoped so conn is dropped before awaits)
    let existing_ids: std::collections::HashSet<String> = {
        let conn = Connection::open(&db_path)?;
        init_snippets_table(&conn)?;
        let mut stmt = conn.prepare("SELECT gist_id FROM snippets WHERE gist_id IS NOT NULL")?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);
        drop(conn);
        ids.into_iter().collect()
    };

    // Collect gists to import (parse metadata before any async work)
    struct GistInfo {
        gist_id: String,
        title: String,
        tier: SnippetTier,
        language: Option<String>,
    }
    let mut to_import: Vec<GistInfo> = Vec::new();

    for gist in &all_gists {
        let gist_id = match gist["id"].as_str() {
            Some(id) => id,
            None => continue,
        };
        if existing_ids.contains(gist_id) {
            continue;
        }
        let is_public = gist["public"].as_bool().unwrap_or(false);
        let tier = if is_public { SnippetTier::Public } else { SnippetTier::Secret };
        let files = match gist["files"].as_object() {
            Some(f) => f,
            None => continue,
        };
        let first_file = match files.values().next() {
            Some(f) => f,
            None => continue,
        };
        let title = first_file["filename"]
            .as_str()
            .unwrap_or("untitled")
            .to_string();
        let language = first_file["language"].as_str().map(|s| s.to_lowercase());

        to_import.push(GistInfo { gist_id: gist_id.to_string(), title, tier, language });
    }

    // Clone gists (async work, no DB connection held)
    let mut cloned: Vec<GistInfo> = Vec::new();
    for info in to_import {
        if let Err(e) = clone_gist(&info.gist_id, &pat).await {
            eprintln!("Failed to clone gist {}: {}", info.gist_id, e);
            continue;
        }
        cloned.push(info);
    }

    // Insert into DB (no awaits after this)
    let mut imported: Vec<Snippet> = Vec::new();
    {
        let conn = Connection::open(&db_path)?;
        for info in cloned {
            let id = uuid::Uuid::new_v4().to_string();
            let now = chrono::Utc::now().to_rfc3339();

            let snippet = Snippet {
                id: id.clone(),
                title: info.title,
                tier: info.tier,
                gist_id: Some(info.gist_id),
                language: info.language,
                created_at: now.clone(),
                updated_at: now,
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

            imported.push(snippet);
        }
    }

    Ok(imported)
}
