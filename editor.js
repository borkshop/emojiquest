import { assumeDefined } from './lib/assert.js';
import {
  countFaces,
  locateLevel,
  locateFace,
  worldColors,
} from './world-description.js';
import { addLevel, removeLevel } from './edit.js';

// q as in quote
const q = JSON.stringify;

/**
 * @param {object} args
 * @param {import('./controller.js').ChooseFn} args.choose
 * @param {import('./controller.js').InputFn} args.input
 * @param {(html: string) => void} args.logHTML
 */
export const makeEditorModes = ({ choose, input, logHTML }) => {
  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   */
  const designNewWorld = async function* (oldMeta) {
    const levelDescription = yield* designNewLevel('Level 1:', oldMeta);
    if (levelDescription === undefined) {
      return undefined;
    }
    // TODO import mechanics separately
    // TODO import colors separately
    const { mechanics } = oldMeta;
    const newMeta = {
      colors: new Map(oldMeta.colors.entries()),
      mechanics,
      levels: [levelDescription],
    };
    return newMeta;
  };

  /**
   * @param {Map<string, string>} colorPalette
   * @param {string} [label]
   */
  const chooseColor = async function* (colorPalette, label) {
    return await choose(Object.fromEntries(colorMenu(colorPalette)), label);
  };

  /**
   * @param {string} label
   * @param {Map<string, string>} colorPalette
   */
  const designFacetColors = async function* (label, colorPalette) {
    const earth = yield* chooseColor(colorPalette, `${label} earth color:`);
    if (earth === undefined) return undefined;

    const base = yield* chooseColor(colorPalette, `${label} base color:`);
    if (base === undefined) return undefined;

    const water = yield* chooseColor(colorPalette, `${label} water color:`);
    if (water === undefined) return undefined;

    const lava = yield* chooseColor(colorPalette, `${label} lava color:`);
    if (lava === undefined) return undefined;

    return { base, lava, water, earth };
  };

  /**
   * @param {string} label
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   */
  const designNewLevel = async function* (label, meta) {
    const levelType = await choose(
      {
        rect: '🖼 Rectangle',
        torus: '🍩 Torus',
        daia: '🎲 Daia',
      },
      label,
    );

    const colorPalette = meta.colors;
    if (levelType === 'daia') {
      return yield* designDaiaLevel({ colorPalette });
    } else if (levelType === 'torus') {
      return yield* designTorusLevel({ colorPalette });
    } else if (levelType === 'rect') {
      return yield* designRectLevel({ colorPalette });
    } else {
      return undefined;
    }
  };

  /**
   * @param {object} args
   * @param {Map<string, string>} args.colorPalette
   */
  const designRectLevel = async function* ({ colorPalette }) {
    const widthText = await input({ type: 'number', placeholder: 'width' });
    if (widthText === undefined) {
      return undefined;
    }
    const width = +widthText;

    const heightText = await input({ type: 'number', placeholder: 'height' });
    if (heightText === undefined) {
      return undefined;
    }
    const height = +heightText;

    const colors = yield* designFacetColors('', colorPalette);
    if (colors === undefined) {
      return undefined;
    }

    return {
      topology: /** @type {'rect'} */ ('rect'),
      size: { x: width, y: height },
      colors,
    };
  };

  /**
   * @param {object} args
   * @param {Map<string, string>} args.colorPalette
   */
  const designTorusLevel = async function* ({ colorPalette }) {
    const chunkWidthText = await input({
      type: 'number',
      placeholder: 'chunk width (in tiles)',
    });
    if (chunkWidthText === undefined) {
      return undefined;
    }
    const chunkWidth = +chunkWidthText;

    const chunkHeightText = await input({
      type: 'number',
      placeholder: 'chunk height (in tiles)',
    });
    if (chunkHeightText === undefined) {
      return undefined;
    }
    const chunkHeight = +chunkHeightText;

    const torusWidthText = await input({
      type: 'number',
      placeholder: 'width (in chunks)',
    });
    if (torusWidthText === undefined) {
      return undefined;
    }
    const torusWidth = +torusWidthText;

    const torusHeightText = await input({
      type: 'number',
      placeholder: 'height (in chunks)',
    });
    if (torusHeightText === undefined) {
      return undefined;
    }
    const torusHeight = +torusHeightText;

    const colors = yield* designFacetColors('', colorPalette);
    if (colors === undefined) {
      return undefined;
    }

    return {
      topology: /** @type {'torus'} */ ('torus'),
      tilesPerChunk: { x: chunkWidth, y: chunkHeight },
      chunksPerLevel: { x: torusWidth, y: torusHeight },
      colors,
    };
  };

  /**
   * @param {object} args
   * @param {Map<string, string>} args.colorPalette
   */
  const designDaiaLevel = async function* ({ colorPalette }) {
    const tilesPerFacetText = await input({
      type: 'number',
      placeholder: 'tiles per facet (x and y)',
    });
    if (tilesPerFacetText === undefined) {
      return undefined;
    }
    const tilesPerFacet = +tilesPerFacetText;

    const facetsPerFaceText = await input({
      type: 'number',
      placeholder: 'facets per face (x and y)',
    });
    if (facetsPerFaceText === undefined) {
      return undefined;
    }
    const facetsPerFace = +facetsPerFaceText;

    const colors = [];
    const mode = await choose({
      one: '🎨 One Palette',
      six: '🌈 Six Palettes',
    });
    if (mode === undefined) {
      return undefined;
    } else if (mode === 'one') {
      const facetColors = yield* designFacetColors('🎲', colorPalette);
      if (facetColors === undefined) {
        return undefined;
      }
      colors.push(
        facetColors,
        facetColors,
        facetColors,
        facetColors,
        facetColors,
        facetColors,
      );
    } else if (mode === 'six') {
      for (let levelIndex = 0; levelIndex < 6; levelIndex += 1) {
        const facetColors = yield* designFacetColors(
          `${(levelIndex % 10) + 1}\ufe0f\u20e3`,
          colorPalette,
        );
        if (facetColors === undefined) {
          return undefined;
        }
        colors.push(facetColors);
      }
    }

    return {
      topology: /** @type {'daia'} */ ('daia'),
      tilesPerFacet,
      facetsPerFace,
      colors,
    };
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   */
  const chooseLevelInsertionIndex = async function* (oldMeta) {
    if (oldMeta.levels.length === 0) {
      return 0;
    }

    const entries = [[0, `Before 1`]];
    for (let index = 1; index < oldMeta.levels.length; index += 1) {
      entries.push([index, `Between ${index} and ${index + 1}`]);
    }
    entries.push([entries.length, `After ${entries.length}`]);
    const options = Object.fromEntries(entries);

    const levelText = await choose(options);
    if (levelText === undefined) {
      return undefined;
    }
    const index = +levelText;
    return index;
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   * @param {import('./types.js').Snapshot} oldSnapshot
   */
  const planLevelAddition = async function* (oldMeta, oldSnapshot) {
    const levelDescription = yield* designNewLevel('New level', oldMeta);
    if (levelDescription === undefined) {
      return undefined;
    }
    const index = yield* chooseLevelInsertionIndex(oldMeta);
    if (index === undefined) {
      return undefined;
    }
    const { meta, snapshot } = addLevel(
      oldMeta,
      oldSnapshot,
      levelDescription,
      index,
    );
    return { meta, snapshot, index };
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   * @param {import('./types.js').Snapshot} oldSnapshot
   * @param {number} levelIndex
   * @param {number} oldLocation
   */
  const planLevelRemoval = async function* (
    oldMeta,
    oldSnapshot,
    levelIndex,
    oldLocation,
  ) {
    let {
      meta: newMeta,
      snapshot: newSnapshot,
      location: newLocation,
    } = removeLevel(oldMeta, oldSnapshot, levelIndex, oldLocation);

    if (newMeta.levels.length === 0) {
      // Deleted the last level, so must make a new one.
      const levelDescription = yield* designNewLevel('First level', newMeta);
      if (levelDescription === undefined) {
        return undefined;
      }
      newMeta.levels.push(levelDescription);
    }

    if (newLocation === undefined) {
      newLocation = yield* chooseLocation(newMeta);
      if (newLocation === undefined) {
        newLocation = 0;
      }
    }

    return {
      meta: newMeta,
      snapshot: newSnapshot,
      location: newLocation,
    };
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {number} [levelIndex]
   */
  const chooseLocation = async function* (meta, levelIndex) {
    if (meta.levels.length === 1) {
      levelIndex = 0;
    } else if (levelIndex === undefined) {
      const levelIndexText = await choose(levelMenu(meta.levels));
      if (levelIndexText === undefined) {
        return undefined;
      }
      levelIndex = levelIndexText - 1;
    }
    const faceCount = countFaces(meta.levels[levelIndex]);
    if (faceCount === 1) {
      const { offset, size } = locateLevel(meta, levelIndex);
      return offset + Math.floor(size / 2);
    } else {
      const faceIndexText = await choose(
        Object.fromEntries(faceMenu(faceCount)),
      );
      if (faceIndexText === undefined) {
        return undefined;
      }
      const faceIndex = faceIndexText - 1;
      const { offset, size } = locateFace(meta, levelIndex, faceIndex);
      return offset + Math.floor(size / 2);
    }
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   * @param {import('./types.js').Snapshot} oldSnapshot
   */
  const editColorPalette = async function* (oldMeta, oldSnapshot) {
    const options = {
      // TODO untangle "new" from color name space.
      new: '🆕 New',
      ...Object.fromEntries(colorMenu(oldMeta.colors)),
    };
    const choice = await choose(options, '🎨 Colors');
    if (choice === 'new') {
      return yield* addColor(oldMeta, oldSnapshot);
    } else {
      return yield* editColor(oldMeta, oldSnapshot, choice);
    }
    return undefined;
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} oldMeta
   * @param {import('./types.js').Snapshot} snapshot
   */
  const addColor = async function* (oldMeta, snapshot) {
    const colorName = await input({ placeholder: 'name for color' });
    if (colorName === undefined) {
      return undefined;
    }

    if (oldMeta.colors.has(colorName)) {
      // Begin animation turn
      yield undefined;

      logHTML(`🚨 The color name ${q(colorName)} already exists`);

      return undefined;
    }
    if (colorName === undefined) return undefined;
    const colorValue = await input({ type: 'color' });
    if (colorValue === undefined) return undefined;
    return {
      meta: {
        ...oldMeta,
        colors: new Map([...oldMeta.colors.entries(), [colorName, colorValue]]),
      },
      snapshot,
    };
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {string} colorName
   */
  const editColor = async function* (meta, snapshot, colorName) {
    const choice = await choose({
      change: '🎨 Change',
      rename: '🏷 Rename',
      delete: '⚡️ Delete',
    });
    let colorPalette = meta.colors;
    if (choice === 'change') {
      const oldColorValue = assumeDefined(
        colorPalette.get(colorName),
        `Color ${q(colorName)} absent in color palette`,
      );
      const newColorValue = await input({
        initial: oldColorValue,
        type: 'color',
      });
      if (newColorValue === undefined) return undefined;
      colorPalette = new Map(
        [...colorPalette.entries()].map(([entryName, colorValue]) => [
          entryName,
          entryName === colorName ? newColorValue : colorValue,
        ]),
      );
    } else if (choice === 'rename') {
      const newColorName = await input({ placeholder: 'new name' });
      if (newColorName === undefined) return undefined;
      colorPalette = new Map(
        [...colorPalette.entries()].map(([entryName, colorValue]) => [
          entryName === colorName ? newColorName : entryName,
          colorValue,
        ]),
      );
    } else if (choice === 'delete') {
      // We have the options of either denying the deletion of a color that is
      // used, or requiring a replacement only if it is used.
      // Currently, we will deny the deletion of a used color.
      const usedColors = worldColors(meta);
      const faceDescriptions = usedColors.get(colorName);
      if (faceDescriptions !== undefined) {
        // Start a new animation turn.
        yield undefined;

        logHTML(
          `🚨 Cannot delete color because it is in use on ${[
            ...faceDescriptions,
          ].join(', ')}.`,
        );

        return undefined;
      }
      colorPalette = new Map(
        [...colorPalette.entries()].filter(
          ([entryName]) => entryName === colorName,
        ),
      );
    } else {
      return undefined;
    }
    return {
      meta: {
        ...meta,
        colors: colorPalette,
      },
      snapshot,
    };
  };

  /**
   * @param {Map<string, string>} colorPalette
   */
  const colorMenu = colorPalette =>
    [...colorPalette.keys()].map(name => [name, name]);

  /**
   * @param {Array<import('./schema-types.js').LevelDescription>} levels
   */
  const levelMenu = levels =>
    levels.map((_, index) => [
      `${index + 1}`,
      `${(index % 10) + 1}\ufe0f\u20e3 Level ${index + 1}`,
    ]);

  /**
   * @param {number} faceCount
   */
  const faceMenu = faceCount => {
    const entries = [];
    for (let index = 0; index < faceCount; index += 1) {
      entries.push([
        `${index + 1}`,
        `${(index % 10) + 1}\ufe0f\u20e3 Face ${index + 1}`,
      ]);
    }
    return entries;
  };

  /**
   * @param {Map<string, number>} marks
   */
  const markMenu = marks =>
    [...marks.entries()].map(([label, position]) => [
      label,
      `${label} @${position}`,
    ]);

  return {
    designNewWorld,
    planLevelAddition,
    planLevelRemoval,
    editColorPalette,
    chooseLocation,
    levelMenu,
    markMenu,
  };
};
