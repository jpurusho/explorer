use serde::Serialize;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Serialize)]
pub struct ArchiveEntry {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
    pub is_dir: bool,
}

#[tauri::command]
pub fn list_archive_contents(path: String) -> Result<Vec<ArchiveEntry>, String> {
    let path = Path::new(&path);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    match ext.as_str() {
        "zip" => list_zip(path),
        "gz" | "tgz" => list_tar_gz(path),
        "tar" => list_tar(path),
        _ => Err(format!("Unsupported archive format: {}", ext)),
    }
}

#[tauri::command]
pub fn extract_archive(path: String, destination: String) -> Result<(), String> {
    let path = Path::new(&path);
    let dest = Path::new(&destination);
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();

    match ext.as_str() {
        "zip" => extract_zip(path, dest),
        "gz" | "tgz" => extract_tar_gz(path, dest),
        "tar" => extract_tar(path, dest),
        _ => Err(format!("Unsupported archive format: {}", ext)),
    }
}

fn list_zip(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        entries.push(ArchiveEntry {
            name: entry.name().to_string(),
            size: entry.size(),
            compressed_size: entry.compressed_size(),
            is_dir: entry.is_dir(),
        });
    }
    Ok(entries)
}

fn list_tar_gz(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let gz = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(gz);

    let mut entries = Vec::new();
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let header = entry.header();
        entries.push(ArchiveEntry {
            name: entry.path().map_err(|e| e.to_string())?.to_string_lossy().to_string(),
            size: header.size().unwrap_or(0),
            compressed_size: header.size().unwrap_or(0),
            is_dir: header.entry_type().is_dir(),
        });
    }
    Ok(entries)
}

fn list_tar(path: &Path) -> Result<Vec<ArchiveEntry>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = tar::Archive::new(reader);

    let mut entries = Vec::new();
    for entry in archive.entries().map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let header = entry.header();
        entries.push(ArchiveEntry {
            name: entry.path().map_err(|e| e.to_string())?.to_string_lossy().to_string(),
            size: header.size().unwrap_or(0),
            compressed_size: header.size().unwrap_or(0),
            is_dir: header.entry_type().is_dir(),
        });
    }
    Ok(entries)
}

fn extract_zip(path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
    archive.extract(dest).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_tar_gz(path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let gz = flate2::read::GzDecoder::new(reader);
    let mut archive = tar::Archive::new(gz);
    archive.unpack(dest).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_tar(path: &Path, dest: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut archive = tar::Archive::new(reader);
    archive.unpack(dest).map_err(|e| e.to_string())?;
    Ok(())
}
