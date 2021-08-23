/**
 * The model represents the simulation of the Emoji Quest world.
 * The world is not sharded and every turn visits the entire world.
 * The simulation works by gathering intents from the player and any simulated
 * non-player entities, then running an auction to determine which intents
 * succeed or fail to effect results for the simulated turn.
 *
 * The model emits transitions to a macro view model, which renders animated
 * transitions for a section of the simulation for the player.
 * The simulation is not responsible for choosing which entities to render, but
 * broadcasts all world transitions and expects the view layer to cull
 * irrelevant information.
 */

// @ts-check

/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
 * @typedef {import('./macro-view-model.js').MacroViewModel} MacroViewModel
 */

import {assert} from './assert.js';
import {quarturnToOcturn} from './geometry2d.js';
import {defaultTileTypeForAgentType, tileTypesByName, effectTypesByName, agentTypesByName, bump} from './mechanics.js';

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
 */
export function makeModel({
  size,
  advance,
  macroViewModel,
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

  // TODO hands for each entity
  // TODO inventories for each entity
  // TODO effects for each entity
  // TODO health for each entity
  // TODO stamina for each entity
  // TODO observers for hands and inventories

  /**
   * Functions to inform of the motion of an entity.
   * The entity does not need to still exist, and this invariant should be
   * revisited if entity numbers get collected and reused in the future.
   * This would complicate the unfollow function, which currently is able to
   * distinguish an accidental call from a deliberate call by balancing follow
   * and unfollow calls.
   *
   * @type {Map<number, Set<FollowFn>>}
   */
  const followers = new Map();

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
   * Note that entity numbers are not reused and this could lead to problems if
   * the next ID counter fills the double precision mantissa.
   * The follow / unfollow functions would need to be revisited if we were to
   * collect and reuse entity identifiers.
   * Specifically, we would probably need to have follow return an opaque token
   * (possibly a closure) to balance unfollow calls.
   *
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
   * @param {number} location
   */
  function destroyEntity(entity, location) {
    removes.add(entity);
    entityTypes.delete(entity);
    mobiles.delete(entity);
    locations.delete(entity);
    entitiesNext[location] = undefined;
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
   * @param {number} e
   * @param {FollowFn} follower
   */
  function follow(e, follower) {
    let entityFollowers = followers.get(e);
    if (entityFollowers === undefined) {
      /** @type {Set<FollowFn>} */
      entityFollowers = new Set();
      followers.set(e, entityFollowers);
    }
    assert(!entityFollowers.has(follower));
    entityFollowers.add(follower);
  }

  /**
   * @param {number} e
   * @param {FollowFn} follower
   */
  function unfollow(e, follower) {
    const entityFollowers = followers.get(e);
    assert(entityFollowers !== undefined);
    assert(entityFollowers.has(follower));
    entityFollowers.delete(follower);
  }

  /**
   * @param {number} e
   * @param {CursorChange} change
   * @param {number} destination
   */
  function notifyFollowers(e, change, destination) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const notifyFollower of entityFollowers) {
        notifyFollower(e, change, destination);
      }
    }
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
          agentTypesByName.pineTree,
          agentTypesByName.pineTree,
          agentTypesByName.ram,
          agentTypesByName.ewe,
          agentTypesByName.appleTree,
          agentTypesByName.appleTree,
          agentTypesByName.mountain,
          agentTypesByName.mountain,
          agentTypesByName.mountain,
          agentTypesByName.axe,
          agentTypesByName.coat,
          agentTypesByName.pick,
          agentTypesByName.bank,
          agentTypesByName.forge,
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
        notifyFollowers(winner, change, destination);
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
        bump({
          agent,
          agentType: entityType(agent),
          patient,
          patientType: entityType(patient),
          leftType: inventory.left,
          rightType: inventory.right,
          effectType: effectTypesByName.empty,
          destination,
          direction,
          inventory,
          macroViewModel,
          destroyEntity,
        });
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

  /**
   * @param {number} location
   * @returns {number | undefined} entityType
   */
  function get(location) {
    const entity = entitiesPrev[location];
    if (entity === undefined) {
      return undefined;
    }
    return entityTypes.get(entity);
  }

  /**
   * @param {number} location
   * @param {number} entityType
   */
  function set(location, entityType) {
    remove(location);
    if (entityType !== agentTypesByName.player) {
      const entity = createEntity(entityType);
      entitiesPrev[location] = entity;
      const tileType = defaultTileTypeForAgentType[entityType];
      macroViewModel.put(entity, location, tileType);
      macroViewModel.enter(entity);
    }
  }

  /**
   * @param {number} location
   */
  function remove(location) {
    const entity = entitiesPrev[location];
    if (entity !== undefined) {
      const entityType = entityTypes.get(entity);
      assert(entityType !== undefined);
      if (entityType === agentTypesByName.player) {
        // There is not yet special logic in the controller to ensure that the
        // player agent still exists when exiting editor mode.
        return;
      }
      macroViewModel.exit(entity);
      locations.delete(entity);
      entityTypes.delete(entity);
      mobiles.delete(entity);
      entitiesPrev[location] = undefined;
    }
  }

  return {
    get,
    set,
    remove,
    intend,
    tick,
    tock,
    init,
    follow,
    unfollow,
  };
}
