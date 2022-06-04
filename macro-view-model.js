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

import { assert, assumeDefined } from './assert.js';

/**
 * @typedef {import('./view-model.js').ViewModel} ViewModel
 * @typedef {ReturnType<makeMacroViewModel>} MacroViewModel
 */

/**
 * @param {ViewModel} viewModel
 * @param {Object} [options]
 * @param {string} [options.name]
 * @param {number} [options.start]
 * @param {number} [options.stride]
 */
export function makeMacroViewModel(
  viewModel,
  {
    // name = '<unknown>',
    start = 0,
    stride = 1,
  } = {},
) {
  let planning = true;

  /** @type {Map<number, number>} external to internal */
  const entities = new Map();
  /** @type {Map<number, number>} internal to location */
  const locations = new Map();
  /** @type {Map<number, number>} external to internal */
  const removes = new Map();
  /** @type {Map<number, number>} internal */
  const rotations = new Map();
  /** @type {Map<number, number>} internal */
  const directions = new Map();
  /** @type {Map<number, number>} internal */
  const destinations = new Map();
  /** @type {Set<number>} internal */
  const replaced = new Set();
  /** @type {Set<number>} internal */
  const touched = new Set();
  /** @type {Set<number>} internal */
  const enters = new Set();
  /** @type {Set<number>} internal */
  const exits = new Set();
  /** @type {Set<number>} internal */
  const bumps = new Set();

  function assertPlanning() {
    assert(
      planning,
      `Cannot send animation commands in macro view model planning phase`,
    );
  }

  let nextId = start;
  function create() {
    const id = nextId;
    nextId += stride;
    return id;
  }

  /**
   * @param {number} external
   */
  function entity(external) {
    return assumeDefined(
      entities.get(external),
      `Failed invariant of macro view model: no internal entity for external entity ${external}`,
    );
  }

  /**
   * @param {number} external
   */
  function locate(external) {
    return assumeDefined(
      locations.get(external),
      `Failed invariant of macro view model: no known location for external entity ${external}`,
    );
  }

  /**
   * Arranges for a new entity to appear spontaneously at a particular
   * location.
   *
   * @param {number} external
   * @param {number} location
   * @param {number} type
   */
  function put(external, location, type) {
    assertPlanning();
    assert(
      entities.get(external) === undefined,
      `Cannot create entity with used value ${external}`,
    );
    const internal = create();
    entities.set(external, internal);
    locations.set(external, location);
    viewModel.put(internal, location, type);
  }

  /**
   * Arranges for an entity to spontaneously disappear at the end of the
   * current turn.
   *
   * @param {number} external
   */
  function remove(external) {
    assertPlanning();
    const internal = entities.get(external);
    assert(internal !== undefined);
    viewModel.remove(internal);
    entities.delete(external);
    locations.delete(external);
  }

  /**
   * Arranges for an entity to gradually appear at a particular position,
   * coming from a particular direction.
   *
   * @param {number} external
   * @param {number} origin
   * @param {number} destination
   * @param {number} type
   * @param {number} directionOcturns
   */
  function give(external, origin, destination, type, directionOcturns) {
    assertPlanning();
    assert(entities.get(external) === undefined);
    const internal = create();
    entities.set(external, internal);
    viewModel.put(internal, origin, type);
    locations.set(external, destination);
    destinations.set(internal, destination);
    directions.set(internal, directionOcturns);
  }

  /**
   * Arranges for an entity to gradually disappear from a particular position,
   * going in a particular direction.
   *
   * @param {number} external
   * @param {number} directionOcturns
   */
  function take(external, directionOcturns) {
    assertPlanning();
    const internal = entity(external);
    touched.add(internal);
    exits.add(internal);
    directions.set(internal, directionOcturns);
    removes.set(external, internal);
  }

  /**
   * Arranges for an entity to gradually disappear, like a tree falling to the
   * axe.
   *
   * @param {number} external
   */
  function fell(external) {
    assertPlanning();
    const internal = entity(external);
    rotations.set(internal, 1);
    exits.add(internal);
    touched.add(internal);
    removes.set(external, internal);
  }

  /**
   * Arranges for an entity to gradually disappear.
   *
   * @param {number} external
   */
  function exit(external) {
    assertPlanning();
    const internal = entity(external);
    removes.set(external, internal);
    touched.add(internal);
    exits.add(internal);
  }

  /**
   * Arranges for an entity to gradually appear.
   *
   * @param {number} external
   */
  function enter(external) {
    assertPlanning();
    const internal = entity(external);
    enters.add(internal);
    touched.add(internal);
  }

  /**
   * @param {number} external
   * @param {number} type
   */
  function replace(external, type) {
    assertPlanning();
    const internal = entity(external);
    const location = locate(external);
    const replacement = create();

    replaced.add(internal);
    locations.set(external, location);
    entities.set(external, replacement);

    viewModel.put(replacement, location, type);

    exits.add(internal);
    touched.add(internal);
    enters.add(replacement);
  }

  /**
   * @param {number} external
   * @param {number} destination
   * @param {number} directionOcturns
   * @param {number} rotation
   */
  function move(external, destination, directionOcturns, rotation) {
    assertPlanning();
    const internal = entity(external);
    destinations.set(internal, destination);
    directions.set(internal, directionOcturns);
    rotations.set(internal, rotation);
    locations.set(external, destination);
    touched.add(internal);
  }

  /**
   * @param {number} external
   * @param {number} directionOcturns
   */
  function bounce(external, directionOcturns) {
    assertPlanning();
    const internal = entity(external);
    touched.add(internal);
    bumps.add(internal);
    directions.set(internal, directionOcturns);
  }

  /**
   * @param {number} external
   */
  function up(external) {
    const internal = entities.get(external);
    if (internal !== undefined) {
      viewModel.up(internal);
    }
  }

  /**
   * @param {number} external
   */
  function down(external) {
    const internal = entity(external);
    viewModel.down(internal);
    return () => viewModel.up(internal);
  }

  /**
   * Conclude animated transitions from the prior turn, so new plans can be
   * made.
   */
  function tock() {
    for (const [internal, destination] of destinations.entries()) {
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
    rotations.clear();
    destinations.clear();
    directions.clear();
    viewModel.tock();

    planning = true;
  }

  function tick() {
    if (!planning) {
      return;
    }
    planning = false;

    for (const internal of touched) {
      assert(!(enters.has(internal) && exits.has(internal)));

      if (exits.has(internal)) {
        if (viewModel.watched(internal)) {
          const directionOcturns = directions.get(internal);
          if (directionOcturns !== undefined) {
            viewModel.transition(internal, {
              directionOcturns,
              stage: 'exit',
            });
          } else {
            viewModel.transition(internal, {
              bump: true,
              stage: 'exit',
            });
          }
        }
      } else if (enters.has(internal)) {
        if (viewModel.watched(internal)) {
          viewModel.transition(internal, {
            bump: true,
            stage: 'enter',
          });
        }
      } else {
        const destination = directions.get(internal);
        if (destination !== undefined) {
          const directionOcturns = directions.get(internal) || 0;
          const rotation = rotations.get(internal) || 0;
          const bump = bumps.has(internal);
          if (viewModel.watched(internal)) {
            viewModel.transition(internal, {
              bump,
              directionOcturns,
              rotation,
            });
          }
        }
      }
    }

    touched.clear();
    exits.clear();
    enters.clear();
    bumps.clear();
  }

  const { animate } = viewModel;

  return {
    tick,
    tock,

    // Animation functions
    animate,
    up,
    down,

    // Planning functions
    put,
    remove,
    take,
    give,
    exit,
    enter,
    fell,
    move,
    bounce,
    replace,
  };
}
