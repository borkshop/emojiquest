
/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 * @typedef {import('./macro-view-model.js').MacroViewModel} MacroViewModel
 * @typedef {import('./controls.js').Controls} Controls
 */

import {same, quarturnToOcturn, halfOcturn, fullOcturn} from './geometry2d.js';
import {agentTypes, agentTypesByName, defaultTileTypeForAgentType, tileTypesByName, itemTypes, itemTypesByName} from './data.js';

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @typedef {Object} Inventory
 * @property {number} left
 * @property {number} right
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
 * @property {boolean} repeat - Repeated actions should only attempt to move
 * the agent, not perform object specific interactions.
 */

/**
 * @typedef {CursorChange & BidExtension} Bid
 */

/**
 * @typedef {ReturnType<makeModel>} Model
 */

/**
 * @param {Object} args
 * @param {number} args.size
 * @param {AdvanceFn} args.advance
 * @param {MacroViewModel} args.macroViewModel
 * @param {FollowFn} args.follow
 */
export function makeModel({
  size,
  advance,
  macroViewModel,
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
  const entityTypes = new Map();

  // Ephemeral state

  /** @type {Map<number, Map<number, Bid>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  /** @type {Set<number>} entity numbers of automobile entities */
  const mobiles = new Set();
  /** @type {Set<number>} */
  const moves = new Set();
  /** @type {Set<number>} */
  const removes = new Set();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number, direction: number}>} */
  const bumps = [];

  let nextModelEntity = 0;

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
   * @param {number} entity
   */
  function destroyEntity(entity) {
    removes.add(entity);
    entityTypes.delete(entity);
    mobiles.delete(entity);
    locations.delete(entity);
  }

  /** @type {TypeFn} */
  function entityType(entity) {
    const type = entityTypes.get(entity);
    if (type === undefined) {
      throw new Error(`Cannot get type for non-existent model entity ${entity}`);
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
    const agent = createEntity(agentTypesByName.player);
    entitiesPrev[spawn] = agent;
    locations.set(agent, spawn);
    macroViewModel.put(agent, spawn, tileTypesByName.happy);

    for (let location = 0; location < size; location++) {
      if (Math.random() < 0.25 && location !== spawn) {
        const modelType = [
          agentTypesByName.pineTree,
          agentTypesByName.appleTree,
          agentTypesByName.axe
        ].sort(() => Math.random() - 0.5).pop() || 0;
        const tileType = defaultTileTypeForAgentType[modelType];
        const entity = createEntity(modelType);
        macroViewModel.put(entity, location, tileType);
        entitiesPrev[location] = entity;
        if (Math.random() < 0.0625) {
          mobiles.add(entity);
          locations.set(entity, location);
        }
      }
    }

    return agent;
  }

  /**
   * @param {number} e - entity number
   * @param {number} direction - in quarters clockwise from north
   * @param {boolean} repeat - whether the agent intends to act upon the
   * patient before them.
   */
  function intend(e, direction, repeat = false) {
    const source = locate(e);
    if (direction === same) {
      return;
    }
    const {position: target, turn, transit} = advance({position: source, direction});
    bids(target).set(e, {position: source, direction, turn, transit, repeat});
    intents.set(e, direction);
  }

  /**
   * effects transitions
   * @param {Inventory} inventory
   */
  function tick(inventory) {
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
      const {position: origin, direction, turn, repeat} = change;
      const patient = entitiesPrev[destination];
      if (patient === undefined) {
        // Move
        macroViewModel.move(winner, destination, direction * quarturnToOcturn, turn);
        follow(winner, change, destination);
        locations.set(winner, destination);
        moves.add(winner);
        entitiesNext[destination] = winner;
        entitiesNext[origin] = undefined;
      } else {
        // Bounce
        macroViewModel.bounce(winner, direction * quarturnToOcturn);
        if (!repeat) {
          // Bump
          bumps.push({agent: winner, patient, origin, destination, direction});
        }
      }
      // Bounce all of the candidates that did not get to procede in the
      // direction they intended.
      for (const loser of candidates) {
        const change = options.get(loser);
        if (change === undefined) throw new Error(`Assertion failed`);
        const {direction} = change;
        macroViewModel.bounce(loser, direction * quarturnToOcturn);
      }
    }

    // Successfully bump an entity that did not move.
    // TODO break this into phases since an entity that doesn't move can also
    // be destroyed by another bump and therein may lay race conditions.
    for (const { agent, patient, destination, direction } of bumps) {
      if (!moves.has(patient) && !removes.has(patient) && !removes.has(agent)) {
        const agentType = agentTypes[entityType(agent)].name;
        const patientType = agentTypes[entityType(patient)].name;
        const leftType = itemTypes[inventory.left].name;
        const rightType = itemTypes[inventory.right].name;
        const condition = `${agentType}:${patientType}:${leftType}:${rightType}:`;
        if (/^player:axe:empty:/.test(condition)) {
          inventory.left = itemTypesByName.axe;
          macroViewModel.take(patient, (direction * quarturnToOcturn + halfOcturn) % fullOcturn);
          destroyEntity(patient);
          entitiesNext[destination] = undefined;
        } else if (/^player:pineTree:axe:/.test(condition)) {
          inventory.right = itemTypesByName.pineLumber;
          macroViewModel.bounce(agent, direction * quarturnToOcturn);
          macroViewModel.fell(patient);
          destroyEntity(patient);
          entitiesNext[destination] = undefined;
        }
      }
    }

    // Swap generations
    [entitiesNext, entitiesPrev] = [entitiesPrev, entitiesNext];
  }

  /**
   * effects moves;
   */
  function tock() {
    macroViewModel.reset();
    moves.clear();
    removes.clear();
    bumps.length = 0;
    targets.clear();
    intents.clear();
  }

  return {intend, tick, tock, init};
}
