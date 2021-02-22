// @ts-check

/**
 * @callback TouchEntityFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileRenderer
 * @prop {TouchEntityFn} enter
 * @prop {TouchEntityFn} exit
 */

const noop = () => {};

/**
 * @template Matrix
 * @param {HTMLElement} $context
 * @param {(tile: number) => Matrix} tileTransform
 * @param {(matrix: Matrix) => string} matrixStyle
 * @param {(tile: number) => HTMLElement} createElement
 * @param {(tile: number) => void} [collectElement]
 * @return {TileRenderer}
 */
export function makeTileRenderer($context, tileTransform, matrixStyle, createElement, collectElement = noop) {
  const $tiles = new Map()

  /**
   * @param {number} t
   */
  function enter(t) {
    const $tile = createElement(t);
    const transform = tileTransform(t);
    $tile.style.transform = matrixStyle(transform);
    $context.appendChild($tile);
    $tiles.set(t, $tile);
  }

  /**
   * @param {number} t
   */
  function exit(t) {
    const $tile = $tiles.get(t);
    if ($tile == null) throw new Error(`Assertion failed: cannot remove absent tile ${t}`);
    $context.removeChild($tile);
    collectElement(t);
  }

  return {enter, exit};
}
