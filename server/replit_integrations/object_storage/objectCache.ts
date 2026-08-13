// Small bounded in-memory LRU cache for object bytes fetched from Google Drive,
// so repeat views of the same file (chapter icons, certificates) don't re-hit the
// Drive API every time. Entries are evicted oldest-first once either limit is exceeded.
// Cleared on server restart — this is a speed optimization, not a source of truth.

const MAX_ENTRIES = 100;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100MB

interface CachedObject {
  buffer: Buffer;
  contentType: string;
}

const cache = new Map<string, CachedObject>();
let totalBytes = 0;

export function getCachedObject(fileId: string): CachedObject | undefined {
  const entry = cache.get(fileId);
  if (!entry) return undefined;
  // Refresh recency (Map preserves insertion order; delete+set moves it to the end).
  cache.delete(fileId);
  cache.set(fileId, entry);
  return entry;
}

export function setCachedObject(fileId: string, entry: CachedObject): void {
  if (entry.buffer.length > MAX_TOTAL_BYTES) return; // don't cache single huge files

  const existing = cache.get(fileId);
  if (existing) {
    totalBytes -= existing.buffer.length;
    cache.delete(fileId);
  }

  cache.set(fileId, entry);
  totalBytes += entry.buffer.length;

  while ((cache.size > MAX_ENTRIES || totalBytes > MAX_TOTAL_BYTES) && cache.size > 0) {
    const oldestKey = cache.keys().next().value as string;
    const oldest = cache.get(oldestKey);
    if (oldest) totalBytes -= oldest.buffer.length;
    cache.delete(oldestKey);
  }
}
