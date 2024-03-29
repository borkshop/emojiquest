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

import { assert, assertDefined, assumeDefined } from './lib/assert.js';
import { setDifference } from './lib/set.js';

/** @typedef {import('./progress.js').AnimateFn} AnimateFn */
/** @typedef {import('./progress.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./types.js').Watcher} Watcher */
/** @typedef {import('./types.js').WatchEntitiesFn} WatchEntitiesFn */

/**
 * @callback WatchFn
 * @param {Watcher} watcher - notified when a tile enters, exits, or moves
 * within a region
 * @param {number} tile - tile number
 * @param {Coord} coordinate - coordinate of tile in watcher space
 */

export function makeViewModel() {
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
    const { location } = tile;
    const tileWatchers = watchers.get(location);
    return tileWatchers !== undefined;
  }

  /**
   * @param {number} entity - entity number
   * @param {number} location - tile number
   * @param {number} type - tile type
   */
  function put(entity, location, type) {
    tiles.set(entity, { location, type });
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

  /**
   * @param {number} entity - entity number
   */
  function remove(entity) {
    pressures.delete(entity);
    animating.delete(entity);
    const tile = assumeDefined(
      tiles.get(entity),
      `Cannot remove entity with unknown location ${entity}`,
    );
    const { location } = tile;
    entityExitsTile(entity, location);
    const tileWatchers = watchers.get(location);
    if (tileWatchers !== undefined) {
      for (const watcher of tileWatchers.keys()) {
        watcher.exit(entity);
      }
    }
  }

  /**
   * @param {number} entity - entity number
   * @param {number} to - tile number
   */
  function move(entity, to) {
    const tile = assumeDefined(
      tiles.get(entity),
      `Assertion failed: cannot move absent entity ${entity}`,
    );
    const { location: from, type } = tile;

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

  /** @type {WatchEntitiesFn} */
  function watchEntities(tiles, watcher) {
    for (const [location, coord] of tiles.entries()) {
      watcherEntersTile(watcher, location, coord);
    }
  }

  /** @type {WatchEntitiesFn} */
  function unwatchEntities(tiles, watcher) {
    for (const location of tiles.keys()) {
      watcherExitsTile(watcher, location);
    }
  }

  /**
   * @type {WatchFn}
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
   * @type {WatchFn}
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
    const tileWatchers = assumeDefined(watchers.get(location));
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
   * @param {number} entity - entity number
   * @param {Transition} transition - how to animate the entity's transition into
   * the next turn.
   */
  function transition(entity, transition) {
    assertDefined(
      tiles.get(entity),
      `Assertion failed: no location for entity ${entity}`,
    );

    const priorTransition = animating.get(entity);
    assert(
      priorTransition === undefined,
      `Only one transition can be scheduled per entity per turn ${entity} ${JSON.stringify(
        transition,
      )} over ${JSON.stringify(priorTransition)}`,
    );

    animating.set(entity, transition);
  }

  /** @type {AnimateFn} */
  function animate(progress) {
    const { elapsed } = progress;

    // Animate button pressure simulation.
    const factor = 0.99 ** elapsed;
    for (const entry of pressures.entries()) {
      const [command] = entry;
      let [, pressure] = entry;
      if (pressed.has(command)) {
        pressure = 1 - (1 - pressure) * factor;
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
        const { location } = tile;
        const tileWatchers = watchers.get(location);
        if (tileWatchers !== undefined) {
          for (const [watcher, coord] of tileWatchers.entries()) {
            watcher.place(
              entity,
              coord,
              pressure(entity),
              progress,
              transition,
            );
          }
        }
      }
    }

    // Animate any remaining entities that just have pressure applied.
    for (const [entity, pressure] of pressures.entries()) {
      if (!animating.has(entity)) {
        const tile = tiles.get(entity);
        if (tile !== undefined) {
          const { location } = tile;
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

  function tock() {
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

  /** @type {import('./types.js').ViewModelFacetForMacroViewModel &
   * import('./types.js').ViewModelFacetForView} */
  return {
    move,
    put,
    remove,
    down,
    up,
    watched,
    watchEntities,
    unwatchEntities,
    animate,
    transition,
    tock,
  };
}
