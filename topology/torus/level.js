// @ts-check

import { dot } from '../../lib/vector2d.js';
import { makeTorusTopology } from './topology.js';
import { makeTorusMap } from './map.js';
import { makeTorusToponym } from './toponym.js';

/**
 * @typedef {object} TorusLevel
 * @prop {import('../../lib/vector2d.js').Point} tilesPerChunk
 * @prop {import('../../lib/vector2d.js').Point} chunksPerLevel
 */

/**
 * @param {TorusLevel} level
 */
export const sizeTorusLevel = level => {
  const { chunksPerLevel, tilesPerChunk } = level;
  const tilesPerLevel = dot(tilesPerChunk, chunksPerLevel);
  const topology = makeTorusTopology({ size: tilesPerLevel });
  return topology.area;
};

/**
 * @param {object} args
 * @param {TorusLevel} args.level
 * @param {Node} args.parentElement
 * @param {Node} args.nextSibling
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../model.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../model.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../model.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../view-model.js').EntityWatchFn} args.watchEntities
 * @param {import('../../view-model.js').EntityWatchFn} args.unwatchEntities
 */
export const makeTorusLevel = ({
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
}) => {
  const { chunksPerLevel, tilesPerChunk } = level;
  const tilesPerLevel = dot(tilesPerChunk, chunksPerLevel);
  const topology = makeTorusTopology({ size: tilesPerLevel });
  const { tileCoordinate, tileNumber, advance, area } = topology;
  const chunkTopology = makeTorusTopology({ size: chunksPerLevel });
  const { tileCoordinate: chunkCoordinate, tileNumber: chunkNumber } =
    chunkTopology;

  // Model

  const toponym = makeTorusToponym({
    tileCoordinate,
  });

  // View

  const { $map, cameraController } = makeTorusMap({
    tilesPerChunk,
    tileSizePx,
    createEntity,

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

  const dispose = () => {
    $map.remove();
  };

  return {
    descriptor: {
      topology: /** @type {'torus'} */ ('torus'),
      chunksPerLevel,
      tilesPerChunk,
    },
    size: area,
    advance,
    cameraController,
    toponym,
    dispose,
  };
};