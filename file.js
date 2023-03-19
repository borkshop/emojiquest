/** @typedef {import('./lib/vector2d.js').Point} Point */

/**
 * @typedef {object} Snapshot
 * @property {number | undefined} player
 * @property {number} size
 * @property {Uint16Array} entities
 * @property {Uint8Array} terrain
 * @property {Map<number, number>} entityTypes
 * @property {Map<number, number>} healths
 * @property {Map<number, number>} staminas
 * @property {Map<number, Array<number>>} inventories
 * @property {Array<import('./schema-types.js').LevelDescription>} levels
 * @property {Map<number, number>} targetLocations
 * @property {Map<number, number>} targetEntities
 * @property {Map<string, string>} colorsByName
 */

import { dot } from './lib/vector2d.js';
import { enumerate } from './lib/iterate.js';
import { makeMechanics } from './mechanics.js';
import { makeValidator } from './lib/schema-validator.js';
import { makeEnricher } from './lib/schema-enricher.js';
import { WholeWorldDescription } from './schema.js';
import { terrainMask } from './model.js';

const validator = makeValidator(WholeWorldDescription);
const enricher = makeEnricher(WholeWorldDescription);

/**
 * @param {string} colorName
 * @param {Map<string, string>} colorsByName
 * @param {Array<string>} errors
 * @param {Array<string>} path
 */
const validateColor = (colorName, colorsByName, errors, path) => {
  const color = colorsByName.get(colorName);
  if (color === undefined) {
    errors.push(
      `${path.join('.')} must be the name of a color mentioned in .colors`,
    );
  }
};

/**
 * @param {import('./lib/color.js').Palette} colors
 * @param {Map<string, string>} colorsByName
 * @param {Array<string>} errors
 * @param {Array<string>} path
 */
const validateColors = (colors, colorsByName, errors, path) => {
  validateColor(colors.base, colorsByName, errors, [...path, 'base']);
  validateColor(colors.earth, colorsByName, errors, [...path, 'earth']);
  validateColor(colors.lava, colorsByName, errors, [...path, 'lava']);
  validateColor(colors.water, colorsByName, errors, [...path, 'water']);
};

/**
 * @param {import('./mechanics.js').MechanicsDescription} mechanics
 * @param {Array<string>} errors
 */
