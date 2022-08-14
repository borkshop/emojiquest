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

import { assert, assertDefined, assumeDefined } from './lib/assert.js';
import { halfOcturn, fullOcturn, quarturnToOcturn } from './geometry2d.js';

/**
 * @typedef {import('./topology.js').AdvanceFn} AdvanceFn
 */

/**
 * @callback PutFn
 * @param {number} entity
 * @param {number} location
 * @param {number} tileType
 */

/**
 * @callback MoveFn
 * @param {number} entity
 * @param {number} destination
 * @param {number} directionQuarturns
 * @param {number} turnQuarturns
 */

/**
 * @callback ReplaceFn
 * Instructs the viewer to animate the entity glyph being gradually replaced.
 *
 * @param {number} entity
 * @param {number} glyph
 */

/**
 * @callback MovingReplaceFn
 * @param {number} entity
 * @param {number} type
 * @param {number} destination
 * @param {number} directionQuarturns
 * @param {number} turnQuarturns
 */

/**
 * @callback TakeFn
 * Instructs the viewer to animate the entity being sent to the entity in the
 * given direction, as if taken by that entity.
 * @param {number} entity
 * @param {number} direction
 */

/**
 * @callback FellFn
 * Instructs the viewer to animate the entity falling.
 * @param {number} entity
 */

/**
 * @callback EnterFn
 * Instructs the viewer to animate the entity into view.
 * @param {number} entity
 */

/**
 * @callback ExitFn
 * Instructs the viewer to animate the entity out of the view.
 * @param {number} entity
 */

/**
 * @callback BounceFn
 * Instructs the viewer to animate the entity bumping in the direction but not
 * moving.
 * @param {number} entity
 * @param {number} directionQuarturns
 */

/**
 * @callback TickFn
 * Informs the view that the animation turn has begun.
 */

/**
 * @callback TockFn
 * Informs the view that the animation turn has ended.
 */

/**
 * @typedef {Object} MacroViewModel
 * @property {PutFn} put
 * @property {MoveFn} move
 * @property {BounceFn} bounce
 * @property {ReplaceFn} replace
 * @property {MovingReplaceFn} movingReplace
 * @property {TakeFn} take
 * @property {FellFn} fell
 * @property {EnterFn} enter
 * @property {ExitFn} exit
 * @property {TickFn} tick
 * @property {TockFn} tock
 */

/**
 * @typedef {import('./topology.js').CursorChange} CursorChange
 */

/**
 * @typedef {Array<number>} Inventory
 */

/**
 * @callback OnDialogFn
 * @param {number} entity - entity that received dialog
 * @param {string} dialog
 */

/**
 * @callback OnMoveFn
 * @param {number} e - entity that moved
 * @param {CursorChange} transition
 * @param {number} destination
 */

/**
 * @typedef {Object} Recipe
 * @property {number} agent
 * @property {number} reagent
 * @property {number} product
 * @property {number} byproduct
 */

/**
 * @callback OnCraftFn
 * @param {number} entity - entity that crafted
 * @param {Recipe} recipe
 */

/**
 * @callback OnInventoryFn
 * @param {number} entity - entity that crafted
 * @param {number} slot - index in the inventory array
 * @param {number} itemType - type of the item (possibly empty)
 */

/**
 * @callback OnHealthFn
 * @param {number} entity - entity that changed health
 * @param {number} health
 */

/**
 * @callback OnStaminaFn
 * @param {number} entity - entity that changed stamina
 * @param {number} stamina
 */

/**
 * @typedef {Object} Follower
 * @property {OnMoveFn} move
 * @property {OnCraftFn} craft
 * @property {OnInventoryFn} inventory
 * @property {OnDialogFn} dialog
 * @property {OnHealthFn} health
 * @property {OnStaminaFn} stamina
 */

/**
 * @callback TypeFn
 * @param {number} entity
 * @returns {number} type
 */

/**
 * @typedef {Object} BidExtension
 * @property {number} destination
 * @property {number} health
 * @property {number} stamina
 * the agent, not perform object specific interactions.
 */

/**
 * @typedef {CursorChange & BidExtension} Bid
 */

/**
 * @typedef {ReturnType<makeModel>} Model
 */

/** @typedef {Model['capture']} CaptureFn */

