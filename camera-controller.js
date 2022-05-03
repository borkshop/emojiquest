/**
 * The camera controller converts motion commands in the Emoji Quest cube world
 * topology to the corresponding animated 3D transitional transformations on
 * the actual camera.
 * For example, the camera controller receives commands like "go north" and
 * then queues up the corresponding animated transition for going north, which
 * will depend on which face of the world the camera is currently oriented
 * toward and whether going north transits to a different face of the world.
 */

// @ts-check

import { translate, rotateX, rotateY, rotateZ } from './matrix3d.js';
import { quarturnVectors } from './geometry2d.js';

/** @typedef {import('./matrix3d.js').Matrix} Matrix */
/** @typedef {import('./camera.js').Camera} Camera */
/** @typedef {import('./daia.js').AdvanceFn} AdvanceFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').Cursor} Cursor */
/** @typedef {import('./daia.js').CursorChange} CursorChange */

/** @typedef {ReturnType<makeCameraController>} CameraController */

/**
 * @callback EaseFn
 * @param {number} p
 * @returns {number}
 */

/** @type {EaseFn} */
const linear = (/** @type {number} */ p) => p;

/**
 * @typedef {(p: number) => Matrix} Roll
 */

/**
 * @param {Object} options
 * @param {Camera} options.camera
 * @param {number} options.tileSizePx
 * @param {AdvanceFn} options.advance
 * @param {EaseFn} [options.ease]
 * @param {EaseFn} [options.easeRoll]
 * @param {number} [options.slow]
 * @param {number} [options.fast]
 *
 */
export function makeCameraController({
  camera,
  tileSizePx,
  advance,
  ease = linear,
  easeRoll = ease,
  fast = 500,
  slow = 1500,
}) {
  /**
   * @type {Array<Roll>}
   */
  const rolls = [
    (/** @type {number} */ p) => rotateX((-Math.PI / 2) * easeRoll(p)),
    (/** @type {number} */ p) => rotateY((-Math.PI / 2) * easeRoll(p)),
    (/** @type {number} */ p) => rotateX((Math.PI / 2) * easeRoll(p)),
    (/** @type {number} */ p) => rotateY((Math.PI / 2) * easeRoll(p)),
  ];

  /**
   * @param {Cursor} at
   * @returns {CursorChange}
   */
  function go(at) {
    const { direction } = at;
    const to = advance(at);
    if (to.transit) {
      // rotations
      camera.transition(slow, rolls[direction]);
      // translations
      camera.transition(slow, (/** @type {number} */ p) =>
        rotateZ((-Math.PI / 2) * to.turn * ease(p)),
      );
    } else {
      const { x: dx, y: dy } = quarturnVectors[direction];
      camera.transition(fast, (/** @type {number} */ p) => {
        const e = ease(p);
        return translate({
          x: -dx * tileSizePx * e,
          y: -dy * tileSizePx * e,
          z: 0,
        });
      });
    }

    return to;
  }

  return { go };
}