const validateMechanics = (mechanics, errors) => {
  const {
    recipes = [],
    actions = [],
    tileTypes = [],
    agentTypes = [],
    itemTypes = [],
    effectTypes = [],
  } = mechanics;

  // Index and validate uniqueness of tile type names.
  const tileTypeNames = new Map();
  for (const [index, tileType] of enumerate(tileTypes)) {
    if (['invalid', 'empty', 'any'].includes(tileType.name)) {
      errors.push(
        `Tile type with name ${tileType.name} at index ${index} of "mechanics.tiles" is reserved.`,
      );
    } else {
      const otherIndex = tileTypeNames.get(tileType.name);
      if (otherIndex !== undefined) {
        errors.push(
          `Tile type with name ${tileType.name} at index ${index} of "mechanics.tiles" duplicates the name of tile at index ${otherIndex}`,
        ); // XXX
      } else {
        tileTypeNames.set(tileType.name, index);
      }
    }
  }

  // Index and validate uniqueness of item type names.
  const itemTypeNames = new Map();
  for (const [index, itemType] of enumerate(itemTypes)) {
    if (['invalid', 'empty', 'any'].includes(itemType.name)) {
      errors.push(
        `Tile type with name ${itemType.name} at index ${index} of "mechanics.itemTypes" is reserved.`,
      );
    } else {
      const otherIndex = itemTypeNames.get(itemType.name);
      if (otherIndex !== undefined) {
        errors.push(
          `Item type with name ${itemType.name} at index ${index} of "mechanics.itemTypes" duplicates the name of item at index ${otherIndex}`,
        ); // XXX
      } else {
        itemTypeNames.set(itemType.name, index);
      }
    }
  }

  // Index and validate uniqueness of agent type names.
  const agentTypeNames = new Map();
  for (const [index, agentType] of enumerate(agentTypes)) {
    if (['invalid', 'empty', 'any'].includes(agentType.name)) {
      errors.push(
        `Tile type with name ${agentType.name} at index ${index} of "mechanics.agentTypes" is reserved.`,
      );
    } else {
      const otherIndex = agentTypeNames.get(agentType.name);
      if (otherIndex !== undefined) {
        errors.push(
          `Entity type with name ${agentType.name} at index ${index} of "mechanics.agents" duplicates the name of entity at index ${otherIndex}`,
        ); // XXX
      } else {
        agentTypeNames.set(agentType.name, index);
      }
    }
  }

  // Index and validate uniqueness of effect type names.
  const effectTypeNames = new Map();
  for (const [index, effectType] of enumerate(effectTypes)) {
    if (['invalid', 'empty', 'any'].includes(effectType.name)) {
      errors.push(
        `Tile type with name ${effectType.name} at index ${index} of "mechanics.effectTypes" is reserved.`,
      );
    } else {
      const otherIndex = effectTypeNames.has(effectType.name);
      if (otherIndex !== undefined) {
        errors.push(
          `Effect type with name ${effectType.name} at index ${index} of "mechanics.effectTypes" duplicates the name of effect at index ${otherIndex}`,
        ); // XXX
      } else {
        effectTypeNames.set(effectType.name, index);
      }
    }
  }

  // ---

  for (const [index, effectType] of enumerate(effectTypes)) {
    const { name, tile = name } = effectType;
    if (!tileTypeNames.has(tile)) {
      errors.push(
        `No corresponding tile with name ${tile} for effect type with name ${name} at index ${index} of "mechanics.effectTypes".`,
      );
    }
  }

  // Cross-reference item type.
  for (const [index, itemType] of enumerate(itemTypes)) {
    const { name, tile = name } = itemType;
    if (!tileTypeNames.has(tile)) {
      errors.push(
        `No corresponding tile with name ${tile} for item type with name ${name} at index ${index} of "mechanics.itemTypes".`,
      );
    }
  }

  // Cross-reference agent type.
  for (const [agentIndex, agentType] of enumerate(agentTypes)) {
    const { name, tile = name, wanders, modes = [] } = agentType;
    if (!tileTypeNames.has(tile)) {
      errors.push(
        `No corresponding tile with name ${tile} for entity type with name ${name} at index ${agentIndex} of "mechanics.agentTypes".`,
      );
    }
    if (wanders !== undefined && wanders !== 'land') {
      errors.push(
        `No corresponding wandering rule ${wanders} for entity type with name ${name} at index ${agentIndex} of "mechanics.agentTypes".`,
      );
    }
    for (const [modeIndex, mode] of enumerate(modes)) {
      const { tile, holds, has } = mode;
      if (!tileTypeNames.has(tile)) {
        errors.push(
          `No tile type ${tile} for entity mode for entity with name ${name} at "mechanics.agentTypes[${agentIndex}].modes[${modeIndex}].tile".`,
        );
      }
      if (holds !== undefined && !itemTypeNames.has(holds)) {
        errors.push(
          `No item type ${holds} for entity mode for entity with name ${name} at "mechanics.agentTypes[${agentIndex}].modes[${modeIndex}].holds".`,
        );
      }
      if (has !== undefined && !itemTypeNames.has(has)) {
        errors.push(
          `No item type ${has} for entity mode for entity with name ${name} at "mechanics.agentTypes[${agentIndex}].modes[${modeIndex}].has".`,
        );
      }
    }
  }

  for (const [index, recipe] of enumerate(recipes)) {
    const { agent, reagent, product, byproduct } = recipe;
    if (!itemTypeNames.has(agent)) {
      errors.push(
        `No corresponding item type with name ${agent} for "mechanics.recipes[${index}].agent".`,
      );
    }
    if (!itemTypeNames.has(reagent)) {
      errors.push(
        `No corresponding item type with name ${reagent} for "mechanics.recipes[${index}].reagent".`,
      );
    }
    if (!itemTypeNames.has(product)) {
      errors.push(
        `No corresponding item type with name ${product} for "mechanics.recipes[${index}].product".`,
      );
    }
    if (byproduct !== undefined && !itemTypeNames.has(byproduct)) {
      errors.push(
        `No corresponding item type with name ${byproduct} for "mechanics.recipes[${index}].byproduct".`,
      );
    }
  }

  for (const [actionIndex, action] of enumerate(actions)) {
    const {
      agent = 'player',
      patient,
      left = 'empty',
      right = 'empty',
      effect = 'any',
      verb,
      items = [],
      jump,
    } = action;
    if (
      ![
        'touch',
        'take',
        'reap',
        'cut',
        'pick',
        'split',
        'merge',
        'replace',
      ].includes(verb)
    ) {
      errors.push(
        `No corresponding verb ${verb} for "mechanics.acctions[${actionIndex}].verb".`,
      );
    }
    if (!agentTypeNames.has(agent)) {
      errors.push(
        `No corresponding entity type named ${agent} for "mechanics.actions[${actionIndex}].agent".`,
      );
    }
    if (!agentTypeNames.has(patient)) {
      errors.push(
        `No corresponding entity type named ${patient} for "mechanics.actions[${actionIndex}].patient".`,
      );
    }
    if (left !== 'any' && left !== 'empty' && !itemTypeNames.has(left)) {
      errors.push(
        `No corresponding item type named ${left} for "mechanics.actions[${actionIndex}].left".`,
      );
    }
    if (right !== 'any' && right !== 'empty' && !itemTypeNames.has(right)) {
      errors.push(
        `No corresponding item type named ${right} for "mechanics.actions[${actionIndex}].right".`,
      );
    }
    if (
      effect !== 'any' &&
      effect !== 'empty' &&
      !effectTypeNames.has(effect)
    ) {
      errors.push(
        `No corresponding effect type named ${right} for "mechanics.actions[${actionIndex}].effect".`,
      );
    }
    for (const [itemIndex, item] of enumerate(items)) {
      if (!itemTypeNames.has(item)) {
        errors.push(
          `No corresponding item type named ${item} for "mechanics.actions[${actionIndex}].items[${itemIndex}]".`,
        );
      }
    }
    if (jump !== undefined && jump !== 'entity' && jump !== 'location') {
      errors.push(
        `Jump property must be to "entity" or "location" for "mechanics.actions[${actionIndex}].jump".`,
      );
    }
  }
};

