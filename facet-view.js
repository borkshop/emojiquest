// @ts-check

import {makeTileView} from './tile-view.js';
import {matrix3dStyle} from './matrix3d.js';
import {north, east, south, west, turnVectors} from './geometry2d.js';
import {compose, translate, rotate, scale, matrixStyle} from './matrix2d.js';

/** @type {Transition} */
const noTransition = {
  direction: 0,
  rotation: 0,
  bump: false,
  stage: 'stay',
}

/** @type {Progress} */
const noProgress = {
  linear: 0,
  sinusoidal: 0,
  sinusoidalQuarterTurn: 0,
  bounce: 0,
}

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */
/** @typedef {import('./daia.js').TileCoordinateFn} TileCoordinateFn */
/** @typedef {import('./daia.js').TileNumberFn} TileNumberFn */
/** @typedef {import('./daia.js').AdvanceFn} AdvanceFn */

/**
 * @typedef {Object} Coord
 * @prop {number} x - integer in the coordinate space of tiles.
 * @prop {number} y - integer in the coordinate space of tiles.
 * @prop {number} a - angle, in increments of 90 degrees clockwise from due
 * north.
 */

/**
 * @callback EntityWatchFn
 * @param {Map<number, Coord>} tiles - tile number to coordinate
 * @param {Watcher} watcher - notified when a tile enters, exits, or moves
 * within a region
 */

/**
 * @typedef {Object} Progress
 * @prop {number} linear
 * @prop {number} sinusoidal
 * @prop {number} sinusoidalQuarterTurn
 * @prop {number} bounce
 */

/**
 * @typedef {Object} Transition
 * @prop {number} [direction] - in quarter turns clockwise from north.
 * @prop {number} [rotation] - in quarter turns clockwise, positive or negative.
 * @prop {boolean} [bump] - whether the entity makes an aborted attempt in the
 * direction.
 * @prop {'exit' | 'enter' | 'stay'} [stage] - whether to pop in or pop out.
 */

/**
 * @callback PlaceFn
 * @param {number} entity
 * @param {Coord} coord - position in the origin coordinate plane, including
 * any inherent rotation angle relative to that plane due to transition over
 * the edge of the world to another face.
 * @param {Progress=} progress - precomputed progress parameters.
 * @param {Transition=} transition - animated transition parameters.
 */

/**
 * @typedef {Object} Watcher
 * @prop {(entity: number) => void} enter
 * @prop {(entity: number) => void} exit
 * @prop {PlaceFn} place
 */

/**
 * @param {Object} options
 * @param {number} options.worldSize
 * @param {number} options.facetSize
 * @param {TileNumberFn} options.tileNumber
 * @param {TileCoordinateFn} options.facetCoordinate
 * @param {AdvanceFn} options.advance
 */
