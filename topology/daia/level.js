// @ts-check

import { makeTopology } from './topology.js';
import { makeMap } from './map.js';
import { makeToponym } from './toponym.js';
import { makePalette } from '../../lib/color.js';

/**
 * @param {import('../../file.js').DaiaLevel} level
 */
export const sizeLevel = level => {
  const { facetsPerFace, tilesPerFacet } = level;
  const tilesPerFace = tilesPerFacet * facetsPerFace;
  const topology = makeTopology({ faceSize: tilesPerFace });
  return topology.worldArea;
};

/**
 * @param {object} args
 * @param {number} args.offset
 * @param {import('../../file.js').DaiaLevel} args.level
 * @param {number} args.frustumRadius
 * @param {number} args.tileSizePx
 * @param {import('../../world.js').CreateEntityFn} args.createEntity
 * @param {import('../../model.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../model.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../model.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../types.js').WatchEntitiesFn} args.watchEntities
 * @param {import('../../types.js').WatchEntitiesFn} args.unwatchEntities
 * @param {Array<import('../../file.js').ColorNamePalette>} args.colorNamePalettes
 * @param {Map<string, string>} args.colorsByName
 */
export const makeLevel = ({
  offset,
  level,
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

  const faceTopology = makeTopology({
    faceSize: 1,
  });

  const facetTopology = makeTopology({
    faceSize: facetsPerFace,
  });

  const tileTopology = makeTopology({
    faceSize: tilesPerFace,
  });

  const toponym = makeToponym({ ...tileTopology, offset });

  // View

  /**
   * @param {object} args
   * @param {Node} args.parentElement
   * @param {Node} args.nextSibling
   */
  const makeView = ({ parentElement, nextSibling }) => {
    const { $map, cameraController } = makeMap({
      tilesPerFacet,
      tileSizePx,
      facetSizePx,
      frustumRadius,
      createEntity,

      palettesByLayer,

      faceSizePx: tileTopology.faceSize * tileSizePx,
      tileNumber: tileTopology.tileNumber,
      tileCoordinate: tileTopology.tileCoordinate,
      advance: tileTopology.advance,

      facetNumber: facetTopology.tileNumber,
      facetCoordinate: facetTopology.tileCoordinate,

      faceTileCoordinate: faceTopology.tileCoordinate,
      faceAdvance: faceTopology.advance,

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
    descriptor: {
      topology: /** @type {'daia'} */ ('daia'),
      facetsPerFace,
      tilesPerFacet,
      colors: colorNamePalettes,
    },
    size: tileTopology.worldArea,
    advance: tileTopology.advance,
    toponym,
    makeView,
  };
};
