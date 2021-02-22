// @ts-check

import {makeTileRenderer} from './tile-renderer.js';
import {matrix3dStyle} from './matrix3d.js';
import {translate, matrixStyle} from './matrix2d.js';

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
 * @param {TileNumberFn} options.tileNumber
 * @param {TileCoordinateFn} options.tileCoordinate
 * @param {TileCoordinateFn} options.facetCoordinate
 * @param {(tile:number) => HTMLElement} options.createFacet
 * @param {(tile:number) => HTMLElement} options.createTile
 * @param {number} options.tileSize
 */
export function makeFacetRenderer({
  context,
  createFacet,
  createTile,
  worldSize,
  facetSize,
  facetTransform,
  facetNumber,
  tileNumber,
  tileCoordinate,
  facetCoordinate,
  tileSize,
}) {
  const renderers = new Map();

  /**
   * @param {number} f
   * @param {number} t
   */
  function enterTile(f, t) {
    const renderer = renderers.get(f);
    renderer.enter(t);
  }

  /**
   * @param {number} f
   * @param {number} t
   */
  function exitTile(f, t) {
    const renderer = renderers.get(f);
    renderer.exit(t);
  }

  /**
   * @param {number} f
   */
  function createMappedFacet(f) {
    const facet = createFacet(f);

    const {f: face, x, y} = facetCoordinate(f);
    const origin = {
      x: x * ratio,
      y: y * ratio,
    };

    const tileMap = new Map();

    for (let dy = 0; dy < facetSize; dy++) {
      for (let dx = 0; dx < facetSize; dx++) {
        const t = tileNumber({
          f: face,
          x: origin.x + dx,
          y: origin.y + dy,
        });
        tileMap.set(t, {x: dx, y: dy});
      }
    }

    /**
     * @param {number} t
     */
    function facetTileTransform(t) {
      const {x, y} = tileMap.get(t);
      return translate({
        x: x * tileSize,
        y: y * tileSize,
      });
    }

    const renderer = makeTileRenderer(facet, facetTileTransform, matrixStyle, createTile);
    renderers.set(f, renderer);
    return facet;
  }

  const facetRenderer = makeTileRenderer(context, facetTransform, matrix3dStyle, createMappedFacet);

  const facetTiles = new Map();

  const ratio = worldSize / facetSize;

  /**
   * @param {number} t
   */
  function translateTileToFaceNumber(t) {
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
  function enter(t) {
    const f = translateTileToFaceNumber(t);
    let facet = facetTiles.get(f);
    if (facet == null) {
      facet = new Set();
      facetTiles.set(f, facet);
      facetRenderer.enter(f);
    }
    facet.add(t);
    enterTile(f, t);
  }

  /**
   * @param {number} t
   */
  function exit(t) {
    const f = translateTileToFaceNumber(t);
    const tiles = facetTiles.get(f);
    if (tiles == null) {
      throw new Error(`Assertion failed: tile exits from absent facet, tile ${t} facet ${f}`);
    }
    tiles.delete(t);
    if (tiles.size === 0) {
      facetTiles.delete(f);
      facetRenderer.exit(f);
    } else {
      exitTile(f, t);
    }
  }

  return {enter, exit};
}

