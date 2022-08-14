/**
 * The daia module provides utilities for mapping the Daia world of Emoji
 * Quest.
 *
 * The Daia world is a cube.
 * Each face of Daia is a square.
 * Within each face, the Daia world has a grid of cells.
 * Each cell corresponds to an index in a flat array.
 * Within each face, the indicies of the array correspond to row-major order.
 * The faces are ordered according to the conventional pips of right handed
 * dice.
 * All of the cells on the same face of the world have the same orientation.
 * Each cell is adjacent to four neighboring cells: north, east, south, and
 * west.
 * Sometimes these neighbors are on adjacent faces of the cube.
 *
 * The remaining details of the Daia world topology are arbitrary
 * but designed for its particular aesthetic.
 * All of the cells along the equatorial faces have the same orientation.
 * According to the pip numbers on dice, these are faces 1, 2, 6, and 5 from
 * west to east around the equator of Daia.
 * Having the same orientation means that travelling from cell to cell,
 * the observer does not need to turn to remain aligned with the latter cell's
 * cardinal directions.
 * According to the pip numbers on dice, the first triad and second
 * triad (faces 1, 2, 3 and faces 4, 5, 6) are thematically related, so
 * travelling among them in order does not require reorientation.
 * This rule dictates the orientation of the top and bottom of the cube,
 * face 4 being north of the equatorial faces and face 3 being south.
 *
 * This module computes the adjacency matrix and the turn vectors for every
 * cell in a Daia representation of a given size.
 * The adjacency matrix is an array of the neighboring cell indicies
 * for every cell, in order from north, east, south, and west.
 * The turn matrix has the same shape and tells whether the heading
 * of a viewer must turn to reorient itself with the cell when moving
 * to each neighbor cell, with a bias for turning clockwise when
 * the viewer needs to turn fully about.
 *
 *      + ←L +
 *      I 3  ↑
 *      ↓    K
 * + I→ + J→ + K→ + L→ +
 * B 5  C 4  D 0  A 1  B
 * ↓    ↓    ↓    ↓    ↓
 * + E→ + F→ + G→ + H→ +
 *                ↑ 2  E
 *                G    ↓
 *                + ←F +
 */

// @ts-check

/** @typedef {import('../lib/vector2d.js').Point} Point */

import { assert } from '../lib/assert.js';
import { north, east, south, west } from '../lib/geometry2d.js';

const no = 0; // steady as she goes
const cw = 1; // clockwise
const af = 2; // about face
const cc = -1; // counter clockwise

// const faceNeighbors = [
// // n, e, s, w
//   [3, 1, 2, 4], // 0
//   [3, 5, 2, 0], // 1
//   [1, 5, 4, 0], // 2
//   [1, 0, 4, 5], // 3
//   [3, 0, 2, 5], // 4
//   [3, 4, 2, 1], // 5
// ];

// TODO invert all these figures so coordinates can be added without inverting
// the turn angle.
export const faceRotations = [
  // n,  e,  s,  w
  [cc, no, cc, no], // 0
  [af, no, no, no], // 1
  [no, cc, af, cw], // 2
  [af, cw, no, cc], // 3
  [no, no, af, no], // 4
  [cw, no, cw, no], // 5
];

/**
 * @typedef {Object} Daia
 * @prop {number} faceSize
 * @prop {number} faceArea
 * @prop {number} worldArea
 * @prop {import('../topology.js').AdvanceFn} advance
 * @prop {import('../topology.js').TileCoordinateFn} tileCoordinate
 * @prop {import('../topology.js').TileNumberFn} tileNumber
 */

/**
 * @param {Object} options
 * @param {number} [options.faceSize]
 * @returns {Daia}
 */
