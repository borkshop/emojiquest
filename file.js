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
 * @property {Map<number, number>} entityTargetLocations
 * @property {Map<string, string>} colorsByName
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
 * @property {Array<ColorNamePalette>} colors
 */

/**
 * @typedef {object} ColorNamePalette
 * @property {string} base - average color of a face (presumably one of either
 * the earth or water color for its tiles)
 * @property {string} earth - color of a tile when earth is on the surface
 * @property {string} water - color of a tile when water is on the surface
 * @property {string} lava - color of a tile when lava is on the surface
 */

/**
 * @typedef {object} TorusLevel
 * @property {'torus'} topology
 * @property {Point} tilesPerChunk
 * @property {Point} chunksPerLevel
 * @property {ColorNamePalette} colors
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
 * @param {unknown} allegedColorName
 * @param {Map<string, string>} colorsByName
 * @param {Array<string>} errors
 * @param {string} path
 */
const validateColor = (allegedColorName, colorsByName, errors, path) => {
  if (typeof allegedColorName !== 'string') {
    errors.push(`${path} must be a string`);
    return '';
  }
  const color = colorsByName.get(allegedColorName);
  if (color === undefined) {
    errors.push(`${path} must be the name of a color mentioned in .colors`);
    return '';
  }
  return allegedColorName;
};

/**
 * @param {unknown} allegedColors
 * @param {Map<string, string>} colorsByName
 * @param {Array<string>} errors
 * @param {string} path
 */
