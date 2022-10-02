// @ts-check

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
import { placeEntity } from '../../animation2d.js';
import { dot, scale } from '../../lib/vector2d.js';
import { tileColorForTerrainFlags } from '../../lib/color.js';

/** @typedef {import('../../lib/geometry2d.js').Point} Point */
/** @typedef {import('../../progress.js').Progress} Progress */
/** @typedef {import('../../animation2d.js').Coord} Coord */
/** @typedef {import('../../topology.js').Cursor} Cursor */
/** @typedef {import('../../topology.js').CursorChange} CursorChange */
/** @typedef {import('../../view-model.js').Watcher} Watcher */
/** @typedef {import('../../view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('../../view-model.js').EntityWatchFn} EntityWatchFn */

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

// TODO makeChunkMapper might be factorable in a way that Daia topology can share.
/**
 * @param {Object} args
 * @param {import('../../lib/vector2d.js').Point} args.tilesPerChunk
 * @param {import('../../topology.js').TileNumberFn} args.tileNumber
 * @param {import('../../topology.js').TileCoordinateFn} args.chunkCoordinate
 * @param {import('../../topology.js').AdvanceFn} args.advance
 */
const makeChunkMapper = ({
  tilesPerChunk,
  tileNumber,
  chunkCoordinate,
  advance,
}) => {
  /**
   * @param {number} chunk
   * @returns {Map<number, Coord>}
   */
  const tilesForChunk = chunk => {
    const tileMap = new Map();

    const cc = chunkCoordinate(chunk);
    const origin = dot(cc, tilesPerChunk);

    // body
    for (let y = 0; y < tilesPerChunk.y; y++) {
      for (let x = 0; x < tilesPerChunk.x; x++) {
        const t = tileNumber({
          f: 0,
          x: origin.x + x,
          y: origin.y + y,
        });
        tileMap.set(t, { x, y, a: 0, origin });
      }
    }

    // TODO generalize the four unrolled flap loops below into a nested loop.

    // west flap
    for (let y = 0; y < tilesPerChunk.y; y++) {
      const position = tileNumber({
        f: 0,
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
    for (let y = 0; y < tilesPerChunk.y; y++) {
      const position = tileNumber({
        f: 0,
        x: origin.x + tilesPerChunk.x - 1,
        y: origin.y + y,
      });
      const flap = assumeDefined(advance({ position, direction: east }));
      tileMap.set(flap.position, {
        x: tilesPerChunk.x,
        y,
        a: flap.turn,
      });
    }

    // north flap
    for (let x = 0; x < tilesPerChunk.x; x++) {
      const position = tileNumber({
        f: 0,
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
    for (let x = 0; x < tilesPerChunk.x; x++) {
      const position = tileNumber({
        f: 0,
        x: origin.x + x,
        y: origin.y + tilesPerChunk.y - 1,
      });
      const flap = assumeDefined(advance({ position, direction: south }));
      tileMap.set(flap.position, {
        x,
        y: tilesPerChunk.y,
        a: flap.turn,
      });
    }

    return tileMap;
  };

  return tilesForChunk;
};

/**
 * @param {Object} args
 * @param {Node} args.$viewport
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.watchTerrain
 * @param {(locations: Iterable<number>, mark: (location: number) => void) => void} args.unwatchTerrain
 * @param {import('../../lib/vector2d.js').Point} args.tilesPerChunk - the height and width of a chunk in tiles
 * @param {import('../../lib/vector2d.js').Point} args.chunkSizePx - the height and width of a chunk in pixels
 * @param {(location: number) => number} args.getTerrainFlags
 * @param {CreateEntityFn} args.createEntity
 * @param {import('../../lib/color.js').Palette} args.palette
 * @param {EntityWatchFn} args.watchEntities
 * @param {EntityWatchFn} args.unwatchEntities
 */
export function makeChunkCreator({
  $viewport,
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  tilesPerChunk,
  chunkSizePx,
  createEntity,
  palette,
  watchEntities,
  unwatchEntities,
}) {
  const animators = new Set();

  /**
   * @param {import('../../lib/vector2d.js').Point} origin
   * @param {Map<number, Coord>} tiles
   * @returns {() => void}
   */
  const createChunk = (origin, tiles) => {
    const backTiles = new Map();

    const $chunk = document.createElementNS(svgNS, 'svg');
    $chunk.setAttributeNS(
      null,
      'viewBox',
      `0 0 ${tilesPerChunk.x} ${tilesPerChunk.y}`,
    );
    $chunk.setAttributeNS(null, 'height', `${chunkSizePx.x}`);
    $chunk.setAttributeNS(null, 'width', `${chunkSizePx.y}`);
    $chunk.setAttributeNS(null, 'class', 'chunk');
    $chunk.setAttributeNS(null, 'style', 'position: absolute');

    const transform = compose(translate(dot(origin, chunkSizePx)));
    const transformStyle = matrixStyle(transform);
    $chunk.style.transform = transformStyle;

    const $back = document.createElementNS(svgNS, 'g');
    const $front = document.createElementNS(svgNS, 'g');
    const $over = document.createElementNS(svgNS, 'g');

    for (const [location, { x, y }] of tiles.entries()) {
      const $backTile = document.createElementNS(svgNS, 'rect');
      const terrainFlags = getTerrainFlags(location);
      const color = tileColorForTerrainFlags(palette, terrainFlags);
      $backTile.setAttributeNS(null, 'height', '1');
      $backTile.setAttributeNS(null, 'width', '1');
      $backTile.setAttributeNS(null, 'x', `${x}`);
      $backTile.setAttributeNS(null, 'y', `${y}`);
      $backTile.setAttributeNS(null, 'class', 'backTile');
      $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      $back.appendChild($backTile);
      backTiles.set(location, $backTile);
    }

    $chunk.appendChild($back);
    $chunk.appendChild($front);
    $chunk.appendChild($over);

    $viewport.appendChild($chunk);

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
        if (tileType === -1) {
          $over.appendChild($entity);
        } else {
          $front.appendChild($entity);
        }
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
        $entity.remove();
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
        const color = tileColorForTerrainFlags(palette, terrainFlags);
        $backTile.setAttributeNS(null, 'style', `fill: ${color}`);
      }
      marked.clear();
    };

    animators.add(animate);

    const dispose = () => {
      animators.delete(animate);
      unwatchTerrain(tiles.keys(), mark);
      unwatchEntities(tiles, watcher);
      $viewport.removeChild($chunk);
    };

    return dispose;
  };

  /**
   * @param {import('../../progress.js').Progress} progress
   */
  const animateChunks = progress => {
    for (const animate of animators) {
      animate(progress);
    }
  };

  return { createChunk, animateChunks };
}

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 * @param {import('../../lib/vector2d.js').Point} args.tilesPerChunk
 * @param {CreateEntityFn} args.createEntity
 * @param {import('../../lib/color.js').Palette} args.palette
 * @param {import('../../view-model.js').EntityWatchFn} args.watchEntities
 * @param {import('../../view-model.js').EntityWatchFn} args.unwatchEntities
 * @param {import('../../model.js').WatchTerrainFn} args.watchTerrain
 * @param {import('../../model.js').WatchTerrainFn} args.unwatchTerrain
 * @param {import('../../model.js').GetTerrainFlagsFn} args.getTerrainFlags
 * @param {import('../../topology.js').TileNumberFn} args.tileNumber
 * @param {import('../../topology.js').TileNumberFn} args.chunkNumber
 * @param {import('../../topology.js').TileCoordinateFn} args.tileCoordinate
 * @param {import('../../topology.js').AdvanceFn} args.advance
 * @param {import('../../topology.js').TileCoordinateFn} args.chunkCoordinate
 */
export const makeMap = ({
  tilesPerChunk,
  tileSizePx,
  createEntity,
  palette,
  watchEntities,
  unwatchEntities,
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  tileNumber,
  chunkNumber,
  chunkCoordinate,
  tileCoordinate,
  advance,
}) => {
  const chunkSizePx = scale(tilesPerChunk, tileSizePx);

  const tilesForChunk = makeChunkMapper({
    tilesPerChunk,
    tileNumber,
    chunkCoordinate,
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
  let cursor = { x: 0, y: 0 };

  const { createChunk, animateChunks } = makeChunkCreator({
    $viewport,
    watchTerrain,
    unwatchTerrain,
    getTerrainFlags,
    tilesPerChunk,
    chunkSizePx,
    createEntity,
    palette,
    watchEntities,
    unwatchEntities,
  });

  const chunks = new Map();

  /**
   * @param {Point} point
   */
  const pointToKey = ({ x, y }) => {
    const hi = (((y >>> 0) & 0xffff) << 16) >>> 0;
    const lo = ((x >>> 0) & 0xffff) >>> 0;
    return (hi | lo) >>> 0;
  };

  /**
   * Tracks numbered tiles in the numbered chunks, so we know when to create or
   * destroy chunks.
   * @type {Map<number, Set<number>>}
   */
  // const chunkTiles = new Map();

  /** @param {string} transformStyle */
  const positionCamera = transformStyle => {
    $viewport.style.transform = transformStyle;
  };

  /**
   * @param {import('../../lib/vector2d.js').Point} coordinate
   */
  function* chunkCoordinatesAround(coordinate) {
    const radius = 4;
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        yield {
          x: Math.floor(coordinate.x / tilesPerChunk.x) + x,
          y: Math.floor(coordinate.y / tilesPerChunk.y) + y,
          f: 0,
        };
      }
    }
  }

  const retainChunksAround = () => {
    for (const chunkCoordinate of chunkCoordinatesAround(cursor)) {
      const chunk = chunkNumber(chunkCoordinate);
      const chunkKey = pointToKey(chunkCoordinate);

      if (!chunks.has(chunkKey)) {
        const tiles = tilesForChunk(chunk);
        const dispose = createChunk(chunkCoordinate, tiles);
        chunks.set(chunkKey, dispose);
      }
    }
  };

  const releaseChunks = () => {
    const candidates = new Map(chunks.entries());
    for (const chunkCoordinate of chunkCoordinatesAround(cursor)) {
      const chunkKey = pointToKey(chunkCoordinate);
      candidates.delete(chunkKey);
    }
    for (const [chunkKey, dispose] of candidates.entries()) {
      chunks.delete(chunkKey);
      dispose();
    }
  };

  /**
   * @param {number} destination
   */
  const jump = destination => {
    // drift = { x: 0, y: 0 };
    const coordinate = tileCoordinate(destination);
    cursor = coordinate;
    retainChunksAround();

    viewportChange = { x: 0, y: 0, a: 0 };
    viewportTransform = compose(
      translate(scaleVector(coordinate, -tileSizePx)),
      translate(scaleVector({ x: 1, y: 1 }, -tileSizePx / 2)),
    );
    positionCamera(matrixStyle(viewportTransform));
  };

  /**
   * @param {number} _destination
   * @param {CursorChange} change
   */
  const move = (_destination, change) => {
    const originalLocalDirection = change.direction;
    const localVector = quarturnVectors[originalLocalDirection];
    const { x, y } = localVector;
    viewportChange = { x, y, a: 0 };
    cursor = addVectors(cursor, localVector);
    retainChunksAround();
  };

  const tick = () => {};

  const tock = () => {
    // Viewport reset.
    const { x, y, a } = viewportChange;
    viewportTransform = compose(
      viewportTransform,
      translate(scaleVector({ x, y }, -tileSizePx)),
      rotateQuarturn(4 + a),
    );
    positionCamera(matrixStyle(viewportTransform));
    viewportChange = { x: 0, y: 0, a: 0 };
    releaseChunks();
  };

  /**
   * @param {import('../../progress.js').Progress} progress
   */
  const animate = progress => {
    if (progress.linear > 1) {
      return;
    }

    animateChunks(progress);

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
