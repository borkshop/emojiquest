// @ts-check

/** @typedef {import('../../lib/vector2d.js').Point} Point */

import { mod } from '../../lib/math.js';
import { quarturnVectors } from '../../lib/geometry2d.js';

/**
 * @typedef {Object} Topology
 * @prop {number} area
 * @prop {import('../../topology.js').AdvanceFn} advance
 * @prop {import('../../topology.js').TileCoordinateFn} tileCoordinate
 * @prop {import('../../topology.js').TileNumberFn} tileNumber
 */

/**
 * @param {Object} options
 * @param {Point} options.size
 * @returns {Topology}
 */
export function makeTopology({ size }) {
  const area = size.x * size.y;

  /** @type {import('../../topology.js').TileCoordinateFn} */
  function tileCoordinate(t) {
    const f = 0;
    const n = 0;
    const x = mod(t, size.y);
    const y = Math.floor(mod(t, area) / size.y);
    return { t, f, n, x, y };
  }

  /** @type {import('../../topology.js').TileNumberFn} */
  function tileNumber({ x, y }) {
    return mod(y, size.y) * size.x + mod(x, size.x);
  }

  /** @type {import('../../topology.js').AdvanceFn} */
  function advance({ position: sourcePosition, direction }) {
    const { x, y, f } = tileCoordinate(sourcePosition);
    const { x: dx, y: dy } = quarturnVectors[direction];
    const target = {
      x: x + dx,
      y: y + dy,
      f,
    };
    // Out of bounds
    if (
      target.x < 0 ||
      target.x >= size.x ||
      target.y < 0 ||
      target.y >= size.y
    ) {
      return;
    }
    const targetPosition = tileNumber(target);
    return {
      position: targetPosition,
      direction,
      turn: 0,
      transit: false,
    };
  }

  return {
    area,
    tileCoordinate,
    tileNumber,
    advance,
  };
}
