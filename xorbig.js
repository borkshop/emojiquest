/** This creates a new xoshiro256+ based random number generator.
 * The user may provide a seed in number, string, or ArrayBuffer form.
 * If the seed string is a valid 64-character hex number or a 32-byte
 * ArrayBuffer, then it is loaded directly into the 256-bit generator state.
 * Otherwise the seed input is used to randomly fill the internal 256-bit
 * generator state.
 *
 * The returned generator object has random, randomInt, and randomBigint
 * methods for primitive float, uint32 and uint64 generation respectively.
 * It also has a writeInto(ArrayBuffer) method to generate arbitrary amounts of
 * random bytes.
 *
 * The generator may be saved in toString() form, and later restored by creating
 * a new generator using that string as seed.
 *
 * @param {number|bigint|string|ArrayBuffer} seed
 */
export function makeRandom(seed) {
  const s = new BigUint64Array(4);
  init(s, seed);
  return Object.freeze({
    toString() { return toString(s) },
    toJSON() { return toString(s) },

    random() {
      // TODO validate this against other implementations
      const result = Number(s[3] >> 11n) * Math.pow(2, -53);
      advance(s);
      return result;
    },

    randomInt() {
      const result = s[0] + s[3];
      advance(s);
      return Number((result >> 32n) & 0xffffffffn);
    },

    randomBigint() {
      const result = s[0] + s[3];
      advance(s);
      return result;
    },

    /** @param {ArrayBufferLike} buf */
    writeInto(buf) {
      const view = new DataView(buf);
      let off = 0;
      while (off < view.byteLength) {
        const value = s[0] + s[3];
        // only extract bytes from the upper 32 bits of value, since
        // there's not enough entropy to pass a basic per-byte
        // statistical test otherwise (and even then we have to have
        // wide margins when only hammering on it 1 and 2 bytes at
        // a time)
        switch (view.byteLength - off) {
          case 1:
            view.setUint8(off, Number(value >> 32n));
            off += 1;
            break;

          case 2:
            view.setUint16(off, Number(value >> 32n));
            off += 2;
            break;

          case 3:
            view.setUint16(off, Number(value >> 32n));
            view.setUint8(off + 2, Number(value >> 48n));
            off += 3;
            break;

          default:
            view.setUint32(off, Number(value >> 32n));
            off += 4;
            break;
        }
        advance(s);
      }
      return off;
    },

  });
}

/** This creates a hash object based on the xoshiro256+ random number generator.
 * Input to be hashed may be provided to the update() method.
 * Hash state may be reset() to start computing a new hash.
 * The digest() hashed so far may be retrieved at anytime; for efficiency, the
 * hash digest may also be accessed by writeInto(ArrayBuffer).
 *
 * A hash digest().buffer may also be passed directly to makeRandom() to
 * directly create a random generator seeded from a large amount of input.
 */
export function makeHash() {
  const s = new BigUint64Array(4);
  return Object.freeze({
    toString() { return toString(s) },
    toJSON() { return toString(s) },

    reset() { s.fill(0n) },

    /** @param {string|ArrayBufferLike} strOrData */
    update(strOrData) {
      mixin(s, typeof strOrData == 'string'
        ? codePointParts(strOrData)
        : byteParts(strOrData));
    },

    digest() {
      const d = new Uint8Array(32);
      writeInto(d.buffer);
      return d;
    },

    writeInto,
  });

  /** @param {ArrayBufferLike} buf */
  function writeInto(buf) {
    const view = new DataView(buf);
    let off = 0;
    for (let i = 0; off < view.byteLength && i < s.length; i++) {
      const value = s[i];
      switch (view.byteLength - off) {
        case 1:
          view.setUint8(off, Number((value & 0xff00_0000_0000_0000n) >> 56n));
          off += 1;
          break;

        case 2:
          view.setUint16(off, Number((value & 0xffff_0000_0000_0000n) >> 48n));
          off += 2;
          break;

        case 3:
          view.setUint16(off, Number((value & 0xffff_0000_0000_0000n) >> 48n));
          view.setUint8(off + 2, Number((value & 0x0000_ff00_0000_0000n) >> 40n));
          off += 3;
          break;

        case 4:
          view.setUint32(off, Number((value & 0xffff_ffff_0000_0000n) >> 32n));
          off += 4;
          break;

        case 5:
          view.setUint32(off, Number((value & 0xffff_ffff_0000_0000n) >> 32n));
          view.setUint8(off + 4, Number((value & 0x0000_0000_ff00_0000n) >> 24n));
          off += 5;
          break;

        case 6:
          view.setUint32(off, Number((value & 0xffff_ffff_0000_0000n) >> 32n));
          view.setUint16(off + 4, Number((value & 0x0000_0000_ffff_0000n) >> 16n));
          off += 6;
          break;

        case 7:
          view.setUint32(off, Number((value & 0xffff_ffff_0000_0000n) >> 32n));
          view.setUint16(off + 4, Number((value & 0x0000_0000_ffff_0000n) >> 16n));
          view.setUint8(off + 6, Number((value & 0x0000_0000_0000_ff00n) >> 8n));
          off += 7;
          break;

        default:
          view.setBigUint64(off, value);
          off += 8;
          break;
      }
    }
    return off;
  }
}

