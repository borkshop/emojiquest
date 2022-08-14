/**
 * The 3D matrix module provides utilities for composing affine transforms in
 * three dimensions, using quaternions.
 */

// @ts-check

const { sin, cos } = Math;

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z: number,
 * }} Point
 */

/**
 * @typedef {{
 *   a1: number,
 *   b1: number,
 *   c1: number,
 *   d1: number,
 *   a2: number,
 *   b2: number,
 *   c2: number,
 *   d2: number,
 *   a3: number,
 *   b3: number,
 *   c3: number,
 *   d3: number,
 *   a4: number,
 *   b4: number,
 *   c4: number,
 *   d4: number,
 * }} Matrix
 */

/**
 * @type {Matrix}
 */
export const identity = {
  a1: 1,  b1: 0,  c1: 0,  d1: 0,
  a2: 0,  b2: 1,  c2: 0,  d2: 0,
  a3: 0,  b3: 0,  c3: 1,  d3: 0,
  a4: 0,  b4: 0,  c4: 0,  d4: 1,
};

/**
 * @param {Matrix} m
 * @param {Matrix} n
 * @returns {Matrix}
 */
export function multiply(m, n) {
  const {
    a1: ma1,  b1: mb1,  c1: mc1,  d1: md1, // r1
    a2: ma2,  b2: mb2,  c2: mc2,  d2: md2, // r2
    a3: ma3,  b3: mb3,  c3: mc3,  d3: md3, // r3
    a4: ma4,  b4: mb4,  c4: mc4,  d4: md4, // r4
  } = m;
  const {
    //  c1        c2        c3        c4
    a1: na1,  b1: nb1,  c1: nc1,  d1: nd1,
    a2: na2,  b2: nb2,  c2: nc2,  d2: nd2,
    a3: na3,  b3: nb3,  c3: nc3,  d3: nd3,
    a4: na4,  b4: nb4,  c4: nc4,  d4: nd4,
  } = n;
  return {
    //  r   c     r   c     r   c     r   c
    a1: ma1*na1 + mb1*na2 + mc1*na3 + md1*na4, // r1*c1
    b1: ma1*nb1 + mb1*nb2 + mc1*nb3 + md1*nb4, // r1*c2
    c1: ma1*nc1 + mb1*nc2 + mc1*nc3 + md1*nc4, // r1*c3
    d1: ma1*nd1 + mb1*nd2 + mc1*nd3 + md1*nd4, // r1*c4

    a2: ma2*na1 + mb2*na2 + mc2*na3 + md2*na4, // r2*c1
    b2: ma2*nb1 + mb2*nb2 + mc2*nb3 + md2*nb4, // r2*c2
    c2: ma2*nc1 + mb2*nc2 + mc2*nc3 + md2*nc4, // r2*c3
    d2: ma2*nd1 + mb2*nd2 + mc2*nd3 + md2*nd4, // r2*c4

    a3: ma3*na1 + mb3*na2 + mc3*na3 + md3*na4, // r3*c1
    b3: ma3*nb1 + mb3*nb2 + mc3*nb3 + md3*nb4, // r3*c2
    c3: ma3*nc1 + mb3*nc2 + mc3*nc3 + md3*nc4, // r3*c3
    d3: ma3*nd1 + mb3*nd2 + mc3*nd3 + md3*nd4, // r3*c4

    a4: ma4*na1 + mb4*na2 + mc4*na3 + md4*na4, // r4*c1
    b4: ma4*nb1 + mb4*nb2 + mc4*nb3 + md4*nb4, // r4*c2
    c4: ma4*nc1 + mb4*nc2 + mc4*nc3 + md4*nc4, // r4*c3
    d4: ma4*nd1 + mb4*nd2 + mc4*nd3 + md4*nd4, // r4*c4
  };
}

/**
 * @param {...Matrix} matrixes
 * @returns {Matrix}
 */
export function compose(...matrixes) {
  return matrixes.reduceRight(multiply, identity);
}

/**
 * @param {Point} point
 * @param {Matrix} matrix
 * @returns {Point}
 */
export function transform(point, matrix) {
  const {
    a1, b1, c1, d1, // r1
    a2, b2, c2, d2, // r2
    a3, b3, c3, d3, // r3
    // 0, 0, 0, 1   // r4
  } = matrix;
  const {x, y, z /*, 1*/} = point; // c1
  return {
    // r  c   r  c   r  c   r  c
    x: a1*x + b1*y + c1*z + d1, // r1*c1
    y: a2*x + b2*y + c2*z + d2, // r2*c2
    z: a3*x + b3*y + c3*z + d3, // r3*c3
                                // 1
  };
}

/**
 * @param {Point} vector
 * @returns {Matrix}
 */
export function translate({x, y, z}) {
  return {
    a1: 1,  b1: 0,  c1: 0,  d1: x,
    a2: 0,  b2: 1,  c2: 0,  d2: y,
    a3: 0,  b3: 0,  c3: 1,  d3: z,
    a4: 0,  b4: 0,  c4: 0,  d4: 1,
  };
}

/**
 * @param {number} a
 * @returns {Matrix}
 */
