// @ts-check
//
// The world has six faces.
// The cursor is on one face.
// There are four adjacent faces to the cursor's face.
//
//    +--+
//    |??| dangling
//    +--+
//    |  |
// +--+--+--+
// |  |@@|  | cursor in center
// +--+--+--+
//    |  |    and four adjacent faces
//    +--+
//
// When the player transits to another face,
// The origin (@@) becomes an adjacent face,
// the destination becomes the cusor face,
// two adjacent faces may rotate on a corner and remain
// adjacent to the destination.
// The remaining face must simply jump to its new position,
// and may have been adjacent to any of the original
// four adjacent faces.
// This is the dangling face. (??)
//
//    +--+
//    |--| the dangling face gets teleported
//    +--+
//      / \
//     + o + rotate clockwise
//      \ /
// +--+--+--+--+
// |  | >>> |++| to become a new adjacent face
// +--+--+--+--+
//      / \
//     + o + rotate counter-cw
//      \ /
//       +
//
//       +--+
//       |  |
// +--+--+--+--+
// |??|  |@@|  | leaving a new dangling face (??)
// +--+--+--+--+
//       |  |
//       +--+
//
// However, if the cursor returns to the previously occupied face, the dangling
// face gets reused instead of teleported.
// This leaves us in a state without a dangling face.
//
//       +
//      / \
//     + o + rotate counter-cw
//      \ /
// +--+--+--+--+
// |??| <<< |  |
// +--+--+--+--+
//      / \
//     + o + rotate clockwise
//      \ /
//       +
//
//    +--+
//    |  |
// +--+--+--+--+
// |  |@@|  |??|
// +--+--+--+--+
//    |  |
//    +--+

import { assumeDefined } from '../../lib/assert.js';
import {
  quarturnVectors,
  north,
  east,
  south,
  west,
} from '../../lib/geometry2d.js';
import {
  identity,
  compose,
  translate,
  rotate,
  rotateQuarturn,
  matrixStyle,
} from '../../lib/matrix2d.js';
import { add as addVectors, scale as scaleVector } from '../../lib/vector2d.js';
import { tileColorForTerrainFlags } from '../../lib/color.js';
import { placeEntity } from '../../animation2d.js';
import { makeTileKeeper } from '../../tile-keeper.js';

/** @typedef {import('../../lib/geometry2d.js').Point} Point */
/** @typedef {import('../../progress.js').Progress} Progress */
/** @typedef {import('../../animation2d.js').Coord} Coord */
/** @typedef {import('../../types.js').Cursor} Cursor */
/** @typedef {import('../../types.js').CursorChange} CursorChange */
/** @typedef {import('../../types.js').Watcher} Watcher */
/** @typedef {import('../../types.js').PlaceFn} PlaceFn */
/** @typedef {import('../../types.js').WatchEntitiesFn} WatchEntitiesFn */
/** @typedef {import('../../types.js').WatchTerrainFn} WatchTerrainFn */
/** @typedef {import('../../types.js').GetTerrainFlagsFn} GetTerrainFlagsFn */

/**
 * @callback CreateEntityFn
 * @param {number} entity
 * @param {number} type
 * @returns {SVGElement}
 */

/**
 * @typedef {Object} Pivot
 * @property {Coord} origin
 * @property {Point} about
 * @property {number} angle
 */

const svgNS = 'http://www.w3.org/2000/svg';

const centerVector = { x: 0.5, y: 0.5 };

/**
 * @param {Object} options
 * @param {number} options.tilesPerFacet
 * @param {import('../../types.js').TileNumberFn} options.tileNumber
 * @param {import('../../types.js').TileCoordinateFn} options.facetCoordinate
 * @param {import('../../types.js').AdvanceFn} options.advance
 */
