import { invoke } from "@tauri-apps/api/core";
import type { FileEntry, FileType } from "../types";
import { useNavigationStore } from "../stores/navigationStore";

/**
 * Handle double-click on a file entry.
 * - Directories: navigate into them
 * - Previewable files: do nothing (preview panel shows them)
 * - Archives (.zip, .tgz, etc): extract in place
 * - Unknown types: open with system default app
 */
export async function handleFileDoubleClick(entry: FileEntry): Promise<void> {
  // Directories: navigate
  if (entry.is_dir) {
    useNavigationStore.getState().navigateTo(entry.path);
    return;
  }

  const fileType = entry.file_type as FileType;

  // Previewable types: do nothing (preview panel handles display)
  const previewableInApp: FileType[] = [
    "image",
    "video",
    "audio",
    "markdown",
    "json",
    "yaml",
    "html",
    "text",
    "code",
    "document", // PDFs are shown in-app
  ];

  if (previewableInApp.includes(fileType)) {
    return; // Let preview panel show it
  }

  // Archives: extract
  if (fileType === "archive") {
    await extractArchive(entry.path);
    return;
  }

  // Unknown types: open with system default
  await openWithSystemApp(entry.path);
}

async function extractArchive(path: string): Promise<void> {
  try {
    await invoke("open_with_system_app", { path });
    // macOS Finder will extract .zip/.tgz automatically when opened
  } catch (err) {
    console.error("Failed to open archive:", err);
    throw err;
  }
}

async function openWithSystemApp(path: string): Promise<void> {
  try {
    await invoke("open_with_system_app", { path });
  } catch (err) {
    console.error("Failed to open file with system app:", err);
    throw err;
  }
}
