/**
 * The macro view model is an adapter for a view model that provides
 * higher-level commands for animated entity transitions, including
 * transitions that require a single logical entity to have multiple
 * actual entity representations, like the replacement of an entity
 * with one representation with a new representation, where both
 * representations exist while one waxes and the other wanes.
 *
 * Consequently, the macro view model has an internal mapping
 * from external entity numbers to internal entity numbers.
 */

// @ts-check

import {assert, assumeDefined} from './assert.js';
import {halfOcturn, fullOcturn} from './geometry2d.js';

/**
 * @typedef {import('./view-model.js').ViewModel} ViewModel
 * @typedef {ReturnType<makeMacroViewModel>} MacroViewModel
 */

/**
 * @param {ViewModel} viewModel
 * @param {Object} options
 * @param {string} options.name
 */
export function makeMacroViewModel(viewModel, {}) {
  /** @type {Map<number, number>} external to internal */
  const entities = new Map();
  /** @type {Map<number, number>} internal to location */
  const locations = new Map();
  /** @type {Map<number, number>} external to internal */
  const removes = new Map();
  /** @type {Map<number, number>} internal to location */
  const moves = new Map();
  /** @type {Set<number>} internal */
  const replaced = new Set();

  let nextId = 0;
  function create() {
    const id = nextId;
    nextId += 1;
    return id;
  }

  /**
   * @param {number} external
   */
  function entity(external) {
    return assumeDefined(entities.get(external), `Failed invariant of macro view model: no internal entity for external entity ${external}`);
  }

  /**
   * @param {number} external
   */
  function locate(external) {
    return assumeDefined(locations.get(external), `Failed invariant of macro view model: no known location for external entity ${external}`);
  }

  /**
   * @param {number} external
   * @param {number} location
   * @param {number} type
   */
  function put(external, location, type) {
    if (entities.get(external) !== undefined) {
      throw new Error(`Assertion error`);
    }
    const internal = create();
    entities.set(external, internal);
    locations.set(external, location);
    viewModel.put(internal, location, type);
  }

  /**
   * @param {number} external
   */
  function remove(external) {
    const internal = entities.get(external);
    assert(internal !== undefined);
    viewModel.remove(internal);
    entities.delete(external);
    locations.delete(external);
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function give(external, directionOcturns) {
    take(external, (directionOcturns + halfOcturn) % fullOcturn);
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function take(external, directionOcturns) {
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        stage: 'exit'
      });
    }
    removes.set(external, internal);
  }
  /**
   * @param {number} external
   */
  function fell(external) {
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        rotation: 1,
        bump: true,
        stage: 'exit',
      });
    }
    removes.set(external, internal);
  }

  /**
   * @param {...number} externals
   */
  function exit(...externals) {
    for (const external of externals) {
      const internal = entity(external);
      if (viewModel.watched(internal)) {
        viewModel.transition(internal, {
          bump: true,
          stage: 'exit',
        });
      }
      removes.set(external, internal);
    }
  }

  /**
   * @param {...number} externals
   */
  function enter(...externals) {
    for (const external of externals) {
      const internal = entity(external);
      if (viewModel.watched(internal)) {
        viewModel.transition(internal, {
          bump: true,
          stage: 'enter',
        });
      }
    }
  }

  /**
   * @param {number} external
   * @param {number} type
   */
  function replace(external, type) {
    const internal = entity(external);
    const location = locate(external);
    const replacement = create();

    replaced.add(internal);
    locations.set(external, location);
    entities.set(external, replacement);

    viewModel.put(replacement, location, type);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        bump: true,
        stage: 'exit',
      });
      viewModel.transition(replacement, {
        bump: true,
        stage: 'enter',
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} destination
   * @param {number} directionOcturns
   * @param {number} turn
   */
  function move(external, destination, directionOcturns, turn) {
    const internal = entity(external);
    moves.set(internal, destination);
    locations.set(external, destination);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        rotation: turn,
      });
    }
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function bounce(external, directionOcturns) {
    const internal = entity(external);
    if (viewModel.watched(internal)) {
      viewModel.transition(internal, {
        directionOcturns,
        bump: true,
      });
    }
  }

  /**
   * @param {number} external
   */
  function up(external) {
    const internal = entity(external);
    viewModel.up(internal);
  }

  /**
   * @param {number} external
   */
  function down(external) {
    const internal = entity(external);
    viewModel.down(internal);
  }

  function reset() {
    for (const [internal, destination] of moves.entries()) {
      viewModel.move(internal, destination);
    }
    for (const [external, internal] of removes.entries()) {
      viewModel.remove(internal);
      entities.delete(external);
      locations.delete(external);
    }
    for (const internal of replaced) {
      viewModel.remove(internal);
    }
    replaced.clear();
    removes.clear();
    moves.clear();
    viewModel.reset();
  }

  const { animate } = viewModel;

  return {
    animate,
    reset,
    up,
    down,
    put,
    remove,
    take,
    give,
    exit,
    enter,
    fell,
    move,
    bounce,
    replace
  };
}
