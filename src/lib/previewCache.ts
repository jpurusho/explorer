import { invoke } from "@tauri-apps/api/core";
import type { FileContent } from "../types";

const MAX_CACHE_SIZE = 10;

// Preview read cap. Larger than the 1MB backend default so realistic JSON/log/
// text files parse fully, but still bounded so a giant file can't hang the UI.
const PREVIEW_MAX_BYTES = 5_000_000;

/**
 * Simple LRU cache for file content previews.
 * Uses a Map where insertion order tracks recency (most recent at end).
 */
const cache = new Map<string, FileContent>();

function cacheGet(key: string): FileContent | undefined {
  const value = cache.get(key);
  if (value === undefined) return undefined;
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key: string, value: FileContent): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CACHE_SIZE) {
    // Evict least recently used (first entry)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, value);
}

/**
 * Fetch file content, returning from cache if available.
 * Stores the result in cache for future lookups.
 */
export async function fetchFileContent(path: string): Promise<FileContent> {
  const cached = cacheGet(path);
  if (cached) return cached;

  const content = await invoke<FileContent>("read_file_content", { path, maxBytes: PREVIEW_MAX_BYTES });
  cacheSet(path, content);
  return content;
}

/**
 * Prefetch file content into the cache without blocking.
 * Silently ignores errors (prefetching is best-effort).
 */
export function prefetchFileContent(path: string): void {
  if (cache.has(path)) return;
  invoke<FileContent>("read_file_content", { path, maxBytes: PREVIEW_MAX_BYTES })
    .then((content) => {
      cacheSet(path, content);
    })
    .catch(() => {
      // Prefetch failures are non-critical
    });
}

/**
 * Invalidate a specific path from the cache (e.g., after editing a file).
 */
export function invalidateCache(path: string): void {
  cache.delete(path);
}
