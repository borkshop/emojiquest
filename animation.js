/**
 * This module captures the a precomputed Progress object.
 * Each property of the progress object represents a different curve.
 * The progress object avoids repetition of common interpolation functions,
 * since in Emoji Quest, every entity moves in tandem after each turn.
 */

// @ts-check

import { clamp } from './math.js';

/**
 * @returns {Promise<number>} - resolves to the current high-res time at the
 * start of the next browser animation frame
 */
export const nextFrame = () => {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

/**
 * @returns {AsyncGenerator<number>} - a stream of elapsed time deltas between
 * animation frames, starting with 0 on the first frame
 */
export async function *frameDeltas() {
  for (
    let t1 = await nextFrame(), t2 = t1;
    /* 🐙 🦑 👾 */;
    t1 = t2, t2 = await nextFrame()
  ) yield t2 - t1;
}

/**
 * @typedef {Object} Progress
 * @prop {number} elapsed
 * @prop {number} linear
 * @prop {number} sinusoidal
 * @prop {number} sinusoidalQuarterTurn
 * @prop {number} bounce
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
  const sinusoidalQuarterTurn = -Math.PI/2 * sinusoidal;
  return {
    elapsed,
    linear,
    sinusoidal,
    sinusoidalQuarterTurn,
    bounce,
  };
}
