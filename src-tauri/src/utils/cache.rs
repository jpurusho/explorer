//! Bounded on-disk cache pruning.
//!
//! The thumbnail and document-preview caches are keyed by path+mtime+size and
//! never overwrite, so on a long-lived install they grow without limit. We prune
//! them to a max total size on startup, evicting least-recently-modified files
//! first (mtime is a good proxy for last-access since entries are immutable).

use std::path::Path;
use std::time::SystemTime;

/// Prune `dir` so its total file size is at most `max_bytes`, deleting
/// oldest-first. Best-effort: any individual error is ignored. Subdirectories
/// (e.g. preview scratch dirs) are skipped — only top-level files are counted.
pub fn prune_dir(dir: &Path, max_bytes: u64) {
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return,
    };

    let mut files: Vec<(std::path::PathBuf, u64, SystemTime)> = Vec::new();
    let mut total: u64 = 0;

    for entry in read.flatten() {
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if !meta.is_file() {
            continue;
        }
        let size = meta.len();
        let mtime = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
        total += size;
        files.push((entry.path(), size, mtime));
    }

    if total <= max_bytes {
        return;
    }

    // Oldest first.
    files.sort_by_key(|(_, _, mtime)| *mtime);

    for (path, size, _) in files {
        if total <= max_bytes {
            break;
        }
        if std::fs::remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }
}
