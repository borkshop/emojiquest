// @ts-check

/** @typedef {import('./matrix.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
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

// https://gist.github.com/gre/1650294
/** @type {Object<string, (progress: number) => number>} */
const easing = {
  // no easing, no acceleration
  linear: t => t,
  // accelerating from zero velocity
  easeInQuad: t => t*t,
  // decelerating to zero velocity
  easeOutQuad: t => t*(2-t),
  // acceleration until halfway, then deceleration
  easeInOutQuad: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
  // accelerating from zero velocity
  easeInCubic: t => t*t*t,
  // decelerating to zero velocity
  easeOutCubic: t => (--t)*t*t+1,
  // acceleration until halfway, then deceleration
  easeInOutCubic: t => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
  // accelerating from zero velocity
  easeInQuart: t => t*t*t*t,
  // decelerating to zero velocity
  easeOutQuart: t => 1-(--t)*t*t*t,
  // acceleration until halfway, then deceleration
  easeInOutQuart: t => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t,
  // accelerating from zero velocity
  easeInQuint: t => t*t*t*t*t,
  // decelerating to zero velocity
  easeOutQuint: t => 1+(--t)*t*t*t*t,
  // acceleration until halfway, then deceleration
  easeInOutQuint: t => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t
};

const ease = easing.easeInOutQuint;

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'h':
      transition(500, rotateY, Math.PI/2, ease);
      break;
    case 'l':
      transition(500, rotateY, -Math.PI/2, ease);
      break;
    case 'j':
      transition(500, rotateX, Math.PI/2, ease);
      break;
    case 'k':
      transition(500, rotateX, -Math.PI/2, ease);
      break;
    case 'u':
    case 'y':
      transition(500, rotateZ, Math.PI/2, ease);
      break;
    case 'i':
    case 'o':
      transition(500, rotateZ, -Math.PI/2, ease);
      break;
    default:
      console.log(key);
  }
  $cube.style.transform = matrix3dStyle(transform);
});

