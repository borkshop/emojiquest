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
 * @property {[Level]} levels - TODO generalize array
 */

/**
 * @typedef {DaiaLevel} Level
 */

/**
 * @typedef {object} DaiaLevel
 * @property {"daia"} topology
 * @property {number} facetsPerFace - facets per face along each edge, so 2x2
 * facets if 2.
 * @property {number} tilesPerFacet - tiles per facet along each edge, so 3x3
 * if 3, and 6x6 tiles on each face if facetsPerFace is 2.
 */

/**
 * @param {unknown} allegedSnapshot
 * @param {import('./mechanics.js').Mechanics} mechanics
 * @returns {{snapshot: Snapshot} | {errors: Array<string>}}
 */
export const validate = (allegedSnapshot, mechanics) => {
  if (typeof allegedSnapshot !== 'object') {
    return { errors: ['expected to begin with an object'] };
  }
  const presumedSnapshot = /** @type {{[name: string]: unknown}} */ (
    allegedSnapshot
  );
  const {
    player: allegedPlayer,
    levels: allegedLevels,
    locations: allegedLocations,
    types: allegedTypes,
    inventories: allegedInventories,
    terrain: allegedTerrain,
    healths: allegedHealths,
    staminas: allegedStaminas,
  } = presumedSnapshot;

  if (allegedPlayer === undefined) {
    // TODO allow for missing player, go to limbo after restore.
    return { errors: ['missing "player"'] };
  } else if (typeof allegedPlayer !== 'number') {
    return { errors: ['"player" must be a number'] };
  }
  if (allegedLevels === undefined) {
    return { errors: ['missing "levels"'] };
  } else if (!Array.isArray(allegedLevels)) {
    return { errors: ['"levels" must be an array'] };
  }
  if (allegedTypes === undefined) {
    return { errors: ['missing "types"'] };
  } else if (!Array.isArray(allegedTypes)) {
    return { errors: ['"types" must be an array'] };
  }
  if (allegedLocations === undefined) {
    return { errors: ['missing "locations"'] };
  } else if (!Array.isArray(allegedLocations)) {
    return { errors: ['"locations" must be an array'] };
  }
  if (allegedInventories === undefined) {
    return { errors: ['missing "inventories"'] };
  } else if (!Array.isArray(allegedInventories)) {
    return { errors: ['"inventories" must be an array'] };
  }
  if (allegedTerrain === undefined) {
    return { errors: ['missing "terrain"'] };
  } else if (!Array.isArray(allegedTerrain)) {
    return { errors: ['"terrain" must be an array'] };
  }
  if (allegedHealths === undefined) {
    return { errors: ['missing "healths"'] };
  } else if (!Array.isArray(allegedHealths)) {
    return { errors: ['"healths" must be an array'] };
  }
  if (allegedStaminas === undefined) {
    return { errors: ['missing "staminas"'] };
  } else if (!Array.isArray(allegedStaminas)) {
    return { errors: ['"staminas" must be an array'] };
  }

  if (allegedLevels.length !== 1) {
    return { errors: ['"levels"  must only contain 1 level'] };
  }
  const allegedLevel = allegedLevels[0];
  if (typeof allegedLevel !== 'object' || allegedLevel === null) {
    return { errors: ['"levels[0]" must be an object'] };
  }
  const presumedLevel = /** @type {{[name: string]: unknown}} */ (allegedLevel);

  // TODO generalize for multiple levels of varying topology.
  const { topology, facetsPerFace, tilesPerFacet } = presumedLevel;
  if (topology !== 'daia') {
    return { errors: ['"levels[0].topology" must be "daia"'] };
  }
  if (typeof facetsPerFace !== 'number') {
    return { errors: ['"levels[0].facetsPerFace" must be a number'] };
  }
  if (typeof tilesPerFacet !== 'number') {
    return { errors: ['"levels[0].tilesPerFacet" must be a number'] };
  }

  /** @type {DaiaLevel} */
  const purportedLevel = {
    topology,
    facetsPerFace,
    tilesPerFacet,
  };

  /** @type {[Level]} */
  const purportedLevels = [purportedLevel];

  // Compute size from level data.
  // TODO generalize for multiple levels of varying topology.
  const size = 6 * facetsPerFace ** 2 * tilesPerFacet ** 2;

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
  let nextEntity = 1;
  for (let entity = 0; entity < allegedLocations.length; entity += 1) {
    const location = allegedLocations[entity];
    const type = allegedEntityTypes.get(entity);
    if (type === undefined) {
      errors.push(
        `Missing entry in "types" for entity in "locations" ${entity} at location ${location}`,
      );
      continue;
    }
    const tileType = mechanics.defaultTileTypeForAgentType[type];
    if (tileType === undefined) {
      errors.push(
        `No known tile type for entity ${entity} at ${location} with alleged type ${type}`,
      );
      continue;
    }
    const purportedEntity = nextEntity;
    nextEntity += 1;
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
        `every entry in "inventories" must have an "entity" number, got ${JSON.stringify(
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
      if (item < 1 || item > mechanics.itemTypes.length) {
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

  /** @type {Map<number, number>} */
  const purportedHealths = new Map();
  for (const allegedEntry of allegedHealths) {
    if (typeof allegedEntry !== 'object') {
      errors.push(
        `every entry in "healths" must be an "object", got ${JSON.stringify(
          allegedEntry,
        )}`,
      );
      continue;
    }
    const entry = /* @type {{[name: string]: unknown}} */ allegedEntry;
    const { entity: allegedEntity, health: allegedHealth } = entry;
    if (typeof allegedEntity !== 'number') {
      errors.push(
        `every entry in "healths" must have an "entity" number, got ${JSON.stringify(
          allegedEntity,
        )}`,
      );
      continue;
    }
    if (typeof allegedHealth !== 'number') {
      errors.push(
        `every entry in "healths" must have an "health" number, got ${JSON.stringify(
          allegedHealth,
        )}`,
      );
      continue;
    }
    const reentity = renames.get(allegedEntity);
    if (reentity === undefined) {
      errors.push(
        `an entry in "healths" for the alleged entity ${allegedEntity} is missing from the map`,
      );
      continue;
    }
    purportedHealths.set(reentity, allegedHealth);
  }

  /** @type {Map<number, number>} */
  const purportedStaminas = new Map();
  for (const allegedEntry of allegedStaminas) {
    if (typeof allegedEntry !== 'object') {
      errors.push(
        `every entry in "staminas" must be an "object", got ${JSON.stringify(
          allegedEntry,
        )}`,
      );
      continue;
    }
    const entry = /* @type {{[name: string]: unknown}} */ allegedEntry;
    const { entity: allegedEntity, stamina: allegedStamina } = entry;
    if (typeof allegedEntity !== 'number') {
      errors.push(
        `every entry in "staminas" must have an "entity" number, got ${JSON.stringify(
          allegedEntity,
        )}`,
      );
      continue;
    }
    if (typeof allegedStamina !== 'number') {
      errors.push(
        `every entry in "staminas" must have an "stamina" number, got ${JSON.stringify(
          allegedStamina,
        )}`,
      );
      continue;
    }
    const reentity = renames.get(allegedEntity);
    if (reentity === undefined) {
      errors.push(
        `an entry in "staminas" for the alleged entity ${allegedEntity} is missing from the map`,
      );
      continue;
    }
    purportedStaminas.set(reentity, allegedStamina);
  }

  const player = renames.get(allegedPlayer);
  if (player === undefined) {
    errors.push(`Missing entity for alleged player player ${allegedPlayer}`);
    return { errors };
  }

  if (allegedTerrain.length !== size) {
    errors.push(`"terrain" must be exactly ${size} long`);
    return { errors };
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
    return { errors };
  }

  /** @type {Snapshot} */
  const snapshot = {
    player,
    size,
    levels: purportedLevels,
    entities: purportedEntities,
    terrain: purportedTerrain,
    entityTypes: purportedEntityTypes,
    healths: purportedHealths,
    staminas: purportedStaminas,
    inventories: purportedInventories,
  };

  return {
    snapshot,
  };
};