function makeFacetMapper({worldSize, facetSize, tileNumber, facetCoordinate, advance}) {
  const ratio = worldSize / facetSize;

  /**
   * @param {number} f
   * @returns {Map<number, Coord>}
   */
  function tilesForFacet(f) {
    const tileMap = new Map();

    const {f: face, x: originX, y: originY} = facetCoordinate(f);
    const origin = { x: originX * ratio, y: originY * ratio };

    // body
    for (let y = 0; y < facetSize; y++) {
      for (let x = 0; x < facetSize; x++) {
        const t = tileNumber({
          f: face,
          x: origin.x + x,
          y: origin.y + y,
        });
        tileMap.set(t, {x, y, a: 0});
      }
    }

    // Here follows a buggy but mostly working attempt to replace
    // the four hand-rolled cases below:
    // // flaps
    // for (let direction = 0; direction < 4; direction++) {
    //   const across = (direction + 1) % 4;
    //   let edge = transform(corners[direction], scale(ratio - 1));
    //   edge = transform(edge, translate(origin));
    //   for (let distance = 0; distance < facetSize; distance++) {
    //     const position = tileNumber({
    //       f: face,
    //       ...edge
    //     });
    //     const next = advance({position, direction});
    //     const flap = transform(edge, translate(turnVectors[direction]));
    //     tileMap.set(next.position, {
    //       ...flap,
    //       a: next.turn
    //     });
    //     edge = transform(edge, translate(turnVectors[across]));
    //   }
    // }

    // west flap
    for (let y = 0; y < facetSize; y++) {
      const position = tileNumber({
        f: face,
        x: origin.x,
        y: origin.y + y,
      });
      const flap = advance({position, direction: west});
      tileMap.set(flap.position, {
        x: -1,
        y,
        a: flap.turn
      });
    }

    // east flap
    for (let y = 0; y < facetSize; y++) {
      const position = tileNumber({
        f: face,
        x: origin.x + facetSize - 1,
        y: origin.y + y,
      });
      const flap = advance({position, direction: east});
      tileMap.set(flap.position, {
        x: facetSize,
        y,
        a: flap.turn
      });
    }

    // north flap
    for (let x = 0; x < facetSize; x++) {
      const position = tileNumber({
        f: face,
        x: origin.x + x,
        y: origin.y,
      });
      const flap = advance({position, direction: north});
      tileMap.set(flap.position, {
        x,
        y: -1,
        a: flap.turn
      });
    }

    // south flap
    for (let x = 0; x < facetSize; x++) {
      const position = tileNumber({
        f: face,
        x: origin.x + x,
        y: origin.y + facetSize - 1,
      });
      const flap = advance({position, direction: south});
      tileMap.set(flap.position, {
        x,
        y: facetSize,
        a: flap.turn
      });
    }

    return tileMap;
  }

  return tilesForFacet;
}

/**
 * @param {Object} options
 * @param {Element} options.context
 * @param {number} options.worldSize
 * @param {number} options.facetSize
 * @param {TileTransformFn} options.facetTransform
 * @param {TileNumberFn} options.facetNumber
 * @param {TileNumberFn} options.tileNumber
 * @param {TileCoordinateFn} options.tileCoordinate
 * @param {TileCoordinateFn} options.facetCoordinate
 * @param {(tile:number) => SVGElement} options.createFacet
 * @param {EntityWatchFn} options.watchEntities
 * @param {EntityWatchFn} options.unwatchEntities
 * @param {(entity:number) => SVGElement} options.createEntity
 * @param {AdvanceFn} options.advance
 */
export function makeFacetView({
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
  advance,
}) {

  const tilesForFacet = makeFacetMapper({
    worldSize,
    facetSize,
    tileNumber,
    facetCoordinate,
    advance,
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

      /** @type {PlaceFn} */
      place(e, coord, progress = noProgress, transition = noTransition) {
        const {
          direction = 0,
          rotation = 0,
          bump = false,
          stage = 'stay'
        } = transition;
        const { sinusoidal, sinusoidalQuarterTurn, bounce } = progress;
        const $entity = entityMap.get(e);
        if (!$entity) throw new Error(`Assertion failed, entity map should have entry for entity ${e}`);
        const {x: dx, y: dy} = turnVectors[(direction + 4 - coord.a) % 4];
        const shiftProgress = bump ? bounce : sinusoidal;
        const scaleProgress = stage === 'stay' ? 1 : stage === 'exit' ? 1 - sinusoidal : sinusoidal;
        const transform = compose(
          scale(scaleProgress),
          rotate(sinusoidalQuarterTurn * rotation),
          rotate(-Math.PI/2 * coord.a),
          translate(coord),
          translate({x: dx * shiftProgress, y: dy * shiftProgress}),
          translate({x: 0.5, y: 0.5}),
        );
        $entity.setAttributeNS(null, 'transform', matrixStyle(transform));
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
   * @param {SVGElement} $facet
   * @param {number} f
   */
  function placeFacet($facet, f) {
    const transform = facetTransform(f);
    // Placed using HTML transform, not SVG transform.
    $facet.style.transform = matrix3dStyle(transform);
  }

  const facetView = makeTileView(context, placeFacet, createMappedFacet, collectMappedFacet);

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
      facetView.enter(f);
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
      facetView.exit(f);
    }
  }

  return {enter, exit};
}