use std::path::Path;
use std::process::Command;
use base64::Engine;

#[tauri::command]
pub fn generate_document_preview(path: String, page: Option<u32>) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    // For doc/docx, convert to PDF via textutil then render
    if ext == "doc" || ext == "docx" {
        return generate_via_pdf_conversion(&path, page.unwrap_or(0));
    }

    // For other formats (ppt, pptx, key, pages), use qlmanage thumbnail
    generate_qlmanage_preview(&path)
}

#[tauri::command]
pub fn get_document_page_count(path: String) -> Result<u32, String> {
    let file_path = Path::new(&path);
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    if ext == "doc" || ext == "docx" {
        let pdf_path = convert_to_pdf(&path)?;
        let count = count_pdf_pages(&pdf_path);
        Ok(count)
    } else {
        // For ppt/key we can't easily get page count without the native app
        Ok(1)
    }
}

fn convert_to_pdf(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    let temp_dir = std::env::temp_dir().join("explorer_previews");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let stem = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let pdf_path = temp_dir.join(format!("{}.pdf", stem));

    // textutil can convert doc/docx to PDF natively on macOS
    let result = Command::new("textutil")
        .args(["-convert", "pdf", "-output"])
        .arg(&pdf_path)
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("textutil conversion failed: {}", stderr));
    }

    Ok(pdf_path.to_string_lossy().to_string())
}

fn count_pdf_pages(pdf_path: &str) -> u32 {
    let output = Command::new("mdls")
        .args(["-name", "kMDItemNumberOfPages", pdf_path])
        .output();

    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        // Output: "kMDItemNumberOfPages = 5"
        if let Some(num_str) = text.split('=').nth(1) {
            if let Ok(n) = num_str.trim().parse::<u32>() {
                return n;
            }
        }
    }
    1
}

fn generate_via_pdf_conversion(path: &str, page: u32) -> Result<String, String> {
    let pdf_path = convert_to_pdf(path)?;

    let temp_dir = std::env::temp_dir().join("explorer_previews");
    let _output_png = temp_dir.join(format!("page_{}.png", page));

    // Use sips to render a specific page from the PDF
    // sips doesn't support page selection, so use qlmanage on the PDF
    // or use Core Graphics via a helper. For now, use qlmanage on the PDF.
    let result = Command::new("qlmanage")
        .args(["-t", "-s", "1200", "-o"])
        .arg(&temp_dir)
        .arg(&pdf_path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        // Fallback: try qlmanage on original
        return generate_qlmanage_preview(path);
    }

    // Find the generated PNG
    let pdf_name = Path::new(&pdf_path).file_name().unwrap_or_default().to_string_lossy();
    let expected = temp_dir.join(format!("{}.png", pdf_name));

    let actual = if expected.exists() {
        expected
    } else {
        find_preview_file(&temp_dir, &pdf_name)?
    };

    let data = std::fs::read(&actual).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&actual);
    let _ = std::fs::remove_file(&pdf_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
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
