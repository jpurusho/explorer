import { invoke } from "@tauri-apps/api/core";
import { imageMimeFromPath } from "./formatters";

const MAX_ENTRIES = 500;

// LRU keyed by path. Map iteration order is insertion order, so we get O(1)
// touch-on-access by delete()+set() — no scanning a parallel access array.
const cache = new Map<string, string>();

// In-flight invokes keyed by path so a fast-scrolling gallery doesn't fire the
// same generate_thumbnail invoke 50 times. Concurrent callers share one promise.
const inflight = new Map<string, Promise<string>>();

export function getThumbnail(path: string): string | undefined {
  const val = cache.get(path);
  if (val !== undefined) {
    // Touch: re-insert to mark as most recently used.
    cache.delete(path);
    cache.set(path, val);
  }
  return val;
}

export function setThumbnail(path: string, dataUrl: string): void {
  if (cache.has(path)) {
    cache.delete(path);
  } else if (cache.size >= MAX_ENTRIES) {
    // Evict the oldest (first inserted) entry.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(path, dataUrl);
}

export function hasThumbnail(path: string): boolean {
  return cache.has(path);
}

/** Load a thumbnail data URL via the Rust backend, sharing in-flight requests
 *  for the same path so a scrolling grid doesn't dispatch duplicate invokes. */
export function loadThumbnail(path: string, size = 300): Promise<string> {
  const cached = getThumbnail(path);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(path);
  if (existing) return existing;

  const p = (async () => {
    try {
      const base64 = await invoke<string>("generate_thumbnail", { path, size });
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      setThumbnail(path, dataUrl);
      return dataUrl;
    } catch {
      // Fall back to a raw read for formats the thumbnail pipeline can't decode
      // (e.g. SVG, exotic image formats). Still cached so we don't refetch.
      const base64 = await invoke<string>("read_image_base64", { path });
      const dataUrl = `data:${imageMimeFromPath(path)};base64,${base64}`;
      setThumbnail(path, dataUrl);
      return dataUrl;
    } finally {
      inflight.delete(path);
    }
  })();

  inflight.set(path, p);
  return p;
}
