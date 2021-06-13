// @ts-check

import {setDifference} from './set.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */

/**
 * @callback EntityWatchFn
 * @param {Map<number, Coord>} tiles - tile number to coordinate
 * @param {Watcher} watcher - notified when a tile enters, exits, or moves
 * within a region
 */

/**
 * @callback PlaceFn
 * @param {number} entity
 * @param {Coord} coord - position in the origin coordinate plane, including
 * any inherent rotation angle relative to that plane due to transition over
 * the edge of the world to another face.
 * @param {number} pressure - button pressure on entity.
 * @param {Progress=} progress - precomputed progress parameters.
 * @param {Transition=} transition - animated transition parameters.
 */

/**
 * @typedef {Object} Watcher
 * @prop {(entity: number) => void} enter
 * @prop {(entity: number) => void} exit
 * @prop {PlaceFn} place
 */

/**
 * @callback PutFn
 * @param {number} entity - entity number
 * @param {number} tile - tile number
 */

/**
 * @callback MoveFn
 * @param {number} entity - entity number
 * @param {number} to - tile number
 */

/**
 * @callback RemoveFn
 * @param {number} entity - entity number
 */

/**
 * @callback TransitionFn
 * @param {number} entity - entity number
 * @param {Transition} transition - how to animate the entity's transition into
 * the next turn.
 */

