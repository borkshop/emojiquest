// @ts-check

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
    const internal = entities.get(external);
    if (internal === undefined) throw new Error(`Assertion failed`);
    return internal;
  }

  /**
   * @param {number} external
   */
  function locate(external) {
    const location = locations.get(external);
    if (location === undefined) throw new Error(`Assertion failed`);
    return location;
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
    viewModel.transition(internal, {
      directionOcturns,
      stage: 'exit'
    });
    removes.set(external, internal);
  }
  /**
   * @param {number} external
   */
  function fell(external) {
    const internal = entity(external);
    viewModel.transition(internal, {
      rotation: 1,
      bump: true,
      stage: 'exit',
    });
    removes.set(external, internal);
  }

  /**
   * @param {...number} externals
   */
  function exit(...externals) {
    for (const external of externals) {
      const internal = entity(external);
      viewModel.transition(internal, {
        bump: true,
        stage: 'exit',
      });
      removes.set(external, internal);
    }
  }

  /**
   * @param {...number} externals
   */
  function enter(...externals) {
    for (const external of externals) {
      const internal = entity(external);
      viewModel.transition(internal, {
        bump: true,
        stage: 'enter',
      });
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
    viewModel.transition(internal, {
      bump: true,
      stage: 'exit',
    });
    viewModel.transition(replacement, {
      bump: true,
      stage: 'enter',
    });
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
    viewModel.transition(internal, {
      directionOcturns,
      rotation: turn,
    });
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function bounce(external, directionOcturns) {
    const internal = entity(external);
    viewModel.transition(external, {directionOcturns, bump: true});
    viewModel.transition(internal, {
      directionOcturns,
      bump: true,
    });
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

  return { animate, reset, up, down, put, take, give, exit, enter, fell, move, bounce, replace };
}
