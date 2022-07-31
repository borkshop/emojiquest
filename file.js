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

/**
 * @param {unknown} allegedSnapshot
 * @param {import('./mechanics.js').Mechanics} mechanics
 * @returns {{snapshot: Snapshot} | {errors: Array<string>}}
 */
export const validate = (allegedSnapshot, mechanics) => {
  // TODO validate that the snapshot world is generated from a world of the
  // same size.
  if (typeof allegedSnapshot !== 'object') {
    return { errors: ['expected to begin with an object'] };
  }
  const presumedSnapshot = /** @type {{[name: string]: unknown}} */ (
    allegedSnapshot
  );
  const {
    agent: allegedAgent,
    locations: allegedLocations,
    types: allegedTypes,
    inventories: allegedInventories,
    terrain: allegedTerrain,
    healths: allegedHealths,
    staminas: allegedStaminas,
  } = presumedSnapshot;

  if (allegedAgent === undefined) {
    // TODO allow for missing agent, go to limbo after restore.
    return { errors: ['missing "agent"'] };
  } else if (typeof allegedAgent !== 'number') {
    return { errors: ['"agent" must be a number'] };
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

  // TODO parameterize topology and consequently size.
  const size = allegedTerrain.length;

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

  const agent = renames.get(allegedAgent);
  if (agent === undefined) {
    errors.push(`Missing entity for alleged player agent ${allegedAgent}`);
    return { errors };
  }

  // This check is tautological, but retained to ensure the invariant persists
  // in the face of evolution of the algorithm and format.
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
    player: agent,
    size,
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
