// @ts-check

import {multiply, matrix3dStyle} from './matrix3d.js';

/** @typedef {import('./matrix3d.js').Matrix} Matrix */

const {min, max} = Math;

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} value
 * @returns {number}
 */
function clamp(lo, hi, value) {
  return max(lo, min(hi, value));
}

/**
 * @typedef {{
 *   start: number,
 *   end: number,
 *   matrix(progress: number): Matrix,
 * }} Transition
 */

/**
 * @param {HTMLElement} $context - camera context element
 * @param {Matrix} transform - initial orientation of the camera
 */
export function makeCamera($context, transform) {
  /** @type {Array<Transition>} */
  let transitions = [];

  /**
   * @param {number} duration
   * @param {(progress: number) => Matrix} matrix
   */
  function transition(duration, matrix) {
    const now = Date.now();
    transitions.push({
      start: now,
      end: now + duration,
      matrix,
    })
  }

  /**
   * @param {number} now
   */
  function animate(now) {
    let current = transform;
    transitions = transitions.filter(({start, end, matrix}) => {
      const progress = clamp(0, 1, (now - start) / (end - start));
      current = multiply(matrix(progress), current);
      if (progress >= 1) {
        transform = multiply(matrix(1), transform);
        return false;
      }
      return true;
    });
    $context.style.transform = matrix3dStyle(current);
  }

  $context.style.transform = matrix3dStyle(transform);

  return {animate, transition};
}
