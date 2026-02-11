// wikilinker/lib/cache.js
//
// File-based page cache with LRU eviction. Stores fetched HTML on disk
// keyed by URL (MD5-hashed), and maintains a JSON index of entries with
// timestamps and sizes. Enforces a configurable max total size (default 1 GB).
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export class Cache {
  constructor(options = {}) {
    this.dir = options.dir || './cache';
    this.maxSize = options.maxSize || 1024 * 1024 * 1024; // 1GB default
    this.ttl = options.ttl || 60 * 60 * 1000; // 1 hour default
    this.indexFile = path.join(this.dir, 'index.json');
    this.index = null; // { key: { file, size, accessed } }
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
    try {
      const data = await fs.readFile(this.indexFile, 'utf8');
      this.index = JSON.parse(data);
    } catch {
      this.index = {};
    }
  }

  async saveIndex() {
    await fs.writeFile(this.indexFile, JSON.stringify(this.index, null, 2));
  }

  hashKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }

  async get(key) {
    if (!this.index) await this.init();

    const entry = this.index[key];
    if (!entry) return null;

    // TTL check — expire stale entries
    if (Date.now() - entry.accessed > this.ttl) {
      try { await fs.unlink(path.join(this.dir, entry.file)); } catch { /* ignore */ }
      delete this.index[key];
      await this.saveIndex();
      return null;
    }

    try {
      const filePath = path.join(this.dir, entry.file);
      const data = await fs.readFile(filePath, 'utf8');
      entry.accessed = Date.now();
      await this.saveIndex();
      return data;
    } catch {
      delete this.index[key];
      await this.saveIndex();
      return null;
    }
  }

  async set(key, value) {
    if (!this.index) await this.init();

    const size = Buffer.byteLength(value, 'utf8');

    // Evict old entries if needed
    await this.evictIfNeeded(size);

    const hash = this.hashKey(key);
    const file = `${hash}.txt`;
    const filePath = path.join(this.dir, file);

    await fs.writeFile(filePath, value, 'utf8');

    this.index[key] = {
      file,
      size,
      accessed: Date.now()
    };

    await this.saveIndex();
  }

  async evictIfNeeded(newSize) {
    let totalSize = Object.values(this.index).reduce((sum, e) => sum + e.size, 0);

    while (totalSize + newSize > this.maxSize && Object.keys(this.index).length > 0) {
      // Find oldest entry
      let oldestKey = null;
      let oldestTime = Infinity;

      for (const [key, entry] of Object.entries(this.index)) {
        if (entry.accessed < oldestTime) {
          oldestTime = entry.accessed;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const entry = this.index[oldestKey];
        const filePath = path.join(this.dir, entry.file);

        try {
          await fs.unlink(filePath);
        } catch {
          // File may already be gone
        }

        totalSize -= entry.size;
        delete this.index[oldestKey];
      }
    }
  }

  async clear() {
    if (!this.index) await this.init();

    for (const entry of Object.values(this.index)) {
      try {
        await fs.unlink(path.join(this.dir, entry.file));
      } catch {
        // Ignore
      }
    }

    this.index = {};
    await this.saveIndex();
  }
}
