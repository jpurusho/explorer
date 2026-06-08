const MAX_ENTRIES = 500;

const cache = new Map<string, string>();
const accessOrder: string[] = [];

export function getThumbnail(path: string): string | undefined {
  const val = cache.get(path);
  if (val) {
    const idx = accessOrder.indexOf(path);
    if (idx > -1) {
      accessOrder.splice(idx, 1);
      accessOrder.push(path);
    }
  }
  return val;
}

export function setThumbnail(path: string, base64: string): void {
  if (cache.has(path)) {
    cache.set(path, base64);
    return;
  }
  if (cache.size >= MAX_ENTRIES) {
    const evict = accessOrder.shift();
    if (evict) cache.delete(evict);
  }
  cache.set(path, base64);
  accessOrder.push(path);
}

export function hasThumbnail(path: string): boolean {
  return cache.has(path);
}
