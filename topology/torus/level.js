// @ts-check

import { dot } from '../../lib/vector2d.js';
import { makePalette } from '../../lib/color.js';
import { makeTopology } from './topology.js';
import { makeTileView } from './view.js';
import { makeToponym } from './toponym.js';

/**
 * @typedef {object} Level
 * @prop {import('../../lib/vector2d.js').Point} tilesPerChunk
 * @prop {import('../../lib/vector2d.js').Point} chunksPerLevel
 */

/**
 * @param {Level} level
 */
export const sizeLevel = level => {
  const { chunksPerLevel, tilesPerChunk } = level;
  const tilesPerLevel = dot(tilesPerChunk, chunksPerLevel);
  const topology = makeTopology({ size: tilesPerLevel });
  return topology.area;
};

/**
 * @param {object} args
 * @param {number} args.offset
 * @param {Level} args.level
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../types.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../types.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../types.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../types.js').WatchEntitiesFn} args.watchEntities
 * @param {import('../../types.js').WatchEntitiesFn} args.unwatchEntities
 * @param {import('../../schema-types.js').WorldColorNamePalette} args.colorNamePalette
 * @param {Map<string, string>} args.colorsByName
 */
export const makeLevel = ({
  offset,
  level,
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
  const { chunksPerLevel, tilesPerChunk } = level;
  const tilesPerLevel = dot(tilesPerChunk, chunksPerLevel);
  const topology = makeTopology({ size: tilesPerLevel });
  const { tileCoordinate, tileNumber, advance, area } = topology;
  const chunkTopology = makeTopology({ size: chunksPerLevel });
  const { tileCoordinate: chunkCoordinate, tileNumber: chunkNumber } =
    chunkTopology;
  const palette = makePalette(colorsByName, colorNamePalette);

  // Model

  const toponym = makeToponym({
    tileCoordinate,
    offset,
  });

  // View

  /**
   * @param {object} args
   * @param {Node} args.parentElement
   * @param {Node} args.nextSibling
   */
  const makeView = ({ parentElement, nextSibling }) => {
    const { $map, cameraController } = makeTileView({
      tilesPerChunk,
      tileSizePx,
      createEntity,
      palette,

      tileNumber,
      tileCoordinate,
      advance,

      chunkNumber,
      chunkCoordinate,

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
      cameraController,
      show,
      hide,
      dispose,
    };
  };

  return {
    name: 'Torus',
    descriptor: {
      topology: /** @type {'torus'} */ ('torus'),
      chunksPerLevel,
      tilesPerChunk,
      colors: colorNamePalette,
    },
    offset,
    size: area,
    faces: [
      {
        name: 'Face',
        offset,
        size: area,
      },
    ],
    advance,
    toponym,
    makeView,
  };
};