/**
 * @param {unknown} allegedWholeWorldDescription
 * @returns {{
 *   wholeWorldDescription: import('./schema-types.js').WholeWorldDescription,
 *   mechanicsDescription: import('./mechanics.js').MechanicsDescription,
 *   mechanics: import('./mechanics.js').Mechanics,
 *   snapshot: Snapshot,
 * } | {
 *   errors: Array<string>
 * }}
 */
export const validate = allegedWholeWorldDescription => {
  // Validate the shape:
  /** @type {Array<string>} */
  const errors = [];
  validator(allegedWholeWorldDescription, errors);
  if (errors.length > 0) {
    return { errors };
  }
  const wholeWorldDescription =
    /** @type {import('./schema-types.js').WholeWorldDescription} */ (
      enricher(allegedWholeWorldDescription)
    );

  // Validate coherence of description.

  const {
    player: describedPlayer,
    levels,
    types: describedEntityTypes,
    locations: describedLocations,
    terrain: describedTerrain = [],
    inventories: describedInventories = new Map(),
    healths: describedHealths = new Map(),
    staminas: describedStaminas = new Map(),
    targetLocations: describedTargetLocations = new Map(),
    targetEntities: describedTargetEntities = new Map(),
    colors: colorsByName,
    mechanics: mechanicsDescription,
  } = wholeWorldDescription;

  if (levels.length < 1) {
    return { errors: ['"levels"  must contain at least 1 level'] };
  }

  validateMechanics(mechanicsDescription, errors);
  if (errors.length > 0) {
    return { errors };
  }

  const mechanics = makeMechanics(mechanicsDescription);

  let size = 0;
  let levelIndex = 0;
  for (const level of levels) {
    if (level.topology === 'rect') {
      const {
        colors,
        size: { x, y },
      } = level;
      validateColors(colors, colorsByName, errors, [
        'levels',
        `${levelIndex}`,
        'colors',
      ]);
      size += x * y;
    } else if (level.topology === 'torus') {
      const { colors, tilesPerChunk, chunksPerLevel } = level;
      validateColors(colors, colorsByName, errors, [
        'levels',
        `${levelIndex}`,
        'colors',
      ]);
      // Compute size from level data.
      const { x, y } = dot(tilesPerChunk, chunksPerLevel);
      size += x * y;
    } else if (level.topology === 'daia') {
      const { colors, tilesPerFacet, facetsPerFace } = level;
      let levelColorsIndex = 0;
      for (const levelColors of colors) {
        validateColors(levelColors, colorsByName, errors, [
          'levels',
          `${levelIndex}`,
          'colors',
          `${levelColorsIndex}`,
        ]);
        levelColorsIndex += 1;
      }
      size += 6 * facetsPerFace ** 2 * tilesPerFacet ** 2;
    }
    levelIndex += 1;
  }

  // Convert the describedEntityTypes array into an equivalent Map so we can delete
  // entries in the order they are used, and thus ensure they are used only
  // once.
  /** @type {Map<number, number>} */
  const unusedEntityTypes = new Map(
    describedEntityTypes.map((type, entity) => [entity, type]),
  );

  /** @type {Map<number, number>} */
  const entityTypes = new Map();

  /** @type {Map<number, number>} */
  const describedEntityToEntity = new Map();
  const entities = new Uint16Array(size);
  let nextEntity = 1;
  for (
    let describedEntity = 0;
    describedEntity < describedLocations.length;
    describedEntity += 1
  ) {
    const location = describedLocations[describedEntity];
    const type = unusedEntityTypes.get(describedEntity);
    if (type === undefined) {
      if (describedEntityTypes[describedEntity] === undefined) {
        errors.push(
          `Missing entry in "types" for entity in "locations" ${describedEntity} at location ${location}`,
        );
      } else {
        errors.push(
          `Entry in "types" for entity in "locations" ${describedEntity} at location ${location} already used at another location`,
        );
      }
      continue;
    }
    const tileType = mechanics.defaultTileTypeForAgentType[type];
    if (tileType === undefined) {
      errors.push(
        `No known tile type for entity ${describedEntity} at ${location} with described type ${type}`,
      );
      continue;
    }
    const entity = nextEntity;
    nextEntity += 1;
    entities[location] = entity;
    entityTypes.set(entity, type);
    describedEntityToEntity.set(describedEntity, entity);
    unusedEntityTypes.delete(describedEntity);
  }

  /** @type {Map<number, Array<number>>} */
  const inventories = new Map();
  for (const [
    describedEntity,
    describedInventory,
  ] of describedInventories.entries()) {
    const entity = describedEntityToEntity.get(describedEntity);
    if (entity === undefined) {
      errors.push(
        `an entry in "inventories" for the alleged entity ${describedEntity} is missing from the map`,
      );
      continue;
    }
    // TODO compact or truncate inventories with empty tails.
    /** @type {Array<number>} */
    const inventory = [];
    for (const item of describedInventory) {
      if (item < 1 || item > mechanics.itemTypes.length) {
        errors.push(
          `all items in the "inventory" for entity ${describedEntity} must be valid item numbers, got ${JSON.stringify(
            item,
          )}`,
        );
        continue;
      }
      inventory.push(item);
    }
    inventories.set(entity, inventory);
  }

  /** @type {Map<number, number>} */
  const healths = new Map();
  for (const [describedEntity, describedHealth] of describedHealths.entries()) {
    const entity = describedEntityToEntity.get(describedEntity);
    if (entity === undefined) {
      errors.push(
        `an entry in "healths" for the described entity ${describedEntity} is missing from the map`,
      );
      continue;
    }
    healths.set(entity, describedHealth);
  }

  /** @type {Map<number, number>} */
  const staminas = new Map();
  for (const [
    describedEntity,
    describedStamina,
  ] of describedStaminas.entries()) {
    const entity = describedEntityToEntity.get(describedEntity);
    if (entity === undefined) {
      errors.push(
        `an entry in "staminas" for the described entity ${describedEntity} is missing from the map`,
      );
      continue;
    }
    staminas.set(entity, describedStamina);
  }

  /** @type {Map<number, number>} */
  const targetLocations = new Map();
  for (const [
    describedEntity,
    describedLocation,
  ] of describedTargetLocations.entries()) {
    const entity = describedEntityToEntity.get(describedEntity);
    if (entity === undefined) {
      errors.push(
        `an entry in "targetLocations" for the described entity ${describedEntity} is missing from the map`,
      );
      continue;
    }
    if (describedLocation >= size || describedLocation < 0) {
      errors.push(
        `an entry in "targetLocations" for the described entity ${describedEntity} has a location ${describedLocation} that is outside the bounds of the world`,
      );
      continue;
    }
    targetLocations.set(entity, describedLocation);
  }

  /** @type {Map<number, number>} */
  const targetEntities = new Map();
  for (const [
    describedEntityFrom,
    describedEntityTo,
  ] of describedTargetEntities.entries()) {
    const entityFrom = describedEntityToEntity.get(describedEntityFrom);
    if (entityFrom === undefined) {
      errors.push(
        `No corresponding from entity defined for entry in "targetEntities" for entity ${describedEntityFrom} to ${describedEntityTo}`,
      );
      continue;
    }
    const entityTo = describedEntityToEntity.get(describedEntityTo);
    if (entityTo === undefined) {
      errors.push(
        `No corresponding to entity defined for entry in "targetEntities" for entity ${describedEntityFrom} to ${describedEntityTo}`,
      );
      continue;
    }
    targetEntities.set(entityFrom, entityTo);
  }

  /** @type {number | undefined } */
  let player;
  if (describedPlayer !== undefined) {
    player = describedEntityToEntity.get(describedPlayer);
    if (player === undefined) {
      errors.push(`Missing entity for described player ${describedPlayer}.`);
      return { errors };
    }
  }

  const terrain = new Uint8Array(size);
  if (describedTerrain.length > size) {
    errors.push(
      `Described terrain length (${describedTerrain.length}) is longer than the world's actual length (${size})`,
    );
  } else {
    for (let index = 0; index < describedTerrain.length; index += 1) {
      const terrainFlags = describedTerrain[index];
      if ((terrainFlags | terrainMask) !== terrainMask) {
        errors.push(
          `Terrain flags at location ${index} include unsupported flags: 0b${(
            terrainFlags & ~terrainMask
          ).toString(2)}`,
        );
      }
    }
    terrain.set(describedTerrain, 0);
  }

  if (errors.length > 0) {
    return { errors };
  }

  /** @type {Snapshot} */
  const snapshot = {
    player,
    size,
    levels,
    entities,
    terrain,
    entityTypes,
    healths,
    staminas,
    inventories,
    targetLocations,
    targetEntities,
    colorsByName,
  };

  return { wholeWorldDescription, mechanicsDescription, snapshot, mechanics };
};
