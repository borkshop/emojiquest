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

/** @typedef {import('./matrix.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint, easeInOutQuad} from './easing.js';
import {identity, compose, multiply, translate, rotateX, rotateY, rotateZ, matrix3dStyle} from './matrix.js';

const faceSize = 3;
const tileSize = 100;

const faceArea = faceSize * faceSize;
const worldSize = tileSize * faceSize;

const $cube = mustFind('#cube');

/**
 * @typedef {{
 *   start: number,
 *   end: number,
 *   ease(progress: number): number,
 *   matrix(time: number): Matrix,
 * }} Transition
 */

let transform = identity;
/** @type {Array<Transition>} */
let transitions = [];

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    let current = transform;
    transitions = transitions.filter(({start, end, ease, matrix}) => {
      const progress = (now - start) / (end - start);
      current = multiply(matrix(ease(progress)), current);
      if (progress > 1) {
        transform = multiply(matrix(1), transform);
        return false;
      }
      return true;
    });
    $cube.style.transform = matrix3dStyle(current);
  }
}

animate();

/**
 * @param {number} duration
 * @param {(angle: number) => Matrix} axis
 * @param {number} angle
 * @param {(progress: number) => number} ease
 */
function transition(duration, axis, angle, ease) {
  const now = Date.now();
  transitions.push({
    start: now,
    end: now + duration,
    ease,
    matrix(progress) {
      return axis(angle * progress);
    },
  })
}

const no = 0; // steady as she goes
const af = Math.PI; // about face
const cw = -Math.PI/2; // clockwise
const cc = Math.PI/2; // counter clockwise

const faceNeighbors = [
// n, e, s, w
  [3, 1, 2, 4], // 0
  [3, 5, 2, 0], // 1
  [1, 5, 4, 0], // 2
  [1, 0, 4, 5], // 3
  [3, 0, 2, 5], // 4
  [3, 4, 2, 1], // 5
];

const faceRotations = [
// n,  e,  s,  w
  [cc, no, cc, no], // 0
  [af, no, no, no], // 1
  [no, cc, af, cw], // 2
  [af, cw, no, cc], // 3
  [no, no, af, no], // 4
  [cw, no, cw, no], // 5
];

const pop = translate({
  x: -worldSize / 2 + tileSize / 2,
  y: -worldSize / 2 + tileSize / 2,
  z: worldSize / 2
});

const faceTransforms = [
  [], // 0 front
  [rotateY(Math.PI/2)], // 1 right
  [rotateX(-Math.PI/2), rotateZ(-Math.PI/2)], // 2 bottom
  [rotateX(Math.PI/2), rotateZ(-Math.PI/2)], // 3 top
  [rotateY(-Math.PI/2)], // 4 left
  [rotateY(Math.PI)], // 5 back
].map(matrixes => compose(...matrixes, pop));

/**
 * @typedef {Object} TileCoordinate
 * @prop {number} f - face number of tile
 * @prop {number} n - row major index of tile on face
 * @prop {number} x - horizontal position on face
 * @prop {number} y - vertical position on face
 */

/**
 * @param {number} t - tile index
 * @returns {TileCoordinate}
 */
function tileCoordinate(t) {
  const f = Math.floor(t / faceArea);
  const n = t % faceArea;
  const y = Math.floor(n / faceSize);
  const x = n % faceSize;
  return {f, n, x, y};
}

for (let t = 0; t < 6 * faceArea; t += 1) {
  const {f, y, x} = tileCoordinate(t);
  const $tile = document.createElement('div');
  const transform = compose(faceTransforms[f], translate({
    x: tileSize * x,
    y: tileSize * y,
    z: 0,
  }));
  $tile.className = 'tile';
  $tile.style.transform = matrix3dStyle(transform);
  $tile.innerText = `${t}`;
  $cube.appendChild($tile);
}

let onFace = 0;

/**
 * @param {number} dir
 */
function rotate(dir) {
  const to = faceNeighbors[onFace][dir];
  const angle = faceRotations[onFace][dir];
  transition(500, rotateZ, angle, easeInOutQuad);
  onFace = to;
}

const ease = easeInOutQuint;

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'ArrowLeft':
    case 'h': // west
      transition(500, rotateY, Math.PI/2, ease);
      rotate(3);
      break;
    case 'ArrowRight':
    case 'l': // east
      transition(500, rotateY, -Math.PI/2, ease);
      rotate(1);
      break;
    case 'ArrowDown':
    case 'j':
      transition(500, rotateX, Math.PI/2, ease);
      rotate(2); // south
      break;
    case 'ArrowUp':
    case 'k':
      transition(500, rotateX, -Math.PI/2, ease);
      rotate(0); // north
      break;
    default:
      console.log(key);
  }
  $cube.style.transform = matrix3dStyle(transform);
});

