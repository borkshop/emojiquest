/**
 * A view model interposes between a model and a view, allowing the view to
 * observe the entrance, exit, and animated placement of entities in its region
 * of interest.
 * The view model is topology-agnostic and sees the world as arbitrary numbered
 * cells.
 * The view model allows multiple views to subscribe to overlapping regions of
 * the model, as is necessary since some cells must be rendered on both sides
 * of borders, like the along the edges of a cube-shaped world or between the
 * boundaries between facets.
 */

// @ts-check

import {setDifference} from './set.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */

/** @typedef {ReturnType<makeViewModel>} ViewModel */

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
 * @prop {(entity: number, type: number) => void} enter
 * @prop {(entity: number) => void} exit
 * @prop {PlaceFn} place
 */

/**
 * @callback PutFn
 * @param {number} entity - entity number
 * @param {number} location - tile number
 * @param {number} type - tile type
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
   * @type {Map<number, {location: number, type: number}>}
   */
  const tiles = new Map();

  /**
   * Tile number to entity numbers to entity types.
   * @type {Map<number, Map<number, number>>}
   */
  const colocated = new Map();

  /**
   * Tile number to watchers.
   * @type {Map<number, Map<Watcher, Coord>>}
   */
  const watchers = new Map();

  /**
   * From entity number to animated transition.
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

  /**
   * Returns whether the entity is watched by any view.
   *
   * @param {number} entity
   */
  function watched(entity) {
    const tile = tiles.get(entity);
    if (tile === undefined) {
      return false;
    }
    const {location} = tile;
    const tileWatchers = watchers.get(location);
    return tileWatchers !== undefined;
  }

  /** @type {PutFn} */
  function put(entity, location, type) {
    tiles.set(entity, {location, type});
    let entities = colocated.get(location);
    if (entities) {
      entities.set(entity, type);
    } else {
      entities = new Map();
      entities.set(entity, type);
      colocated.set(location, entities);
    }

    const tileWatchers = watchers.get(location);
    if (tileWatchers !== undefined) {
      for (const [watcher, coord] of tileWatchers.entries()) {
        watcher.enter(entity, type);
        watcher.place(entity, coord, pressure(entity));
      }
    }
  }

  /** @type {RemoveFn} */
  function remove(entity) {
    pressures.delete(entity);
    animating.delete(entity);
    const tile = tiles.get(entity);
    if (tile === undefined) {
      throw new Error(`Cannot remove entity with unknown location ${entity}`);
    }
    const {location} = tile;
    entityExitsTile(entity, location);
    const tileWatchers = watchers.get(location);
    if (tileWatchers !== undefined) {
      for (const watcher of tileWatchers.keys()) {
        watcher.exit(entity);
      }
    }
  }

  /** @type {MoveFn} */
  function move(entity, to) {
    const tile = tiles.get(entity);
    if (tile === undefined) throw new Error(`Assertion failed: cannot move absent entity ${entity}`);
    const {location: from, type} = tile;

    if (from === to) {
      return;
    }

    entityExitsTile(entity, from);
    tile.location = to;
    entityEntersTile(entity, to, type);

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
      watcher.enter(entity, type);
    }
    if (after) {
      for (const [watcher, coord] of after.entries()) {
        watcher.place(entity, coord, pressure(entity));
      }
    }
  }

  /** @type {EntityWatchFn} */
  function watch(tiles, watcher) {
    for (const [location, coord] of tiles.entries()) {
      watcherEntersTile(watcher, location, coord);
    }
  }

  /** @type {EntityWatchFn} */
  function unwatch(tiles, watcher) {
    for (const location of tiles.keys()) {
      watcherExitsTile(watcher, location);
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} location - tile number
   * @param {Coord} coord - coordinate of tile
   */
  function watcherEntersTile(watcher, location, coord) {
    // Register watcher.
    let tileWatchers = watchers.get(location);
    if (tileWatchers) {
      tileWatchers.set(watcher, coord);
    } else {
      tileWatchers = new Map();
      tileWatchers.set(watcher, coord);
      watchers.set(location, tileWatchers);
    }

    // Initial notification.
    const entities = colocated.get(location);
    if (entities) {
      for (const [entity, type] of entities.entries()) {
        watcher.enter(entity, type);
        watcher.place(entity, coord, pressure(entity));
      }
    }
  }

  /**
   * @param {Watcher} watcher - watcher
   * @param {number} location - tile number
   */
  function watcherExitsTile(watcher, location) {
    // Final notification.
    const entities = colocated.get(location);
    if (entities) {
      for (const entity of entities.keys()) {
        watcher.exit(entity);
      }
    }

    // Unregister watcher.
    const tileWatchers = watchers.get(location);
    if (!tileWatchers) throw new Error(`Assertion failed`);
    tileWatchers.delete(watcher);
    if (tileWatchers.size === 0) {
      watchers.delete(location);
    }
  }

  /**
   * @param {number} entity - entity number
   * @param {number} location - tile number
   */
  function entityExitsTile(entity, location) {
    const entities = colocated.get(location);
    if (entities) {
      entities.delete(entity);
    }
  }

  /**
   * @param {number} entity - entity number
   * @param {number} location - tile number
   * @param {number} type - tile type
   */
  function entityEntersTile(entity, location, type) {
    let entities = colocated.get(location);
    if (!entities) {
      entities = new Map();
      colocated.set(location, entities);
    }
    entities.set(entity, type);
  }

  /**
   * @param {number} location - tile number
   * @returns {Map<number, number>=}
   */
  function entitiesAtTile(location) {
    return colocated.get(location);
  }

  /** @type {TransitionFn} */
  function transition(entity, transition) {
    const tile = tiles.get(entity);
    if (tile === undefined) {
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
      const tile = tiles.get(entity);
      if (tile !== undefined) {
        const {location} = tile;
        const tileWatchers = watchers.get(location);
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
        const tile = tiles.get(entity);
        if (tile !== undefined) {
          const {location} = tile;
          const tileWatchers = watchers.get(location);
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
    watched,
    watch,
    unwatch,
    animate,
    transition,
    reset,
  };
}
