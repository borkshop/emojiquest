// @ts-check

import { makeDaia } from './topology.js';
import { makeMap } from './map.js';
import { makeDaiaToponym } from './toponym.js';

/**
 * @typedef {object} DaiaLevel
 * @prop {number} facetsPerFace
 * @prop {number} tilesPerFacet
 */

/**
 * @param {DaiaLevel} level
 */
export const sizeDaiaLevel = level => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;
  const tileDaia = makeDaia({ faceSize: tilesPerFace });
  return tileDaia.worldArea;
};

/**
 * @param {object} args
 * @param {DaiaLevel} args.level
 * @param {Node} args.parentElement
 * @param {Node} args.nextSibling
 * @param {number} args.frustumRadius
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../model.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../model.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../model.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../view-model.js').EntityWatchFn} args.watchEntities
 * @param {import('../../view-model.js').EntityWatchFn} args.unwatchEntities
 */
export const makeDaiaLevel = ({
  level,
  parentElement,
  nextSibling,
  tileSizePx,
  createEntity,
  frustumRadius,
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  watchEntities,
  unwatchEntities,
}) => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;

  const facetSizePx = tilesPerFacet * tileSizePx;

  // Model

  const faceDaia = makeDaia({
    faceSize: 1,
  });

  const facetDaia = makeDaia({
    faceSize: facetsPerFace,
  });

  const tileDaia = makeDaia({
    faceSize: tilesPerFace,
  });

  const toponym = makeDaiaToponym(tileDaia);

  // View

  const { $map, cameraController } = makeMap({
    tilesPerFacet,
    tileSizePx,
    facetSizePx,
    frustumRadius,
    createEntity,

    faceSizePx: tileDaia.faceSize * tileSizePx,
    tileNumber: tileDaia.tileNumber,
    tileCoordinate: tileDaia.tileCoordinate,
    advance: tileDaia.advance,

    facetNumber: facetDaia.tileNumber,
    facetCoordinate: facetDaia.tileCoordinate,

    faceTileCoordinate: faceDaia.tileCoordinate,
    faceAdvance: faceDaia.advance,

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
      topology: 'daia',
      facetsPerFace,
      tilesPerFacet,
    },
    size: tileDaia.worldArea,
    advance: tileDaia.advance,
    cameraController,
    toponym,
    dispose,
  };
};
