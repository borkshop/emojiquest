
/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 * @typedef {import('./view-model.js').MoveFn} MoveFn
 * @typedef {import('./view-model.js').RemoveFn} RemoveFn
 * @typedef {import('./view-model.js').PutFn} PutFn
 * @typedef {import('./view-model.js').TransitionFn} TransitionFn
 */

import {same} from './geometry2d.js';
import {viewTypesByName} from './data.js';

const {agent, tree} = viewTypesByName;

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @callback FollowFn
 * @param {number} e - entity that moved
 * @param {CursorChange} transition
 * @param {number} destination
 */

/**
 * @callback TypeFn
 * @param {number} entity
 * @returns {number} type
 */

/**
 * @typedef {Object} BidExtension
 * @property {boolean} deliberate - Whether the agent wishes to bump the
 * patient, otherwise to move onto the tile in the direction only if it is
 * empty.
 */

/**
 * @typedef {CursorChange & BidExtension} Bid
 */

/**
 * @param {Object} args
 * @param {number} args.size
 * @param {AdvanceFn} args.advance
 * @param {TransitionFn} args.transition
 * @param {MoveFn} args.move
 * @param {RemoveFn} args.remove
 * @param {PutFn} args.put
 * @param {FollowFn} args.follow
 */
export function makeModel({
  size,
  advance,
  transition: transitionView,
  move: moveView,
  remove: removeView,
  put: positionView,
  follow,
}) {
  /** @type {Array<number | undefined>} */
  let entitiesPrev = new Array(size);
  let entitiesNext = new Array(size);
  // const priorities = new Array(size);
  /** @type {Map<number, number>} entity number -> heading in quarter turns clockwise from north */
  const intents = new Map();
  /** @type {Map<number, number>} entity number -> location number */
  const locations = new Map();
  /** @type {Map<number, number>} */
  const types = new Map();

  // Ephemeral state

  /** @type {Map<number, Map<number, Bid>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  /** @type {Set<number>} entity numbers of automobile entities */
  const mobiles = new Set();
  /** @type {Map<number, number>} */
  const moves = new Map();
  /** @type {Set<number>} entities to remove on tock */
  const removes = new Set();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number}>} - agents to patients */
  const bumps = [];

  let next = 0;
  /**
   * @param {number} type
   * @returns {number} entity
   */
  function create(type) {
    const entity = next;
    next++;
    types.set(entity, type);
    return entity;
  }

  /** @type {TypeFn} */
  function type(entity) {
    const type = types.get(entity);
    if (type === undefined) {
      throw new Error(`Cannot get type for non-existent entity ${entity}`);
    }
    return type;
  }

  /**
   * @param {number} e - entity
   * @returns {number} t - tile
   */
  function locate(e) {
    const t = locations.get(e);
    if (t === undefined) {
      throw new Error(`Simulation assertion error: cannot locate entity ${e}`);
    }
    return t;
  }

  /**
   * @param {number} t - target tile number
   * @returns {Map<number, Bid>} from entity
   */
  function bids(t) {
    let b = targets.get(t);
    if (!b) {
      /** @type {Map<number, Bid>} */
      b = new Map();
      targets.set(t, b);
    }
    return b;
  }

  /**
   * @param {number} spawn - tile to spawn the agent at
   */
  function init(spawn) {
    const a = create(agent);
    entitiesPrev[spawn] = a;
    locations.set(a, spawn);
    positionView(a, spawn);

    for (let t = 0; t < size; t++) {
      if (Math.random() < 0.25 && t !== spawn) {
        const e = create(tree);
        positionView(e, t);
        entitiesPrev[t] = e;
        if (Math.random() < 0.25) {
          mobiles.add(e);
          locations.set(e, t);
        }
      }
    }

    return a;
  }

  /**
   * @param {number} e - entity number
   * @param {number} direction - in quarters clockwise from north
   * @param {boolean} deliberate - whether the agent intends to act upon the
   * patient before them.
   */
  function intend(e, direction, deliberate = false) {
    const source = locate(e);
    if (direction === same) {
      return;
    }
    const {position: target, turn, transit} = advance({position: source, direction});
    bids(target).set(e, {position: source, direction, turn, transit, deliberate});
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

    // Prepare the next generation
    for (let i = 0; i < size; i++) {
      entitiesNext[i] = entitiesPrev[i];
    }

    // Auction
    // Considering every tile that an entity wishes to move into or act upon
    for (const [destination, options] of targets.entries()) {
      const candidates = [...options.keys()].sort(() => Math.random() - 0.5);
      if (location === undefined) throw new Error(`Assertion failed`);
      // TODO: pluck less lazy
      const winner = candidates.pop();
      if (winner === undefined) throw new Error(`Assertion failed`);
      const change = options.get(winner);
      if (change === undefined) throw new Error(`Assertion failed`);
      const {position: origin, direction, turn, deliberate} = change;
      const patient = entitiesPrev[destination];
      if (patient === undefined) {
        // Move
        transitionView(winner, {direction, rotation: turn});
        follow(winner, change, destination);
        moves.set(winner, destination);
        locations.set(winner, destination);
        entitiesNext[destination] = winner;
        entitiesNext[origin] = undefined;
      } else {
        // Bounce
        transitionView(winner, {direction, bump: true});
        if (deliberate) {
          // Bump
          bumps.push({agent: winner, patient, origin, destination});
        }
      }
      // Bounce all of the candidates that did not get to procede in the
      // direction they intended.
      for (const loser of candidates) {
        const change = options.get(loser);
        if (change === undefined) throw new Error(`Assertion failed`);
        const {position: origin, direction} = change;
        transitionView(loser, {direction, bump: true});
        moves.set(loser, origin);
      }
    }

    // Successfully bump an entity that did not move.
    for (const { patient, destination } of bumps) {
      if (!moves.has(patient)) {
        transitionView(patient, {
          rotation: 1,
          bump: true,
          stage: 'exit'
        });
        removes.add(patient);
        entitiesNext[destination] = undefined;
      }
    }

    // Swap generations
    [entitiesNext, entitiesPrev] = [entitiesPrev, entitiesNext];
  }

  /**
   * effects moves;
   */
  function tock() {
    for (const [entity, position] of moves.entries()) {
      moveView(entity, position);
    }
    for (const entity of removes) {
      removeView(entity);
      types.delete(entity);
      locations.delete(entity);
      mobiles.delete(entity);
    }

    moves.clear();
    removes.clear();
    bumps.length = 0;
    targets.clear();
    intents.clear();
  }

  return {intend, type, tick, tock, init};
}
