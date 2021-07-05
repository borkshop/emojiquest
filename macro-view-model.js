// @ts-check

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
    const internal = create();
    entities.set(external, internal);
    locations.set(external, location);
    viewModel.put(internal, location, type);
  }

  /**
   * @param {number} external
   * @param {number} direction
   */
  function take(external, direction) {
    const internal = entity(external);
    viewModel.transition(internal, {
      direction,
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
   * @param {number} direction
   * @param {number} turn
   */
  function move(external, destination, direction, turn) {
    const internal = entity(external);
    moves.set(external, destination);
    locations.set(external, destination);
    viewModel.transition(internal, {
      direction,
      rotation: turn,
    });
  }

  /**
   * @param {number} external
   * @param {number} direction
   */
  function bounce(external, direction) {
    const internal = entity(external);
    viewModel.transition(external, {direction, bump: true});
    viewModel.transition(internal, {
      direction,
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

  return { animate, reset, up, down, put, take, fell, move, bounce, replace };
}
