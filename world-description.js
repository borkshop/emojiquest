import { assert } from './lib/assert.js';

// Supported level types:
import * as daia from './topology/daia/level.js';
import * as torus from './topology/torus/level.js';
import * as rect from './topology/rect/level.js';

/**
 * @param {import('./schema-types.js').LevelDescription} level
 */
export const sizeLevel = level => {
  const { topology } = level;
  if (topology === 'daia') {
    return daia.sizeLevel(level);
  } else if (topology === 'torus') {
    return torus.sizeLevel(level);
  } else if (topology === 'rect') {
    return rect.sizeLevel(level);
  }
  assert(false, `Unrecognized level topology ${topology}`);
};

/**
 * @param {import('./schema-types.js').LevelDescription} level
 */
export const countFaces = level => {
  const { topology } = level;
  if (topology === 'daia') {
    return 6;
  } else if (topology === 'torus') {
    return 1;
  } else if (topology === 'rect') {
    return 1;
  }
  assert(false, `Unrecognized level topology ${topology}`);
};

/**
 * @param {import('./schema-types.js').WorldMetaDescription} meta
 * @param {number} levelIndex
 */
export const locateLevel = (meta, levelIndex) => {
  let offset = 0;
  for (let index = 0; index < levelIndex; index += 1) {
    offset += sizeLevel(meta.levels[index]);
  }
  return { offset, size: sizeLevel(meta.levels[levelIndex]) };
};

/**
 * @param {import('./schema-types.js').WorldMetaDescription} meta
 * @param {number} levelIndex
 * @param {number} faceIndex
 */
export const locateFace = (meta, levelIndex, faceIndex) => {
  let { offset, size } = locateLevel(meta, levelIndex);
  const level = meta.levels[levelIndex];
  const { topology } = level;
  if (topology === 'daia') {
    const faceSize = size / 6;
    return {
      offset: offset + faceSize * faceIndex,
      size: faceSize,
    };
  } else if (topology === 'torus') {
    return { offset, size };
  } else if (topology === 'rect') {
    return { offset, size };
  }
  assert(false, `Unrecognized level topology ${topology}`);
};

/**
 * @param {Map<string, Set<string>>} colors
 * @param {{ earth: string, base: string, water: string, lava: string }} faceColors
 * @param {string} user
 */
const addColors = (colors, faceColors, user) => {
  const { earth, base, water, lava } = faceColors;
  for (const color of [earth, base, water, lava]) {
    let set = colors.get(color);
    if (set === undefined) {
      set = new Set();
      colors.set(color, set);
    }
    set.add(user);
  }
};

export const faceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/**
 * @param {import('./schema-types.js').WorldMetaDescription} meta
 */
export const worldColors = meta => {
  /** @type {Map<string, Set<string>>} */
  const colors = new Map();

  let levelIndex = 0;
  for (const level of meta.levels) {
    if (level.topology === 'torus' || level.topology === 'rect') {
      addColors(colors, level.colors, `${levelIndex}`);
    } else if (level.topology === 'daia') {
      let faceIndex = 0;
      for (const faceColors of level.colors) {
        addColors(colors, faceColors, `${levelIndex}.${faceIndex}`);
        faceIndex += 1;
      }
    }
    levelIndex += 1;
  }

  return colors;
};
