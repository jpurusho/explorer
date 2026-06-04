import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

let windowCounter = 0;

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

    webview.once("tauri://created", () => {
      console.log(`Preview window "${label}" created`);
    });

    webview.once("tauri://error", (e) => {
      console.error(`Failed to create preview window "${label}":`, e);
    });
  } catch (err) {
    console.error("Error creating WebviewWindow:", err);
  }
}
