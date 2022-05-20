// @ts-check

import { assert, assertNonZero } from './assert.js';
import { halfOcturn, fullOcturn, octurnVectors } from './geometry2d.js';
import { makeBoxTileMap } from './tile-map-box.js';

/**
 * @typedef {[number, number, number, number, number, number, number, number, number]} NineNumbers
 */

/**
 * @param {number} x
 * @param {number} y
 */
export function locate(x, y) {
  return (y + 1) * 5 + x + 1;
}

export const tileMap = makeBoxTileMap({ x: 5, y: 5 }, { x: -1, y: -1 });

const gridCoordinates = [
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
];

const gridLocations = gridCoordinates.map(({ x, y }) => locate(x, y));

const octurnGridIndexes = [7, 8, 5, 2, 1, 0, 3, 6];

/**
 * @param {import('./macro-view-model.js').MacroViewModel} macroViewModel
 */
export function makeNineKeyView(macroViewModel) {
  let next = 1; // 0 is a sentinel for absence.

  /** @type {NineNumbers} */
  const entities = [0, 0, 0, 0, 0, 0, 0, 0, 0];

  /**
   * @param {number} type
   * @param {number} location
   */
  function create(type, location) {
    const entity = next;
    next = next + 1;
    macroViewModel.put(entity, location, type);
    return entity;
  }

  /**
   * @param {number} slot
   * @param {number} tileType
   */
  function spawn(slot, tileType) {
    const location = gridLocations[slot];
    const entity = create(tileType, location);
    macroViewModel.enter(entity);
    entities[slot] = entity;
  }

  /** @param {number} slot */
  function despawn(slot) {
    const entity = entities[slot];
    assertNonZero(entity);
    macroViewModel.exit(entity);
    entities[slot] = 0;
  }

  /**
   * @param {number} directionOcturns
   */
  function despawnOutward(directionOcturns) {
    const gridIndex = octurnGridIndexes[directionOcturns];
    const entity = entities[gridIndex];
    assertNonZero(
      entity,
      `Expected an entity at gridIndex ${gridIndex} for direction ${directionOcturns}/8th turn clockwise from north`,
    );
    macroViewModel.take(entity, directionOcturns);
    entities[gridIndex] = 0;
  }

  /**
   * @param {number} tileType
   * @param {number} directionOcturns
   */
  function spawnInward(tileType, directionOcturns) {
    const gridIndex = octurnGridIndexes[directionOcturns];
    assert(
      entities[gridIndex] === 0,
      `Cannot spawnInward on ${gridIndex} because that space is occupied by ${entities[gridIndex]}`,
    );
    const { x, y } = octurnVectors[directionOcturns];
    const entity = create(tileType, locate(1 + x * 2, 1 + y * 2));
    macroViewModel.move(
      entity,
      locate(1 + x, 1 + y),
      (directionOcturns + halfOcturn) % fullOcturn,
      0,
    );
    entities[gridIndex] = entity;
  }

  /**
   * @param {number} fromSlot
   * @param {number} toSlot
   * @param {number} directionOcturns
   * @param {number} spinOcturns
   */
  function move(fromSlot, toSlot, directionOcturns, spinOcturns) {
    const entity = entities[fromSlot];
    assertNonZero(
      entity,
      `Cannot move entity in nine-key-view from ${fromSlot} to ${toSlot} because the slot is empty`,
    );
    const destination = gridLocations[toSlot];
    macroViewModel.move(entity, destination, directionOcturns, spinOcturns);
    entities[toSlot] = entity;
    entities[fromSlot] = 0;
  }

  /**
   * @param {number} slot
   * @param {number} directionOcturns
   */
  function take(slot, directionOcturns) {
    const entity = entities[slot];
    assertNonZero(entity);
    macroViewModel.take(entity, directionOcturns);
    entities[slot] = 0;
  }

  /**
   * @param {number} slot
   * @param {number} type
   * @param {number} directionOcturns
   */
  function give(slot, type, directionOcturns) {
    const entity = next;
    next = next + 1;
    const toLocation = gridLocations[slot];
    const { x, y } = gridCoordinates[slot];
    const { x: dx, y: dy } = octurnVectors[directionOcturns];
    const fromLocation = locate(x - dx, y - dy);
    macroViewModel.give(
      entity,
      fromLocation,
      toLocation,
      type,
      directionOcturns,
    );
    entities[slot] = entity;
  }

  /**
   * @param {number} slot
   * @param {number} tileType
   */
  function replace(slot, tileType) {
    const entity = entities[slot];
    if (entity !== 0) {
      macroViewModel.replace(entity, tileType);
    } else {
      spawn(slot, tileType);
    }
  }

  /**
   * @param {number} slot
   * @param {number} directionOcturns
   */
  function bounce(slot, directionOcturns) {
    const entity = entities[slot];
    assertNonZero(entity);
    macroViewModel.bounce(entity, directionOcturns);
  }

  /**
   * @param {number} slot
   */
  function up(slot) {
    const entity = entities[slot];
    if (entity !== 0) {
      macroViewModel.up(entity);
    }
  }

  /**
   * @param {number} slot
   */
  function down(slot) {
    const entity = entities[slot];
    if (entity !== 0) {
      macroViewModel.down(entity);
    }
    return () => {
      macroViewModel.up(entity);
    };
  }

  return {
    create,
    spawn,
    despawn,
    despawnOutward,
    spawnInward,
    move,
    take,
    replace,
    bounce,
    give,
    up,
    down,
  };
}
