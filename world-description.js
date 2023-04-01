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