export function rotateX(a) {
  return {
    a1: 1,  b1: 0,       c1: 0,        d1: 0,
    a2: 0,  b2: cos(a),  c2: -sin(a),  d2: 0,
    a3: 0,  b3: sin(a),  c3: cos(a),   d3: 0,
    a4: 0,  b4: 0,       c4: 0,        d4: 1,
  };
}

/**
 * @param {number} a
 * @returns {Matrix}
 */
export function rotateY(a) {
  return {
    a1: cos(a),   b1: 0,  c1: sin(a),  d1: 0,
    a2: 0,        b2: 1,  c2: 0,       d2: 0,
    a3: -sin(a),  b3: 0,  c3: cos(a),  d3: 0,
    a4: 0,        b4: 0,  c4: 0,       d4: 1,
  };
}

/**
 * @param {number} a
 * @returns {Matrix}
 */
export function rotateZ(a) {
  return {
    a1: cos(a),    b1: sin(a),  c1: 0,  d1: 0,
    a2: -sin(a),   b2: cos(a),  c2: 0,  d2: 0,
    a3: 0,         b3: 0,       c3: 1,  d3: 0,
    a4: 0,         b4: 0,       c4: 0,  d4: 1,
  };
}

/**
 * @param {Matrix} matrix
 * @returns {string}
 */
export function matrix3dStyle(matrix) {
  const {
    a1, b1, c1, d1,
    a2, b2, c2, d2,
    a3, b3, c3, d3,
    a4, b4, c4, d4,
  } = matrix;
  return `matrix3d(${a1}, ${a2}, ${a3}, ${a4}, ${b1}, ${b2}, ${b3}, ${b4}, ${c1}, ${c2}, ${c3}, ${c4}, ${d1}, ${d2}, ${d3}, ${d4})`;
}

/**
 * @param {number} s
 * @returns {Matrix}
 */
export function scale(s) {
  return {
    a1: s,  b1: 0,  c1: 0,  d1: 0,
    a2: 0,  b2: s,  c2: 0,  d2: 0,
    a3: 0,  b3: 0,  c3: s,  d3: 0,
    a4: 0,  b4: 0,  c4: 0,  d4: 1,
  };
}

/**
 * @param {Matrix} matrix
 * @returns {Matrix}
 */
export function inverse(matrix) {
  const {
    a1, b1, c1, d1,
    a2, b2, c2, d2,
    a3, b3, c3, d3,
    a4, b4, c4, d4,
  } = matrix;

  const i = {
    a1:  b2*c3*d4 - b2*c4*d3 - c2*b3*d4 + c2*b4*d3 + d2*b3*c4 - d2*b4*c3,
    b1: -b1*c3*d4 + b1*c4*d3 + c1*b3*d4 - c1*b4*d3 - d1*b3*c4 + d1*b4*c3,
    c1:  b1*c2*d4 - b1*c4*d2 - c1*b2*d4 + c1*b4*d2 + d1*b2*c4 - d1*b4*c2,
    d1: -b1*c2*d3 + b1*c3*d2 + c1*b2*d3 - c1*b3*d2 - d1*b2*c3 + d1*b3*c2,

    a2: -a2*c3*d4 + a2*c4*d3 + c2*a3*d4 - c2*a4*d3 - d2*a3*c4 + d2*a4*c3,
    b2:  a1*c3*d4 - a1*c4*d3 - c1*a3*d4 + c1*a4*d3 + d1*a3*c4 - d1*a4*c3,
    c2: -a1*c2*d4 + a1*c4*d2 + c1*a2*d4 - c1*a4*d2 - d1*a2*c4 + d1*a4*c2,
    d2:  a1*c2*d3 - a1*c3*d2 - c1*a2*d3 + c1*a3*d2 + d1*a2*c3 - d1*a3*c2,

    a3:  a2*b3*d4 - a2*b4*d3 - b2*a3*d4 + b2*a4*d3 + d2*a3*b4 - d2*a4*b3,
    b3: -a1*b3*d4 + a1*b4*d3 + b1*a3*d4 - b1*a4*d3 - d1*a3*b4 + d1*a4*b3,
    c3:  a1*b2*d4 - a1*b4*d2 - b1*a2*d4 + b1*a4*d2 + d1*a2*b4 - d1*a4*b2,
    d3: -a1*b2*d3 + a1*b3*d2 + b1*a2*d3 - b1*a3*d2 - d1*a2*b3 + d1*a3*b2,

    a4: -a2*b3*c4 + a2*b4*c3 + b2*a3*c4 - b2*a4*c3 - c2*a3*b4 + c2*a4*b3,
    b4:  a1*b3*c4 - a1*b4*c3 - b1*a3*c4 + b1*a4*c3 + c1*a3*b4 - c1*a4*b3,
    c4: -a1*b2*c4 + a1*b4*c2 + b1*a2*c4 - b1*a4*c2 - c1*a2*b4 + c1*a4*b2,
    d4:  a1*b2*c3 - a1*b3*c2 - b1*a2*c3 + b1*a3*c2 + c1*a2*b3 - c1*a3*b2,
  };

  const determinant = a1*i.a1 + b1*i.a2 + c1*i.a3 + d1*i.a4;

  return multiply(i, scale(determinant));
}
