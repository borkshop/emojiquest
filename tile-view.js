/**
 * A tile view manages the DOM elements for the entities in a 2D grid.
 * Emoji Quest uses tile views for the control pad and inside each 2D facet of
 * the 3D world.
 */

// @ts-check

/**
 * @callback EnterFn
 * @param {number} tile
 * @param {number} type
 */

/**
 * @callback ExitFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileView
 * @prop {EnterFn} enter
 * @prop {ExitFn} exit
 */

const noop = () => {};

/**
 * @template Element
 * @callback AppendChildFn
 * @param {Element} child
 */

/**
 * @template Element
 * @callback RemoveChildFn
 * @param {Element} child
 */

/**
 * @template Element
 * @typedef {Object} ParentElement
 * @prop {AppendChildFn<Element>} appendChild
 * @prop {RemoveChildFn<Element>} removeChild
 */

/**
 * @template {Element} ParentElement
 * @template {Element} ChildElement
 * @param {ParentElement} $parent
 * @param {ChildElement?} $nextSibling
 * @param {(tile: number, type: number) => ChildElement} createElement
 * @param {(tile: number) => void} [collectElement]
 * @return {TileView}
 */
export function makeTileView($parent, $nextSibling, createElement, collectElement = noop) {
  const $tiles = new Map();

  /**
   * @param {number} t
   * @param {number} type
   */
  function enter(t, type) {
    const $tile = createElement(t, type);
    $parent.insertBefore($tile, $nextSibling);
    $tiles.set(t, $tile);
  }

  /**
   * @param {number} t
   */
  function exit(t) {
    const $tile = $tiles.get(t);
    if ($tile == null) throw new Error(`Assertion failed: cannot remove absent tile ${t}`);
    $parent.removeChild($tile);
    collectElement(t);
  }

  return {enter, exit};
}