/** This generates an (effectively) infinite stream of independent random generators.
* It will technically only generate 2^128 independent generators.
*
* @param {number|bigint|string|ArrayBuffer} seed
*/
export function generateRandoms(seed) {
  const s = new BigUint64Array(4);
  init(s, seed);
  const self = Object.freeze({
    toString() { return toString(s) },
    toJSON() { return toString(s) },
    [Symbol.iterator]() { return self },
    /** @returns {IteratorYieldResult<ReturnType<makeRandom>>} */
    next() {
      const value = makeRandom(s.buffer);
      jump(s);
      return { value };
    },
  });
  return self;
}

/** This generates an (effectively) infinite stream of streams of independent random generators.
 * It will technically only generate 2^64 independent stream starting points,
 * each of which can only be used for 2^64 independent generators.
 *
 * @param {number|bigint|string|ArrayBuffer} seed
 */
export function generateStarts(seed) {
  const s = new BigUint64Array(4);
  init(s, seed);
  const self = {
    toString() { return toString(s) },
    toJSON() { return toString(s) },
    [Symbol.iterator]() { return self },
    /** @returns {IteratorYieldResult<ReturnType<generateRandoms>>} */
    next() {
      const value = generateRandoms(s.buffer);
      longJump(s);
      return { value };
    },
  };
  return self;
}

/** This (re)initializes generator state from a supplied seed.
 * If the seed is a 64-character hex string or a 32-byte buffer, then generator
 * state is set exactly to the given seed.
 * Otherwise splitmix64 is used to fill generator state from a drastically
 * different stream of pseudo-random numbers than xoshiro256+ will later
 * generate.
 *
 * @param {BigUint64Array} s
 * @param {number|bigint|string|ArrayBuffer} seed
 */
function init(s, seed) {
  if (s.length != 4)
    throw new Error('xoshiro256+ generator state must have 4 bigints');

  if (typeof seed == 'string') {
    if (!fromString(s, seed)) {
      s.fill(0n);
      if (!mixin(s, codePointParts(seed))) init(s, 0);
    }
  }

  else if (seed instanceof ArrayBuffer) {
    if (seed.byteLength == s.buffer.byteLength) {
      new Uint8Array(s.buffer).set(new Uint8Array(seed));
    } else {
      s.fill(0n);
      if (!mixin(s, byteParts(seed))) init(s, 0);
    }
  }

  else if (typeof seed == 'number' || typeof seed == 'bigint') {
    fillSplitmix(s, seed);
  }

  else assertNever(seed, 'invalid xoshiro256+ seed, expected a number, string, or ArrayBuffer');
}

/** This returns a 64-character hex string containing all 256 bits of a generator's state.
 * It can be used to serialize generator state.
 *
 * @param {BigUint64Array} s
 */
function toString(s) {
  return s[0].toString(16).padStart(16, '0')
    + s[1].toString(16).padStart(16, '0')
    + s[2].toString(16).padStart(16, '0')
    + s[3].toString(16).padStart(16, '0');
}

/** This resets generator state from a valid 64-character hex string and
 * returns true, or leaves s unchanged and returns false.
 * It can be used to deserialize generator state.
 *
 * @param {BigUint64Array} s
 * @param {string} str
 */
