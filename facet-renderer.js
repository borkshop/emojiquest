// @ts-check

import {makeTileRenderer} from './tile-renderer.js';
import {matrix3dStyle} from './matrix3d.js';
import {translate, matrixStyle} from './matrix2d.js';

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').TileNumberFn} TileNumberFn */

/**
 * @callback EntityWatchFn
 * @param {Map<number, Point>} tiles - tile number to coordinate
 * @param {Watcher} watcher - notified when a tile enters, exits, or moves
 * within a region
 */

/**
 * @typedef {Object} Watcher
 * @prop {(entity: number) => void} enter
 * @prop {(entity: number) => void} exit
 * @prop {(entity: number, coord: Point) => void} place
 */

/**
 * @typedef {Object} Point
 * @prop {number} x
 * @prop {number} y
 */

/**
 * @param {Object} options
 * @param {number} options.worldSize
 * @param {number} options.facetSize
 * @param {TileNumberFn} options.tileNumber
 * @param {TileCoordinateFn} options.facetCoordinate
 */
function makeFacetMapper({worldSize, facetSize, tileNumber, facetCoordinate}) {
  const ratio = worldSize / facetSize;

  /**
   * @param {number} f
   * @returns {Map<number, Point>}
   */
  function tilesForFacet(f) {
    const tileMap = new Map();

    const {f: face, x: originX, y: originY} = facetCoordinate(f);
    const origin = { x: originX * ratio, y: originY * ratio };

    for (let y = 0; y < facetSize; y++) {
      for (let x = 0; x < facetSize; x++) {
        const t = tileNumber({
          f: face,
          x: origin.x + x,
          y: origin.y + y,
        });
        tileMap.set(t, {x, y});
      }
    }
    return tileMap;
  }

  return tilesForFacet;
}

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
 * @param {EntityWatchFn} options.watchEntities
 * @param {EntityWatchFn} options.unwatchEntities
 * @param {(entity:number) => HTMLElement} options.createEntity
 * @param {number} options.tileSize
 */
export function makeFacetRenderer({
  context,
  createFacet,
  createEntity,
  worldSize,
  facetSize,
  facetTransform,
  facetNumber,
  tileNumber,
  tileCoordinate,
  facetCoordinate,
  watchEntities,
  unwatchEntities,
  tileSize,
}) {

  const tilesForFacet = makeFacetMapper({
    worldSize,
    facetSize,
    tileNumber,
    facetCoordinate,
  });

  /** @type {Map<number, Watcher>} */
  const watchers = new Map();

  /**
   * @param {number} f
   */
  function createMappedFacet(f) {
    const $facet = createFacet(f);

    const entityMap = new Map();

    const watcher = {

      /**
       * @param {number} e - entity number
       */
      enter(e) {
        const $entity = createEntity(e);
        if (!$entity) throw new Error(`Assertion failed, createEntity hook must return something`);
        entityMap.set(e, $entity);
        $facet.appendChild($entity);
      },

      /**
       * @param {number} e - entity number
       * @param {Point} coord - position of the entity within the facet's coordinate space
       */
      place(e, coord) {
        const $entity = entityMap.get(e);
        if (!$entity) throw new Error(`Assertion failed, entity map should have entry for entity ${e}`);
        const {x, y} = coord;
        const transform = translate({
          x: x * tileSize,
          y: y * tileSize,
        });
        $entity.style.transform = matrixStyle(transform);
      },

      /**
       * @param {number} e - entity number
       */
      exit(e) {
        const $entity = entityMap.get(e);
        if (!$entity) throw new Error(`Assertion failed`);
        entityMap.delete(e);
        $facet.removeChild($entity);
      },
    };

    watchEntities(tilesForFacet(f), watcher);

    watchers.set(f, watcher);

    // const renderer = makeTileRenderer($facet, placeTile, createTile);
    // renderers.set(f, renderer);
    return $facet;
  }

  /**
   * @param {number} f
   */
  function collectMappedFacet(f) {
    const watcher = watchers.get(f);

    if (!watcher) throw new Error(`Assertion error`);

    const tiles = tilesForFacet(f);
    unwatchEntities(tiles, watcher);
  }

  /**
   * @param {HTMLElement} $facet
   * @param {number} f
   */
  function placeFacet($facet, f) {
    const transform = facetTransform(f);
    $facet.style.transform = matrix3dStyle(transform);
  }

  const facetRenderer = makeTileRenderer(context, placeFacet, createMappedFacet, collectMappedFacet);

  /**
   * Tracks numbered tiles in the numbered facets.
   * @type {Map<number, Set<number>>}
   */
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
    }
  }

  return {enter, exit};
}
