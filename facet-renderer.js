// @ts-check

import {makeTileRenderer} from './tile-renderer.js';

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').TileNumberFn} TileNumberFn */

/**
 * @param {Object} options
 * @param {HTMLElement} options.context
 * @param {number} options.ratio The number of tiles per facet along an edge
 * @param {TileTransformFn} options.facetTransform
 * @param {TileNumberFn} options.facetNumber
 * @param {TileCoordinateFn} options.tileCoordinate
 * @param {(tile:number) => HTMLElement} options.createFacet
 */
export function makeFacetRenderer({
  context,
  createFacet,
  ratio,
  facetTransform,
  facetNumber,
  tileCoordinate
}) {
  const facetTileRenderer = makeTileRenderer(context, facetTransform, createFacet);
  const facetTiles = new Map();

  /**
   * @param {number} t
   */
  function translateTileNumber(t) {
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
    const f = translateTileNumber(t);
    let facet = facetTiles.get(f);
    if (facet == null) {
      facet = new Set();
      facetTiles.set(f, facet);
      facetTileRenderer.tileEnters(f);
    }
    facet.add(t);
  }

  /**
   * @param {number} t
   */
  function tileExits(t) {
    const f = translateTileNumber(t);
    const facet = facetTiles.get(f);
    if (facet == null) {
      throw new Error(`Assertion failed: tile exits from absent facet, tile ${t} facet ${f}`);
    }
    facet.delete(t);
    if (facet.size === 0) {
      facetTiles.delete(f);
      facetTileRenderer.tileExits(f);
    }
  }

  return {tileEnters, tileExits};
}

