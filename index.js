// @ts-check

/** @typedef {import('./matrix.js').Matrix} Matrix */

import {mustFind} from 'cdom/wiring';
import {identity, multiply, rotateX, rotateY} from './matrix.js';

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

let transform = identity;

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'h':
      transform = multiply(rotateY(Math.PI/2), transform);
      break;
    case 'l':
      transform = multiply(rotateY(-Math.PI/2), transform);
      break;
    case 'j':
      transform = multiply(rotateX(Math.PI/2), transform);
      break;
    case 'k':
      transform = multiply(rotateX(-Math.PI/2), transform);
      break;
    default:
      console.log(key);
  }
  $cube.style.transform = matrix3dStyle(transform);
});

