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
 * @callback TransitionFn
 * @param {number} duration
 * @param {(progress: number) => Matrix} matrix
 */

/**
 * @typedef {Object} Camera
 * @prop {TransitionFn} transition
 * @prop {(now: number) => void} animate
 */

/**
 * @param {HTMLElement} $context - camera context element
 * @param {Matrix} transform - initial orientation of the camera
 * @returns {Camera}
 */
export function makeCamera($context, transform) {
  /** @type {Array<Transition>} */
  let transitions = [];

  /** @type {TransitionFn} */
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

    // Consolidate completed transitions
    let completed = 0;
    for (const transition of transitions) {
      const {start, end, matrix} = transition;
      const progress = clamp(0, 1, (now - start) / (end - start));
      if (progress < 1) {
        break;
      }
      transform = multiply(matrix(progress), transform);
      completed++;
    }

    // Shift the complted transitions off.
    transitions.copyWithin(0, completed);
    transitions.length -= completed;

    // Apply all remaining transitions, including completed transitions that
    // follow an incomplete transition.
    let current = transform;
    for (const transition of transitions) {
      const {start, end, matrix} = transition;
      const progress = clamp(0, 1, (now - start) / (end - start));
      current = multiply(matrix(progress), current);
    }

    $context.style.transform = matrix3dStyle(current);
  }

  $context.style.transform = matrix3dStyle(transform);

  return {animate, transition};
}