const makeFacetMapper = ({
  tilesPerFacet,
  tileNumber,
  facetCoordinate,
  advance,
}) => {
  /**
   * @param {number} facet
   * @returns {Map<number, Coord>}
   */
  const tilesForFacet = facet => {
    const tileMap = new Map();

    const { f: face, x: originX, y: originY } = facetCoordinate(facet);
    const origin = {
      x: originX * tilesPerFacet,
      y: originY * tilesPerFacet,
    };

    // body
    for (let y = 0; y < tilesPerFacet; y++) {
      for (let x = 0; x < tilesPerFacet; x++) {
        const t = tileNumber({
          f: face,
          x: origin.x + x,
          y: origin.y + y,
        });
        tileMap.set(t, { x, y, a: 0 });
      }
    }

    // TODO generalize the four unrolled flap loops below into a nested loop.

    // west flap
    for (let y = 0; y < tilesPerFacet; y++) {
      const position = tileNumber({
        f: face,
        x: origin.x,
        y: origin.y + y,
      });
      const flap = assumeDefined(advance({ position, direction: west }));
      tileMap.set(flap.position, {
        x: -1,
        y,
        a: flap.turn,
      });
    }

    // east flap
    for (let y = 0; y < tilesPerFacet; y++) {
      const position = tileNumber({
        f: face,
        x: origin.x + tilesPerFacet - 1,
        y: origin.y + y,
      });
      const flap = assumeDefined(advance({ position, direction: east }));
      tileMap.set(flap.position, {
        x: tilesPerFacet,
        y,
        a: flap.turn,
      });
    }

    // north flap
    for (let x = 0; x < tilesPerFacet; x++) {
      const position = tileNumber({
        f: face,
        x: origin.x + x,
        y: origin.y,
      });
      const flap = assumeDefined(advance({ position, direction: north }));
      tileMap.set(flap.position, {
        x,
        y: -1,
        a: flap.turn,
      });
    }

    // south flap
    for (let x = 0; x < tilesPerFacet; x++) {
      const position = tileNumber({
        f: face,
        x: origin.x + x,
        y: origin.y + tilesPerFacet - 1,
      });
      const flap = assumeDefined(advance({ position, direction: south }));
      tileMap.set(flap.position, {
        x,
        y: tilesPerFacet,
        a: flap.turn,
      });
    }

    return tileMap;
  };

  return tilesForFacet;
};

/**
 * @param {Object} args
 * @param {number} args.tilesPerFacet - the height and width of a facet in tiles
 * @param {number} args.facetSizePx - the height and width of a facet in pixels
 * @param {Array<import('../../lib/color.js').Palette>} args.palettesByLayer
 * @param {WatchTerrainFn} args.watchTerrain
 * @param {WatchTerrainFn} args.unwatchTerrain
 * @param {GetTerrainFlagsFn} args.getTerrainFlags
 * @param {CreateEntityFn} args.createEntity
 * @param {WatchEntitiesFn} args.watchEntities
 * @param {WatchEntitiesFn} args.unwatchEntities
 */
