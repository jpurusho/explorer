import { format } from "date-fns";

export function formatSize(bytes: number, opts?: { zero?: string }): string {
  if (bytes === 0) return opts?.zero ?? "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(isoString: string, pattern = "MMM d, HH:mm"): string {
  if (!isoString) return "—";
  try {
    return format(new Date(isoString), pattern);
  } catch {
    return "—";
  }
}

/** Last path segment (filename). */
export function basename(path: string): string {
  return path.split("/").pop() || path;
}

/** Parent directory of a path. */
export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

/** Guess an image MIME type from a file path's extension. */
export function imageMimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    default:
      return "image/png";
  }
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
