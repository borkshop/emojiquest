// @ts-check

/*
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

/** @typedef {import('./matrix3d.js').Matrix} Matrix */

/**
 * @typedef {Object} TileCoordinate
 * @prop {number} t - tile number
 * @prop {number} f - face number of tile
 * @prop {number} n - row major index of tile on face
 * @prop {number} x - horizontal position on face
 * @prop {number} y - vertical position on face
 */

/**
 * @typedef {Object} TileQuery
 * @prop {number} f - face number of tile
 * @prop {number} x - horizontal position on face
 * @prop {number} y - vertical position on face
 */

/**
 * @callback TileCoordinateFn
 * @param {number} t - tile index
 * @returns {TileCoordinate}
 */

/**
 * @callback TileNumberFn
 * @param {TileQuery} coord - tile coordinate
 * @returns {number}
 */

/**
 * @callback NeighborFn
 * @param {number} t
 * @param {number} direction
 * @returns {number}
 */

/**
 * @typedef {Object} Cursor
 * @prop {number} position
 * @prop {number} direction
 */

/**
 * @callback AdvanceFn
 * @param {Cursor} cursor
 * @returns {Cursor}
 */

/**
 * @callback TileTransformFn
 * @param {number} t
 * @returns {Matrix}
 */

/**
 * @callback CameraTransformFn
 * @param {number} t
 * @returns {Matrix}
 */

import {north, east, south, west, same} from './geometry2d.js';
import {compose, multiply, translate, rotateX, rotateY, rotateZ} from './matrix3d.js';

const no =  0; // steady as she goes
const cw =  1; // clockwise
const af =  2; // about face
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

export const faceRotations = [
// n,  e,  s,  w
  [cc, no, cc, no], // 0
  [af, no, no, no], // 1
  [no, cc, af, cw], // 2
  [af, cw, no, cc], // 3
  [no, no, af, no], // 4
  [cw, no, cw, no], // 5
];

const faceTransforms = [
  [], // 0 front
  [rotateY(Math.PI/2)], // 1 right
  [rotateX(-Math.PI/2), rotateZ(-Math.PI/2)], // 2 bottom
  [rotateX(Math.PI/2), rotateZ(-Math.PI/2)], // 3 top
  [rotateY(-Math.PI/2)], // 4 left
  [rotateY(Math.PI)], // 5 back
].map(matrixes => compose(...matrixes));

/**
 * @param {Object} options
 * @param {number} options.faceSize
 * @param {number} options.tileSize
 * @returns {{
 *   faceSize: number,
 *   tileSize: number,
 *   faceArea: number,
 *   worldSize: number,
 *   neighbor: NeighborFn,
 *   advance: AdvanceFn,
 *   tileCoordinate: TileCoordinateFn,
 *   tileNumber: TileNumberFn,
 *   tileTransform: TileTransformFn,
 *   cameraTransform: CameraTransformFn,
 * }}
 */