export function makeDaia({ faceSize = 1 }) {
  const faceArea = faceSize * faceSize;
  const worldArea = 6 * faceArea;

  /**
   * @param {{x: number, y: number}} position
   * @param {number} direction
   * @returns {boolean}
   */
  const transits = ({ x, y }, direction) => {
    const end = faceSize - 1;
    return (
      (y === 0 && direction === north) ||
      (x === 0 && direction === west) ||
      (y === end && direction === south) ||
      (x === end && direction === east)
    );
  };

  /**
   * @type {Array<Array<(coord: Point) => number>>}
   */
  const seams = [
    [
      // 0, front, dysia
      (/** @type {Point} */ { x }) => 4 * faceArea - 1 - x * faceSize, // K northward
      (/** @type {Point} */ { y }) => faceArea + y * faceSize, // A eastward
      (/** @type {Point} */ { x }) => 3 * faceArea - faceSize - faceSize * x, // G southward
      (/** @type {Point} */ { y }) =>
        4 * faceArea + faceSize - 1 + y * faceSize, // D westward
    ],
    [
      // 1, right, oria
      (/** @type {Point} */ { x }) => 3 * faceArea + faceSize - 1 - x, // L northward
      (/** @type {Point} */ { y }) => 5 * faceArea + faceSize * y, // B eastward
      (/** @type {Point} */ { x }) => 2 * faceArea + x, // H southward
      (/** @type {Point} */ { y }) => 1 * faceSize * y + faceSize - 1, // A westward
    ],
    [
      // 2, bottom, infra
      (/** @type {Point} */ { x }) => 2 * faceArea - faceSize + x, // H northward
      (/** @type {Point} */ { y }) => 6 * faceArea - faceSize + y, // E eastward
      (/** @type {Point} */ { x }) => 5 * faceArea - 1 - x, // F southward
      (/** @type {Point} */ { y }) => 1 * faceArea - 1 - y, // G westward
    ],
    [
      // 3, top, borea
      (/** @type {Point} */ { x }) => faceArea + faceSize - 1 - x, // L northward
      (/** @type {Point} */ { y }) => faceSize - y - 1, // K eastward
      (/** @type {Point} */ { x }) => 4 * faceArea + x, // J southward
      (/** @type {Point} */ { y }) => 5 * faceArea + y, // I westward
    ],
    [
      // 4, left, occia
      (/** @type {Point} */ { x }) => 4 * faceArea - faceSize + x, // J northward
      (/** @type {Point} */ { y }) => faceSize * y, // D eastward
      (/** @type {Point} */ { x }) => 3 * faceArea - 1 - x, // F southward
      (/** @type {Point} */ { y }) =>
        5 * faceArea + faceSize - 1 + faceSize * y, // C westward
    ],
    [
      // 5, back, euia
      (/** @type {Point} */ { x }) => 3 * faceArea + faceSize * x, // I northward
      (/** @type {Point} */ { y }) => 4 * faceArea + faceSize * y, // C eastward
      (/** @type {Point} */ { x }) =>
        2 * faceArea + faceSize - 1 + faceSize * x, // E southward
      (/** @type {Point} */ { y }) =>
        1 * faceArea + faceSize - 1 + faceSize * y, // B westward
    ],
  ];

  const knits = [
    (/** @type {number} */ t) => t - faceSize, // north
    (/** @type {number} */ t) => t + 1, // west
    (/** @type {number} */ t) => t + faceSize, // south
    (/** @type {number} */ t) => t - 1, // east
  ];

  /** @type {import('../topology.js').TileCoordinateFn} */
  function tileCoordinate(t) {
    const f = Math.floor(t / faceArea);
    assert(f < 6);
    const n = t % faceArea;
    const y = Math.floor(n / faceSize);
    const x = n % faceSize;
    return { t, f, n, x, y };
  }

  /** @type {import('../topology.js').TileNumberFn} */
  function tileNumber({ x, y, f }) {
    return f * faceArea + y * faceSize + x;
  }

  /** @type {import('../topology.js').AdvanceFn} */
  function advance({ position, direction }) {
    const coord = tileCoordinate(position);
    const { f } = coord;
    if (transits(coord, direction)) {
      const rotations = faceRotations[f];
      const turn = rotations[direction];
      return {
        position: seams[f][direction](coord),
        direction: (direction + turn + 4) % 4,
        turn,
        transit: true,
      };
    } else {
      return {
        position: knits[direction](position),
        direction,
        turn: 0,
        transit: false,
      };
    }
  }

  return {
    faceSize,
    faceArea,
    worldArea,
    tileCoordinate,
    tileNumber,
    advance,
  };
}
