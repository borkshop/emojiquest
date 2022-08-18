// @ts-check

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 * }} Point
 */

/**
 * @param {Point} a
 * @param {Point} b
 */
export const add = (a, b) => {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
};

/**
 * @param {Point} a
 * @param {Point} b
 */
export const dot = (a, b) => {
  return {
    x: a.x * b.x,
    y: a.y * b.y,
  };
};

/**
 * @param {Point} vector
 * @param {number} factor
 */
export const scale = (vector, factor) => {
  return {
    x: vector.x * factor,
    y: vector.y * factor,
  };
};
