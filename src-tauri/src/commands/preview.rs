use std::path::Path;
use std::process::Command;
use base64::Engine;

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
        "doc" | "docx" | "rtf" | "odt" => convert_with_textutil(&path, &pdf_path),
        "ppt" | "pptx" | "key" | "pages" | "numbers" | "ods" | "odp" | "xls" | "xlsx" => {
            // Try cupsfilter first (works for many formats via macOS print system)
            convert_with_cupsfilter(&path, &pdf_path)
                .or_else(|_| convert_with_automator(&path, &pdf_path, &ext))
        }
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

fn convert_with_automator(path: &str, pdf_path: &Path, ext: &str) -> Result<(), String> {
    // Use AppleScript to export via the native app (Keynote, Pages, Numbers)
    let app_name = match ext {
        "key" => "Keynote",
        "pages" => "Pages",
        "numbers" => "Numbers",
        "ppt" | "pptx" => "Keynote",  // Keynote can open PowerPoint
        _ => return Err("No native app for this format".to_string()),
    };

    let script = format!(
        r#"
        tell application "{}"
            set wasRunning to running
            activate
            open POSIX file "{}"
            delay 2
            set theDoc to front document
            export theDoc to POSIX file "{}" as PDF
            close theDoc saving no
            if not wasRunning then quit
        end tell
        "#,
        app_name,
        path,
        pdf_path.to_string_lossy()
    );

    let result = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).to_string());
    }
    Ok(())
}

fn generate_qlmanage_preview(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    let temp_dir = std::env::temp_dir().join("explorer_previews");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let result = Command::new("qlmanage")
        .args(["-t", "-s", "1200", "-o"])
        .arg(&temp_dir)
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        return Err("qlmanage failed to generate preview".to_string());
    }

    let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
    let expected = temp_dir.join(format!("{}.png", file_name));

    let actual = if expected.exists() {
        expected
    } else {
        find_preview_file(&temp_dir, &file_name)?
    };

    let data = std::fs::read(&actual).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&actual);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    // Return as a data URL since this is a PNG fallback
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
