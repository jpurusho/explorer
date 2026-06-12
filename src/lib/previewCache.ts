import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settingsStore";
import type { FileContent } from "../types";

const MAX_CACHE_SIZE = 10;

// Preview read cap, configurable via Settings (preview_max_mb). Bounds how much
// of a large file is read for preview so a giant file can't hang the UI, while
// being large enough that realistic JSON/log/text files parse fully.
function previewMaxBytes(): number {
  const mb = useSettingsStore.getState().settings.preview_max_mb || 5;
  return mb * 1_000_000;
}

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

  const content = await invoke<FileContent>("read_file_content", { path, maxBytes: previewMaxBytes() });
  cacheSet(path, content);
  return content;
}

/**
 * Prefetch file content into the cache without blocking.
 * Silently ignores errors (prefetching is best-effort).
 */
export function prefetchFileContent(path: string): void {
  if (cache.has(path)) return;
  invoke<FileContent>("read_file_content", { path, maxBytes: previewMaxBytes() })
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

/**
 * Replace a path's cached content directly. Used after an in-app save so the
 * next read returns the freshly-written bytes without re-hitting disk.
 */
export function updateCache(path: string, content: FileContent): void {
  cacheSet(path, content);
}

type Listener = (path: string) => void;
const listeners = new Set<Listener>();

/**
 * Subscribe to content-updated broadcasts. Returns an unsubscribe function.
 * Used by the preview panel to refresh in place when the editor saves.
 */
export function onContentUpdated(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Notify subscribers that `path`'s cached content was just refreshed.
 */
export function emitContentUpdated(path: string): void {
  listeners.forEach((fn) => fn(path));
}
