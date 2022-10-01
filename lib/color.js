// @ts-check

import { assumeDefined } from './assert.js';

/**
 * @typedef {object} Palette
 * @property {string} base - average color of a face (presumably one of either
 * the earth or water color for its tiles)
 * @property {string} earth - color of a tile when earth is on the surface
 * @property {string} water - color of a tile when water is on the surface
 * @property {string} lava - color of a tile when lava is on the surface
 */

/**
 * @param {Palette} palette
 * @param {number} terrainFlags
 */
export const tileColorForTerrainFlags = (palette, terrainFlags) => {
  if ((terrainFlags & 0b10) !== 0) {
    return palette.lava;
  } else if ((terrainFlags & 0b1) !== 0) {
    return palette.water;
  } else {
    return palette.earth;
  }
};

/**
 * @param {Map<string, string>} colorsByName
 * @param {Palette} paletteColorNames
 * @returns {Palette}
 */
export const makePalette = (colorsByName, { base, lava, water, earth }) => {
  return {
    base: assumeDefined(colorsByName.get(base)),
    lava: assumeDefined(colorsByName.get(lava)),
    water: assumeDefined(colorsByName.get(water)),
    earth: assumeDefined(colorsByName.get(earth)),
  };
};
