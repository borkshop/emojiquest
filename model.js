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

import {assert, assertDefined, assumeDefined} from './assert.js';
import {quarturnToOcturn} from './geometry2d.js';
import {
  defaultTileTypeForAgentType,
  itemTypes,
  itemTypesByName,
  tileTypesByName,
  effectTypesByName,
  agentTypesByName,
  bump,
  craft,
} from './mechanics.js';

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @typedef {Array<number>} Inventory
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

const emptyItem = itemTypesByName.empty;

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

  let entities = new Uint16Array(size);
  let entitiesWriteBuffer = new Uint16Array(size);

  // TODO consider assigning every position a priority, then shuffling
  // priorities locally each turn.
  // const priorities = new Array(size);

  /** @type {Map<number, number>} entity number -> heading in quarter turns clockwise from north */
  const intents = new Map();

  /** @type {Map<number, number>} entity number -> location number */
  const locations = new Map();

  /** @type {Map<number, number>} */
  const entityTypes = new Map();

  /** @type {Map<number, Map<number, Bid>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  /** @type {Set<number>} entity numbers of mobile entities */
  const mobiles = new Set();
  /** @type {Set<number>} */
  const moves = new Set();
  /** @type {Set<number>} */
  const removes = new Set();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number, direction: number}>} */
  const bumps = [];

  /** @type {Set<number>} */
  const craftIntents = new Set();

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

  // TODO other kinds of observers, beyond just following an entity's location.

  let nextModelEntity = 1; // 0 implies non-existant.

  /**
   * Some entities may have an inventory.
   * Each inventory is an array of item types, and type zero indicates an empty
   * slot.
   * This is sufficiently general to model inventories for arbitrary entities.
   *
   * Crafting mechanics apply only to the first two slots of the inventory
   * array regardless of length.
   *
   * The player entity specifically has two hand slots followed by eight pack
   * slots.
   *
   * The mechanics do not yet necessitate item entities to track item instance
   * state.
   * Concepts like "wear" would require this, but can also be cheaply but
   * imperfectly modeled with a probability of wearing out on any use.
   *
   * @type {Map<number, Array<number>>}
   */

  const inventories = new Map();

  /** @type {Map<number, number>} */
  const effectsOwned = new Map();
  /** @type {Map<number, number>} */
  const effectsChosen = new Map();
  /** @type {Map<number, number>} */
  const healths = new Map();
  /** @type {Map<number, number>} */
  const staminas = new Map();

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
    entitiesWriteBuffer[location] = 0;
  }

  /** @type {TypeFn} */
  function entityType(entity) {
    const type = entityTypes.get(entity);
    assertDefined(type, `Cannot get type for non-existent model entity ${entity}`);
    return type;
  }

  /**
   * @param {number} e - entity
   * @returns {number} t - tile
   */
  function locate(e) {
    const t = locations.get(e);
    assertDefined(t, `Simulation assertion error: cannot locate entity ${e}`);
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
    assertDefined(entityFollowers);
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
    entities[spawn] = agent;
    locations.set(agent, spawn);
    macroViewModel.put(agent, spawn, tileTypesByName.happy);

    inventories.set(agent, [
      emptyItem, // held in left hand
      emptyItem, // held in right hand
      emptyItem, // command === 1
      emptyItem, // command === 2
      emptyItem, // command === 3
      emptyItem, // command === 4 (5 skipped)
      emptyItem, // command === 6
      emptyItem, // command === 7
      emptyItem, // command === 8
      emptyItem, // command === 9
    ]);
    healths.set(agent, 0);
    staminas.set(agent, 0);
    effectsOwned.set(agent, 1 << effectTypesByName.none);
    effectsChosen.set(agent, effectTypesByName.none);

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
        entities[location] = entity;
        if (Math.random() < 0.0625) {
          mobiles.add(entity);
          locations.set(entity, location);
        }
      }
    }

    return agent;
  }

  /**
   * @param {number} entity
   * @param {number} direction - in quarters clockwise from north
   * @param {boolean} repeat - whether the agent intends to act upon the
   * patient before them.
   */
  function intend(entity, direction, repeat = false) {
    const source = locate(entity);
    const {position: target, turn, transit} = advance({position: source, direction});
    bids(target).set(entity, {position: source, direction, turn, transit, repeat});
    intents.set(entity, direction);
    craftIntents.delete(entity);
  }

  /**
   * @param {number} entity
   */
  function intendToCraft(entity) {
    craftIntents.add(entity);
    intents.delete(entity);
  }

  const bumpKit = {
    entityType,
    entityEffect,
    entityInventory,
    destroyEntity,
    macroViewModel,
  };

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
    for (const entity of mobiles) {
      // TODO select from eleigible directions.
      intend(entity, Math.floor(Math.random() * 4));
    }

    // Prepare the next generation
    entitiesWriteBuffer.set(entities);

    // Auction
    // Considering every tile that an entity wishes to move into or act upon
    for (const [destination, options] of targets.entries()) {
      const candidates = [...options.keys()].sort(() => Math.random() - 0.5);
      // TODO: pluck less lazy
      const winner = assumeDefined(candidates.pop());
      const change = assumeDefined(options.get(winner));
      const {position: origin, direction, turn, repeat} = change;
      const patient = entities[destination];
      if (patient === 0) {
        // Move
        macroViewModel.move(winner, destination, direction * quarturnToOcturn, turn);
        notifyFollowers(winner, change, destination);
        locations.set(winner, destination);
        moves.add(winner);
        entitiesWriteBuffer[destination] = winner;
        entitiesWriteBuffer[origin] = 0;
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
        const change = assumeDefined(options.get(loser));
        const {direction} = change;
        macroViewModel.bounce(loser, direction * quarturnToOcturn);
      }
    }

    // Successfully bump an entity that did not move.
    // TODO break this into phases since an entity that doesn't move can also
    // be destroyed by another bump and therein may lay race conditions.
    for (const { agent, patient, destination, direction } of bumps) {
      if (!moves.has(patient) && !removes.has(patient) && !removes.has(agent)) {
        const inventory = inventories.get(agent);
        if (inventory !== undefined && inventory.length >= 2) {
          bump(bumpKit, {
            agent,
            patient,
            destination,
            direction,
          });
        }
      }
    }

    // Craft.
    for (const entity of craftIntents) {
      const inventory = inventories.get(entity);
      if (inventory !== undefined && inventory.length >= 2) {
        [inventory[0], inventory[1]] = craft(inventory[0], inventory[1]);
      }
    }

    // Swap generations.
    [entitiesWriteBuffer, entities] = [entities, entitiesWriteBuffer];
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
    craftIntents.clear();
  }

  /**
   * @param {number} location
   * @returns {number} entityType or (zero for no-type)
   */
  function get(location) {
    const entity = assumeDefined(entities[location]);
    if (entity === 0) {
      return 0;
    }
    const entityType = entityTypes.get(entity);
    if (entityType === undefined) {
      return 0;
    }
    return entityType;
  }

  /**
   * @param {number} location
   * @param {number} entityType
   */
  function set(location, entityType) {
    remove(location);
    if (entityType !== agentTypesByName.player) {
      const entity = createEntity(entityType);
      entities[location] = entity;
      const tileType = defaultTileTypeForAgentType[entityType];
      macroViewModel.put(entity, location, tileType);
      macroViewModel.enter(entity);
    }
  }

  /**
   * @param {number} location
   */
  function remove(location) {
    const entity = entities[location];
    if (entity !== 0) {
      const entityType = entityTypes.get(entity);
      assertDefined(entityType);
      if (entityType === agentTypesByName.player) {
        // There is not yet special logic in the controller to ensure that the
        // player agent still exists when exiting editor mode.
        return;
      }
      macroViewModel.exit(entity);
      locations.delete(entity);
      entityTypes.delete(entity);
      mobiles.delete(entity);
      entities[location] = 0;
    }
  }

  /**
   * @param {number} entity
   */
  function entityInventory(entity) {
    return assumeDefined(inventories.get(entity));
  }

  /**
   * @param {number} entity
   * @param {number} effect
   */
  function availEffect(entity, effect) {
    const effects = assumeDefined(effectsOwned.get(entity)) | 1 << effect;
    effectsOwned.set(entity, effects);
  }

  /**
   * @param {number} entity
   */
  function entityEffect(entity) {
    const effect = assumeDefined(effectsChosen.get(entity));
    const mask = assumeDefined(effectsOwned.get(entity));
    assert((mask & (1 << effect)) !== 0);
    return effect;
  }

  /**
   * @param {number} entity
   * @param {number} effect
   */
  function entityHasEffect(entity, effect) {
    const mask = assumeDefined(effectsOwned.get(entity));
    return (mask & (1 << effect)) !== 0;
  }

  /**
   * @param {number} entity
   */
  function entityEffects(entity) {
    return assumeDefined(effectsOwned.get(entity));
  }

  /**
   * @param {number} entity
   */
  function entityEffectChoice(entity) {
    return assumeDefined(effectsChosen.get(entity));
  }

  /**
   * @param {number} entity
   * @param {number} effect
   */
  function chooseEffect(entity, effect) {
    const entityEffects = assumeDefined(effectsOwned.get(entity));
    assert((entityEffects & (1 << effect)) !== 0);
    effectsChosen.set(entity, effect);
  }

  /**
   * @param {number} entity
   */
  function entityStamina(entity) {
    return assumeDefined(staminas.get(entity));
  }

  /**
   * @param {number} entity
   */
  function entityHealth(entity) {
    return assumeDefined(healths.get(entity));
  }

  /**
   * @param {number} entity
   * @param {number} itemType TODO inventoryIndex
   * @returns {'effect' | 'discard'}
   */
  function use(entity, itemType) {
    const effectName = itemTypes[itemType].effect;
    if (effectName !== undefined) {
      const effectType = assumeDefined(effectTypesByName[effectName]);
      availEffect(entity, effectType);
      chooseEffect(entity, effectType);
      return 'effect';
    }
    // TODO eat for health, eat for stamina
    return 'discard';
  }

  /**
   * @param {number} entity
   * @param {number} i
   * @param {number} j
   */
  function swap(entity, i, j) {
    const inventory = entityInventory(entity);
    assert(i >= 0);
    assert(j >= 0);
    assert(i < inventory.length);
    assert(j < inventory.length);
    [inventory[i], inventory[j]] = [inventory[j], inventory[i]];
  }

  return {
    get,
    set,
    remove,
    intend,
    intendToCraft,
    swap,
    use,
    craft,
    entityInventory, // XXX remove
    entityStamina,
    entityHealth,
    entityEffect,
    entityHasEffect,
    entityEffects,
    entityEffectChoice,
    chooseEffect,
    tick,
    tock,
    init,
    follow,
    unfollow,
  };
}
