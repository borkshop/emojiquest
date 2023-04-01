/** @type {Map<string, string>} */
const standardColors = new Map(
  Object.entries({
    red: '#ff0000',
    blue: '#0000ff',
    brown: '#777700',
    black: '#000000',
  }),
);

/** @type {import('../schema-types.js').WorldColorNamePalette} */
export const standardLevelColors = {
  base: 'brown',
  lava: 'red',
  water: 'blue',
  earth: 'brown',
};

const standardMechanics = {};

/** @type {import('../schema-types.js').WorldMetaDescription} */
export const standardMeta = {
  colors: standardColors,
  mechanics: standardMechanics,
  levels: [],
};
