import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, FileMetadata, FileContent, AppSettings } from "../types";

export async function listDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>("list_directory", { path });
}

export async function readFileContent(
  path: string,
  maxBytes?: number
): Promise<FileContent> {
  return invoke<FileContent>("read_file_content", { path, maxBytes });
}

export async function getFileMetadata(path: string): Promise<FileMetadata> {
  return invoke<FileMetadata>("get_file_metadata", { path });
}

export async function getHomeDirectory(): Promise<string> {
  return invoke<string>("get_home_directory");
}

export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}
