// @ts-check

import { assert } from './assert.js';
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
  const frustumRadius = 10;

  const levelSizes = snapshot.levels.map(level => {
    const { facetsPerFace, tilesPerFacet } = level;
    const tilesPerFace = tilesPerFacet * facetsPerFace;

    const tileDaia = makeDaia({
      tileSizePx,
      faceSize: tilesPerFace,
    });

    return tileDaia.worldArea;
  });

  // Aggregate data from layers.
  let size = 0;
  /** @type {Array<number>} */
  const starts = [];
  for (const levelSize of levelSizes) {
    starts.push(size);
    size += levelSize;
  }

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel, {
    name: 'world',
  });

  /**
   * @param {number} global
   */
  const locate = global => {
    for (let i = 0; i < starts.length; i += 1) {
      const start = starts[i];
      if (global >= start) {
        return {
          level: levels[i],
          local: global - start,
        };
      }
    }
    assert(false);
  };

  /** @type {import('./daia.js').AdvanceFn} */
  const advance = ({
    position: previousGlobalPosition,
    direction: previousDirection,
  }) => {
    // TODO consider binary search here, if many layers.
    for (let i = 0; i < starts.length; i += 1) {
      const start = starts[i];
      if (previousGlobalPosition > start) {
        const previousLocalPosition = previousGlobalPosition - start;
        const {
          position: nextLocalPosition,
          direction: nextDirection,
          turn,
          transit,
        } = levels[i].advance({
          position: previousLocalPosition - start,
          direction: previousDirection,
        });
        const nextGlobalPosition = nextLocalPosition + start;
        return {
          position: nextGlobalPosition,
          direction: nextDirection,
          turn,
          transit,
        };
      }
    }
    assert(false);
  };

  const worldModel = makeModel({
    size,
    advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
    snapshot,
  });

  const levels = snapshot.levels.map((level, i) => {
    const { facetsPerFace, tilesPerFacet } = level;
    const tilesPerFace = tilesPerFacet * facetsPerFace;

    const facetSizePx = tilesPerFacet * tileSizePx;

    /**
     * @param {Iterable<number>} locations
     * @param {(location: number) => void} watcher
     */
    const watchTerrain = (locations, watcher) => {
      return worldModel.watchTerrain(
        [...locations].map(location => location + starts[i]),
        watcher,
      );
    };

    /**
     * @param {Iterable<number>} locations
     * @param {(location: number) => void} watcher
     */
    const unwatchTerrain = (locations, watcher) => {
      return worldModel.watchTerrain(
        [...locations].map(location => location + starts[i]),
        watcher,
      );
    };

    /**
     * @param {number} location
     */
    const getTerrainFlags = location => {
      return worldModel.getTerrainFlags(location + starts[i]);
    };

    /** @type {import('./view-model.js').EntityWatchFn} */
    const watchEntities = (tiles, watcher) => {
      return worldViewModel.watchEntities(
        new Map(
          [...tiles.entries()].map(([local, coord]) => [
            local + starts[i],
            coord,
          ]),
        ),
        watcher,
      );
    };

    /** @type {import('./view-model.js').EntityWatchFn} */
    const unwatchEntities = (tiles, watcher) => {
      return worldViewModel.unwatchEntities(
        new Map(
          [...tiles.entries()].map(([local, coord]) => [
            local + starts[i],
            coord,
          ]),
        ),
        watcher,
      );
    };

    // Model

    const faceDaia = makeDaia({
      tileSizePx, // presumed irrelevant
      faceSize: 1,
    });

    const facetDaia = makeDaia({
      tileSizePx, // presumed irrelevant
      faceSize: facetsPerFace,
    });

    const tileDaia = makeDaia({
      tileSizePx,
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

      faceSizePx: tileDaia.faceSizePx,
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

    const dispose = () => {
      $map.remove();
    };

    return {
      descriptor: {
        topology: 'daia',
        facetsPerFace,
        tilesPerFacet,
      },
      size: tileDaia.worldArea,
      advance: tileDaia.advance,
      cameraController,
      toponym,
      dispose,
    };
  });

  /**
   * @param {number | undefined} player
   */
  const capture = player => {
    return {
      levels: levels.map(({ descriptor }) => descriptor),
      ...worldModel.capture(player),
    };
  };

  /** @type {import('./controller.js').CameraController} */
  const cameraController = {
    jump(global) {
      const { level, local } = locate(global);
      return level.cameraController.jump(local);
    },
    move(global, change) {
      const { level, local } = locate(global);
      return level.cameraController.move(local, change);
    },
    animate(progress) {
      for (const { cameraController } of levels) {
        cameraController.animate(progress);
      }
    },
    tick() {
      for (const { cameraController } of levels) {
        cameraController.tick();
      }
    },
    tock() {
      for (const { cameraController } of levels) {
        cameraController.tock();
      }
    },
  };

  /** @param {number} global */
  const toponym = global => {
    const { level, local } = locate(global);
    return level.toponym(local);
  };

  const dispose = () => {
    for (const { dispose } of levels) {
      dispose();
    }
  };

  const world = {
    worldModel,
    worldMacroViewModel,
    cameraController,
    toponym,
    advance,
    capture,
    dispose,
  };

  return world;
};
