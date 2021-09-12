/**
 * This module captures the a precomputed Progress object.
 * Each property of the progress object represents a different curve.
 * The progress object avoids repetition of common interpolation functions,
 * since in Emoji Quest, every entity moves in tandem after each turn.
 */

// @ts-check

import { clamp } from './math.js';

/**
 * @typedef {Object} Progress
 * @prop {number} now
 * @prop {number} linear
 * @prop {number} sinusoidal
 * @prop {number} sinusoidalQuarterTurn
 * @prop {number} bounce
 */

/**
 * @param {number} start
 * @param {number} now
 * @param {number} duration
 */
export function makeProgress(start, now, duration) {
  const linear = clamp(0, 1, (now - start) / duration);
  const sinusoidal = (1 - Math.cos(Math.PI * linear)) / 2;
  const bounce = (1 - Math.cos(Math.PI * 2 * sinusoidal)) / 16;
  const sinusoidalQuarterTurn = -Math.PI/2 * sinusoidal;
  return {
    now,
    linear,
    sinusoidal,
    sinusoidalQuarterTurn,
    bounce,
  };
}

/**
 * @callback AnimateFn
 * @param {Progress} progress
 */
