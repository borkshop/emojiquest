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
 * @param {number} args.offset
 * @param {number} args.frustumRadius
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../model.js').Model} args.worldModel
 * @param {import('../../view-model.js').ViewModel} args.worldViewModel
 */
export const makeDaiaLevel = ({
  level,
  offset,
  parentElement,
  nextSibling,
  tileSizePx,
  createEntity,
  frustumRadius,
  worldModel,
  worldViewModel,
}) => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;

  const facetSizePx = tilesPerFacet * tileSizePx;

  /**
   * @param {Iterable<number>} locations
   * @param {(location: number) => void} watcher
   */
  const watchTerrain = (locations, watcher) => {
    return worldModel.watchTerrain(
      [...locations].map(location => location + offset),
      watcher,
    );
  };

  /**
   * @param {Iterable<number>} locations
   * @param {(location: number) => void} watcher
   */
  const unwatchTerrain = (locations, watcher) => {
    return worldModel.watchTerrain(
      [...locations].map(location => location + offset),
      watcher,
    );
  };

  /**
   * @param {number} location
   */
  const getTerrainFlags = location => {
    return worldModel.getTerrainFlags(location + offset);
  };

  /** @type {import('../../view-model.js').EntityWatchFn} */
  const watchEntities = (tiles, watcher) => {
    return worldViewModel.watchEntities(
      new Map(
        [...tiles.entries()].map(([local, coord]) => [local + offset, coord]),
      ),
      watcher,
    );
  };

  /** @type {import('../../view-model.js').EntityWatchFn} */
  const unwatchEntities = (tiles, watcher) => {
    return worldViewModel.unwatchEntities(
      new Map(
        [...tiles.entries()].map(([local, coord]) => [local + offset, coord]),
      ),
      watcher,
    );
  };

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
