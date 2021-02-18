// @ts-check

import {north, south, east, west} from './geometry2d.js';

/**
 * @param {number} t
 * @param {(tile: number, direction: number) => number} neighbor
 * @param {number} major
 * @param {number} minor
 * @param {number} r
 * @returns {Generator<number>}
 */
function *arc(t, neighbor, major, minor, r) {
  let u = neighbor(t, minor);
  const r2 = r * r;
  for (let x = 0; x < r; x++) {
    const x2 = x*x;
    let v = u;
    for (let y = 0; x2 + (y+1)*(y+1) < r2; y++) {
      yield v;
      v = neighbor(v, minor);
      // TODO need transformation of the axis vector
    }
    u = neighbor(u, major);
  }
}

/**
 * @param {number} t
 * @param {(tile: number, direction: number) => number} neighbor
 * @param {number} radius
 * @returns {Generator<number>}
 */
export function *circle(t, neighbor, radius) {
  yield t;
  yield *arc(t, neighbor, north, east, radius);
  yield *arc(t, neighbor, east, south, radius);
  yield *arc(t, neighbor, south, west, radius);
  yield *arc(t, neighbor, west, north, radius);
}