export function makeViewModel() {
  /** @type {number | undefined} time of last animation frame */
  let last;

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
   * From entity number animated transition.
   * @type {Map<number, Transition>}
   */
  const animating = new Map();

  /**
   * What entities are pressed down, as buttons.
   * @type {Set<number>}
   */
  const pressed = new Set();

  /**
   * The pressure from 0 (fully up) to 1 (fully down)
   * for each pressed button entity.
   * @type {Map<number, number>}
   */
  const pressures = new Map();

  /** @type {PutFn} */
  function put(entity, tile) {
    locations.set(entity, tile);
    let entities = colocated.get(tile);
    if (entities) {
      entities.add(entity);
    } else {
      entities = new Set();
      entities.add(entity);
      colocated.set(tile, entities);
    }

    const tileWatchers = watchers.get(tile);
    if (tileWatchers !== undefined) {
      for (const [watcher, coord] of tileWatchers.entries()) {
        watcher.enter(entity);
        watcher.place(entity, coord, pressure(entity));
      }
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
  function move(entity, to) {
    const from = locations.get(entity);
    if (from == null) throw new Error(`Assertion failed: cannot move absent entity ${entity}`);
    if (from === to) {
      return;
    }

    entityExitsTile(entity, from);
    locations.set(entity, to);
    entityEntersTile(entity, to);

    // The representation of the entity moves within each watcher
    // that observes it either before or after the transition.
    const before = watchers.get(from);
    const after = watchers.get(to);
    const beforeSet = new Set(before?.keys());
    const afterSet = new Set(after?.keys());
    for (const watcher of setDifference(beforeSet, afterSet)) {
      // watchers before move but not after
      watcher.exit(entity);
    }
    for (const watcher of setDifference(afterSet, beforeSet)) {
      // watchers after move but not before
      watcher.enter(entity);
    }
    if (after) {
      for (const [watcher, coord] of after.entries()) {
        watcher.place(entity, coord, pressure(entity));
      }
    }
  }

  /** @type {EntityWatchFn} */
  function watch(tiles, watcher) {
    for (const [tile, coord] of tiles.entries()) {
      watcherEntersTile(watcher, tile, coord);
    }
  }

  /** @type {EntityWatchFn} */
  function unwatch(tiles, watcher) {
    for (const tile of tiles.keys()) {
      watcherExitsTile(watcher, tile);
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} tile - tile number
   * @param {Coord} coord - coordinate of tile
   */
  function watcherEntersTile(watcher, tile, coord) {
    // Register watcher.
    let tileWatchers = watchers.get(tile);
    if (tileWatchers) {
      tileWatchers.set(watcher, coord);
    } else {
      tileWatchers = new Map();
      tileWatchers.set(watcher, coord);
      watchers.set(tile, tileWatchers);
    }

    // Initial notification.
    const entities = colocated.get(tile);
    if (entities) {
      for (const entity of entities) {
        watcher.enter(entity);
        watcher.place(entity, coord, pressure(entity));
      }
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} tile - tile number
   */
  function watcherExitsTile(watcher, tile) {
    // Final notification.
    const entities = colocated.get(tile);
    if (entities) {
      for (const entity of entities) {
        watcher.exit(entity);
      }
    }

    // Unregister watcher.
    const tileWatchers = watchers.get(tile);
    if (!tileWatchers) throw new Error(`Assertion failed`);
    tileWatchers.delete(watcher);
    if (tileWatchers.size === 0) {
      watchers.delete(tile);
    }
  }

  /**
   * @param {number} entity - entity number
   * @param {number} tile - tile number
   */
  function entityExitsTile(entity, tile) {
    const entities = colocated.get(tile);
    if (entities) {
      entities.delete(entity);
    }
  }

  /**
   * @param {number} entity - entity number
   * @param {number} tile - tile number
   */
  function entityEntersTile(entity, tile) {
    let entities = colocated.get(tile);
    if (!entities) {
      entities = new Set();
      colocated.set(tile, entities);
    }
    entities.add(entity);
  }

  /**
   * @param {number} tile - tile number
   * @returns {Set<number>=}
   */
  function entitiesAtTile(tile) {
    return colocated.get(tile);
  }

  /** @type {TransitionFn} */
  function transition(entity, transition) {
    const location = locations.get(entity);
    if (location === undefined) {
      throw new Error(`Assertion failed: no location for entity ${entity}`);
    }
    animating.set(entity, transition);
  }

  /** @type {AnimateFn} */
  function animate(progress) {
    const {now} = progress;

    if (last === undefined) {
      last = now;
      return;
    }

    // Animate button pressure simulation.
    const factor = 0.9999 ** (now - last);
    for (const entry of pressures.entries()) {
      const [command] = entry;
      let [, pressure] = entry;
      if (pressed.has(command)) {
        pressure = 1 - ((1 - pressure) * factor);
      } else {
        pressure = pressure * factor;
      }
      if (pressure <= Number.EPSILON) {
        pressures.delete(command);
      } else {
        pressures.set(command, pressure);
      }
    }

    // Animate transitions.
    for (const [entity, transition] of animating.entries()) {
      const tile = locations.get(entity);
      if (tile !== undefined) {
        const tileWatchers = watchers.get(tile);
        if (tileWatchers !== undefined) {
          for (const [watcher, coord] of tileWatchers.entries()) {
            watcher.place(entity, coord, pressure(entity), progress, transition);
          }
        }
      }
    }

    // Animate any remaining entities that just have pressure applied.
    for (const [entity, pressure] of pressures.entries()) {
      if (!animating.has(entity)) {
        const tile = locations.get(entity);
        if (tile !== undefined) {
          const tileWatchers = watchers.get(tile);
          if (tileWatchers !== undefined) {
            for (const [watcher, coord] of tileWatchers.entries()) {
              watcher.place(entity, coord, pressure);
            }
          }
        }
      }
    }
  }

  function reset() {
    animating.clear();
  }

  /**
   * @param {number} command
   */
  function down(command) {
    if (!pressed.has(command)) {
      pressed.add(command);
      pressures.set(command, pressure(command));
    }
  }

  /**
   * @param {number} command
   */
  function up(command) {
    pressed.delete(command);
  }

  /**
   * @param {number} command
   */
  function pressure(command) {
    return pressures.get(command) || 0;
  }

  return {
    move,
    put,
    remove,
    down,
    up,
    entitiesAtTile,
    watch,
    unwatch,
    animate,
    transition,
    reset,
  };
}
