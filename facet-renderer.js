// @ts-check

import {makeTileRenderer} from './tile-renderer.js';

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').TileNumberFn} TileNumberFn */

/**
 * @param {Object} options
 * @param {HTMLElement} options.context
 * @param {number} options.worldSize
 * @param {number} options.facetSize
 * @param {TileTransformFn} options.facetTransform
 * @param {TileNumberFn} options.facetNumber
 * @param {TileCoordinateFn} options.tileCoordinate
 * @param {(tile:number) => HTMLElement} options.createFacet
 */
export function makeFacetRenderer({
  context,
  createFacet,
  worldSize,
  facetSize,
  facetTransform,
  facetNumber,
  tileCoordinate
}) {
  const facetRenderer = makeTileRenderer(context, facetTransform, createFacet);
  const facetTiles = new Map();

  const ratio = worldSize / facetSize;

  /**
   * @param {number} t
   */
  function translateFacetToTileNumber(t) {
    const {f, x, y} = tileCoordinate(t);
    return facetNumber({
      f,
      x: Math.floor(x / ratio),
      y: Math.floor(y / ratio),
    });
  }

  /**
   * @param {number} t
   */
  function tileEnters(t) {
    const f = translateFacetToTileNumber(t);
    let facet = facetTiles.get(f);
    if (facet == null) {
      facet = new Set();
      facetTiles.set(f, facet);
      facetRenderer.tileEnters(f);
    }
    facet.add(t);
  }

  /**
   * @param {number} t
   */
  function tileExits(t) {
    const f = translateFacetToTileNumber(t);
    const facet = facetTiles.get(f);
    if (facet == null) {
      throw new Error(`Assertion failed: tile exits from absent facet, tile ${t} facet ${f}`);
    }
    facet.delete(t);
    if (facet.size === 0) {
      facetTiles.delete(f);
      facetRenderer.tileExits(f);
    }
  }

  return {tileEnters, tileExits};
}

