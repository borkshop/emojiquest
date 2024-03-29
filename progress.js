/**
 * This module captures the a precomputed Progress object.
 * Each property of the progress object represents a different curve.
 * The progress object avoids repetition of common interpolation functions,
 * since in Emoji Quest, every entity moves in tandem after each turn.
 */

// @ts-check

import { clamp } from './lib/math.js';

/**
 * @typedef {Object} Progress
 * @prop {number} elapsed
 * @prop {number} linear
 * @prop {number} sinusoidal
 * @prop {number} sinusoidalQuarterTurn
 * @prop {number} bounce
 * @prop {number} enter
 * @prop {number} exit
 */

/**
 * @callback AnimateFn
 * @param {Progress} progress
 */

/**
 * @param {number} elapsed
 * @param {number} turns
 * @returns {Progress}
 */
export function makeProgress(elapsed, turns) {
  const linear = clamp(0, 1, turns);
  const sinusoidal = (1 - Math.cos(Math.PI * linear)) / 2;
  const bounce = (1 - Math.cos(Math.PI * 2 * sinusoidal)) / 16;
  const sinusoidalQuarterTurn = (-Math.PI / 2) * sinusoidal;

  const enter = Math.max(0, sinusoidal * 2 - 1);
  const exit = Math.max(0, 1 - sinusoidal * 2);

  return {
    elapsed,
    linear,
    sinusoidal,
    sinusoidalQuarterTurn,
    bounce,
    exit,
    enter,
  };
}
