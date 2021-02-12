// @ts-check

/** @typedef {import('./matrix.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint, easeInOutQuad} from './easing.js';
import {identity, multiply, rotateX, rotateY, rotateZ} from './matrix.js';

const $cube = mustFind('#cube');

/**
 * @param {Matrix} matrix
 * @returns {string}
 */
function matrix3dStyle(matrix) {
  const {
    a1, b1, c1, d1,
    a2, b2, c2, d2,
    a3, b3, c3, d3,
    a4, b4, c4, d4,
  } = matrix;
  return `matrix3d(${a1}, ${a2}, ${a3}, ${a4}, ${b1}, ${b2}, ${b3}, ${b4}, ${c1}, ${c2}, ${c3}, ${c4}, ${d1}, ${d2}, ${d3}, ${d4})`;
}

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

const no = 0; // steady
const af = Math.PI; // about face
const cw = -Math.PI/2; // clockwise
const cc = Math.PI/2; // counter clockwise

const neighbors = [
// n, e, s, w
  [3, 1, 2, 4], // 0
  [3, 5, 2, 0], // 1
  [0, 1, 5, 4], // 2
  [0, 4, 5, 1], // 3
  [3, 0, 2, 5], // 4
  [3, 4, 2, 1], // 5
];

const rotations = [
// n,  e,  s,  w
  [af, no, no, no], // 0
  [cw, no, cw, no], // 1
  [no, cc, af, cw], // 2
  [af, cw, no, cc], // 3
  [cc, no, cc, no], // 4
  [no, no, af, no], // 5
];

let at = 0;

/**
 * @param {number} dir
 */
function rotate(dir) {
  const to = neighbors[at][dir];
  const angle = rotations[at][dir];
  transition(500, rotateZ, angle, easeInOutQuad);
  at = to;
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