const validateColors = (allegedColors, colorsByName, errors, path) => {
  if (allegedColors === null || typeof allegedColors !== 'object') {
    errors.push(
      `${path} must be an object with {base, lava, water, earth} strings`,
    );
    return {
      base: '',
      lava: '',
      water: '',
      earth: '',
    };
  }
  const { base, lava, water, earth } =
    /** @type {{[name: string]: unknown}} */ (allegedColors);
  return {
    base: validateColor(base, colorsByName, errors, `${path}.base`),
    lava: validateColor(lava, colorsByName, errors, `${path}.lava`),
    water: validateColor(water, colorsByName, errors, `${path}.water`),
    earth: validateColor(earth, colorsByName, errors, `${path}.earth`),
  };
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
    types: allegedTypes,
    inventories: allegedInventories,
    terrain: allegedTerrain,
    healths: allegedHealths,
    staminas: allegedStaminas,
    entityTargetLocations: allegedEntityTargetLocations,
    colors: allegedColors,
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

  if (allegedEntityTargetLocations === undefined) {
    return { errors: ['missing "entityTargetLocations"'] };
  } else if (!Array.isArray(allegedEntityTargetLocations)) {
    return { errors: ['"entityTargetLocations" must be an array'] };
  }

  if (allegedColors === undefined) {
    return { errors: ['missing "colors"'] };
  } else if (
    typeof allegedColors !== 'object' ||
    allegedColors === null ||
    Array.isArray(allegedColors)
  ) {
    return { errors: ['"colors" must be a record'] };
  }

  const errors = [];

  /** @type {Map<string, string>} */
  const colorsByName = new Map();
  for (const [name, value] of Object.entries(allegedColors)) {
    if (typeof value !== 'string' || !/^#[0-9A-F]{6}$/.test(value)) {
      errors.push(`invalid color for name ${name}`);
    } else {
      colorsByName.set(name, value);
    }
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
      return { errors: ['"levels[${index}]" must be an object'] };
    }
    const presumedLevel = /** @type {{[name: string]: unknown}} */ (
      allegedLevel
    );

    const { topology } = presumedLevel;
    if (topology === 'daia') {
      const {
        facetsPerFace,
        tilesPerFacet,
        colors: allegedColors,
      } = presumedLevel;
      if (typeof facetsPerFace !== 'number') {
        return {
          errors: [`"levels[${index}].facetsPerFace" must be a number`],
        };
      }
      if (typeof tilesPerFacet !== 'number') {
        return {
          errors: [`"levels[${index}].tilesPerFacet" must be a number`],
        };
      }
      if (!Array.isArray(allegedColors)) {
        errors.push(`"levels[${index}].colors" must be an array`);
        continue;
      }
      if (allegedColors.length !== 6) {
        errors.push(
          `"levels[${index}].colors" must be an array of 6 color maps`,
        );
        continue;
      }

      /** @type {Array<ColorNamePalette>} */
      const purportedColors = [];
      let faceNumber = 0;
      for (const allegedFaceColors of allegedColors) {
        const purportedFaceColors = validateColors(
          allegedFaceColors,
          colorsByName,
          errors,
          `levels[${index}].colors[${faceNumber}]`,
        );
        if (errors.length) {
          return { errors };
        }
        purportedColors.push(purportedFaceColors);
        faceNumber += 1;
      }

      /** @type {DaiaLevel} */
      const purportedLevel = {
        topology,
        facetsPerFace,
        tilesPerFacet,
        colors: purportedColors,
      };
      purportedLevels.push(purportedLevel);
      // Compute size from level data.
      size += 6 * facetsPerFace ** 2 * tilesPerFacet ** 2;
    } else if (topology === 'torus') {
      const {
        tilesPerChunk,
        chunksPerLevel,
        colors: allegedColors,
      } = presumedLevel;
      const purportedTilesPerChunk = validatePoint(tilesPerChunk);
      if (purportedTilesPerChunk === undefined) {
        return {
          errors: ['"levels[${index}].tilesPerChunk" must be a {x, y} size'],
        };
      }
      const purportedChunksPerLevel = validatePoint(chunksPerLevel);
      if (purportedChunksPerLevel === undefined) {
        return {
          errors: ['"levels[${index}].chunksPerLevel" must be a {x, y} size'],
        };
      }

      const purportedColors = validateColors(
        allegedColors,
        colorsByName,
        errors,
        `levels[${index}].colors`,
      );
      if (errors.length) {
        return { errors };
      }

      /** @type {TorusLevel} */
      const purportedLevel = {
        topology,
        tilesPerChunk: purportedTilesPerChunk,
        chunksPerLevel: purportedChunksPerLevel,
        colors: purportedColors,
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
  for (
    let allegedEntity = 0;
    allegedEntity < allegedTypes.length;
    allegedEntity += 1
  ) {
    const allegedType = allegedTypes[allegedEntity];
    if (typeof allegedEntity !== 'number') {
      errors.push(
        `every value in "entities" must be a number, got ${JSON.stringify(
          allegedEntity,
        )} at ${allegedEntity}`,
      );
      continue;
    }
    if (typeof allegedType !== 'number') {
      errors.push(
        `every value in "types" must be a number, got ${JSON.stringify(
          allegedType,
        )} at ${allegedEntity}`,
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

  /** @type {Map<number, number>} */
  const purportedEntityTargetLocations = new Map();
  for (const allegedEntry of allegedEntityTargetLocations) {
    if (typeof allegedEntry !== 'object') {
      errors.push(
        `every entry in "entityTargetLocations" must be an "object", got ${JSON.stringify(
          allegedEntry,
        )}`,
      );
      continue;
    }
    const entry = /* @type {{[name: string]: unknown}} */ allegedEntry;
    const { entity: allegedEntity, location: allegedLocation } = entry;
    if (typeof allegedEntity !== 'number') {
      errors.push(
        `every entry in "entityTargetLocations" must have an "entity" number, got ${JSON.stringify(
          allegedEntity,
        )}`,
      );
      continue;
    }
    if (typeof allegedLocation !== 'number') {
      errors.push(
        `every entry in "entityTargetLocations" must have an "location" number, got ${JSON.stringify(
          allegedLocation,
        )}`,
      );
      continue;
    }
    const reentity = renames.get(allegedEntity);
    if (reentity === undefined) {
      errors.push(
        `an entry in "entityTargetLocations" for the alleged entity ${allegedEntity} is missing from the map`,
      );
      continue;
    }
    if (allegedLocation >= size || allegedLocation < 0) {
      errors.push(
        `an entry in "entityTargetLocations" for the alleged entity ${allegedEntity} has a location ${allegedLocation} that is outside the bounds of the world`,
      );
      continue;
    }
    purportedEntityTargetLocations.set(reentity, allegedLocation);
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
    entityTargetLocations: purportedEntityTargetLocations,
    colorsByName,
  };

  return {
    snapshot,
  };
};
