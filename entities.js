// @ts-check

import {setDifference} from './set.js';

/**
 * @typedef {Object} Point
 * @prop {number} x
 * @prop {number} y
 */

/**
 * @callback EntityWatchFn
 * @param {Map<number, Point>} tiles - tile number to coordinate
 * @param {Watcher} watcher - notified when a tile enters, exits, or moves
 * within a region
 */

/**
 * @typedef {Object} Watcher
 * @prop {(entity: number) => void} enter
 * @prop {(entity: number) => void} exit
 * @prop {(entity: number, coord: Point) => void} place
 */

export function makeEntities() {
  let next = 0;

  /** @type {Map<number, number>} */
  const types = new Map();

  /**
   * Entity number to tile number.
   * @type {Map<number, number>}
   */
  const locations = new Map();

  /**
   * Tile number to entity numbers.
   * @type {Map<number, Set<number>>}
   */
  const colocated = new Map();

  /**
   * Tile number to watchers.
   * @type {Map<number, Map<Watcher, Point>>}
   */
  const watchers = new Map();

  /**
   * @param {number} type
   */
  function create(type) {
    const e = next;
    types.set(e, type);
    next++;
    return e;
  }

  /**
   * @param {number} e
   */
  function type(e) {
    return types.get(e);
  }

  /**
   * @param {number} e - entity number
   * @param {number} t - tile number
   */
  function put(e, t) {
    locations.set(e, t);
    let entities = colocated.get(t);
    if (entities) {
      entities.add(e);
    } else {
      entities = new Set();
      entities.add(e);
      colocated.set(t, entities);
    }
  }

  /**
   * @param {number} e - entity number
   * @param {number} to - tile number
   */
  function move(e, to) {
    const from = locations.get(e);
    if (from == null) throw new Error(`Assertion failed: cannot move absent entity ${e}`);
    console.log('move from', from, 'to', to);
    if (from === to) {
      return;
    }

    entityExitsTile(e, from);
    locations.set(e, to);
    entityEntersTile(e, to);

    const before = watchers.get(from);
    const after = watchers.get(to);
    const beforeSet = new Set(before?.keys());
    const afterSet = new Set(after?.keys());
    for (const watcher of setDifference(beforeSet, afterSet)) {
      // watchers before move but not after
      watcher.exit(e);
    }
    for (const watcher of setDifference(afterSet, beforeSet)) {
      // watchers after move but not before
      watcher.enter(e);
    }
    if (after) {
      for (const [watcher, coord] of after.entries()) {
        watcher.place(e, coord);
      }
    }
  }

  /** @type {EntityWatchFn} */
  function watch(tiles, watcher) {
    for (const [t, coord] of tiles.entries()) {
      let tileWatchers = watchers.get(t);
      if (tileWatchers) {
        tileWatchers.set(watcher, coord);
      } else {
        tileWatchers = new Map();
        tileWatchers.set(watcher, coord);
        watchers.set(t, tileWatchers);
      }

      const entities = colocated.get(t);
      if (entities) {
        for (const e of entities) {
          watcher.enter(e);
          watcher.place(e, coord);
        }
      }
    }
  }

  /** @type {EntityWatchFn} */
  function unwatch(tiles, watcher) {
    for (const t of tiles.keys()) {
      const entities = colocated.get(t);
      if (entities) {
        for (const e of entities) {
          watcher.exit(e);
        }
      }

      const tileWatchers = watchers.get(t);
      if (!tileWatchers) throw new Error(`Assertion failed`);
      tileWatchers.delete(watcher);
      if (tileWatchers.size === 0) {
        watchers.delete(t);
      }
    }
  }

  /**
   * @param {number} e - entity number
   * @param {number} t - tile number
   */
  function entityExitsTile(e, t) {
    const entities = colocated.get(t);
    if (entities) {
      entities.delete(e);
    }
  }

  /**
   * @param {number} e - entity number
   * @param {number} t - tile number
   */
  function entityEntersTile(e, t) {
    let entities = colocated.get(t);
    if (!entities) {
      entities = new Set();
      colocated.set(t, entities);
    }
    entities.add(e);
  }

  /**
   * @param {number} t - tile number
   * @returns {Set<number>=}
   */
  function entitiesAtTile(t) {
    return colocated.get(t);
  }

  return { create, move, type, put, entitiesAtTile, watch, unwatch };
}