function fromString(s, str) {
  if (str.length != 64) return false;
  let n = 0n;
  try { n = BigInt('0x' + str) } catch (e) { return false }
  s[3] = n & 0xffff_ffff_ffff_ffffn;
  s[2] = (n >>= 64n) & 0xffff_ffff_ffff_ffffn;
  s[1] = (n >>= 64n) & 0xffff_ffff_ffff_ffffn;
  s[0] = (n >>= 64n) & 0xffff_ffff_ffff_ffffn;
  return true;
}

/** Generates bigint parts from the code points of a string.
 * It's primarily intended to be used with mixin().
 *
 * NOTE: since unicode code points only typically come from a 7-24 bit space
 * (heavily skewed towards 7-bit), this should never be used alone to
 * initialize a xoshiro256+ generator.
 *
 * @param {string} str
 */
function* codePointParts(str) {
  for (const unit of str) {
    const codePoint = unit.codePointAt(0) || 0xfffd;
    yield BigInt(codePoint);
  }
}

/** Generates 64-bit bigint parts from an array buffer of arbitrary data.
 * Packs as many bytes as possible into each 64-bit part.
 * It's primarily intended to be used with mixin().
 *
 * @param {ArrayBufferLike} buf
 */
function* byteParts(buf) {
  const view = new DataView(buf);
  let i = 0;
  while (i < view.byteLength) {
    switch (view.byteLength - i) {
      case 7:
        yield BigInt(view.getUint32(i)) << 24n
          | BigInt(view.getUint16(i + 4)) << 8n
          | BigInt(view.getUint8(i + 6));
        break;

      case 6:
        yield BigInt(view.getUint32(i)) << 16n
          | BigInt(view.getUint16(i + 2));
        break;

      case 5:
        yield BigInt(view.getUint32(i)) << 8n
          | BigInt(view.getUint8(i + 4));
        break;

      case 4:
        yield BigInt(view.getUint32(i));
        break;

      case 3:
        yield BigInt(view.getUint16(i)) << 8n
          | BigInt(view.getUint8(i + 2));
        break;

      case 2:
        yield BigInt(view.getUint16(i));
        break;

      case 1:
        yield BigInt(view.getUint8(i));
        break;

      default:
        yield view.getBigUint64(i);
    }
    i += 8;
  }
}

/** This mixes a stream of bigints into a xoshiro256+ generator.
 * It uses splitmix64 similarly to the fillSplitmix(), mixing a part into each
 * state element before passing it to splitmix64, whose output is then used to
 * refill s.
 * It calls the advance() after each round of state regeneration.
 * Any final partial round (modulo 4) is padded out as if 0-valued parts were
 * given, before a final call to advance().
 *
 * This may be used to seed a xoshiro256+ generator from a user supplied
 * string, or as a hash function in its own right, providing up to 256 bits
 * of output extracted from s.
 *
 * TODO evaluate hash quality
 *
 * @param {BigUint64Array} s
 * @param {Iterable<bigint>} parts
 */
function mixin(s, parts) {
  let n = 0;
  let i = 0;
  let si = s[i];
  for (const part of parts) {
    const j = (i + 1) % 4;
    [si, s[j]] = splitmix(si ^ part);
    if (j == 0) {
      advance(s);
      n++;
    }
    i = j;
  }
  if (i > 0) {
    while (i > 0) {
      const j = (i + 1) % 4;
      [si, s[j]] = splitmix(si);
      i = j;
    }
    advance(s);
    n++;
  }
  return n;
}

/** This is the splitmix64 seeding routine alluded to in upstream commentary.
 * It is used to seed a new xoshiro256+ generator from a single 32-bit or 64-bit number
 *
 * TODO: verify this by comparing against other adaptations
 *
 * @param {BigUint64Array} s
 * @param {number|bigint} seed
 */
function fillSplitmix(s, seed) {
  let n = typeof seed == 'bigint' ? seed : BigInt(seed);
  [n, s[0]] = splitmix(n);
  [n, s[1]] = splitmix(n);
  [n, s[2]] = splitmix(n);
  [n, s[3]] = splitmix(n);
}

