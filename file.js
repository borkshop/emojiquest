/** @typedef {import('./lib/vector2d.js').Point} Point */

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
 * @property {Array<Level>} levels
 */

/**
 * @typedef {DaiaLevel | TorusLevel} Level
 */

/**
 * @typedef {object} DaiaLevel
 * @property {'daia'} topology
 * @property {number} facetsPerFace - facets per face along each edge, so 2x2
 * facets if 2.
 * @property {number} tilesPerFacet - tiles per facet along each edge, so 3x3
 * if 3, and 6x6 tiles on each face if facetsPerFace is 2.
 */

/**
 * @typedef {object} TorusLevel
 * @property {'torus'} topology
 * @property {Point} tilesPerChunk
 * @property {Point} chunksPerLevel
 */

import { dot } from './lib/vector2d.js';

/**
 * @param {unknown} allegedPoint
 * @returns {Point | undefined}
 */
const validatePoint = allegedPoint => {
  if (typeof allegedPoint !== 'object') {
    return undefined;
  }
  if (allegedPoint === null) {
    return undefined;
  }
  const presumedPoint = /** @type {{[name: string]: unknown}} */ (allegedPoint);
  const { x, y } = presumedPoint;
  if (typeof x !== 'number') {
    return undefined;
  }
  if (typeof y !== 'number') {
    return undefined;
  }
  return { x, y };
};

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
    entities: allegedEntities,
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
  if (allegedEntities === undefined) {
    return { errors: ['missing "entities"'] };
  } else if (!Array.isArray(allegedEntities)) {
    return { errors: ['"entities" must be an array'] };
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

  if (allegedLevels.length < 1) {
    return { errors: ['"levels"  must contain at least 1 level'] };
  }

  /** @type {Array<Level>} */
  const purportedLevels = [];
  let size = 0;

  for (let index = 0; index < allegedLevels.length; index += 1) {
    const allegedLevel = allegedLevels[index];
    if (typeof allegedLevel !== 'object' || allegedLevel === null) {
      return { errors: ['"levels[0]" must be an object'] };
    }
    const presumedLevel = /** @type {{[name: string]: unknown}} */ (
      allegedLevel
    );

    const { topology } = presumedLevel;
    if (topology === 'daia') {
      const { facetsPerFace, tilesPerFacet } = presumedLevel;
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
      purportedLevels.push(purportedLevel);
      // Compute size from level data.
      size += 6 * facetsPerFace ** 2 * tilesPerFacet ** 2;
    } else if (topology === 'torus') {
      const { tilesPerChunk, chunksPerLevel } = presumedLevel;
      const purportedTilesPerChunk = validatePoint(tilesPerChunk);
      if (purportedTilesPerChunk === undefined) {
        return { errors: ['"levels[0].tilesPerChunk" must be a {x, y} size'] };
      }
      const purportedChunksPerLevel = validatePoint(chunksPerLevel);
      if (purportedChunksPerLevel === undefined) {
        return { errors: ['"levels[0].chunksPerLevel" must be a {x, y} size'] };
      }
      /** @type {TorusLevel} */
      const purportedLevel = {
        topology,
        tilesPerChunk: purportedTilesPerChunk,
        chunksPerLevel: purportedChunksPerLevel,
      };
      purportedLevels.push(purportedLevel);
      // Compute size from level data.
      const { x, y } = dot(purportedTilesPerChunk, purportedChunksPerLevel);
      size += x * y;
    } else {
      return { errors: ['"levels[0].topology" must be "daia" or "torus"'] };
    }
  }

  /** @type {Map<number, number>} */
  const allegedEntityTypes = new Map();
  const errors = [];
  if (allegedEntities.length !== allegedTypes.length) {
    errors.push('"entities" and "types" must be the same length');
  }
  for (
    let i = 0;
    i < Math.min(allegedEntities.length, allegedTypes.length);
    i += 1
  ) {
    const allegedEntity = allegedEntities[i];
    const allegedType = allegedTypes[i];
    if (typeof allegedEntity !== 'number') {
      errors.push(
        `every value in "entities" must be a number, got ${JSON.stringify(
          allegedEntity,
        )} at ${i}`,
      );
      continue;
    }
    if (typeof allegedType !== 'number') {
      errors.push(
        `every value in "types" must be a number, got ${JSON.stringify(
          allegedType,
        )} at ${i}`,
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
