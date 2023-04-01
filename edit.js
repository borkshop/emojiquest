import { assert, assumeDefined } from './lib/assert.js';
import { sizeLevel } from './world-description.js';

/**
 * @param {import('./edit-types.js').Operation} operation
 */
const sizeOperation = operation => {
  let length = 0;
  for (const span of operation) {
    length += span.length;
  }
  return length;
};

/**
 * @param {number | undefined} location
 * @param {import('./edit-types.js').Operation} operation
 */
const transformLocation = (location, operation) => {
  if (location === undefined) {
    return undefined;
  }
  let offset = 0;
  for (const span of operation) {
    const { type, length } = span;
    if (type === 'keep') {
      const { start } = span;
      if (location >= start && location < start + length) {
        return location - start + offset;
      }
    }
    offset += length;
  }
  return undefined;
};

/**
 * @template {Uint8Array | Uint16Array} ArrayT
 * @param {ArrayT} newArray
 * @param {ArrayT} oldArray
 * @param {import('./edit-types.js').Operation} operation
 */
const transformTypedArrayIndexedByLocation = (
  newArray,
  oldArray,
  operation,
) => {
  let offset = 0;
  for (const span of operation) {
    const { type, length } = span;
    if (type === 'keep') {
      const { start } = span;
      newArray.set(oldArray.subarray(start, start + length), offset);
    }
    offset += length;
  }
};

/**
 * @template KeyT
 * @param {Map<KeyT, number>} newMap
 * @param {Map<KeyT, number>} oldMap
 * @param {import('./edit-types.js').Operation} operation
 */
const transformMapToLocation = (newMap, oldMap, operation) => {
  for (const [key, oldLocation] of oldMap.entries()) {
    const newLocation = transformLocation(oldLocation, operation);
    if (newLocation !== undefined) {
      newMap.set(key, newLocation);
    }
  }
};

/**
 * @template KeyT
 * @template ValueT
 * @param {Map<KeyT, ValueT>} map
 * @returns {Map<KeyT, ValueT>}
 */
const cloneMap = map => new Map(map.entries());

/**
 * @template KeyT
 * @template ValueT
 * @param {Map<KeyT, Array<ValueT>>} map
 * @returns {Map<KeyT, Array<ValueT>>}
 */
const cloneMapOfArrays = map =>
  new Map([...map.entries()].map(([key, values]) => [key, values.slice()]));

/** @type {import('./types.js').Snapshot} */
export const nullSnapshot = {
  entities: new Uint16Array(0),
  types: new Map(),
  player: undefined,
  inventories: new Map(),
  terrain: new Uint8Array(0),
  healths: new Map(),
  staminas: new Map(),
  targetLocations: new Map(),
  targetEntities: new Map(),
};

/**
 * @param {import('./types.js').Snapshot} oldSnapshot
 * @param {Map<string, number>} oldMarks
 * @param {import('./edit-types.js').Operation} operation
 * @returns {{snapshot: import('./types.js').Snapshot, marks: Map<string, number>}}
 */
const transformWorld = (oldSnapshot, oldMarks, operation) => {
  if (operation.length === 0) {
    return {
      snapshot: nullSnapshot,
      marks: new Map(),
    };
  }

  const {
    player,
    entities: oldEntities,
    types: oldTypes,
    terrain: oldTerrain,
    healths,
    staminas,
    inventories,
    targetLocations: oldTargetLocations,
    targetEntities,
  } = oldSnapshot;

  const size = sizeOperation(operation);

  const newEntities = new Uint16Array(size);
  transformTypedArrayIndexedByLocation(newEntities, oldEntities, operation);

  // Drop garbage entity types.
  /** @type {Map<number, number>} */
  const newTypes = new Map();
  for (let location = 0; location < newEntities.length; location += 1) {
    const entity = newEntities[location];
    if (entity !== 0) {
      newTypes.set(entity, assumeDefined(oldTypes.get(entity)));
    }
  }

  const newTerrain = new Uint8Array(size);
  transformTypedArrayIndexedByLocation(newTerrain, oldTerrain, operation);

  /** @type {Map<number, number>} */
  const newTargetLocations = new Map();
  transformMapToLocation(newTargetLocations, oldTargetLocations, operation);

  /** @type {Map<string, number>} */
  const newMarks = new Map();
  transformMapToLocation(newMarks, oldMarks, operation);

  const newSnapshot = {
    player,
    entities: newEntities,
    types: newTypes,
    terrain: newTerrain,
    healths: cloneMap(healths),
    staminas: cloneMap(staminas),
    inventories: cloneMapOfArrays(inventories),
    targetLocations: newTargetLocations,
    targetEntities: cloneMap(targetEntities),
  };

  return {
    snapshot: newSnapshot,
    marks: newMarks,
  };
};

/** @param {Array<import('./schema-types.js').LevelDescription>} levels */
const cloneOperation = levels => {
  let start = 0;
  /** @type {import('./edit-types.js').Operation} */
  const operation = [];
  for (const level of levels) {
    const length = sizeLevel(level);
    operation.push({ type: 'keep', start, length });
    start += length;
  }
  return operation;
};

/**
 * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
 * @param {import('./types.js').Snapshot} oldSnapshot
 * @param {import('./schema-types.js').LevelDescription} newLevel
 * @param {number} index
 */
export const addLevel = (oldMeta, oldSnapshot, newLevel, index) => {
  const {
    colors,
    levels: oldLevels,
    mechanics,
    marks: oldMarks = new Map(),
  } = oldMeta;

  assert(index <= oldLevels.length);

  const newLevels = oldLevels.slice();
  newLevels.splice(index, 0, newLevel);

  const newLevelSize = sizeLevel(newLevel);
  const operation = cloneOperation(oldLevels);
  operation.splice(index, 0, { type: 'skip', length: newLevelSize });

  const { snapshot: newSnapshot, marks: newMarks } = transformWorld(
    oldSnapshot,
    oldMarks,
    operation,
  );

  const newMeta = {
    levels: newLevels,
    marks: newMarks,
    colors,
    mechanics,
  };

  return {
    meta: newMeta,
    snapshot: newSnapshot,
  };
};

/**
 * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
 * @param {import('./types.js').Snapshot} oldSnapshot
 * @param {number} index
 * @param {number} [oldLocation]
 */
export const removeLevel = (oldMeta, oldSnapshot, index, oldLocation) => {
  const {
    colors,
    levels: oldLevels,
    mechanics,
    marks: oldMarks = new Map(),
  } = oldMeta;

  assert(index < oldLevels.length);

  const newLevels = oldLevels.slice();
  newLevels.splice(index, 1);

  const operation = cloneOperation(oldLevels);
  operation.splice(index, 1);

  const { snapshot: newSnapshot, marks: newMarks } = transformWorld(
    oldSnapshot,
    oldMarks,
    operation,
  );

  const newMeta = {
    levels: newLevels,
    marks: newMarks,
    colors,
    mechanics,
  };

  const newLocation = transformLocation(oldLocation, operation);

  return {
    meta: newMeta,
    snapshot: newSnapshot,
    location: newLocation,
  };
};
