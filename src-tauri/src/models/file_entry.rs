use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub size: u64,
    pub modified: String,
    pub file_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: String,
    pub created: String,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub is_hidden: bool,
    pub permissions: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileContent {
    pub content: String,
    pub mime_type: String,
    pub size: u64,
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExifData {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub focal_length: Option<String>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub iso: Option<String>,
    pub date_taken: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub orientation: Option<u8>,
}

pub fn classify_file_type(name: &str) -> String {
    // Check well-known extensionless filenames first
    let name_lower = name.to_lowercase();
    match name_lower.as_str() {
        "makefile" | "gnumakefile" | "bsdmakefile" => return "code".to_string(),
        "dockerfile" | "containerfile" => return "code".to_string(),
        "vagrantfile" | "rakefile" | "gemfile" | "guardfile" | "capfile" => return "code".to_string(),
        "procfile" | "brewfile" => return "code".to_string(),
        "justfile" | "taskfile" => return "code".to_string(),
        "cmakelists.txt" => return "code".to_string(),
        "license" | "licence" | "authors" | "contributors" | "changelog"
        | "changes" | "history" | "notice" | "patents" => return "text".to_string(),
        "readme" => return "markdown".to_string(),
        ".gitignore" | ".gitattributes" | ".gitmodules" | ".dockerignore"
        | ".editorconfig" | ".eslintrc" | ".prettierrc" | ".babelrc"
        | ".npmrc" | ".nvmrc" | ".env" | ".env.local" | ".env.development"
        | ".env.production" | ".flake8" | ".pylintrc" | ".rubocop.yml" => return "code".to_string(),
        _ => {}
    }

    // Check if file has no extension (no dot, or starts with dot and has no further dot)
    let has_extension = if name.starts_with('.') {
        name[1..].contains('.')
    } else {
        name.contains('.')
    };

    if !has_extension {
        return "text".to_string();
    }

    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "webp" | "heic" | "ico" | "tiff" => {
            "image".to_string()
        }
        "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v" => "video".to_string(),
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "m4a" => "audio".to_string(),
        "md" | "mdx" => "markdown".to_string(),
        "json" => "json".to_string(),
        "yml" | "yaml" => "yaml".to_string(),
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "java" | "c" | "cpp" | "h"
        | "hpp" | "cs" | "rb" | "swift" | "kt" | "lua" | "sh" | "bash" | "zsh" | "fish"
        | "sql" | "html" | "css" | "scss" | "less" | "vue" | "svelte" | "php" | "toml"
        | "ini" | "cfg" | "conf" => "code".to_string(),
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp"
        | "key" | "pages" | "numbers" => {
            "document".to_string()
        }
        "txt" | "log" | "csv" | "tsv" => "text".to_string(),
        "zip" | "tar" | "gz" | "tgz" | "bz2" | "xz" | "7z" | "rar" | "dmg" => "archive".to_string(),
        _ => "unknown".to_string(),
    }
}