export function makeDaia({faceSize, tileSize}) {
  const faceArea = faceSize * faceSize;
  const worldSize = tileSize * faceSize;

  const cornerTransform = translate({
    x: -worldSize / 2 + tileSize / 2,
    y: -worldSize / 2 + tileSize / 2,
    z: worldSize / 2,
  });

  const originTransform = translate({
    x: worldSize / 2 - tileSize / 2,
    y: worldSize / 2 - tileSize / 2,
    z: -worldSize / 2 + tileSize / 2,
  });

  const faceCorners = faceTransforms.map(matrix => multiply(matrix, cornerTransform));
  const faceOrigins = faceTransforms.map(matrix => multiply(matrix, originTransform));

  /**
   * @param {{x: number, y: number}} position
   * @param {number} direction
   * @returns {number}
   */
  function transitCase({x, y}, direction) {
    if (y === 0 && direction === north) return north;
    if (x === faceSize - 1 && direction === east) return east;
    if (y === faceSize - 1 && direction === south) return south;
    if (x === 0 && direction === west) return west;
    return same;
  }

  /**
   * @type {Array<Array<(coord: TileCoordinate) => number>>}
   */
  const seams = [
    [ // 0, front, dysia
      (/** @type {TileCoordinate} */{x}) => 4 * faceArea - 1 - x * faceSize, // K northward
      (/** @type {TileCoordinate} */{y}) => faceArea + y * faceSize, // A eastward
      (/** @type {TileCoordinate} */{x}) => 3 * faceArea - faceSize - faceSize * x, // G southward
      (/** @type {TileCoordinate} */{y}) => 4 * faceArea + faceSize - 1 + y * faceSize, // D westward
    ],
    [ // 1, right, oria
      (/** @type {TileCoordinate} */{x}) => 3 * faceArea + faceSize - 1 - x, // L northward
      (/** @type {TileCoordinate} */{y}) => 5 * faceArea + faceSize * y, // B eastward
      (/** @type {TileCoordinate} */{x}) => 2 * faceArea + x, // H southward
      (/** @type {TileCoordinate} */{y}) => 1 * faceSize * y + faceSize - 1, // A westward
    ],
    [ // 2, bottom, infra
      (/** @type {TileCoordinate} */{x}) => 2 * faceArea - faceSize + x, // H northward
      (/** @type {TileCoordinate} */{y}) => 6 * faceArea - faceSize + y, // E eastward
      (/** @type {TileCoordinate} */{x}) => 5 * faceArea - 1 - x, // F southward
      (/** @type {TileCoordinate} */{y}) => 1 * faceArea - 1 - y, // G westward
    ],
    [ // 3, top, borea
      (/** @type {TileCoordinate} */{x}) => faceArea + faceSize - 1 - x, // L northward
      (/** @type {TileCoordinate} */{y}) => faceSize - y - 1, // K eastward
      (/** @type {TileCoordinate} */{x}) => 4 * faceArea + x, // J southward
      (/** @type {TileCoordinate} */{y}) => 5 * faceArea + y, // I westward
    ],
    [ // 4, left, occia
      (/** @type {TileCoordinate} */{x}) => 4 * faceArea - faceSize + x, // J northward
      (/** @type {TileCoordinate} */{y}) => faceSize * y, // D eastward
      (/** @type {TileCoordinate} */{x}) => 3 * faceArea - 1 - x, // F southward
      (/** @type {TileCoordinate} */{y}) => 5 * faceArea + faceSize - 1 + faceSize * y, // C westward
    ],
    [ // 5, back, euia
      (/** @type {TileCoordinate} */{x}) => 3 * faceArea + faceSize * x, // I northward
      (/** @type {TileCoordinate} */{y}) => 4 * faceArea + faceSize * y, // C eastward
      (/** @type {TileCoordinate} */{x}) => 2 * faceArea + faceSize - 1 + faceSize * x, // E southward
      (/** @type {TileCoordinate} */{y}) => 1 * faceArea + faceSize - 1 + faceSize * y, // B westward
    ],
  ];

  const knits = [
    (/** @type {number} */ t) => t - faceSize, // north
    (/** @type {number} */ t) => t + 1, // west
    (/** @type {number} */ t) => t + faceSize, // south
    (/** @type {number} */ t) => t - 1, // east
  ];

  /** @type {TileCoordinateFn} */
  function tileCoordinate(t) {
    const f = Math.floor(t / faceArea);
    const n = t % faceArea;
    const y = Math.floor(n / faceSize);
    const x = n % faceSize;
    return {t, f, n, x, y};
  }

  /** @type {TileNumberFn} */
  function tileNumber({x, y, f}) {
    return f * faceArea + y * faceSize + x;
  }

  /** @type {NeighborFn} */
  function neighbor(t, direction) {
    const coord = tileCoordinate(t);
    const {f} = coord;
    const c = transitCase(coord, direction);
    if (c === same) {
      return knits[direction](t);
    } else {
      return seams[f][c](coord);
    }
  }

  /** @type {AdvanceFn} */
  function advance({position, direction}) {
    const coord = tileCoordinate(position);
    const {f} = coord;
    const c = transitCase(coord, direction);
    if (c === same) {
      return {
        position: knits[direction](position),
        direction,
      };
    } else {
      return {
        position: seams[f][c](coord),
        direction: (direction + faceRotations[f][direction] + 4) % 4,
      };
    }
  }

  /** @type {TileTransformFn} */
  function tileTransform(t) {
    const {f, y, x} = tileCoordinate(t);
    return multiply(faceCorners[f], translate({
      x: tileSize * x,
      y: tileSize * y,
      z: 0,
    }));
  }

  /** @type {CameraTransformFn} */
  function cameraTransform(t) {
    const {f, y, x} = tileCoordinate(t);
    return multiply(faceOrigins[f], translate({
      x: -tileSize * x,
      y: -tileSize * y,
      z: 0,
    }));
  }

  return {
    faceSize,
    tileSize,
    faceArea,
    worldSize,
    tileCoordinate,
    tileNumber,
    neighbor,
    advance,
    tileTransform,
    cameraTransform,
  }
}
