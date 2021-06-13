
/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 * @typedef {import('./view-model.js').MoveFn} MoveFn
 * @typedef {import('./view-model.js').RemoveFn} RemoveFn
 * @typedef {import('./view-model.js').PutFn} PutFn
 * @typedef {import('./view-model.js').TransitionFn} TransitionFn
 */

import {same} from './geometry2d.js';
import {agentTypesByName, defaultTileTypeForAgentType, tileTypesByName} from './data.js';

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
 * @param {Object} args.viewModel
 * @param {TransitionFn} args.viewModel.transition
 * @param {MoveFn} args.viewModel.move
 * @param {RemoveFn} args.viewModel.remove
 * @param {PutFn} args.viewModel.put
 * @param {FollowFn} args.follow
 */
export function makeModel({
  size,
  advance,
  viewModel,
  follow,
}) {
  /** @type {Array<number | undefined>} */
  let entitiesPrev = new Array(size);
  let entitiesNext = new Array(size);
  let tilesPrev = new Array(size);
  let tilesNext = new Array(size);
  // const priorities = new Array(size);
  /** @type {Map<number, number>} entity number -> heading in quarter turns clockwise from north */
  const intents = new Map();
  /** @type {Map<number, number>} entity number -> location number */
  const locations = new Map();
  /** @type {Map<number, number>} */
  const entityTypes = new Map();
  /** @type {Map<number, number>} */
  const tileTypes = new Map();
  // /** @type {Map<number, number>} */
  // const leftHands = new Map();
  // /** @type {Map<number, number>} */
  // const rightHands = new Map();

  // Ephemeral state

  /** @type {Map<number, Map<number, Bid>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  /** @type {Set<number>} entity numbers of automobile entities */
  const mobiles = new Set();
  /** @type {Map<number, number>} */
  const moves = new Map();
  /** @type {Map<number, number>} entities to remove on tock (model to viewModel) */
  const removes = new Map();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number}>} - agents to patients */
  const bumps = [];

  let nextModelEntity = 0;
  let nextViewEntity = 0;

  /**
   * @param {number} type
   * @returns {number} entity
   */
  function createEntity(type) {
    const entity = nextModelEntity;
    nextModelEntity++;
    entityTypes.set(entity, type);
    return entity;
  }

  /**
   * @param {number} type
   * @returns {number} entity
   */
  function createTile(type) {
    const entity = nextViewEntity;
    nextViewEntity++;
    tileTypes.set(entity, type);
    return entity;
  }

  /** @type {TypeFn} */
  function entityType(entity) {
    const type = entityTypes.get(entity);
    if (type === undefined) {
      throw new Error(`Cannot get type for non-existent model entity ${entity}`);
    }
    return type;
  }

  /** @type {TypeFn} */
  function tileType(entity) {
    const type = tileTypes.get(entity);
    if (type === undefined) {
      throw new Error(`Cannot get type for non-existent view model entity ${entity}`);
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
    const agentModelEntity = createEntity(agentTypesByName.player);
    const agentViewModelEntity = createTile(tileTypesByName.happy);
    entitiesPrev[spawn] = agentModelEntity;
    tilesPrev[spawn] = agentViewModelEntity;
    locations.set(agentModelEntity, spawn);
    viewModel.put(agentViewModelEntity, spawn, tileTypesByName.happy);

    for (let location = 0; location < size; location++) {
      if (Math.random() < 0.25 && location !== spawn) {
        const modelType = [
          agentTypesByName.pineTree,
          agentTypesByName.appleTree,
          agentTypesByName.axe
        ].sort(() => Math.random() - 0.5).pop() || 0;
        const tileType = defaultTileTypeForAgentType[modelType];
        const entity = createEntity(modelType);
        const tile = createTile(tileType);
        viewModel.put(tile, location, tileType);
        entitiesPrev[location] = entity;
        tilesPrev[location] = tile;
        if (Math.random() < 0.0625) {
          mobiles.add(entity);
          locations.set(entity, location);
        }
      }
    }

    return agentModelEntity;
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
    // Measure
    // let treeCount = 0;
    // for (let i = 0; i < size; i++) {
    // }

    // // Create
    // for (let i = 0; i < size; i++) {
    // }

    // Think
    for (const mobile of mobiles) {
      // TODO select from eleigible directions.
      intend(mobile, Math.floor(Math.random() * 4));
    }

    // Prepare the next generation
    for (let i = 0; i < size; i++) {
      entitiesNext[i] = entitiesPrev[i];
      tilesNext[i] = tilesPrev[i];
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
        viewModel.transition(tilesPrev[origin], {direction, rotation: turn});
        follow(winner, change, destination);
        moves.set(tilesPrev[origin], destination);
        locations.set(winner, destination);
        entitiesNext[destination] = winner;
        entitiesNext[origin] = undefined;
        tilesNext[destination] = tilesPrev[origin];
        tilesNext[origin] = undefined;
      } else {
        // Bounce
        viewModel.transition(tilesPrev[origin], {direction, bump: true});
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
        viewModel.transition(tilesPrev[origin], {direction, bump: true});
      }
    }

    // Successfully bump an entity that did not move.
    for (const { patient, destination } of bumps) {
      if (!moves.has(patient)) {
        viewModel.transition(tilesPrev[destination], {
          rotation: 1,
          bump: true,
          stage: 'exit'
        });
        removes.set(patient, tilesPrev[destination]);
        entitiesNext[destination] = undefined;
        tilesNext[destination] = undefined;
      }
    }

    // Swap generations
    [entitiesNext, entitiesPrev] = [entitiesPrev, entitiesNext];
    [tilesNext, tilesPrev] = [tilesPrev, tilesNext];
  }

  /**
   * effects moves;
   */
  function tock() {
    for (const [tile, destination] of moves.entries()) {
      viewModel.move(tile, destination);
    }
    for (const [entity, tile] of removes.entries()) {
      viewModel.remove(tile);
      entityTypes.delete(entity);
      locations.delete(entity);
      mobiles.delete(entity);
    }

    moves.clear();
    removes.clear();
    bumps.length = 0;
    targets.clear();
    intents.clear();
  }

  return {intend, entityType, tileType, tick, tock, init};
}
