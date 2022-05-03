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

import { assert, assertDefined, assumeDefined } from './assert.js';
import { quarturnToOcturn } from './geometry2d.js';

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @typedef {Array<number>} Inventory
 */

/**
 * @callback DialogFn
 * @param {number} entity - entity that received dialog
 * @param {string} dialog
 */

/**
 * @callback MotionFn
 * @param {number} e - entity that moved
 * @param {CursorChange} transition
 * @param {number} destination
 */

/**
 * @typedef {Object} Follower
 * @property {MotionFn} motion
 * @property {DialogFn} dialog
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

/** @typedef {ReturnType<Model['capture']>} Snapshot */
/** @typedef {Model['capture']} CaptureFn */
/** @typedef {Model['restore']} RestoreFn */

/**
 * @param {Object} args
 * @param {number} args.size
 * @param {AdvanceFn} args.advance
 * @param {MacroViewModel} args.macroViewModel
 * @param {import('./mechanics.js').Mechanics} args.mechanics
 */
export function makeModel({ size, advance, macroViewModel, mechanics }) {
  const {
    itemTypes,
    // agentTypes,
    // tileTypes,
    // effectTypes,
    tileTypesByName,
    agentTypesByName,
    itemTypesByName,
    effectTypesByName,
    defaultTileTypeForAgentType,
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
   * @type {Map<number, Set<Follower>>}
   */
  const followers = new Map();

  // TODO other kinds of observers, beyond just following an entity's location.

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
    mobiles.delete(entity);
    locations.delete(entity);
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
  function onMotion(e, change, destination) {
    const entityFollowers = followers.get(e);
    if (entityFollowers !== undefined) {
      for (const follower of entityFollowers) {
        follower.motion(e, change, destination);
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
    const {
      position: target,
      turn,
      transit,
    } = advance({ position: source, direction });
    bids(target).set(entity, {
      position: source,
      direction,
      turn,
      transit,
      repeat,
    });
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
      // TODO select from eligible directions.
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
      const { position: origin, direction, turn, repeat } = change;
      const patient = entities[destination];
      if (patient === 0) {
        // Move
        macroViewModel.move(
          winner,
          destination,
          direction * quarturnToOcturn,
          turn,
        );
        onMotion(winner, change, destination);
        locations.set(winner, destination);
        moves.add(winner);
        entitiesWriteBuffer[destination] = winner;
        entitiesWriteBuffer[origin] = 0;
      } else {
        // Bounce
        macroViewModel.bounce(winner, direction * quarturnToOcturn);
        if (!repeat) {
          // Bump
          bumps.push({
            agent: winner,
            patient,
            origin,
            destination,
            direction,
          });
        }
      }
      // Bounce all of the candidates that did not get to proceed in the
      // direction they intended.
      for (const loser of candidates) {
        const change = assumeDefined(options.get(loser));
        const { direction } = change;
        macroViewModel.bounce(loser, direction * quarturnToOcturn);
      }
    }

    // Successfully bump an entity that did not move.
    // TODO break this into phases since an entity that doesn't move can also
    // be destroyed by another bump and therein may lay race conditions.
    for (const { agent, patient, destination, direction } of bumps) {
      if (!moves.has(patient) && !removes.has(patient) && !removes.has(agent)) {
        const inventory = inventories.get(agent);
        let bumped = null;
        if (inventory !== undefined && inventory.length >= 2) {
          bumped = bump(bumpKit, {
            agent,
            patient,
            destination,
            direction,
          });
        }
        if (bumped !== null) {
          const { dialog } = bumped;
          if (dialog !== undefined) {
            onDialog(agent, dialog);
          }
        } else {
          const patientType = assumeDefined(entityTypes.get(patient));
          const patientDesc = mechanics.agentTypes[patientType];
          const { dialog } = patientDesc;
          if (dialog !== undefined) {
            // TODO rotate dialog:
            // The dialog might cycle on repeated bumps and reset when the
            // agent fails to repeat a bump, or for depending on the patient
            // type, might not reset.
            onDialog(agent, dialog[0]);
          }
        }
      }
    }

    // Craft.
    for (const entity of craftIntents) {
      const inventory = inventories.get(entity);
      if (inventory !== undefined && inventory.length >= 2) {
        let dialog;
        [inventory[0], inventory[1], dialog] = craft(
          inventory[0],
          inventory[1],
        );
        if (dialog !== undefined) {
          onDialog(entity, dialog);
        }
      }
    }

    // Swap generations.
    [entitiesWriteBuffer, entities] = [entities, entitiesWriteBuffer];
  }

  /**
   * effects moves;
   */
  function tock() {
    macroViewModel.tock();
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
      const entityType = assumeDefined(entityTypes.get(entity));
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
   * @param {number} inventoryIndex
   */
  function inventory(entity, inventoryIndex) {
    const inventory = entityInventory(entity);
    assert(inventoryIndex < inventory.length);
    return inventory[inventoryIndex];
  }
  /**
   * @param {number} entity
   * @param {number} effect
   */
  function availEffect(entity, effect) {
    const effects = entityEffects(entity) | (1 << effect);
    effectsOwned.set(entity, effects);
  }

  /**
   * @param {number} entity
   */
  function entityEffect(entity) {
    const effect = effectsChosen.get(entity);
    if (effect === undefined) {
      return 0;
    }
    const effects = entityEffects(entity);
    assert((effects & (1 << effect)) !== 0);
    return effect;
  }

  /**
   * @param {number} entity
   * @param {number} effect
   */
  function entityHasEffect(entity, effect) {
    assert(effect >= 0);
    const effects = entityEffects(entity);
    return (effects & (1 << effect)) !== 0;
  }

  /**
   * @param {number} entity
   */
  function entityEffects(entity) {
    const mask = effectsOwned.get(entity);
    if (mask === undefined) {
      return 0;
    }
    return mask;
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
   * @param {number} inventoryIndex
   * @returns {'effect' | 'discard'}
   */
  function use(entity, inventoryIndex) {
    const inventory = entityInventory(entity);
    const itemType = inventory[inventoryIndex];
    const effectName = itemTypes[itemType].effect;
    inventory[inventoryIndex] = emptyItem; // poof
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

  /**
   * @param {number} entity
   * @param {number} start
   */
  function anyPacked(entity, start = 0) {
    const inventory = entityInventory(entity);
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
    const inventory = entityInventory(entity);
    for (let i = start; i < inventory.length; i += 1) {
      if (inventory[i] === emptyItem) {
        return false;
      }
    }
    return true;
  }

  /**
   * @param {number} agent
   */
  function capture(agent) {
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

    /** @type {Array<{entity: number, type: number}>} */
    const retypes = [];
    for (const [entity, type] of entityTypes.entries()) {
      const reentity = assumeDefined(renames.get(entity));
      retypes.push({
        entity: reentity,
        type: type,
      });
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

    const reagent = assumeDefined(renames.get(agent));

    // TODO capture agent entity id
    return {
      agent: reagent,
      locations: relocations,
      types: retypes,
      inventories: reinventories,
      terrain: [...terrain.slice()],
      // effectsOwned,
      // effectsChosen,
      // healths,
      // staminas,
    };
  }

  /**
   * @param {unknown} allegedSnapshot
   * @returns {number | Array<string>} agent number if ok or corruption reasons
   */
  function restore(allegedSnapshot) {
    if (typeof allegedSnapshot !== 'object') {
      return ['expected to begin with an object'];
    }
    const snapshot = /** @type {{[name: string]: unknown}} */ (allegedSnapshot);
    const {
      agent: allegedAgent,
      locations: allegedLocations,
      types: allegedTypes,
      inventories: allegedInventories,
      terrain: allegedTerrain,
    } = snapshot;

    if (allegedAgent === undefined) {
      return ['missing "agent"'];
    } else if (typeof allegedAgent !== 'number') {
      return ['"agent" must be a number'];
    }
    if (allegedTypes === undefined) {
      return ['missing "types"'];
    } else if (!Array.isArray(allegedTypes)) {
      return ['"types" must be an array'];
    }
    if (allegedLocations === undefined) {
      return ['missing "locations"'];
    } else if (!Array.isArray(allegedLocations)) {
      return ['"locations" must be an array'];
    }
    if (allegedInventories === undefined) {
      return ['missing "inventories"'];
    } else if (!Array.isArray(allegedInventories)) {
      return ['"inventories" must be an array'];
    }
    if (allegedTerrain === undefined) {
      return ['missing "terrain"'];
    } else if (!Array.isArray(allegedTerrain)) {
      return ['"terrain" must be an array'];
    }

    /** @type {Map<number, number>} */
    const allegedEntityTypes = new Map();
    const errors = [];
    for (const allegedEntry of allegedTypes) {
      if (typeof allegedEntry !== 'object') {
        errors.push(
          `every entry in "types" must be an object, got ${JSON.stringify(
            allegedEntry,
          )}`,
        );
        continue;
      }
      const entry = /** @type {{[name: string]: unknown}} */ (allegedEntry);
      const { entity: allegedEntity, type: allegedType } = entry;
      if (typeof allegedEntity !== 'number') {
        errors.push(
          `every entry in "types" must be an object with an "entity" property, got ${JSON.stringify(
            allegedEntity,
          )}`,
        );
        continue;
      }
      if (typeof allegedType !== 'number') {
        errors.push(
          `every entry in "types" must be an object with an "type" property, got ${JSON.stringify(
            allegedType,
          )}`,
        );
        continue;
      }
      allegedEntityTypes.set(allegedEntity, allegedType);
    }

    /** @type {Map<number, number>} */
    const purportedEntityTypes = new Map();

    /** @type {Map<number, number>} */
    const renames = new Map();
    const purportedEntities = new Uint16Array(size);
    let nextPurportedEntity = nextEntity;
    for (let entity = 0; entity < allegedLocations.length; entity += 1) {
      const location = allegedLocations[entity];
      const type = allegedEntityTypes.get(entity);
      if (type === undefined) {
        errors.push(
          `Missing entry in "types" for entity in "locations" ${entity} at location ${location}`,
        );
        continue;
      }
      const tileType = defaultTileTypeForAgentType[type];
      if (tileType === undefined) {
        errors.push(
          `No known tile type for entity ${entity} at ${location} with alleged type ${type}`,
        );
        continue;
      }
      const purportedEntity = nextPurportedEntity;
      nextPurportedEntity += 1;
      purportedEntities[location] = purportedEntity;
      purportedEntityTypes.set(purportedEntity, type);
      renames.set(entity, purportedEntity);
      // The notion here is that deleting the consumed type prevents the
      // entity from being reinstantiated.
      // This is somewhat indirect, and means that the data integrity error
      // above (when a type is missing) conflates the issue of not being
      // present with being redundant.
      // Other mechanisms would be worth considering.
      allegedEntityTypes.delete(entity);
    }

    /** @type {Map<number, Array<number>>} */
    const purportedInventories = new Map();
    for (const allegedEntry of allegedInventories) {
      if (typeof allegedEntry !== 'object') {
        errors.push(
          `every entry in "inventories" must be an "object", got ${JSON.stringify(
            allegedEntry,
          )}`,
        );
        continue;
      }
      const entry = /* @type {{[name: string]: unknown}} */ allegedEntry;
      const { entity: allegedEntity, inventory: allegedInventory } = entry;
      if (typeof allegedEntity !== 'number') {
        errors.push(
          `every entry in "inventories" must have an "entry" number, got ${JSON.stringify(
            allegedEntity,
          )}`,
        );
        continue;
      }
      if (!Array.isArray(allegedInventory)) {
        errors.push(
          `every entry in "inventories" must have an "inventory" array, got ${JSON.stringify(
            allegedInventory,
          )}`,
        );
        continue;
      }
      const reentity = renames.get(allegedEntity);
      if (reentity === undefined) {
        errors.push(
          `an entry in "inventories" for the alleged entity ${allegedEntity} is missing from the map`,
        );
        continue;
      }
      /** @type {Array<number>} */
      const inventory = [];
      for (const item of allegedInventory) {
        if (typeof item !== 'number') {
          errors.push(
            `all items in the "inventory" for entity ${allegedEntity} must be numbers, got ${JSON.stringify(
              item,
            )}`,
          );
          continue;
        }
        if (item < 1 || item > itemTypes.length) {
          errors.push(
            `all items in the "inventory" for entity ${allegedEntity} must be valid item numbers, got ${JSON.stringify(
              item,
            )}`,
          );
          continue;
        }
        inventory.push(item);
      }
      purportedInventories.set(reentity, inventory);
    }

    const agent = renames.get(allegedAgent);
    if (agent === undefined) {
      errors.push(`Missing entity for alleged player agent ${allegedAgent}`);
      return errors;
    }

    if (allegedTerrain.length !== size) {
      errors.push(`"terrain" must be exactly ${size} long`);
      return errors;
    }

    for (let location = 0; location < size; location += 1) {
      const type = allegedTerrain[location];
      if (typeof type !== 'number') {
        errors.push(
          `every value in "terrain" must be a number, got ${JSON.stringify(
            type,
          )} at location ${location}`,
        );
      }
    }
    const purportedTerrain = /* @type {Array<number>} */ allegedTerrain;

    if (errors.length > 0) {
      return errors;
    }

    // Commit!
    // Reset just in case there's some dangling state transition in progress.
    tock();
    mobiles.clear();
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
        const tileType = defaultTileTypeForAgentType[type];
        const actualEntity = createEntity(type);
        assert(actualEntity === purportedEntity);
        macroViewModel.put(actualEntity, location, tileType);
        entities[location] = actualEntity;
        locations.set(actualEntity, location);
      }
    }
    inventories.clear();
    for (const [entity, inventory] of purportedInventories.entries()) {
      inventories.set(entity, inventory);
    }

    for (let location = 0; location < size; location += 1) {
      setTerrainFlags(location, purportedTerrain[location]);
    }

    return agent;
  }

  return {
    get,
    set,
    remove,
    intend,
    intendToCraft,
    inventory,
    anyPacked,
    allPacked,
    swap,
    use,
    craft,
    locate,
    entityStamina,
    entityHealth,
    entityEffect,
    entityHasEffect,
    entityEffects,
    entityEffectChoice,
    chooseEffect,
    watchTerrain,
    unwatchTerrain,
    getTerrainFlags,
    setTerrainFlags,
    toggleTerrainFlags,
    tick,
    tock,
    init,
    follow,
    unfollow,
    capture,
    restore,
  };
}
