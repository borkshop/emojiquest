/**
 * A tile view manages the DOM elements for the entities in a 2D grid.
 * Emoji Quest uses tile views for the control pad and inside each 2D facet of
 * the 3D world.
 */

// @ts-check

import { assumeDefined } from './lib/assert.js';
import { placeEntity } from './animation2d.js';

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
 * @template {Element} ChildElement
 * @callback ResetFn
 * @param {(tile: number, type: number) => ChildElement} createElement
 */

/** @typedef {import('./types.js').PlaceFn} PlaceFn */

/**
 * @template {Element} ChildElement
 * @typedef {object} ElementWatcher
 * @prop {EnterFn} enter
 * @prop {ExitFn} exit
 * @prop {PlaceFn} place
 * @prop {ResetFn<ChildElement>} reset
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
 * @return {ElementWatcher<ChildElement>}
 */
export function makeElementWatcher(
  $parent,
  $nextSibling,
  createElement,
  collectElement = noop,
) {
  const $elements = new Map();

  /**
   * @param {number} entity
   * @param {number} type
   */
  function enter(entity, type) {
    const $element = createElement(entity, type);
    $parent.insertBefore($element, $nextSibling);
    $elements.set(entity, $element);
  }

  /**
   * @param {number} entity
   */
  function exit(entity) {
    const $element = assumeDefined(
      $elements.get(entity),
      `Assertion failed: cannot remove absent element ${entity}`,
    );
    $parent.removeChild($element);
    collectElement(entity);
  }

  /** @type {PlaceFn} */
  function place(entity, coord, pressure, progress, transition) {
    const element = assumeDefined($elements.get(entity));
    placeEntity(element, coord, pressure, progress, transition);
  }

  /** @type {ResetFn<ChildElement>} */
  function reset(newCreateElement) {
    // TODO If it transpires that the behavior is ever necessary, track all
    // current elements that might have invalidated representations and replace
    // them.
    createElement = newCreateElement;
  }

  return { enter, exit, place, reset };
}
