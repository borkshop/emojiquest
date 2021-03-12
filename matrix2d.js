// @ts-check

const { sin, cos } = Math;

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 * }} Point
 */

/**
 * @typedef {{
 *   a1: number,
 *   b1: number,
 *   c1: number,
 *   a2: number,
 *   b2: number,
 *   c2: number,
 *   a3: number,
 *   b3: number,
 *   c3: number,
 * }} Matrix
 */

/**
 * @type {Matrix}
 */
export const identity = {
  a1: 1,  b1: 0,  c1: 0,
  a2: 0,  b2: 1,  c2: 0,
  a3: 0,  b3: 0,  c3: 1,
};

/**
 * @param {Matrix} m
 * @param {Matrix} n
 * @returns {Matrix}
 */
export function multiply(m, n) {
  const {
    a1: ma1,  b1: mb1,  c1: mc1, // r1
    a2: ma2,  b2: mb2,  c2: mc2, // r2
    a3: ma3,  b3: mb3,  c3: mc3, // r3
  } = m;
  const {
    //  c1        c2        c3
    a1: na1,  b1: nb1,  c1: nc1,
    a2: na2,  b2: nb2,  c2: nc2,
    a3: na3,  b3: nb3,  c3: nc3,
  } = n;
  return {
    //  r   c     r   c     r   c
    a1: ma1*na1 + mb1*na2 + mc1*na3, // r1*c1
    b1: ma1*nb1 + mb1*nb2 + mc1*nb3, // r1*c2
    c1: ma1*nc1 + mb1*nc2 + mc1*nc3, // r1*c3

    a2: ma2*na1 + mb2*na2 + mc2*na3, // r2*c1
    b2: ma2*nb1 + mb2*nb2 + mc2*nb3, // r2*c2
    c2: ma2*nc1 + mb2*nc2 + mc2*nc3, // r2*c3

    a3: ma3*na1 + mb3*na2 + mc3*na3, // r3*c1
    b3: ma3*nb1 + mb3*nb2 + mc3*nb3, // r3*c2
    c3: ma3*nc1 + mb3*nc2 + mc3*nc3, // r3*c3
  };
}

/**
 * @param {...Matrix} matrixes
 * @returns {Matrix}
 */
export function compose(...matrixes) {
  return matrixes.reduce(multiply, identity);
}

/**
 * @param {Point} point
 * @param {Matrix} matrix
 * @returns {Point}
 */
export function transform(point, matrix) {
  const {
    a1, b1, c1, // r1
    a2, b2, c2, // r2
    // 0, 0, 1  // r3
  } = matrix;
  const {x, y /*, 1*/} = point; // c1
  return {
    // r  c   r  c   r  c(1)
    x: a1*x + b1*y + c1, // r1*c1
    y: a2*x + b2*y + c2, // r2*c2
                         // 1
  };
}

/**
 * @param {Point} vector
 * @returns {Matrix}
 */
export function translate({x, y}) {
  return {
    a1: 1,  b1: 0,  c1: x,
    a2: 0,  b2: 1,  c2: y,
    a3: 0,  b3: 0,  c3: 1,
  };
}

/**
 * @param {number} a
 * @returns {Matrix}
 */
export function rotate(a) {
  return {
    a1: cos(a),  b1: -sin(a), c1: 0,
    a2: sin(a),  b2: cos(a),  c2: 0,
    a3: 0,       b3: 0,       c3: 1,
  };
}

/**
 * @param {number} s
 * @returns {Matrix}
 */
export function scale(s) {
  return {
    a1: s,  b1: 0,  c1: 0,
    a2: 0,  b2: s,  c2: 0,
    a3: 0,  b3: 0,  c3: 1,
  };
}

/**
 * @param {Matrix} matrix
 * @returns {string}
 */
export function matrixStyle(matrix) {
  const {
    a1, b1, c1,
    a2, b2, c2,
  } = matrix;
  return `matrix(${a1}, ${a2}, ${b1}, ${b2}, ${c1}, ${c2})`;
}
