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
export const turnVectors = [
  {x:  0, y: -1}, // north
  {x:  1, y:  0}, // east
  {x:  0, y:  1}, // south
  {x: -1, y:  0}, // west
];

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
