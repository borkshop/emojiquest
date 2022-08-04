// @ts-check

import { makeDaia } from './daia.js';
import { makeDaiaToponym } from './daia-names.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeModel } from './model.js';
import { makeMap } from './map.js';

/**
 * @callback CreateEntityFn
 * @param {number} entity
 * @param {number} type
 * @returns {SVGElement}
 */

/**
 * @param {import('./file.js').Snapshot} snapshot
 * @param {Node} parentElement
 * @param {Node} nextSibling
 * @param {object} args
 * @param {number} args.tileSizePx
 * @param {CreateEntityFn} args.createEntity
 * @param {import('./mechanics.js').Mechanics} args.mechanics
 */
export const makeWorld = (
  snapshot,
  parentElement,
  nextSibling,
  { tileSizePx, createEntity, mechanics },
) => {
  const { facetsPerFace, tilesPerFacet } = snapshot.levels[0];
  const tilesPerFace = tilesPerFacet * facetsPerFace;

  const frustumRadius = 10;
  const facetSizePx = tilesPerFacet * tileSizePx;

  // Model

  const faceWorld = makeDaia({
    tileSizePx, // presumed irrelevant
    faceSize: 1,
  });

  const facetWorld = makeDaia({
    tileSizePx, // presumed irrelevant
    faceSize: facetsPerFace,
  });

  const daia = makeDaia({
    tileSizePx,
    faceSize: tilesPerFace,
  });

  const toponym = makeDaiaToponym(daia);

  // View

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel, {
    name: 'world',
  });

  const worldModel = makeModel({
    size: daia.worldArea,
    advance: daia.advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
    snapshot,
  });

  const { $map, cameraController } = makeMap({
    tilesPerFacet,
    tileSizePx,
    facetSizePx,
    frustumRadius,
    createEntity,

    faceSizePx: daia.faceSizePx,
    tileNumber: daia.tileNumber,
    tileCoordinate: daia.tileCoordinate,
    advance: daia.advance,

    facetNumber: facetWorld.tileNumber,
    facetCoordinate: facetWorld.tileCoordinate,

    faceTileCoordinate: faceWorld.tileCoordinate,
    faceAdvance: faceWorld.advance,

    watchTerrain: worldModel.watchTerrain,
    unwatchTerrain: worldModel.unwatchTerrain,
    getTerrainFlags: worldModel.getTerrainFlags,

    watchEntities: worldViewModel.watchEntities,
    unwatchEntities: worldViewModel.unwatchEntities,
  });

  parentElement.insertBefore($map, nextSibling);

  /**
   * @param {number | undefined} player
   */
  const capture = player => {
    return {
      levels: [
        {
          topology: 'daia',
          facetsPerFace,
          tilesPerFacet,
        },
      ],
      ...worldModel.capture(player),
    };
  };

  const dispose = () => {
    $map.remove();
  };

  const world = {
    worldModel,
    worldMacroViewModel,
    cameraController,
    toponym,
    advance: daia.advance,
    capture,
    dispose,
  };

  return world;
};
