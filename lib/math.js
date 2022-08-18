/**
 * This module provides math functions that would feel welcome on the Math
 * namespace but are not there yet.
 */

// @ts-check

const { min, max } = Math;

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} value
 * @returns {number}
 */
export function clamp(lo, hi, value) {
  return max(lo, min(hi, value));
}

/**
 * @param {number} a
 * @param {number} b
 */
export const mod = (a, b) => ((a % b) + b) % b;
