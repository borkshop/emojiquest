
/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 * @typedef {import('./view-model.js').CreateFn} CreateFn
 * @typedef {import('./view-model.js').MoveFn} MoveFn
 * @typedef {import('./view-model.js').PutFn} PutFn
 * @typedef {import('./view-model.js').TransitionFn} TransitionFn
 */

import {count} from './iteration.js';

const [agent, tree] = count();

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @callback FollowFn
 * @param {number} e - entity that moved
 * @param {CursorChange} transition
 */

/**
 * @param {Object} args
 * @param {number} args.size
 * @param {AdvanceFn} args.advance
 * @param {TransitionFn} args.transition
 * @param {MoveFn} args.move
 * @param {PutFn} args.put
 * @param {CreateFn} args.create
 * @param {FollowFn} args.follow
 */
export function makeModel({
  size,
  advance,
  create,
  transition,
  move,
  put,
  follow,
}) {
  /** @type {Array<number | undefined>} */
  const entities = new Array(size);
  // const priorities = new Array(size);
  const intents = new Map();
  const locations = new Map();
  /** @type {Map<number, Map<number, CursorChange>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  const mobiles = new Set();
  /** @type {Map<number, number>} */
  const moves = new Map();

  function init() {
    const spawn = 0;

    const a = create(agent);
    entities[spawn] = a;
    locations.set(a, spawn);
    put(a, spawn);

    for (let t = 0; t < size; t++) {
      if (Math.random() < 0.25 && t !== spawn) {
        const e = create(tree);
        put(e, t);
        entities[t] = e;
        if (Math.random() < 0.25) {
          mobiles.add(e);
          locations.set(e, t);
        }
      }
    }

    return a;
  }

  /**
   * @param {number} t - target tile number
   * @returns {Map<number, CursorChange>} from entity
   */
  function bids(t) {
    let b = targets.get(t);
    if (!b) {
      /** @type {Map<number, CursorChange>} */
      b = new Map();
      targets.set(t, b);
    }
    return b;
  }

  /**
   * @param {number} e - entity number
   * @param {number} direction - in quarters clockwise from north
   */
  function intend(e, direction) {
    const source = locations.get(e);
    if (source === undefined) throw new Error(`Simulation assertion error: cannot locate entity ${e}`);
    const {position: target, turn, transit} = advance({position: source, direction});
    bids(target).set(e, {position: source, direction, turn, transit});
    intents.set(e, direction);
  }

  /**
   * effects transitions
   */
  function tick() {
    // AI
    for (const mobile of mobiles) {
      // TODO select from eleigible directions.
      intend(mobile, Math.floor(Math.random() * 4));
    }

    // Auction moves
    for (const [destination, options] of targets.entries()) {
      if (entities[destination] === undefined) {
        if (location === undefined) throw new Error(`Assertion failed`);
        // TODO: pluck less lazy
        const candidates = [...options.keys()].sort(() => Math.random() - 0.5);
        const winner = candidates.pop();
        if (winner === undefined) throw new Error(`Assertion failed`);
        const change = options.get(winner);
        if (change === undefined) throw new Error(`Assertion failed`);
        const {position: origin, direction, turn} = change;
        transition(winner, direction, turn);
        follow(winner, change);
        moves.set(winner, destination);
        locations.set(winner, destination);
        entities[destination] = winner;
        entities[origin] = undefined;
      }
    }
  }

  /**
   * effects moves;
   */
  function tock() {
    for (const [entity, position] of moves.entries()) {
      move(entity, position);
    }

    moves.clear();
    targets.clear();
    intents.clear();
  }

  return {intend, tick, tock, init};
}
