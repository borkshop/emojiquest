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
 * @typedef {Object} CursorChange
 * @prop {number} position
 * @prop {number} direction
 * @prop {number} turn
 * @prop {boolean} transit
 */

/**
 * @callback AdvanceFn
 * @param {Cursor} cursor
 * @returns {CursorChange}
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

/**
 * @callback ToponymFn
 * @param {number} t
 * @returns {string}
 */

import {north, east, south, west, moddivpoint} from './geometry2d.js';
import {compose, inverse, identity, translate, rotateX, rotateY, rotateZ} from './matrix3d.js';

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
  [rotateZ(-Math.PI/2), rotateX(-Math.PI/2)], // 2 bottom
  [rotateZ(-Math.PI/2), rotateX(Math.PI/2)], // 3 top
  [rotateY(-Math.PI/2)], // 4 left
  [rotateY(Math.PI)], // 5 back
].map(matrixes => compose(...matrixes));

const faceNames = [
  'Dysia',
  'Oria',
  'Infra',
  'Borea',
  'Occia',
  'Euia',
];

const arrows = [
  ['↘', '↓', '↙'],
  ['→', '⨯', '←'],
  ['↗', '↑', '↖'],
];

/**
 * @typedef {Object} Daia
 * @prop {number} faceSize
 * @prop {number} tileSize
 * @prop {number} faceArea
 * @prop {number} worldSize
 * @prop {number} worldArea
 * @prop {NeighborFn} neighbor
 * @prop {AdvanceFn} advance
 * @prop {TileCoordinateFn} tileCoordinate
 * @prop {TileNumberFn} tileNumber
 * @prop {TileTransformFn} tileTransform
 * @prop {CameraTransformFn} cameraTransform
 * @prop {ToponymFn} toponym
 */

/**
 * @param {Object} options
 * @param {number} [options.faceSize]
 * @param {number} [options.tileSize]
 * @param {Matrix} [options.transform]
 * @returns {Daia}
 */
export function makeDaia({
  faceSize = 1,
  tileSize = 100,
  transform = identity
}) {
  const faceArea = faceSize * faceSize;
  const worldArea = 6 * faceArea;
  const worldSize = tileSize * faceSize;

  const cornerTransform = translate({
    x: -worldSize / 2 + tileSize / 2,
    y: -worldSize / 2 + tileSize / 2,
    z: worldSize / 2,
  });

  const cornerAdjustment = translate({
    x: - tileSize / 2,
    y: - tileSize / 2,
    z: 0,
  });

  const centerTransform = translate({
    x: worldSize / 2 - tileSize / 2,
    y: worldSize / 2 - tileSize / 2,
    z: -worldSize / 2 + tileSize / 2,
  });

  const faceCorners = faceTransforms.map(matrix => compose(
    cornerTransform,
    matrix,
    transform,
    cornerAdjustment,
  ));

  const faceOrigins = faceTransforms.map(matrix => compose(
    inverse(matrix),
    centerTransform,
  ));

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
    return -1;
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
    if (c === -1) {
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
    if (c === -1) {
      return {
        position: knits[direction](position),
        direction,
        turn: 0,
        transit: false,
      };
    } else {
      const turn = faceRotations[f][direction];
      return {
        position: seams[f][c](coord),
        direction: (direction + turn + 4) % 4,
        turn,
        transit: true,
      };
    }
  }

  /** @type {TileTransformFn} */
  function tileTransform(t) {
    const {f, y, x} = tileCoordinate(t);
    return compose(
      translate({
        x: tileSize * x,
        y: tileSize * y,
        z: 0,
      }),
      faceCorners[f],
    );
  }

  /** @type {CameraTransformFn} */
  function cameraTransform(t) {
    const {f, y, x} = tileCoordinate(t);
    return compose(
      faceOrigins[f],
      translate({
        x: -tileSize * x,
        y: -tileSize * y,
        z: 0,
      }),
    );
  }

  /**
   * @param {number} t
   */
  function toponym(t) {
    const {f, x, y} = tileCoordinate(t);
    const {q: {x: qx, y: qy}, r: {x: rx, y: ry}} = moddivpoint({x, y}, {x: faceSize / 3, y: faceSize / 3})
    const {q: {x: sx, y: sy}, r: {x: tx, y: ty}} = moddivpoint({x: rx, y: ry}, {x: faceSize / 9, y: faceSize / 9})
    const {q: {x: ux, y: uy}, r: {x: vx, y: vy}} = moddivpoint({x: tx, y: ty}, {x: faceSize / 27, y: faceSize / 27})
    return `${faceNames[f]} ${arrows[qy][qx]} ${arrows[sy][sx]} ${arrows[uy][ux]} ${arrows[vy][vx]} @${t}`;
  }

  return {
    faceSize,
    tileSize,
    faceArea,
    worldArea,
    worldSize,
    tileCoordinate,
    tileNumber,
    neighbor,
    advance,
    tileTransform,
    cameraTransform,
    toponym,
  }
}
