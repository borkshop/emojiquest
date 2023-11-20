// @ts-check

// TODO replace with xorbig out of borkshop-js
export function makeRandom(seed = 0xdead_beefn) {
  let randState = seed;
  const rand = () => (randState = randState * 6364136223846793005n + 1442695040888963407n) >> 17n & 0xffff_ffffn;
  /** @param {bigint} n */
  const randn = n => rand() % n;
  const random = () => Number(rand()) / 0x1_0000_0000;
  return { rand, randn, random };
}

/**
 * @param {object} params
 * @param {number} params.width
 * @param {number} params.height
 * @param {() => number} [params.random]
 * @param {number} [params.minSize]
 */
export function makeBSP({
  width, height,
  random = Math.random,
  minSize = 1,
}) {
  /** @param {number} dim */
  const split = dim => {
    const rem = dim - 2 * minSize;
    if (rem < 0) throw new Error('stop splitting sooner');
    if (rem == 0) return minSize;

    for (let sanity = 100; sanity-- > 0;) {
      const split = minSize + random() * rem;
      if (split >= minSize && dim - split >= minSize)
        return Math.floor(split);
    }
    throw new Error('ran out of split sanity');
  };

  /** @typedef {object} QElement
   * @prop {number} x
   * @prop {number} y
   * @prop {number} w
   * @prop {number} h
   * @prop {number} dir
   * @prop {number} depth
   */

  /** @type {QElement|null} */
  let cur = null;

  /** @type {QElement[]} */
  const q = [{
    x: 0,
    y: 0,
    w: width,
    h: height,
    dir: 0,
    depth: 0,
  }];

  let sanity = 2 * Math.log(width) / Math.log(2) * Math.log(height) / Math.log(2);
  const acc = {
    get depth() { return cur ? cur.depth : NaN },

    get left() { return cur ? cur.x : NaN },
    get top() { return cur ? cur.y : NaN },
    get right() { return cur ? cur.x + cur.w : NaN },
    get bottom() { return cur ? cur.y + cur.h : NaN },
    get loc() { return cur ? [cur.x, cur.y] : [NaN, NaN] },

    get width() { return cur ? cur.w : NaN },
    get height() { return cur ? cur.h : NaN },
    get size() { return cur ? [cur.w, cur.h] : [NaN, NaN] },

    get isLeaf() {
      if (!cur) return false;
      const { w, h } = cur;
      return w / 2 < minSize && h / 2 < minSize;
    },

    descend() {
      if (!cur) return;
      const { x, y, w, h, dir: wantDir, depth } = cur;

      const dir = wantDir == 1
        ? (h / 2 >= minSize ? 1 : 0)
        : (w / 2 >= minSize ? 0 : 1);

      if (dir == 0 && w / 2 >= minSize) {
        const spw = split(w);
        q.unshift(
          { x, y, w: spw, h, dir: 1, depth: depth + 1 },
          { x: x + spw, y, w: w - spw, h, dir: 1, depth: depth + 1 },
        );
      }

      else if (dir == 1 && h / 2 >= minSize) {
        const sph = split(h);
        q.unshift(
          { x, y, w, h: sph, dir: 0, depth: depth + 1 },
          { x, y: y + sph, w, h: h - sph, dir: 0, depth: depth + 1 },
        );
      }

    },
  };

  const self = {
    [Symbol.iterator]() { return self },

    /** @returns {IteratorResult<typeof acc>} */
    next() {
      if (--sanity <= 0) throw new Error('BSP ran out of q sanity');
      cur = q.shift() || null;
      if (!cur) return { done: true, value: undefined };
      return { done: false, value: acc };
    },
  };
  return self;
}

/**
 * @param {object} params
 * @param {number} params.left
 * @param {number} params.top
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.hitLimit]
 * @param {number} [params.particleLimit]
 * @param {() => number} [params.random]
 * @param {() => bigint} [params.rand]
 * @param {(x: number, y: number) => boolean} params.test
 * @param {(x: number, y: number) => void} params.set
 * @param {() => Iterable<{x: number, y: number}>} params.all
 * @param {(x: number, y: number, note: string) => void} [params.note]
 */
export function dla({
  left, top,
  width, height,
  hitLimit = width * height / 4,
  particleLimit = 2 * width * height,

  test, set, all,
  random = Math.random,
  rand = makeRandom(BigInt(Math.floor(random() * 65536))).rand,
  note = () => { },
}) {
  // TODO refactor to be animatable / interactable
  // TODO random walker dual of DLA

  const { randn: randStartN } = makeRandom(rand());
  const { random: randHeading } = makeRandom(rand());

  const bw = BigInt(width), bh = BigInt(height);

  /** @returns {[x: number, y: number]} */
  const randStart = () => {
    const j = randStartN(2n * bw + 2n * bh);
    if (j < bw)
      return [left + Number(j), top];
    else if (j < bw + bh)
      return [left + Number(bw - 1n), top + Number(j - bw)];
    else if (j < bw + bh + bw)
      return [left + Number(j - bw - bh), top + Number(bh - 1n)];
    else
      return [left, top + Number(j - bw - bh - bw)];
  };

  /** @param {number} x @param {number} y */
  const inBounds = (x, y) =>
    x > left &&
    y > top &&
    x < left + width - 1 &&
    y < top + height - 1;

  for (
    let hitCount = 0, particleCount = 0;
    hitCount < hitLimit && particleCount < particleLimit;
    particleCount++
  ) {
    const p = randStart();

    // heading deflection
    const headingRange = [NaN, NaN];
    for (const { x, y } of all()) {
      if (inBounds(x, y)) {
        const h = Math.atan2(x - p[0], y - p[1]);
        headingRange[0] = isNaN(headingRange[0]) ? h : Math.min(headingRange[0], h);
        headingRange[1] = isNaN(headingRange[1]) ? h : Math.max(headingRange[1], h);
      }
    }
    if (isNaN(headingRange[0]) || isNaN(headingRange[1])) {
      console.warn('no set cells in bounds');
      console.log('bounds', { left, top, width, height });
      for (const p of all()) console.log(p);
      return;
    }

    const steps = Math.max(Math.ceil(width / 2), Math.ceil(height / 2));

    const h = headingRange[0] + randHeading() * (headingRange[1] - headingRange[0]);
    const d = [Math.sin(h), Math.cos(h)];
    note(...p, 'start');
    for (let i = 0; i < steps; i++) {
      const nx = p[0] + d[0], ny = p[1] + d[1];
      if (!inBounds(nx, ny)) break;

      const at = [Math.floor(nx), Math.floor(ny)];
      note(nx, ny, 'part');
      if (test(at[0], at[1])) {
        const mx = Math.floor(p[0]), my = Math.floor(p[1]);
        if (inBounds(mx, my)) {
          set(mx, my)
          hitCount++;
        }
        break;
      }
      p[0] = nx, p[1] = ny;
    }
  }
}
