// @ts-check

import {north, south, east, west} from './geometry2d.js';

/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 */

/**
 * @param {number} direction
 * @param {number} angle
 * @returns {number}
 */
function turn(direction, angle) {
  return (direction + 4 + angle) % 4;
}

/**
 * @param {number} position
 * @param {AdvanceFn} advance
 * @param {number} direction
 * @param {number} r
 * @returns {Generator<number>}
 */
function *arc(position, advance, direction, r) {
  let major = advance({position, direction: turn(direction, 1)});
  const r2 = r * r;
  for (let x = 0; x < r; x++) {
    const x2 = (x+1)*(x+1);
    let minor = {position: major.position, direction: turn(major.direction, -1)};
    for (let y = 0; x2 + y*y < r2; y++) {
      yield minor.position;
      minor = advance(minor);
    }
    major = advance(major);
  }
}

/**
 * @param {number} t
 * @param {AdvanceFn} advance
 * @param {number} radius
 * @returns {Generator<number>}
 */
export function *circle(t, advance, radius) {
  yield t;
  yield *arc(t, advance, north, radius);
  yield *arc(t, advance, east, radius);
  yield *arc(t, advance, south, radius);
  yield *arc(t, advance, west, radius);
}
