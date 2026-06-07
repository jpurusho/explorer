import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let windowCounter = 0;

export async function openNewWindow(startPath?: string) {
  windowCounter++;
  const label = `explorer-${windowCounter}`;
  const params = startPath ? new URLSearchParams({ startPath }) : new URLSearchParams();

  try {
    const webview = new WebviewWindow(label, {
      url: `/?${params.toString()}`,
      title: "Explorer",
      width: 1200,
      height: 800,
      minWidth: 600,
      minHeight: 400,
      decorations: true,
      resizable: true,
      center: true,
    });

    webview.once("tauri://error", () => {});
  } catch {
    // Window creation failed
  }
}

export async function detachPreview(filePath: string, fileName: string, fileType: string) {
  windowCounter++;
  const label = `preview-${windowCounter}`;

  const params = new URLSearchParams({
    detached: "true",
    path: filePath,
    name: fileName,
    type: fileType,
  });

  const width = fileType === "video" || fileType === "image" ? 800 : 600;
  const height = fileType === "video" || fileType === "image" ? 600 : 700;

  try {
    const webview = new WebviewWindow(label, {
      url: `/?${params.toString()}`,
      title: fileName,
      width,
      height,
      minWidth: 400,
      minHeight: 300,
      decorations: true,
      resizable: true,
      center: true,
    });

    webview.once("tauri://error", () => {});
  } catch {
    // Preview window creation failed
  }
}
