// @ts-check

import { assert, assumeDefined } from './assert.js';
import { placeEntity } from './animation2d.js';

/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */

/**
 * @param {Object} args
 * @param {(entity: number, type: number) => Element} args.createElement
 * @param {(entity: number) => void} [args.collectElement]
 */
export function makeElementTracker({ createElement, collectElement }) {
  /** @type {Map<number, Element>} */
  const elements = new Map();

  /** @type {PlaceFn} */
  function place(entity, coord, pressure, progress, transition) {
    const element = assumeDefined(elements.get(entity));
    placeEntity(element, coord, pressure, progress, transition);
  }

  /**
   * @param {number} entity
   * @param {number} type
   */
  function create(entity, type) {
    assert(!elements.has(entity));
    const element = createElement(entity, type);
    elements.set(entity, element);
    return element;
  }

  /**
   * @param {number} entity
   */
  function collect(entity) {
    assert(elements.has(entity));
    elements.delete(entity);
    if (collectElement !== undefined) {
      collectElement(entity);
    }
  }

  return {
    place,
    create,
    collect,
  };
}
