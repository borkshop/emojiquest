// @ts-check

import { makePalette } from '../../lib/color.js';
import { makeTopology } from './topology.js';
import { makeMap } from './map.js';
import { makeToponym } from './toponym.js';

/**
 * @typedef {object} Level
 * @prop {import('../../lib/vector2d.js').Point} size
 */

// TODO parameterize somewhere, doesn't need to be in the level description.
const tilesPerChunk = { x: 9, y: 9 };

/**
 * @param {Level} level
 */
export const sizeLevel = level => {
  const { size } = level;
  const { x, y } = size;
  return x * y;
};

/**
 * @param {object} args
 * @param {number} args.offset
 * @param {Level} args.level
 * @param {Node} args.parentElement
 * @param {Node} args.nextSibling
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../model.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../model.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../model.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../view-model.js').EntityWatchFn} args.watchEntities
 * @param {import('../../view-model.js').EntityWatchFn} args.unwatchEntities
 * @param {import('../../file.js').ColorNamePalette} args.colorNamePalette
 * @param {Map<string, string>} args.colorsByName
 */
export const makeLevel = ({
  offset,
  level,
  parentElement,
  nextSibling,
  tileSizePx,
  createEntity,
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  watchEntities,
  unwatchEntities,
  colorNamePalette,
  colorsByName,
}) => {
  const { size } = level;
  const topology = makeTopology({ size });
  const { tileCoordinate, advance, area } = topology;

  const palette = makePalette(colorsByName, colorNamePalette);

  // Model

  const toponym = makeToponym({
    tileCoordinate,
    offset,
  });

  // View

  /**
   * @param {import('../../lib/geometry2d.js').Point} origin
   * @returns {Map<number, import('../../animation2d.js').Coord>}
   */
  const tilesForChunk = origin => {
    const tileMap = new Map();
    for (let y = -1; y < tilesPerChunk.y + 1; y += 1) {
      for (let x = -1; x < tilesPerChunk.x + 1; x += 1) {
        const coord = {
          x: origin.x + x,
          y: origin.y + y,
          a: 0,
        };
        if (
          coord.x >= 0 &&
          coord.x < size.x &&
          coord.y >= 0 &&
          coord.y < size.y
        ) {
          const position = coord.x + coord.y * size.x;
          tileMap.set(position, { x, y, a: 0 });
        }
      }
    }
    return tileMap;
  };

  const { $map, cameraController } = makeMap({
    tilesForChunk,
    tilesPerChunk,

    tileSizePx,
    createEntity,
    palette,

    tileCoordinate,

    watchTerrain,
    unwatchTerrain,
    getTerrainFlags,
    watchEntities,
    unwatchEntities,
  });

  parentElement.insertBefore($map, nextSibling);

  const show = () => {
    $map.style.display = 'block';
  };

  const hide = () => {
    $map.style.display = 'none';
  };

  const dispose = () => {
    $map.remove();
  };

  return {
    descriptor: {
      topology: /** @type {'rect'} */ ('rect'),
      size,
      colors: colorNamePalette,
    },
    size: area,
    advance,
    cameraController,
    toponym,
    show,
    hide,
    dispose,
  };
};
