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

import { assert, assertDefined, assumeDefined } from './assert.js';
import { quarturnToOcturn } from './geometry2d.js';

/**
 * @typedef {import('./daia.js').AdvanceFn} AdvanceFn
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
 * @callback BounceFn
 * Instructs the viewer to animate the entity bumping in the direction but not
 * moving.
 * @param {number} entity
 * @param {number} directionQuarturns
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
 * @property {TakeFn} take
 * @property {FellFn} fell
 * @property {EnterFn} enter
 * @property {ExitFn} exit
 * @property {TickFn} tick
 * @property {TockFn} tock
 */

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
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

const makeFlags = function* () {
  for (let i = 0; true; i += 1) {
    yield 1 << i;
  }
};

export const [terrainWater, terrainLava, terrainCold, terrainHot] = makeFlags();

export const [
  effectWarm,
  effectFire,
  effectFloat,
  effectPower,
  effectMojick,
  effectWater,
  effectFly,
  effectWind,
] = makeFlags();

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
 */
export function makeModel({ size, advance, macroViewModel, mechanics }) {
  const {
    itemTypes,
    agentTypes,
    // tileTypes,
    // effectTypes,
    // tileTypesByName,
    // agentTypesByName,
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
  /** @type {Set<number>} */
  const moves = new Set();
  /** @type {Set<number>} */
  const removes = new Set();
  /** @type {Array<{agent: number, patient: number, origin: number, destination: number, direction: number}>} */
  const bumps = [];
  /** @type {Map<number, {type: number, next: number}>} */
  const dialogs = new Map();

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

  /** @type {Map<number, number>}
   * Bit vectors for the effects that each entity may choose from.
   * Absence is equivalent to 0.
   */
  const effectsOwned = new Map();
  /** @type {Map<number, number>}
   * The bit number for the entity's chosen effect, from the effectsOwned bit
   * vector.  The number 0 indicates effect 1.  Absence indicates no effect
   * chosen.  The number -1 is equivalent to absence.
   */
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
   * @param {number} entity
   * @param {number} direction - in quarters clockwise from north
   * @param {boolean} repeat - whether the agent intends to act upon the
   * patient before them.
   */
  function intendToMove(entity, direction, repeat = false) {
    if (moveIntents.has(entity) || craftIntents.has(entity)) {
      return;
    }
    moveIntents.set(entity, direction);

    const source = locate(entity);
    const {
      position: target,
      turn,
      transit,
    } = advance({ position: source, direction });

    const effects = entityEffect(entity);
    // TODO merge entity effects from held or stowed inventory items.
    const terrainFlags = terrain[target];

    if (terrainFlags & terrainLava) {
      if (!(effects & effectFly)) {
        macroViewModel.bounce(entity, direction * quarturnToOcturn);
        if (!talk(entity, entities[target])) {
          onDialog(entity, `🌋 The lava is hot!`);
        }
        return;
      }
    }

    if (terrainFlags & terrainWater) {
      if (!(effects & (effectFloat | effectFly))) {
        macroViewModel.bounce(entity, direction * quarturnToOcturn);
        if (!talk(entity, entities[target])) {
          onDialog(
            entity,
            `🌊 The water runs swiftly. You may need a <nobr>🛶<b>canoe</b></nobr>.`,
          );
        }
        return;
      }
    }

    bids(target).set(entity, {
      position: source,
      direction,
      turn,
      transit,
      repeat,
    });
  }

  /**
   * @param {number} entity
   */
  function intendToCraft(entity) {
    if (moveIntents.has(entity) || craftIntents.has(entity)) {
      return;
    }

    craftIntents.add(entity);
  }

  const bumpKit = {
    entityType,
    entityEffect,
    inventory,
    put,
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
      intendToMove(entity, Math.floor(Math.random() * 4));
    }

    // Prepare the next generation
    entitiesWriteBuffer.set(entities);

    // Auction
    // Considering every tile that an entity wishes to move into or act upon
    for (const [destination, options] of targets.entries()) {
      const losers = [...options.keys()];
      const winner = pluck(losers, Math.floor(Math.random() * losers.length));
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
        onMove(winner, change, destination);
        locations.set(winner, destination);
        moves.add(winner);
        entitiesWriteBuffer[destination] = winner;
        entitiesWriteBuffer[origin] = 0;
      } else {
        if (!repeat) {
          // Bounce
          macroViewModel.bounce(winner, direction * quarturnToOcturn);
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
      for (const loser of losers) {
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
        const bumped = bump(bumpKit, {
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
    const tileType = defaultTileTypeForAgentType[entityType];
    macroViewModel.put(entity, location, tileType);
    macroViewModel.enter(entity);

    const { health, stamina } = agentTypes[entityType];
    if (health !== undefined) {
      healths.set(entity, health);
    }
    if (stamina !== undefined) {
      staminas.set(entity, stamina);
    }

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
   * @param {number} effect
   */
  function availEffect(entity, effect) {
    const effects = entityEffects(entity) | (1 << effect);
    effectsOwned.set(entity, effects);
  }

  /**
   * @param {number} entity
   * @returns {number} effects - bit vector, but with only one bit selected, if any.
   */
  function entityEffect(entity) {
    const effect = effectsChosen.get(entity);
    if (effect === undefined) {
      return 0;
    }
    const effects = entityEffects(entity);
    assert((effects & (1 << effect)) !== 0);
    return 1 << effect;
  }

  /**
   * @param {number} entity
   * @param {number} effect - a bit index, 0 means 1 << 0.
   */
  function entityHasEffect(entity, effect) {
    assert(effect >= 0);
    const effects = entityEffects(entity);
    return (effects & (1 << effect)) !== 0;
  }

  /**
   * @param {number} entity
   * @returns {number} effects - bit vector, 0 means no effects, 1 means effect
   * 0.
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
   * @returns {number} effect - a bit index, -1 means no choice,
   * 0 means 1 << 0.
   */
  function entityEffectChoice(entity) {
    const effect = effectsChosen.get(entity);
    if (effect === undefined) {
      return -1;
    }
    return effect;
  }

  /**
   * @param {number} entity
   * @param {number} effect - a bit index, 0 means 1 << 0.
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
    const inventory = provideInventory(entity, 2);
    const itemType = inventory[inventoryIndex];
    const itemDescriptor = itemTypes[itemType];
    inventory[inventoryIndex] = emptyItem; // poof
    const effectName = itemDescriptor.effect;
    if (effectName !== undefined) {
      const effectType = assumeDefined(effectTypesByName[effectName]) - 1;
      availEffect(entity, effectType);
      chooseEffect(entity, effectType);
      return 'effect';
    }
    const healthEffect = itemDescriptor.health;
    if (healthEffect !== undefined) {
      const oldHealth = healths.get(entity) || 0;
      const newHealth = Math.min(5, oldHealth + 1);
      healths.set(entity, newHealth);
      onHealth(entity, newHealth);
    }
    const staminaEffect = itemDescriptor.stamina;
    if (staminaEffect !== undefined) {
      const oldStamina = staminas.get(entity) || 0;
      const newStamina = Math.min(5, oldStamina + 1);
      staminas.set(entity, newStamina);
      onStamina(entity, newStamina);
    }
    return 'discard';
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

  // TODO rename agent to player in model file
  // TODO allow for absence of player in model file
  /**
   * @param {number | undefined} agent
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

    /** @type {number | undefined} reagent */
    let reagent;
    if (agent !== undefined) {
      reagent = assumeDefined(renames.get(agent));
    }

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
    macroViewModel.tock();

    // TODO validate that the snapshot world is generated from a world of the
    // same size.
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
      // TODO allow for missing agent, go to limbo after restore.
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
      // TODO compact or truncate inventories with empty tails.
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
      for (let slot = 0; slot < inventory.length; slot++) {
        onInventory(entity, slot, inventory[slot]);
      }
    }

    for (let location = 0; location < size; location += 1) {
      setTerrainFlags(location, purportedTerrain[location]);
    }

    effectsChosen.clear();
    effectsOwned.clear();
    healths.clear();
    staminas.clear();
    // TODO load effectsChosen, effectsOwned, healths, staminas

    return agent;
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
    entityTypeAt,
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
    follow,
    unfollow,
    capture,
    restore,
  };
}
