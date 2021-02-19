import {translate, rotateX, rotateY, rotateZ} from './matrix3d.js';
import {faceRotations} from './daia.js';
import {north, south, east, west, turnVectors} from './geometry2d.js';

/** @typedef {import('./camera.js').Camera} Camera */
/** @typedef {import('./daia.js').NeighborFn} NeighborFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */

/**
 * @callback EaseFn
 * @param {number} p
 * @returns {number}
 */

/**
 * @param {Object} options
 * @param {Camera} options.camera
 * @param {EaseFn} options.ease
 * @param {number} options.tileSize
 * @param {NeighborFn} options.neighbor
 * @param {TileCoordinateFn} options.tileCoordinate
 * @param {number} [options.slow]
 * @param {number} [options.fast]
 *
 */
export function makeCameraController({camera, ease, tileSize, neighbor, tileCoordinate, fast = 500, slow = 1500}) {
  /**
   * @param {number} at
   * @param {number} direction
   */
  function go(at, direction) {
    const to = neighbor(at, direction);
    const atCoord = tileCoordinate(at);
    const toCoord = tileCoordinate(to);
    if (atCoord.f !== toCoord.f) {

      // rotations
      if (direction === west) {
        camera.transition(slow, (/** @type {number} */ p) => rotateY(Math.PI/2 * ease(p)));
      } else if (direction === east) {
        camera.transition(slow, (/** @type {number} */ p) => rotateY(-Math.PI/2 * ease(p)));
      } else if (direction === south) {
        camera.transition(slow, (/** @type {number} */ p) => rotateX(Math.PI/2 * ease(p)));
      } else if (direction === north) {
        camera.transition(slow, (/** @type {number} */ p) => rotateX(-Math.PI/2 * ease(p)));
      }

      // translations
      const turn = faceRotations[atCoord.f][direction];
      camera.transition(slow, (/** @type {number} */ p) => rotateZ(-Math.PI/2 * turn * ease(p)));

    } else {
      const {x: dx, y: dy} = turnVectors[direction];
      camera.transition(fast, (/** @type {number} */ p) => {
        const e = ease(p);
        return translate({
          x: -dx * tileSize * e,
          y: -dy * tileSize * e,
          z: 0,
        })
      });
    }

    return to;
  }

  return {go};
}