/** This is the xoshiro256+ next() function without result extraction.
 *
 * Adapted in 2021 by Joshua Corbin from https://prng.di.unimi.it/xoshiro256plus.c
 *
 * Written in 2018 by David Blackman and Sebastiano Vigna (vigna@acm.org)
 *
 * To the extent possible under law, the author has dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/>.
 *
 * This is xoshiro256+ 1.0, our best and fastest generator for
 * floating-point numbers.
 * We suggest to use its upper bits for floating-point generation,
 * as it is slightly faster than xoshiro256++/xoshiro256**.
 * It passes all tests we are aware of except for the lowest three bits,
 * which might fail linearity tests (and just those),
 * so if low linear complexity is not considered an issue (as it is usually
 * the case) it can be used to generate 64-bit outputs, too.
 *
 * We suggest to use a sign test to extract a random Boolean value,
 * and right shifts to extract subsets of bits.
 *
 * The state must be seeded so that it is not everywhere zero.
 * If you have a 64-bit seed, we suggest to seed a splitmix64 generator and
 * use its output to fill s.
 *
 * @param {BigUint64Array} s
 */
function advance(s) {
  const t = s[1] << 17n;

  s[2] ^= s[0];
  s[3] ^= s[1];
  s[1] ^= s[2];
  s[0] ^= s[3];

  s[2] ^= t;

  // s[3] = rotl(s[3], 45n)
  const x = s[3];
  s[3] = (x << 45n) | (x >> 19n);
}

/** This is the jump function for the generator.
 * It is equivalent to 2^128 calls to advance().
 * It can be used to generate 2^128 non-overlapping subsequences for parallel computations.
 *
 * @param {BigUint64Array} s
 */
function jump(s) {
  let s0 = 0n;
  let s1 = 0n;
  let s2 = 0n;
  let s3 = 0n;
  for (const JUMP of [
    0x180ec6d33cfd0aban,
    0xd5a61266f0c9392cn,
    0xa9582618e03fc9aan,
    0x39abdc4529b1661cn,
  ]) for (let b = 0n; b < 64; b++) {
    if (JUMP & 1n << b) {
      s0 ^= s[0];
      s1 ^= s[1];
      s2 ^= s[2];
      s3 ^= s[3];
    }
    advance(s);
  }
  s[0] = s0;
  s[1] = s1;
  s[2] = s2;
  s[3] = s3;
}

/** This is the long-jump function for the generator.
 * It is equivalent to 2^192 calls to advance().
 * It can be used to generate 2^64 starting points,
 * from each of which jump() will generate 2^64 non-overlapping subsequences for parallel distributed computations.
 *
 * @param {BigUint64Array} s
 */
function longJump(s) {
  let s0 = 0n;
  let s1 = 0n;
  let s2 = 0n;
  let s3 = 0n;
  for (const LONG_JUMP of [
    0x76e15d3efefdcbbfn,
    0xc5004e441c522fb3n,
    0x77710069854ee241n,
    0x39109bb02acbe635n,
  ]) for (let b = 0n; b < 64; b++) {
    if (LONG_JUMP & 1n << b) {
      s0 ^= s[0];
      s1 ^= s[1];
      s2 ^= s[2];
      s3 ^= s[3];
    }
    advance(s);
  }
  s[0] = s0;
  s[1] = s1;
  s[2] = s2;
  s[3] = s3;
}

/** This is the splitmix64 next function, used to seed xoshiro256+ above.
 *
 * Adapted in 2021 by Joshua Corbin from https://prng.di.unimi.it/splitmix64.c
 *
 * Written in 2015 by Sebastiano Vigna (vigna@acm.org)
 *
 * To the extent possible under law, the author has dedicated all copyright
 * and related and neighboring rights to this software to the public domain
 * worldwide. This software is distributed without any warranty.
 *
 * See <http://creativecommons.org/publicdomain/zero/1.0/>.
 *
 * This is a fixed-increment version of Java 8's SplittableRandom generator
 * See http://dx.doi.org/10.1145/2714064.2660195 and 
 * http://docs.oracle.com/javase/8/docs/api/java/util/SplittableRandom.html
 *
 * It is a very fast generator passing BigCrush, and it can be useful if
 * for some reason you absolutely want 64 bits of state.
 *
 * @param {bigint} x
 */
function splitmix(x) {
  let z = (x += 0x9e3779b97f4a7c15n);
  z = (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n;
  z = (z ^ (z >> 27n)) * 0x94d049bb133111ebn;
  return [x, z ^ (z >> 31n)];
}

/**
 * @param {never} _
 * @param {string} desc
 */
function assertNever(_, desc) {
  throw new Error(desc);
}
