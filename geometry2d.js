// @ts-check

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 * }} Point
 */

import {count} from './iteration.js';

/* quarter turns */
export const [north, east, south, west, same] = count();

/** @type {Array<Point>} */
export const quarturnVectors = [
  {x:  0, y: -1}, // north
  {x:  1, y:  0}, // east
  {x:  0, y:  1}, // south
  {x: -1, y:  0}, // west
];

/** @type {Array<Point>} */
export const octurnVectors = [
  {x:  0, y: -1}, // nn
  {x:  1, y: -1}, // ne
  {x:  1, y:  0}, // ee
  {x:  1, y:  1}, // se
  {x:  0, y:  1}, // ss
  {x: -1, y:  1}, // sw
  {x: -1, y:  0}, // ww
  {x: -1, y: -1}, // nw
];

export const quarturnToOcturn = 2;
export const halfOcturn = 4;
export const fullOcturn = 8;

/** @type {Array<Point>} */
export const corners = [
  {x: 0, y: 0},
  {x: 1, y: 0},
  {x: 1, y: 1},
  {x: 0, y: 1},
];

/* eighth slices */
export const [nn, ne, ee, se, ss, sw, ww, nw, oo] = count();

/** @type {Array<Point>} */
export const sliceVectors = [
  {x:  0, y: -1}, // nn
  {x:  1, y: -1}, // ne
  {x:  1, y:  0}, // ee
  {x:  1, y:  1}, // se
  {x:  0, y:  1}, // ss
  {x: -1, y:  1}, // sw
  {x: -1, y:  0}, // ww
  {x: -1, y: -1}, // nw
];

/**
 * @template T
 * @typedef {{q: T, r: T}} ModDiv
 */

/**
 * @param {number} n
 * @param {number} d
 * @returns {ModDiv<number>}
 */
function moddiv(n, d) {
  const q = Math.floor(n / d);
  const r = n - q * d;
  return {q, r};
}

/**
 * @param {Point} n
 * @param {Point} d
 * @returns {ModDiv<Point>}
 */
export function moddivpoint({x, y}, {x: dx, y: dy}) {
  const {q: qx, r: rx} = moddiv(x, dx);
  const {q: qy, r: ry} = moddiv(y, dy);
  return {
    q: {x: qx, y: qy},
    r: {x: rx, y: ry},
  };
}