/**
 * @typedef {object} Snapshot
 * @property {number | undefined} player
 * @property {number} size
 * @property {Uint16Array} entities
 * @property {Array<number>} terrain
 * @property {Map<number, number>} entityTypes
 * @property {Map<number, number>} healths
 * @property {Map<number, number>} staminas
 * @property {Map<number, Array<number>>} inventories
 */

const makeFlags = function* () {
  for (let i = 0; true; i += 1) {
    yield 1 << i;
  }
};

export const [terrainWater, terrainLava, terrainCold, terrainHot] = makeFlags();

export const [heldSlot, packSlot] = makeFlags();

/**
 * @template T
 * @param {Array<T>} candidates
 * @param {number} index
 */
const pluck = (candidates, index) => {
  const winner = candidates[index];
  candidates[index] = candidates[candidates.length - 1];
  candidates.length--;
  return winner;
};

/**
 * @param {Object} args
 * @param {number} args.size
 * @param {AdvanceFn} args.advance
 * @param {MacroViewModel} args.macroViewModel
 * @param {import('./mechanics.js').Mechanics} args.mechanics
 * @param {Snapshot} [args.snapshot]
 */
export function makeModel({
  size,
  advance,
  macroViewModel,
  mechanics,
  snapshot,
}) {
  const {
    itemTypes,
    agentTypes,
    // tileTypes,
    // effectTypes,
    // tileTypesByName,
    // agentTypesByName,
    itemTypesByName,
    effectTypesByName,
    tileTypeForAgent,
    // tileTypeForItemType,
    // tileTypeForEffectType,
    craft,
    bump,
    // viewText,
  } = mechanics;

  const emptyItem = itemTypesByName.empty;

  let entities = new Uint16Array(size);
  let entitiesWriteBuffer = new Uint16Array(size);

  /**
   * The terrain model is a 1 byte bit mask per world cell.
   *
   *   0: water
   *   1: magma
   */
  const terrain = new Uint8Array(size);
  /** @type {Map<number, Set<(location: number) => void>>} */
  const terrainWatchers = new Map();

  /**
   * @param {Iterable<number>} locations
   * @param {(location: number) => void} watcher
   */
  const watchTerrain = (locations, watcher) => {
    for (const location of locations) {
      let watchers = terrainWatchers.get(location);
      if (watchers === undefined) {
        watchers = new Set();
        terrainWatchers.set(location, watchers);
      }
      watchers.add(watcher);
    }
  };

  /**
   * @param {Iterable<number>} locations
   * @param {(location: number) => void} watcher
   */
  const unwatchTerrain = (locations, watcher) => {
    for (const location of locations) {
      const watchers = assumeDefined(terrainWatchers.get(location));
      assert(watchers.has(watcher));
      watchers.delete(watcher);
      if (watchers.size === 0) {
        terrainWatchers.delete(location);
      }
    }
  };

  /**
   * @param {number} location
   */
  const getTerrainFlags = location => {
    return terrain[location];
  };

  /**
   * @param {number} location
   * @param {number} terrainFlags
   */
  const setTerrainFlags = (location, terrainFlags) => {
    terrain[location] = terrainFlags;
    const watchers = terrainWatchers.get(location);
    if (watchers !== undefined) {
      for (const watch of watchers) {
        watch(location);
      }
    }
  };

  /**
   * @param {number} location
   * @param {number} terrainFlags
   */
  const toggleTerrainFlags = (location, terrainFlags) => {
    terrain[location] ^= terrainFlags;
    const watchers = terrainWatchers.get(location);
    if (watchers !== undefined) {
      for (const watch of watchers) {
        watch(location);
      }
    }
  };

  // TODO consider assigning every position a priority, then shuffling
  // priorities locally each turn.
  // const priorities = new Array(size);

  /** @type {Map<number, number>} entity number -> heading in quarter turns clockwise from north */
  const moveIntents = new Map();

  /** @type {Map<number, number>} entity number -> location number */
  const locations = new Map();

  /** @type {Map<number, number>} */
  const entityTypes = new Map();

  /** @type {Map<number, Map<number, Bid>>} target tile number -> intended
   * entity number -> transition */
  const targets = new Map();
  /** @type {Set<number>} entity numbers of mobile entities */
  const mobiles = new Set();
  /** @type {Map<number, Bid>} */
  const moves = new Map();
  /** @type {Set<number>} */
  const removes = new Set();
  /** @type {Map<number, number>} */
  const bounces = new Map();
  /** @type {Map<number, number>} entity to mode number (0 implied if absent) */
  const tileTypes = new Map();
  /** @type {Set<number>} entities that may have changed mode*/
  const staleTileTypes = new Set();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number, direction: number}>} */
  const bumps = [];
  /** @type {Map<number, {type: number, next: number}>} */
  const dialogs = new Map();

  /** @type {Set<number>} */
  const craftIntents = new Set();
  /** @type {Map<number, number>} agent to patient */
  const bumpIntents = new Map();

  /**
   * Functions to inform of the motion of an entity.
   * The entity does not need to still exist, and this invariant should be
   * revisited if entity numbers get collected and reused in the future.
   * This would complicate the unfollow function, which currently is able to
   * distinguish an accidental call from a deliberate call by balancing follow
   * and unfollow calls.
   *
   * @type {Map<number, Set<Follower>>}
   */
  const followers = new Map();

  let nextEntity = 1; // 0 implies non-existant.

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
  const healths = new Map();
  /** @type {Map<number, number>} */
  const staminas = new Map();

  /** @type {Set<number>} */
  const staleHealths = new Set();
  /** @type {Map<number, number>} */
  const healthTrajectories = new Map();
  /** @type {Set<number>} */
  const staleHealthTrajectories = new Set();

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
    const entity = nextEntity;
    nextEntity++;
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
    tileTypes.delete(entity);
    mobiles.delete(entity);
    locations.delete(entity);
    entityTypes.delete(entity);
    mobiles.delete(entity);
    staleTileTypes.delete(entity);
    staleHealths.delete(entity);
    staleHealthTrajectories.delete(entity);
    entitiesWriteBuffer[location] = 0;
  }

  /** @type {TypeFn} */
  function entityType(entity) {
    const type = entityTypes.get(entity);
    assertDefined(
      type,
      `Cannot get type for non-existent model entity ${entity}`,
    );
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
   * @param {Follower} follower
   */
  function follow(e, follower) {
    let entityFollowers = followers.get(e);
    if (entityFollowers === undefined) {
      /** @type {Set<Follower>} */
      entityFollowers = new Set();
      followers.set(e, entityFollowers);
    }
    assert(!entityFollowers.has(follower));
    entityFollowers.add(follower);

    const inventory = inventories.get(e);
    if (inventory !== undefined) {
      for (let slot = 0; slot < inventory.length; slot++) {
        onInventory(e, slot, inventory[slot]);
      }
    }

    const health = healths.get(e);
    if (health !== undefined) {
      onHealth(e, health);
    }

    const stamina = staminas.get(e);
    if (stamina !== undefined) {
      onStamina(e, stamina);
    }
  }

  /**
   * @param {number} e
   * @param {Follower} follower
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
  function onMove(e, change, destination) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.move(e, change, destination);
      }
    }
  }

  /**
   * @param {number} e
   * @param {number} slot
   * @param {number} itemType
   */
  function onInventory(e, slot, itemType) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.inventory(e, slot, itemType);
      }
    }
  }

  /**
   * @param {number} e
   * @param {string} dialog
   */
  function onDialog(e, dialog) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.dialog(e, dialog);
      }
    }
  }

  /**
   * @param {number} e
   * @param {Recipe} recipe
   */
  function onCraft(e, recipe) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.craft(e, recipe);
      }
    }
  }

  /**
   * @param {number} e
   * @param {number} health
   */
  function onHealth(e, health) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.health(e, health);
      }
    }
  }

  /**
   * @param {number} e
   * @param {number} stamina
   */
  function onStamina(e, stamina) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.stamina(e, stamina);
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
   * @param {number} agent
   * @param {number} patient
   */
  function talk(agent, patient) {
    const patientType = entityTypes.get(patient);
    if (patientType === undefined) {
      return false;
    }
    const patientDesc = agentTypes[patientType];
    const { dialog } = patientDesc;
    if (dialog !== undefined) {
      // The dialog might cycle on repeated bumps and reset when the
      // agent fails to repeat a bump.
      const rotation = dialogs.get(agent);
      let index = 0;
      if (rotation !== undefined && rotation.type === patientType) {
        index = rotation.next;
      }
      index = index % dialog.length;
      onDialog(agent, dialog[index]);
      dialogs.set(agent, { type: patientType, next: index + 1 });
      return true;
    }
    return false;
  }

  /**
   * @param {number} agent
   * @param {number} direction - in quarters clockwise from north
   * @param {boolean} repeat - whether the agent intends to act upon the
   * patient before them.
   */
  function intendToMove(agent, direction, repeat = false) {
    if (
      moveIntents.has(agent) ||
      craftIntents.has(agent) ||
      bumpIntents.has(agent)
    ) {
      return;
    }
    moveIntents.set(agent, direction);

    const origin = locate(agent);
    const {
      position: destination,
      turn,
      transit,
    } = advance({ position: origin, direction });

    const patient = entities[destination];
    if (patient !== 0) {
      if (!repeat) {
        bumps.push({
          agent,
          patient,
          origin,
          destination,
          direction,
        });
      }
    } else {
      const { passable, dialog, health, stamina } = pass(agent, destination);
      if (!passable) {
        assertDefined(dialog);
        bounces.set(agent, direction);
        onDialog(agent, dialog);
      } else {
        assertDefined(health);
        assertDefined(stamina);
        bids(destination).set(agent, {
          position: origin,
          destination,
          direction,
          turn,
          transit,
          health,
          stamina,
        });
      }
    }
  }

  /**
   * @param {number} entity
   */
  function intendToCraft(entity) {
    if (
      moveIntents.has(entity) ||
      craftIntents.has(entity) ||
      bumpIntents.has(entity)
    ) {
      return;
    }

    craftIntents.add(entity);
  }

  function entityEffect() {
    return effectTypesByName.empty;
  }

  /**
   * @param {number} entity
   * @param {number} direction
   * @param {number} location
   */
  function take(entity, direction, location) {
    macroViewModel.take(
      entity,
      (direction * quarturnToOcturn + halfOcturn) % fullOcturn,
    );
    destroyEntity(entity, location);
    bounces.delete(entity);
  }

  /**
   * @param {number} entity
   * @param {number} location
   */
  function fell(entity, location) {
    macroViewModel.fell(entity);
    destroyEntity(entity, location);
    bounces.delete(entity);
  }

  const kit = {
    entityType,
    entityEffect,
    take,
    fell,
    inventory,
    put,
    has,
    holds,
    cold,
    hot,
    sick,
    afloat,
    immersed,
    entityHealth,
    entityStamina,
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
      // TODO select from eligible directions.
      intendToMove(entity, Math.floor(Math.random() * 4));
    }

    // Update entity health trajectories
    for (const entity of staleHealthTrajectories) {
      const unhealthy = hot(entity) || cold(entity);
      if (unhealthy) {
        healthTrajectories.set(entity, -1);
      } else {
        healthTrajectories.delete(entity);
      }
    }

    // Update entity health
    for (const [entity, trajectory] of healthTrajectories.entries()) {
      let health = healths.get(entity) || 0;
      health += trajectory;
      health = Math.max(0, health);
      if (health === 0) {
        healths.delete(entity);
      } else {
        healths.set(entity, health);
      }
      staleHealths.add(entity);
    }

    // Emit health change
    for (const entity of staleHealths) {
      const health = healths.get(entity) || 0;
      onHealth(entity, health);
      staleTileTypes.add(entity);
    }

    // Prepare the next generation
    entitiesWriteBuffer.set(entities);

    // Auction
    // Considering every tile that an entity wishes to move into or act upon
    for (const [destination, options] of targets.entries()) {
      const losers = [...options.keys()];
      const winner = pluck(losers, Math.floor(Math.random() * losers.length));
      const change = assumeDefined(options.get(winner));
      const { position: origin, health, stamina } = change;
      assert(entities[destination] === 0);

      // Move
      locations.set(winner, destination);
      staleTileTypes.add(winner);
      staleHealthTrajectories.add(winner);
      moves.set(winner, change);
      entitiesWriteBuffer[destination] = winner;
      entitiesWriteBuffer[origin] = 0;
      adjustHealth(winner, health);
      adjustStamina(winner, stamina);

      // Bounce all of the candidates that did not get to proceed in the
      // direction they intended.
      for (const loser of losers) {
        const change = assumeDefined(options.get(loser));
        const { direction } = change;
        macroViewModel.bounce(loser, direction * quarturnToOcturn);
      }
    }

    // Bump.
    for (const { agent, patient, destination, direction } of bumps) {
      bounces.set(agent, direction);
      if (!moves.has(patient)) {
        // A side-effect of bumping may include cancellation of the above
        // bounce, in the case that the agent is destroyed by another bump.
        const bumped = bump(kit, {
          agent,
          patient,
          destination,
          direction,
        });
        if (bumped !== null) {
          const { dialog } = bumped;
          if (dialog !== undefined) {
            onDialog(agent, dialog);
          }
        } else {
          talk(agent, patient);
        }
      }
    }

    // Craft.
    for (const entity of craftIntents) {
      const inventory = inventories.get(entity);
      if (inventory !== undefined && inventory.length >= 2) {
        const agent = inventory[0];
        const reagent = inventory[1];
        const formula = craft(agent, reagent);
        if (formula !== undefined) {
          const [product, byproduct, dialog] = formula;
          inventory[0] = product;
          inventory[1] = byproduct;
          onCraft(entity, { agent, reagent, product, byproduct });
          if (dialog !== undefined) {
            onDialog(entity, dialog);
          }
        } else {
          onDialog(entity, `💩 Can’t combine these!`);
        }
      }
    }

    // Orchestrate moves and moves combined with type type changes.
    for (const [entity, change] of moves.entries()) {
      let newType;
      if (staleTileTypes.has(entity)) {
        staleTileTypes.delete(entity);
        const oldType = assumeDefined(tileTypes.get(entity));
        newType = tileTypeForAgent(entity, kit);
        if (oldType == newType) {
          newType = undefined;
        } else {
          tileTypes.set(entity, newType);
        }
        // Hold my beer.
        staleTileTypes.delete(entity);
      }
      const { destination, direction, turn } = change;
      if (newType !== undefined) {
        macroViewModel.movingReplace(
          entity,
          newType,
          destination,
          direction * quarturnToOcturn,
          turn,
        );
      } else {
        macroViewModel.move(
          entity,
          destination,
          direction * quarturnToOcturn,
          turn,
        );
      }
      onMove(entity, change, destination);
      bounces.delete(entity);
    }

    // Handle any remaining tile type change for entities that changed but did
    // not move.
    for (const entity of staleTileTypes) {
      const oldType = tileTypes.get(entity);
      if (oldType === undefined) {
        // TODO something is causing entities to get added to the stale bucket
        // after they were removed. Shrug.
        continue;
        // throw new Error(`Assertion failure: entity ${entity} at ${locations.get(entity)} has no tile type`);
      }
      const newType = tileTypeForAgent(entity, kit);
      if (oldType !== newType) {
        macroViewModel.replace(entity, newType);
        tileTypes.set(entity, newType);
        bounces.delete(entity);
      }
    }
    staleTileTypes.clear();

    for (const [entity, direction] of bounces.entries()) {
      // Some entities may have been removed, as in the case of all entities
      // that participate in a bump cycle.
      if (entityTypes.has(entity)) {
        macroViewModel.bounce(entity, direction * quarturnToOcturn);
      }
    }
    bounces.clear();

    // Swap generations.
    [entitiesWriteBuffer, entities] = [entities, entitiesWriteBuffer];
  }

  /**
   * effects moves;
   */
  function tock() {
    moves.clear();
    removes.clear();
    bumps.length = 0;
    targets.clear();
    moveIntents.clear();
    bumpIntents.clear();
    craftIntents.clear();
  }

  /**
   * @param {number} location
   * @returns {number} entityType or (zero for no-type)
   */
  function entityTypeAt(location) {
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
   */
  function entityAt(location) {
    return assumeDefined(entities[location]);
  }

  /**
   * @param {number} location
   * @param {number} entityType
   */
  function set(location, entityType) {
    assert(
      entityType !== undefined,
      `model.set must be called with an entity type`,
    );

    assert(
      entities[location] === 0,
      `Cannot create entity with type ${entityType} ${agentTypes[entityType].name} at location ${location} occupied by ${entities[location]}`,
    );

    const entity = createEntity(entityType);
    entities[location] = entity;
    locations.set(entity, location);
    const { health, stamina } = agentTypes[entityType];
    if (health !== undefined) {
      healths.set(entity, health);
    }
    if (stamina !== undefined) {
      staminas.set(entity, stamina);
    }

    // tileType must be computed after stats and inventory
    const tileType = tileTypeForAgent(entity, kit);
    tileTypes.set(entity, tileType);

    macroViewModel.put(entity, location, tileType);
    macroViewModel.enter(entity);

    staleHealthTrajectories.add(entity);
    staleHealths.add(entity);

    return entity;
  }

  /**
   * @param {number} location
   */
  function remove(location) {
    const entity = entities[location];
    if (entity !== 0) {
      macroViewModel.exit(entity);
      locations.delete(entity);
      inventories.delete(entity);
      entityTypes.delete(entity);
      mobiles.delete(entity);
      staleTileTypes.delete(entity);
      staleHealths.delete(entity);
      staleHealthTrajectories.delete(entity);
      entities[location] = 0;
    }
    return entity;
  }

  /**
   * @param {number} entity
   * @param {number} length
   */
  function provideInventory(entity, length) {
    let inventory = inventories.get(entity);
    if (inventory === undefined) {
      inventory = [];
      inventories.set(entity, inventory);
    }
    for (let index = inventory.length; index < length; index += 1) {
      inventory[index] = itemTypesByName.empty;
    }
    return inventory;
  }

  /**
   * @param {number} entity
   * @param {number} slot
   * @param {number} itemType
   */
  function put(entity, slot, itemType) {
    assert(
      itemType !== itemTypesByName.invalid,
      `Cannot place invalid item type in entity ${entity} inventory at slot ${slot}`,
    );
    assert(
      itemType !== itemTypesByName.any,
      `Cannot place wildcard item type in entity ${entity} inventory at slot ${slot}`,
    );
    const inventory = provideInventory(entity, slot + 1);
    inventory[slot] = itemType;
    onInventory(entity, slot, itemType);
    staleTileTypes.add(entity);
    staleHealthTrajectories.add(entity);
  }

  /**
   * @param {number} entity
   * @param {number} slot
   */
  function inventory(entity, slot) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return itemTypesByName.empty;
    }
    if (inventory.length <= slot) {
      return itemTypesByName.empty;
    }
    return inventory[slot];
  }

  /**
   * @param {number} entity
   * @param {number} itemType
   */
  function has(entity, itemType) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return false;
    }
    return inventory.includes(itemType);
  }

  /**
   * @param {number} entity
   * @param {number} itemType
   */
  function holds(entity, itemType) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return false;
    }
    return inventory.slice(0, 2).includes(itemType);
  }

  /**
   * @param {number} entity
   */
  function afloat(entity) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return false;
    }
    return inventory.slice(0, 2).some(itemType => {
      const itemDesc = itemTypes[itemType];
      return 'swimGear' in itemDesc;
    });
  }

  /**
   * @param {number} entity
   */
  function aboat(entity) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return false;
    }
    return inventory.slice(0, 2).some(itemType => {
      const itemDesc = itemTypes[itemType];
      return 'boat' in itemDesc;
    });
  }

  /**
   * @param {number} entity
   */
  function immersed(entity) {
    const location = locate(entity);
    const terrainFlags = getTerrainFlags(location);
    return (terrainFlags & terrainWater) !== 0;
  }

  /**
   * @param {number} entity
   */
  function temperature(entity) {
    const location = locate(entity);
    const terrainFlags = getTerrainFlags(location);
    let base = 0;
    if ((terrainFlags & terrainHot) !== 0) {
      base += 1;
    }
    if ((terrainFlags & terrainCold) !== 0) {
      base -= 1;
    }
    // Held items, TODO worn items.
    for (const slot of [0, 1]) {
      const itemTypeNumber = inventory(entity, slot);
      const itemType = itemTypes[itemTypeNumber];
      if (itemType.heat !== undefined) {
        base += itemType.heat;
      }
    }
    return base;
  }

  /**
   * @param {number} entity
   */
  function hot(entity) {
    return temperature(entity) > 1;
  }

  /**
   * @param {number} entity
   */
  function cold(entity) {
    return temperature(entity) < 0;
  }

  /**
   * @param {number} _entity
   */
  function sick(_entity) {
    // TODO
    return false;
  }

  /**
   * @param {number} entity
   * @param {number} location
   */
  function pass(entity, location) {
    const terrainFlags = getTerrainFlags(location);
    const health = healths.get(entity) || 0;
    const stamina = staminas.get(entity) || 0;
    if (health === 0) {
      return { passable: false, dialog: '💀!!1!' };
    }
    if ((terrainFlags & terrainWater) !== 0) {
      if (afloat(entity)) {
        if (stamina > 0) {
          return { passable: true, stamina: -1, health: 0 };
        } else {
          return { passable: true, stamina: 0, health: -1 };
        }
      } else if (aboat(entity)) {
        return { passable: true, stamina: 1, health: 0 };
      } else {
        return { passable: false, dialog: '🌊!!1!' };
      }
    }
    return { passable: true, stamina: 1, health: 0 };
  }

  /**
   * @param {number} entity
   */
  function entityStamina(entity) {
    return staminas.get(entity) || 0;
  }

  /**
   * @param {number} entity
   */
  function entityHealth(entity) {
    return healths.get(entity) || 0;
  }

  /**
   * @param {number} entity
   * @param {number} inventoryIndex
   * @returns {'discard'}
   */
  function use(entity, inventoryIndex) {
    const inventory = provideInventory(entity, 2);
    const itemType = inventory[inventoryIndex];
    const itemDescriptor = itemTypes[itemType];
    inventory[inventoryIndex] = emptyItem; // poof
    const healthEffect = itemDescriptor.health;
    if (healthEffect !== undefined) {
      adjustHealth(entity, 1);
    }
    const staminaEffect = itemDescriptor.stamina;
    if (staminaEffect !== undefined) {
      const oldStamina = staminas.get(entity) || 0;
      const newStamina = Math.min(5, oldStamina + 1);
      staminas.set(entity, newStamina);
      onStamina(entity, newStamina);
    }
    staleTileTypes.add(entity);
    return 'discard';
  }

  /**
   * @param {number} entity
   * @param {number} amount
   */
  function adjustStamina(entity, amount) {
    if (amount === 0) return;
    const oldStamina = staminas.get(entity) || 0;
    const newStamina = Math.max(0, Math.min(5, oldStamina + amount));
    setStamina(entity, newStamina);
  }

  /**
   * @param {number} entity
   * @param {number} stamina
   */
  function setStamina(entity, stamina) {
    if (stamina === 0) {
      staminas.delete(entity);
    } else {
      staminas.set(entity, stamina);
    }
    // TODO
    // staleStaminas.add(entity);
    onStamina(entity, stamina);
  }

  /**
   * @param {number} entity
   * @param {number} amount
   */
  function adjustHealth(entity, amount) {
    if (amount === 0) return;
    const oldHealth = healths.get(entity) || 0;
    const newHealth = Math.max(0, Math.min(5, oldHealth + amount));
    setHealth(entity, newHealth);
  }

  /**
   * @param {number} entity
   * @param {number} health
   */
  function setHealth(entity, health) {
    if (health === 0) {
      healths.delete(entity);
    } else {
      healths.set(entity, health);
    }
    staleHealths.add(entity);
    onHealth(entity, health);
  }

  /**
   * @param {number} entity
   * @param {number} i
   * @param {number} j
   */
  function swap(entity, i, j) {
    const inventory = provideInventory(entity, Math.max(i, j) + 1);
    assert(i >= 0);
    assert(j >= 0);
    assert(i < inventory.length);
    assert(j < inventory.length);
    [inventory[i], inventory[j]] = [inventory[j], inventory[i]];
    staleTileTypes.add(entity);
    staleHealthTrajectories.add(entity);
  }

  /**
   * @param {number} entity
   * @param {number} start
   */
  function anyPacked(entity, start = 0) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return false;
    }
    for (let i = start; i < inventory.length; i += 1) {
      if (inventory[i] !== emptyItem) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {number} entity
   * @param {number} start
   */
  function allPacked(entity, start = 0) {
    const inventory = inventories.get(entity);
    if (inventory === undefined) {
      return true;
    }
    for (let i = start; i < inventory.length; i += 1) {
      if (inventory[i] === emptyItem) {
        return false;
      }
    }
    return true;
  }

  // TODO allow for absence of player in model file
  /**
   * @param {number | undefined} player
   */
  function capture(player) {
    const renames = new Map();
    const relocations = [];

    for (let location = 0; location < size; location += 1) {
      const entity = entities[location];
      if (entity !== 0) {
        const reentity = relocations.length;
        relocations.push(location);
        renames.set(entity, reentity);
      }
    }

    /** @type {Array<number>} */
    const reentities = [];
    /** @type {Array<number>} */
    const retypes = [];
    for (const [entity, type] of entityTypes.entries()) {
      const reentity = assumeDefined(renames.get(entity));
      reentities.push(reentity);
      retypes.push(type);
    }

    /** @type {Array<{entity: number, inventory: Array<number>}>} */
    const reinventories = [];
    for (const [entity, inventory] of inventories.entries()) {
      const reentity = assumeDefined(renames.get(entity));
      reinventories.push({
        entity: reentity,
        inventory: inventory.slice(),
      });
    }

    /** @type {Array<{entity: number, health: number}>} */
    const rehealths = [];
    for (const [entity, health] of healths.entries()) {
      const reentity = assumeDefined(renames.get(entity));
      rehealths.push({
        entity: reentity,
        health,
      });
    }
    /** @type {Array<{entity: number, stamina: number}>} */
    const restaminas = [];
    for (const [entity, stamina] of staminas.entries()) {
      const reentity = assumeDefined(renames.get(entity));
      restaminas.push({
        entity: reentity,
        stamina,
      });
    }

    /** @type {number | undefined} replayer */
    let replayer;
    if (player !== undefined) {
      replayer = assumeDefined(renames.get(player));
    }

    return {
      player: replayer,
      locations: relocations,
      entities: reentities,
      types: retypes,
      inventories: reinventories,
      terrain: [...terrain.slice()],
      healths: rehealths,
      staminas: restaminas,
    };
  }

  /**
   * @param {object} args
   * @param {number | undefined} args.player
   * @param {Uint16Array} args.entities
   * @param {Array<number>} args.terrain
   * @param {Map<number, number>} args.entityTypes
   * @param {Map<number, number>} args.healths
   * @param {Map<number, number>} args.staminas
   * @param {Map<number, Array<number>>} args.inventories
   */
  function restore({
    player: agent,
    entities: purportedEntities,
    terrain: purportedTerrain,
    entityTypes: purportedEntityTypes,
    healths: purportedHealths,
    staminas: purportedStaminas,
    inventories: purportedInventories,
  }) {
    // Reset just in case there's some dangling state transition in progress.
    tock();
    mobiles.clear();
    healths.clear();
    staminas.clear();
    for (let location = 0; location < size; location += 1) {
      const entity = entities[location];
      if (entity !== 0) {
        destroyEntity(entity, location);
        macroViewModel.exit(entity);
        entities[location] = 0;
      }
      const purportedEntity = purportedEntities[location];
      if (purportedEntity !== 0) {
        const type = assumeDefined(purportedEntityTypes.get(purportedEntity));
        const actualEntity = createEntity(type);
        assert(actualEntity === purportedEntity);
        entities[location] = actualEntity;
        locations.set(actualEntity, location);
        const actualHealth = purportedHealths.get(purportedEntity) || 0;
        if (actualHealth !== 0) {
          healths.set(actualEntity, actualHealth);
        }
        const actualStamina = purportedStaminas.get(purportedEntity) || 0;
        if (actualStamina !== 0) {
          staminas.set(actualEntity, actualStamina);
        }
      }
    }
    inventories.clear();
    for (const [entity, inventory] of purportedInventories.entries()) {
      inventories.set(entity, inventory);
      for (let slot = 0; slot < inventory.length; slot++) {
        onInventory(entity, slot, inventory[slot]);
      }
    }

    for (let location = 0; location < size; location += 1) {
      setTerrainFlags(location, purportedTerrain[location]);
    }

    // Tile type for each agent is a function of its inventory and related state
    // so must be computed last.
    for (const [entity, location] of locations.entries()) {
      const tileType = tileTypeForAgent(entity, kit);
      tileTypes.set(entity, tileType);
      macroViewModel.put(entity, location, tileType);
    }

    return agent;
  }

  if (snapshot !== undefined) {
    restore(snapshot);
  }

  // TODO: decompose into facets: watcher, controller, test
  return {
    set,
    remove,
    intendToMove,
    intendToCraft,
    inventory,
    anyPacked,
    allPacked,
    swap,
    put, // for tests only
    use,
    craft,
    locate,
    entityAt,
    entityType,
    entityTypeAt,
    entityStamina,
    entityHealth,
    setHealth, // for tests only
    setStamina, // for tests only
    watchTerrain,
    unwatchTerrain,
    getTerrainFlags,
    setTerrainFlags,
    toggleTerrainFlags,
    tick,
    tock,
    follow,
    unfollow,
    capture,
  };
}
