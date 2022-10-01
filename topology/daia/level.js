// @ts-check

import { makeDaia } from './topology.js';
import { makeMap } from './map.js';
import { makeDaiaToponym } from './toponym.js';
import { makePalette } from '../../lib/color.js';

/**
 * @param {import('../../file.js').DaiaLevel} level
 */
export const sizeDaiaLevel = level => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;
  const tileDaia = makeDaia({ faceSize: tilesPerFace });
  return tileDaia.worldArea;
};

/**
 * @param {object} args
 * @param {import('../../file.js').DaiaLevel} args.level
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
 * @param {Array<import('../../file.js').ColorNamePalette>} args.colorNamePalettes
 * @param {Map<string, string>} args.colorsByName
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
  colorNamePalettes,
  colorsByName,
}) => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;

  const facetSizePx = tilesPerFacet * tileSizePx;

  const palettesByLayer = colorNamePalettes.map(colorNamePalette =>
    makePalette(colorsByName, colorNamePalette),
  );

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

    palettesByLayer,

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
      topology: /** @type {'daia'} */ ('daia'),
      facetsPerFace,
      tilesPerFacet,
      colors: colorNamePalettes,
    },
    size: tileDaia.worldArea,
    advance: tileDaia.advance,
    cameraController,
    toponym,
    show,
    hide,
    dispose,
  };
};
