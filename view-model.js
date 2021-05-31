// @ts-check

import {setDifference} from './set.js';

const {min, max} = Math;

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} value
 * @returns {number}
 */
function clamp(lo, hi, value) {
  return max(lo, min(hi, value));
}

/**
 * @typedef {Object} Coord
 * @prop {number} x - integer in the coordinate space of tiles.
 * @prop {number} y - integer in the coordinate space of tiles.
 * @prop {number} a - angle, in increments of quarter turns clockwise from due
 * north.
 */

/**
 * @callback PutFn
 * @param {number} e - entity number
 * @param {number} t - tile number
 */

/**
 * @callback MoveFn
 * @param {number} e - entity number
 * @param {number} to - tile number
 */

/**
 * @callback RemoveFn
 * @param {number} e - entity number
 */

/**
 * @callback TransitionFn
 * @param {number} e - entity number
 * @param {Transition} transition - how to animate the entity's transition into
 * the next turn.
 */

/**
 * @callback AnimateFn
 * @param {number} now
 */

/** @typedef {import('./facet-view.js').Watcher} Watcher */
/** @typedef {import('./facet-view.js').Transition} Transition */
/** @typedef {import('./facet-view.js').EntityWatchFn} EntityWatchFn */

/**
 * @param {number} duration
 */
export function makeViewModel(duration) {
  /**
   * Current animated transition start time.
   */
  let start = 0;

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
   * @type {Map<number, Map<Watcher, Coord>>}
   */
  const watchers = new Map();

  /**
   * From entity number to direction of motion in quarter turns clockwise from
   * north.
   * @type {Map<number, Transition>}
   */
  const animating = new Map();

  /** @type {PutFn} */
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

  /** @type {RemoveFn} */
  function remove(entity) {
    const tile = locations.get(entity);
    if (tile === undefined) {
      throw new Error(`Cannot remove entity with unknown location ${entity}`);
    }
    entityExitsTile(entity, tile);
    const tileWatchers = watchers.get(tile);
    if (tileWatchers !== undefined) {
      for (const watcher of tileWatchers.keys()) {
        watcher.exit(entity);
      }
    }
  }

  /** @type {MoveFn} */
  function move(e, to) {
    const from = locations.get(e);
    if (from == null) throw new Error(`Assertion failed: cannot move absent entity ${e}`);
    if (from === to) {
      return;
    }

    entityExitsTile(e, from);
    locations.set(e, to);
    entityEntersTile(e, to);

    // The representation of the entity moves within each watcher
    // that observes it either before or after the transition.
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
      watcherEntersTile(watcher, t, coord);
    }
  }

  /** @type {EntityWatchFn} */
  function unwatch(tiles, watcher) {
    for (const t of tiles.keys()) {
      watcherExitsTile(watcher, t);
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} t - tile number
   * @param {Coord} coord - coordinate of tile
   */
  function watcherEntersTile(watcher, t, coord) {
    // Register watcher.
    let tileWatchers = watchers.get(t);
    if (tileWatchers) {
      tileWatchers.set(watcher, coord);
    } else {
      tileWatchers = new Map();
      tileWatchers.set(watcher, coord);
      watchers.set(t, tileWatchers);
    }

    // Initial notification.
    const entities = colocated.get(t);
    if (entities) {
      for (const e of entities) {
        watcher.enter(e);
        watcher.place(e, coord);
      }
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} t - tile number
   */
  function watcherExitsTile(watcher, t) {
    // Final notification.
    const entities = colocated.get(t);
    if (entities) {
      for (const e of entities) {
        watcher.exit(e);
      }
    }

    // Unregister watcher.
    const tileWatchers = watchers.get(t);
    if (!tileWatchers) throw new Error(`Assertion failed`);
    tileWatchers.delete(watcher);
    if (tileWatchers.size === 0) {
      watchers.delete(t);
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

  /** @type {TransitionFn} */
  function transition(e, transition) {
    const location = locations.get(e);
    if (location === undefined) {
      throw new Error(`Assertion failed: no location for entity ${e}`);
    }
    animating.set(e, transition);
  }

  /** @type {AnimateFn} */
  function animate(now) {
    const linear = clamp(0, 1, (now - start) / duration);
    const sinusoidal = (1 - Math.cos(Math.PI * linear)) / 2;
    const bounce = (1 - Math.cos(Math.PI * 2 * sinusoidal)) / 16;
    const sinusoidalQuarterTurn = -Math.PI/2 * sinusoidal;
    const progress = {
      linear,
      sinusoidal,
      sinusoidalQuarterTurn,
      bounce,
    };

    for (const [e, transition] of animating.entries()) {
      const t = locations.get(e);
      if (t !== undefined) {
        const tileWatchers = watchers.get(t);
        if (tileWatchers !== undefined) {
          for (const [watcher, coord] of tileWatchers.entries()) {
            watcher.place(e, coord, progress, transition);
          }
        }
      }
    }
  }

  /**
   * @param {number} now
   */
  function reset(now) {
    start = now;
    animating.clear();
  }

  return {
    move,
    put,
    remove,
    entitiesAtTile,
    watch,
    unwatch,
    animate,
    transition,
    reset,
  };
}