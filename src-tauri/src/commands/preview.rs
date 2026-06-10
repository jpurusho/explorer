use std::path::Path;
use std::process::Command;
use base64::Engine;
use sha2::{Digest, Sha256};

/// Convert a document to PDF and return the base64-encoded PDF data.
/// Supports doc, docx, ppt, pptx, key, pages, numbers.
#[tauri::command]
pub fn convert_document_to_pdf(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let temp_dir = std::env::temp_dir().join("explorer_previews");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let stem = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let pdf_path = temp_dir.join(format!("{}.pdf", stem));

    // Remove old file if exists
    let _ = std::fs::remove_file(&pdf_path);

    let converted = match ext.as_str() {
        // Word-family: textutil produces a real multi-page PDF, no app launch.
        "doc" | "docx" | "rtf" | "odt" => convert_with_textutil(&path, &pdf_path),
        // Slide/keynote/pages formats can only be converted to multi-page PDF by
        // launching the native app (Keynote/Pages) — which we refuse to do. Show
        // a cached single-page Quick Look thumbnail inline; the "View all pages"
        // button opens a native QLPreviewView window for full navigation.
        "ppt" | "pptx" | "key" | "pages" | "odp" => {
            return generate_qlmanage_preview(&path);
        }
        // Spreadsheet/print formats cupsfilter can handle via the print system
        // without launching any app.
        "numbers" | "ods" | "xls" | "xlsx" => convert_with_cupsfilter(&path, &pdf_path),
        _ => convert_with_cupsfilter(&path, &pdf_path),
    };

    if converted.is_err() || !pdf_path.exists() {
        // Final fallback: generate a single-page thumbnail via qlmanage
        return generate_qlmanage_preview(&path);
    }

    let data = std::fs::read(&pdf_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&pdf_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(b64)
}

/// Legacy single-page preview for formats that can't be converted to PDF.
#[tauri::command]
pub fn generate_document_preview(path: String, _page: Option<u32>) -> Result<String, String> {
    generate_qlmanage_preview(&path)
}

#[tauri::command]
pub fn get_document_page_count(path: String) -> Result<u32, String> {
    // Not needed anymore since we use PDF rendering, but keep for compatibility
    let _ = path;
    Ok(1)
}

fn convert_with_textutil(path: &str, pdf_path: &Path) -> Result<(), String> {
    let result = Command::new("textutil")
        .args(["-convert", "pdf", "-output"])
        .arg(pdf_path)
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).to_string());
    }
    Ok(())
}

fn convert_with_cupsfilter(path: &str, pdf_path: &Path) -> Result<(), String> {
    let result = Command::new("/usr/sbin/cupsfilter")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() || result.stdout.is_empty() {
        return Err("cupsfilter failed".to_string());
    }

    // cupsfilter outputs PDF to stdout
    std::fs::write(pdf_path, &result.stdout).map_err(|e| e.to_string())?;
    Ok(())
}

fn generate_qlmanage_preview(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);

    // Cache key: path + mtime + size, so the thumbnail is generated once and
    // reused on every subsequent preview (and invalidated when the file changes).
    let meta = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hasher.update(mtime.to_le_bytes());
    hasher.update(meta.len().to_le_bytes());
    let cache_key = format!("{:x}", hasher.finalize());

    let cache_dir = std::env::temp_dir().join("explorer_previews");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    let cached_png = cache_dir.join(format!("{}.png", cache_key));

    if cached_png.exists() {
        if let Ok(data) = std::fs::read(&cached_png) {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
            return Ok(format!("data:image/png;base64,{}", b64));
        }
    }

    // Not cached yet: run qlmanage into a scratch dir, then move into the cache.
    let scratch = cache_dir.join(format!("{}_scratch", cache_key));
    std::fs::create_dir_all(&scratch).map_err(|e| e.to_string())?;

    let result = Command::new("qlmanage")
        .args(["-t", "-s", "1200", "-o"])
        .arg(&scratch)
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        let _ = std::fs::remove_dir_all(&scratch);
        return Err("qlmanage failed to generate preview".to_string());
    }

    let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
    let expected = scratch.join(format!("{}.png", file_name));
    let actual = if expected.exists() {
        expected
    } else {
        find_preview_file(&scratch, &file_name)?
    };

    // Persist into the cache under the stable key, then clean up the scratch dir.
    std::fs::rename(&actual, &cached_png).or_else(|_| std::fs::copy(&actual, &cached_png).map(|_| ())).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_dir_all(&scratch);

    let data = std::fs::read(&cached_png).map_err(|e| e.to_string())?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
}

fn find_preview_file(dir: &Path, stem: &str) -> Result<std::path::PathBuf, String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.contains(stem.split('.').next().unwrap_or(stem)) && name.ends_with(".png") {
            return Ok(entry.path());
        }
    }
    Err("Preview file not generated".to_string())
}
