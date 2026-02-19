// server/shared/bloom.js
//
// Minimal bloom filter using double hashing (FNV-1a + DJB2).
// Used for compact entity lookup in the browser extension.

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export class BloomFilter {
  /**
   * @param {Uint8Array} bits - the bit array
   * @param {number} numBits - total bits (m)
   * @param {number} numHashes - number of hash functions (k)
   */
  constructor(bits, numBits, numHashes) {
    this.bits = bits;
    this.m = numBits;
    this.k = numHashes;
  }

  /**
   * Create an empty bloom filter sized for n items at the given FP rate.
   */
  static create(numItems, fpRate) {
    const m = Math.ceil(-numItems * Math.log(fpRate) / (Math.LN2 * Math.LN2));
    const k = Math.round((m / numItems) * Math.LN2);
    const bytes = Math.ceil(m / 8);
    return new BloomFilter(new Uint8Array(bytes), m, k);
  }

  add(str) {
    const h1 = fnv1a(str);
    const h2 = djb2(str);
    for (let i = 0; i < this.k; i++) {
      const idx = ((h1 + Math.imul(i, h2)) >>> 0) % this.m;
      this.bits[idx >> 3] |= (1 << (idx & 7));
    }
  }

  has(str) {
    const h1 = fnv1a(str);
    const h2 = djb2(str);
    for (let i = 0; i < this.k; i++) {
      const idx = ((h1 + Math.imul(i, h2)) >>> 0) % this.m;
      if ((this.bits[idx >> 3] & (1 << (idx & 7))) === 0) return false;
    }
    return true;
  }

  /** Serialize to a buffer: [4 bytes m LE][4 bytes k LE][bits...] */
  serialize() {
    const header = new ArrayBuffer(8);
    const view = new DataView(header);
    view.setUint32(0, this.m, true);
    view.setUint32(4, this.k, true);
    const out = new Uint8Array(8 + this.bits.length);
    out.set(new Uint8Array(header), 0);
    out.set(this.bits, 8);
    return out;
  }

  /** Deserialize from a buffer produced by serialize() */
  static deserialize(buffer) {
    const view = new DataView(buffer.buffer || buffer, buffer.byteOffset || 0);
    const m = view.getUint32(0, true);
    const k = view.getUint32(4, true);
    const bits = new Uint8Array(buffer.buffer || buffer, (buffer.byteOffset || 0) + 8);
    return new BloomFilter(bits, m, k);
  }
}