export function makeFacetCreator({
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  tilesPerFacet,
  facetSizePx,
  createEntity,
  watchEntities,
  unwatchEntities,
  palettesByLayer,
}) {
  const animators = new Set();

  /**
   * @param {number} _facetNumber
   * @param {number} faceNumber
   * @param {Map<number, Coord>} tiles
   * @returns {{$facet: SVGElement, dispose: () => void}}
   */
  const createFacet = (_facetNumber, faceNumber, tiles) => {
    const backTiles = new Map();

    const $facet = document.createElementNS(svgNS, 'svg');
    $facet.setAttributeNS(
      null,
      'viewBox',
      `0 0 ${tilesPerFacet} ${tilesPerFacet}`,
    );
    $facet.setAttributeNS(null, 'height', `${facetSizePx}`);
    $facet.setAttributeNS(null, 'width', `${facetSizePx}`);
    $facet.setAttributeNS(null, 'class', 'facet');

    const $back = document.createElementNS(svgNS, 'g');
    const $front = document.createElementNS(svgNS, 'g');

    for (const [location, { x, y }] of tiles.entries()) {
      const $backTile = document.createElementNS(svgNS, 'rect');
      const terrainFlags = getTerrainFlags(location);
      const color = tileColorForTerrainFlags(
        palettesByLayer[faceNumber],
        terrainFlags,
      );
      $backTile.setAttributeNS(null, 'height', '1');
      $backTile.setAttributeNS(null, 'width', '1');
      $backTile.setAttributeNS(null, 'x', `${x}`);
      $backTile.setAttributeNS(null, 'y', `${y}`);
      $backTile.setAttributeNS(null, 'class', 'backTile');
      $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      $back.appendChild($backTile);
      backTiles.set(location, $backTile);
    }

    $facet.appendChild($back);
    $facet.appendChild($front);

    /** @type {Map<number, SVGElement>} */
    const entityMap = new Map();

    const watcher = {
      /**
       * @param {number} entity - entity number
       * @param {number} tileType
       */
      enter(entity, tileType) {
        const $entity = assumeDefined(
          createEntity(entity, tileType),
          `Assertion failed, createEntity hook must return something`,
        );
        entityMap.set(entity, $entity);
        $front.appendChild($entity);
      },

      /** @type {PlaceFn} */
      place(entity, coord, pressure, progress, transition) {
        const $entity = assumeDefined(
          entityMap.get(entity),
          `Assertion failed, entity map should have entry for entity ${entity}`,
        );
        placeEntity($entity, coord, pressure, progress, transition);
      },

      /**
       * @param {number} entity - entity number
       */
      exit(entity) {
        const $entity = assumeDefined(
          entityMap.get(entity),
          `Assertion failed, entity map should an entry for entity ${entity}`,
        );
        entityMap.delete(entity);
        $front.removeChild($entity);
      },
    };

    watchEntities(tiles, watcher);

    const marked = new Set();

    /**
     * @param {number} location
     */
    const mark = location => {
      marked.add(location);
    };

    watchTerrain(tiles.keys(), mark);

    /**
     * @param {import('../../progress.js').Progress} _progress
     */
    const animate = _progress => {
      for (const location of marked) {
        const $backTile = backTiles.get(location);
        const terrainFlags = getTerrainFlags(location);
        const color = tileColorForTerrainFlags(
          palettesByLayer[faceNumber],
          terrainFlags,
        );
        $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      }
      marked.clear();
    };

    animators.add(animate);

    const dispose = () => {
      animators.delete(animate);
      unwatchTerrain(tiles.keys(), mark);
      unwatchEntities(tiles, watcher);
    };

    return { $facet, dispose };
  };

  /**
   * @param {import('../../progress.js').Progress} progress
   */
  const animateFacets = progress => {
    for (const animate of animators) {
      animate(progress);
    }
  };

  return { createFacet, animateFacets };
}
/**
 * @param {Object} args
 * @param {HTMLElement} args.$viewport
 * @param {number} args.face
 * @param {number} args.tileSizePx
 * @param {number} args.faceSizePx
 * @param {number} args.facetSizePx
 * @param {WatchEntitiesFn} args.watchEntities
 * @param {WatchEntitiesFn} args.unwatchEntities
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.watchTerrain
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.unwatchTerrain
 * @param {(location: number) => number} args.getTerrainFlags
 * @param {ReturnType<makeFacetCreator>['createFacet']} args.createFacet
 */
const makeFace = ({
  $viewport,
  face,
  faceSizePx,
  facetSizePx,
  createFacet,
}) => {
  const $face = document.createElement('div');
  $face.className = 'face';
  // Hack to hide group until first relocated:
  $face.style.transform = 'scale(0)';
  $face.appendChild(document.createTextNode(`${face}`));
  $viewport.appendChild($face);

  /** @type {Map<number, SVGElement>} */
  const facets = new Map();
  /** @type {Map<number, () => void>} */
  const facetDisposers = new Map();

  /**
   * @param {number} facet
   * @param {Map<number, Coord>} tiles
   * @param {Point} point
   */
  const facetEnters = (facet, tiles, point) => {
    const { $facet, dispose } = createFacet(facet, face, tiles);
    // console.log({facet, point});
    $facet.style.transform = matrixStyle(
      translate(scaleVector(point, facetSizePx)),
    );
    $face.appendChild($facet);
    facetDisposers.set(facet, dispose);
    facets.set(facet, $facet);
  };

  /** @param {number} facet */
  const facetExits = facet => {
    const $facet = assumeDefined(
      facets.get(facet),
      `Assertion failed: cannot dispose of non-existent facet ${facet}`,
    );
    const dispose = assumeDefined(
      facetDisposers.get(facet),
      `Assertion failed: cannot dispose of non-existent facet ${facet}`,
    );
    dispose();
    $facet.remove();
  };

  /**
   * @param {import('../../animation2d.js').Coord} destination
   */
  const relocate = ({ x, y, a }) => {
    const transform = compose(
      translate(scaleVector({ x: 1, y: 1 }, -faceSizePx / 2)),
      rotateQuarturn(a),
      translate(scaleVector({ x: 1, y: 1 }, faceSizePx / 2)),
      translate(scaleVector({ x, y }, faceSizePx)),
    );
    const transformStyle = matrixStyle(transform);
    $face.style.transform = transformStyle;
  };

  /** @type {Pivot?} */
  let pivoting = null;

  /** @param {Pivot} pivot */
  const pivot = pivot => {
    pivoting = pivot;
  };

  /** @param {Progress} progress */
  const animate = progress => {
    if (pivoting !== null) {
      const { origin, about, angle } = pivoting;
      const transform = compose(
        // Rotate about center.
        translate(scaleVector(centerVector, -faceSizePx)),
        rotate((origin.a * Math.PI) / 2),
        translate(scaleVector(centerVector, faceSizePx)),
        // Rotate about pivot corner.
        translate(scaleVector(about, -faceSizePx)),
        rotate((angle * progress.sinusoidal * Math.PI) / 2),
        translate(scaleVector(about, faceSizePx)),
        // Place globally.
        translate(scaleVector(origin, faceSizePx)),
      );
      const transformStyle = matrixStyle(transform);
      $face.style.transform = transformStyle;
    }
  };

  const tick = () => {};

  const tock = () => {
    pivoting = null;
  };

  return { animate, tick, tock, pivot, relocate, facetEnters, facetExits };
};

