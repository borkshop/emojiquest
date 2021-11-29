/**
 * The camera manages the animation of the 3D traansform that applies to the
 * whole world such that the camera is oriented over the player cursor.
 */

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
 * @prop {(matrix: Matrix) => void} reset
 */

/**
 * @param {HTMLElement} $context - camera context element
 * @param {Matrix} transform - initial orientation of the camera
 * @returns {Camera}
 */
export function makeCamera($context, transform) {
  /** @type {Array<Transition>} */
  let transitions = [];

  // Absolute time as measured in accumulated elapsed animation time.
  let now = 0;

  /** @type {TransitionFn} */
  function transition(duration, matrix) {
    transitions.push({
      start: now,
      end: now + duration,
      matrix,
    })
  }

  /**
   * @param {number} elapsed
   */
  function animate(elapsed) {
    now += elapsed;

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

  /**
   * @param {Matrix} newTransform
   */
  function reset(newTransform) {
    transform = newTransform;
    transitions.length = 0;
    $context.style.transform = matrix3dStyle(transform);
  }

  reset(transform);

  return {animate, transition, reset};
}
