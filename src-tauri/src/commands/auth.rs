use crate::utils::errors::AppError;
use keyring::Entry;

const SERVICE: &str = "com.jpurshot.explorer";
const GITHUB_PAT_KEY: &str = "github-pat";

/// Store a GitHub Personal Access Token in the macOS Keychain.
/// Overwrites any existing token.
#[tauri::command]
pub async fn set_github_pat(token: String) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE, GITHUB_PAT_KEY)
        .map_err(|e| AppError::Other(format!("Keychain entry create failed: {}", e)))?;
    entry
        .set_password(&token)
        .map_err(|e| AppError::Other(format!("Keychain write failed: {}", e)))?;
    Ok(())
}

/// Retrieve the GitHub PAT from the macOS Keychain.
/// Returns None if no token is stored.
#[tauri::command]
pub async fn get_github_pat() -> Result<Option<String>, AppError> {
    let entry = Entry::new(SERVICE, GITHUB_PAT_KEY)
        .map_err(|e| AppError::Other(format!("Keychain entry create failed: {}", e)))?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Other(format!("Keychain read failed: {}", e))),
    }
}

/// Clear the GitHub PAT from the macOS Keychain.
#[tauri::command]
pub async fn clear_github_pat() -> Result<(), AppError> {
    let entry = Entry::new(SERVICE, GITHUB_PAT_KEY)
        .map_err(|e| AppError::Other(format!("Keychain entry create failed: {}", e)))?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // already absent
        Err(e) => Err(AppError::Other(format!("Keychain delete failed: {}", e))),
    }
}