/**
 * @param {Object} args
 * @param {number} args.tilesPerFacet
 * @param {number} args.tileSizePx
 * @param {number} args.faceSizePx
 * @param {number} args.facetSizePx
 * @param {number} args.frustumRadius
 * @param {CreateEntityFn} args.createEntity
 * @param {Array<import('../../lib/color.js').Palette>} args.palettesByLayer
 * @param {WatchEntitiesFn} args.watchEntities
 * @param {WatchEntitiesFn} args.unwatchEntities
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.watchTerrain
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.unwatchTerrain
 * @param {(location: number) => number} args.getTerrainFlags
 * @param {import('../../types.js').TileNumberFn} args.tileNumber
 * @param {import('../../types.js').TileNumberFn} args.facetNumber
 * @param {import('../../types.js').TileCoordinateFn} args.tileCoordinate
 * @param {import('../../types.js').TileCoordinateFn} args.facetCoordinate
 * @param {import('../../types.js').AdvanceFn} args.advance
 * @param {import('../../types.js').TileCoordinateFn} args.faceTileCoordinate
 * @param {import('../../types.js').AdvanceFn} args.faceAdvance
 */
export const makeTileView = ({
  tilesPerFacet,
  tileSizePx,
  faceSizePx,
  facetSizePx,
  frustumRadius,
  createEntity,
  palettesByLayer,
  watchEntities,
  unwatchEntities,
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  tileNumber,
  facetNumber,
  facetCoordinate,
  tileCoordinate,
  advance,
  faceAdvance,
}) => {
  const tilesForFacet = makeFacetMapper({
    tilesPerFacet,
    tileNumber,
    facetCoordinate,
    advance,
  });

  const $map = document.createElement('div');
  $map.className = 'map';

  const $origin = document.createElement('div');
  $origin.className = 'origin';
  $map.appendChild($origin);

  const $viewport = document.createElement('div');
  $viewport.className = 'viewport';
  $origin.appendChild($viewport);

  let viewportTransform = identity;
  let viewportChange = { x: 0, y: 0, a: 0 };
  let drift = { x: 0, y: 0, a: 0 };

  const { createFacet, animateFacets } = makeFacetCreator({
    watchTerrain,
    unwatchTerrain,
    getTerrainFlags,
    tilesPerFacet,
    facetSizePx,
    createEntity,
    watchEntities,
    unwatchEntities,
    palettesByLayer,
  });

  const faceControllers = new Array(6).fill(null).map((_, face) =>
    makeFace({
      $viewport,
      face,

      tileSizePx,
      faceSizePx,
      facetSizePx,

      watchTerrain,
      unwatchTerrain,
      getTerrainFlags,
      watchEntities,
      unwatchEntities,
      createFacet,
    }),
  );

  /** @param {number} facet */
  const facetEnters = facet => {
    const { f: face, x, y } = facetCoordinate(facet);
    // console.log(`facet ${facet} enters on face ${face} at ${x}, ${y}`);
    const tiles = tilesForFacet(facet);
    faceControllers[face].facetEnters(facet, tiles, { x, y });
  };

  /** @param {number} facet */
  const facetExits = facet => {
    const { f: face } = facetCoordinate(facet);
    // console.log(`facet ${facet} exits on face ${face}`);
    faceControllers[face].facetExits(facet);
  };

  /**
   * @param {number} tile
   */
  const translateTileToFacetNumber = tile => {
    const { f, x, y } = tileCoordinate(tile);
    return facetNumber({
      f,
      x: Math.floor(x / tilesPerFacet),
      y: Math.floor(y / tilesPerFacet),
    });
  };

  /**
   * Tracks numbered tiles in the numbered facets, so we know when to create or
   * destroy facets.
   * @type {Map<number, Set<number>>}
   */
  const facetTiles = new Map();

  const { keepTilesAround } = makeTileKeeper({
    /** @param {number} tile */
    enter(tile) {
      const facet = translateTileToFacetNumber(tile);
      let tiles = facetTiles.get(facet);
      if (tiles == null) {
        tiles = new Set();
        facetTiles.set(facet, tiles);
        facetEnters(facet);
      }
      tiles.add(tile);
    },
    /** @param {number} tile */
    exit(tile) {
      const facet = translateTileToFacetNumber(tile);
      const tiles = facetTiles.get(facet);
      if (tiles == null) {
        throw new Error(
          `Assertion failed: tile exits from absent facet, tile ${tile} facet ${facet}`,
        );
      }
      tiles.delete(tile);
      if (tiles.size === 0) {
        facetTiles.delete(facet);
        facetExits(facet);
      }
    },
    advance,
  });

  /** @param {string} transformStyle */
  const positionCamera = transformStyle => {
    $viewport.style.transform = transformStyle;
  };

  /**
   * @param {number} destination
   */
  const jump = destination => {
    keepTilesAround(destination, frustumRadius);

    drift = { x: 0, y: 0, a: 0 };

    const coordinate = tileCoordinate(destination);
    const { f: face } = coordinate;

    faceControllers[face].relocate({ x: 0, y: 0, a: 0 });

    const [northerly] = [0, 1, 2, 3].map(direction => {
      const { position, turn } = assumeDefined(
        faceAdvance({ position: face, direction }),
      );
      faceControllers[position].relocate({
        ...quarturnVectors[direction],
        a: (4 - turn) % 4,
      });
      return { position, turn };
    });
    // Position the opposite face north of north, accumulating rotations if needed.
    const neighbor = assumeDefined(
      faceAdvance({
        position: northerly.position,
        direction: (4 - northerly.turn) % 4,
      }),
    );
    const vector = { x: 0, y: -2 }; // north, then north again
    faceControllers[5 - face].relocate({
      ...vector,
      a: (8 - northerly.turn - neighbor.turn) % 4,
    });

    viewportTransform = compose(
      translate(scaleVector(coordinate, -tileSizePx)),
      translate(scaleVector({ x: 1, y: 1 }, -tileSizePx / 2)),
    );
    viewportChange = { x: 0, y: 0, a: 0 };
    positionCamera(matrixStyle(viewportTransform));
  };

  /**
   * @param {number} destination
   * @param {CursorChange} change
   */
  const move = (destination, change) => {
    keepTilesAround(destination, frustumRadius);

    const { turn, transit, position: origin } = change;
    const originalLocalDirection = change.direction;
    const localVector = quarturnVectors[originalLocalDirection];

    if (transit) {
      const originalLocalLeftDirection = (originalLocalDirection + 3) % 4;
      const originalLocalRightDirection = (originalLocalDirection + 1) % 4;

      const globalDirection = (originalLocalDirection + drift.a) % 4;
      const globalLeftDirection = (originalLocalLeftDirection + drift.a) % 4;
      const globalRightDirection = (originalLocalRightDirection + drift.a) % 4;

      const globalVector = quarturnVectors[globalDirection];
      const globalLeftVector = quarturnVectors[globalLeftDirection];
      const globalRightVector = quarturnVectors[globalRightDirection];

      const originalGlobalLeftVector = addVectors(drift, globalLeftVector);
      const originalGlobalRightVector = addVectors(drift, globalRightVector);

      const globalLeftPivotVector = addVectors(
        scaleVector(addVectors(globalVector, globalRightVector), 0.5),
        centerVector,
      );
      const globalRightPivotVector = addVectors(
        scaleVector(addVectors(globalVector, globalLeftVector), 0.5),
        centerVector,
      );

      const originalGlobalAngle = drift.a;

      // Advance drift coordinate and rotation.
      drift.a = (drift.a + 4 - change.turn) % 4;
      drift.x += globalVector.x;
      drift.y += globalVector.y;

      //        +------+------+
      //        | left | left |
      // +------+------+------+------+
      // | prev | orig | dest | next |
      // +------+------+------+------+
      //        | rite | rite |
      //        +------+------+
      // left: pivot clockwise
      // rite: pivot counter-clockwise
      // orig: does not move since it is in the neighborhood of dest
      // dest: does not move since it is in the neighborhood of orig
      // next: relocate since it was the floating tile on the other side of the world
      // prev: does not move since it becomes the floating tile

      const originCoordinate = tileCoordinate(origin);
      const { f: originFace } = originCoordinate;
      const { position: leftFace, turn: leftTurn } = assumeDefined(
        faceAdvance({
          position: originFace,
          direction: originalLocalLeftDirection,
        }),
      );
      const { position: rightFace, turn: rightTurn } = assumeDefined(
        faceAdvance({
          position: originFace,
          direction: originalLocalRightDirection,
        }),
      );
      const { position: destinationFace, turn: destinationTurn } =
        assumeDefined(
          faceAdvance({
            position: originFace,
            direction: originalLocalDirection,
          }),
        );
      // console.log({destinationFace, originalLocalDirection, destinationTurn});
      const { position: nextFace, turn: nextTurn } = assumeDefined(
        faceAdvance({
          position: destinationFace,
          direction: (originalLocalDirection + 4 + destinationTurn) % 4,
        }),
      );

      const originalLocalLeftAngle = 4 - leftTurn;
      const originalGlobalLeftAngle =
        (originalGlobalAngle + originalLocalLeftAngle) % 4;
      const originalLocalRightAngle = 4 - rightTurn;
      const originalGlobalRightAngle =
        (originalGlobalAngle + originalLocalRightAngle) % 4;

      const finalNextVector = addVectors(drift, globalVector);

      faceControllers[leftFace].pivot({
        origin: { ...originalGlobalLeftVector, a: originalGlobalLeftAngle },
        about: globalLeftPivotVector,
        angle: 1,
      });

      faceControllers[rightFace].pivot({
        origin: { ...originalGlobalRightVector, a: originalGlobalRightAngle },
        about: globalRightPivotVector,
        angle: -1,
      });

      faceControllers[nextFace].relocate({
        ...finalNextVector,
        a: (drift.a + 4 - nextTurn) % 4,
      });
    }

    const { x, y } = localVector;
    viewportChange = { x, y, a: turn };
  };

  const tick = () => {
    for (const faceController of faceControllers) {
      faceController.tick();
    }
  };

  const tock = () => {
    for (const faceController of faceControllers) {
      faceController.tock();
    }

    // Viewport reset.
    const { x, y, a } = viewportChange;
    viewportTransform = compose(
      viewportTransform,
      translate(scaleVector({ x, y }, -tileSizePx)),
      rotateQuarturn(4 + a),
    );
    positionCamera(matrixStyle(viewportTransform));
    viewportChange = { x: 0, y: 0, a: 0 };
  };

  /**
   * @param {import('../../progress.js').Progress} progress
   */
  const animate = progress => {
    if (progress.linear > 1) {
      return;
    }

    animateFacets(progress);

    for (const faceController of faceControllers) {
      faceController.animate(progress);
    }

    // Viewport transition.
    const { x, y, a } = viewportChange;
    const partialTransform = compose(
      viewportTransform,
      translate({
        x: -x * tileSizePx * progress.sinusoidal,
        y: -y * tileSizePx * progress.sinusoidal,
      }),
      rotate(a * -progress.sinusoidalQuarterTurn),
    );
    positionCamera(matrixStyle(partialTransform));
  };

  const cameraController = { jump, move, animate, tick, tock };

  return { $map, cameraController };
};
