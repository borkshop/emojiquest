// @ts-check

/**
 * @typedef {import('./view-model.js').MoveFn} MoveFn
 * @typedef {import('./view-model.js').RemoveFn} RemoveFn
 * @typedef {import('./view-model.js').PutFn} PutFn
 * @typedef {import('./view-model.js').TransitionFn} TransitionFn
 */

/** @typedef {ReturnType<makeMacroViewModel>} MacroViewModel */

/**
 * @param {Object} viewModel
 * @param {TransitionFn} viewModel.transition
 * @param {MoveFn} viewModel.move
 * @param {RemoveFn} viewModel.remove
 * @param {PutFn} viewModel.put
 */
export function makeMacroViewModel(viewModel) {
  /** @type {Map<number, number>} external to internal */
  const entities = new Map();
  // /** @type {Map<number, number>} */
  // const adds = new Map();
  // /** @type {Map<number, number>} external to internal */
  const removes = new Map();
  // /** @type {Map<number, number>} internal to location */
  const moves = new Map();

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
   * @param {number} location
   * @param {number} type
   */
  function put(external, location, type) {
    const internal = create();
    entities.set(external, internal);
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
   * @param {number} destination
   * @param {number} direction
   * @param {number} turn
   */
  function move(external, destination, direction, turn) {
    const internal = entity(external);
    moves.set(external, destination);
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

  function reset() {
    for (const [internal, destination] of moves.entries()) {
      viewModel.move(internal, destination);
    }
    for (const [external, internal] of removes.entries()) {
      viewModel.remove(internal);
      entities.delete(external);
    }
    removes.clear();
    moves.clear();
  }

  return { reset, put, take, fell, move, bounce };
}


