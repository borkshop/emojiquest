// @ts-check

export default function makeMortonMap() {
  /** @type {Map<bigint, Set<number>>} */
  const idsAt = new Map();

  return {
    clear() {
      idsAt.clear();
    },

    /** @param {number} x @param {number} y */
    at(x, y) {
      if (x < 0 || y < 0) return {
        *[Symbol.iterator]() { },
        get count() { return 0 },
        has() { return false },
        add() { throw new Error('out of bounds') },
        del() { throw new Error('out of bounds') },
      };

      const key = mortonKey(x, y);
      return {
        *[Symbol.iterator]() {
          let ids = idsAt.get(key);
          if (ids) yield* ids;
        },

        get count() { return idsAt.get(key)?.size || 0 },

        /** @param {number} id */
        has(id) { return idsAt.get(key)?.has(id) || false },

        /** @param {number} id */
        add(id) {
          let ids = idsAt.get(key);
          if (!ids) idsAt.set(key, ids = new Set());
          ids.add(id);
        },

        /** @param {number} id */
        del(id) {
          let ids = idsAt.get(key);
          if (ids) ids.delete(id);
        },

      };
    },
  };
}
/** @typedef {ReturnType<makeMortonMap>} MortonMap */

/** @param {number} x @param {number} y */
export function mortonKey(x, y) {
  const bx = BigInt(Math.floor(x));
  const by = BigInt(Math.floor(y));
  return mortonSpread1(bx) | mortonSpread1(by) << 1n;
}

/** @param {bigint} key */
export function mortonPoint(key) {
  const bx = mortonCompact1(key);
  const by = mortonCompact1(key >> 1n);
  return { x: Number(bx), y: Number(by) };
}

/** @param {bigint} x */
export function mortonSpread1(x) {
  const min = 0, max = 2n ** 32n - 1n;
  if (x < min || x > max)
    throw RangeError('Number not within acceptable 32-bit range');
  x = BigInt.asUintN(32, x);
  x = x & 0x0000_0000_FFFF_FFFFn; // mask lower 32-bit syllable (double word)
  x = (x | (x << 16n)) & 0x0000_FFFF_0000_FFFFn; // spread 16-bit syllables (words)
  x = (x | (x << 8n)) & 0x00FF_00FF_00FF_00FFn; // spread 8-bit syllables (bytes)
  x = (x | (x << 4n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // spread 4-bit syllables (nibbles)
  x = (x | (x << 2n)) & 0x3333_3333_3333_3333n; // spread 2-bit syllables
  x = (x | (x << 1n)) & 0x5555_5555_5555_5555n; // spread bits, even parity
  return x;
}

/** @param {bigint} x */
export function mortonCompact1(x) {
  x = x & 0x5555_5555_5555_5555n; // mask even parity bits
  x = (x | (x >> 1n)) & 0x3333_3333_3333_3333n; // compact bits
  x = (x | (x >> 2n)) & 0x0F0F_0F0F_0F0F_0F0Fn; // compact 2-bit syllables
  x = (x | (x >> 4n)) & 0x00FF_00FF_00FF_00FFn; // compact 4-bit syllables (nibbles)
  x = (x | (x >> 8n)) & 0x0000_FFFF_0000_FFFFn; // compact 8-bit syllables (bytes)
  x = (x | (x >> 16n)) & 0x0000_0000_FFFF_FFFFn; // compact 16-bit syllables (words)
  x = BigInt.asUintN(32, x);
  return x;
}

