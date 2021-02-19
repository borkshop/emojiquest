// @ts-check

import {matrix3dStyle} from './matrix3d.js';

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */

/**
 * @callback TileEntersFn
 * @param {number} tile
 */

/**
 * @callback TileExitsFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileRenderer
 * @prop {TileEntersFn} tileEnters
 * @prop {TileExitsFn} tileExits
 */

/**
 * @param {HTMLElement} $context
 * @param {TileTransformFn} tileTransform
 * @param {(tile: number) => HTMLElement} createElement
 * @return {TileRenderer}
 */
export function makeTileRenderer($context, tileTransform, createElement) {
  const $tiles = new Map()

  /**
   * @param {number} t
   */
  function tileEnters(t) {
    const transform = tileTransform(t);
    const $tile = createElement(t);
    $tile.style.transform = matrix3dStyle(transform);
    $context.appendChild($tile);
    $tiles.set(t, $tile);
  }

  /**
   * @param {number} t
   */
  function tileExits(t) {
    const $tile = $tiles.get(t);
    if ($tile == null) throw new Error(`Assertion failed: cannot remove absent tile ${t}`);
    $context.removeChild($tile);
  }

  return {tileEnters, tileExits};
}

