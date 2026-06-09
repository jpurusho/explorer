use std::path::Path;
use std::process::Command;
use base64::Engine;

#[tauri::command]
pub fn generate_document_preview(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let temp_dir = std::env::temp_dir().join("explorer_previews");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let file_name = file_path.file_stem().unwrap_or_default().to_string_lossy();
    let output_path = temp_dir.join(format!("{}.png", file_name));

    let result = Command::new("qlmanage")
        .args(["-t", "-s", "1024", "-o"])
        .arg(&temp_dir)
        .arg(&path)
        .output()
        .map_err(|e| e.to_string())?;

    if !result.status.success() {
        return Err("qlmanage failed to generate preview".to_string());
    }

    // qlmanage outputs to <filename>.png in the output dir
    let expected = temp_dir.join(format!("{}.png", file_path.file_name().unwrap_or_default().to_string_lossy()));
    let actual_path = if expected.exists() {
        expected
    } else if output_path.exists() {
        output_path
    } else {
        // qlmanage sometimes uses slightly different naming
        let entries = std::fs::read_dir(&temp_dir).map_err(|e| e.to_string())?;
        let mut found = None;
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.contains(&*file_name) && name.ends_with(".png") {
                found = Some(entry.path());
                break;
            }
        }
        found.ok_or_else(|| "Preview file not generated".to_string())?
    };

    let data = std::fs::read(&actual_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(&actual_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
}
