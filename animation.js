// @ts-check

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
 * @typedef {Object} Progress
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
    linear,
    sinusoidal,
    sinusoidalQuarterTurn,
    bounce,
  };
}

