// @ts-check

import { assert } from './lib/assert.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeModel } from './model.js';

// Supported level types:
import * as daia from './topology/daia/level.js';
import * as torus from './topology/torus/level.js';

/**
 * @typedef {object} Level
 * @prop {import('./file.js').Level} descriptor
 * @prop {number} size
 * @prop {import('./topology.js').AdvanceFn} advance
 * @prop {import('./topology.js').ToponymFn} toponym
 * @prop {import('./controller.js').CameraController} cameraController
 * @prop {() => void} show
 * @prop {() => void} hide
 * @prop {() => void} dispose
 */

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
    const { topology } = level;
    if (topology === 'daia') {
      return daia.sizeLevel(level);
    } else if (topology === 'torus') {
      return torus.sizeLevel(level);
    }
    assert(false, `Unrecognized level topology ${topology}`);
  });

  // Aggregate data from layers.
  let size = 0;
  /** @type {Array<number>} */
  const offsets = [];
  for (const levelSize of levelSizes) {
    offsets.push(size);
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
    for (let index = offsets.length - 1; index >= 0; index -= 1) {
      const offset = offsets[index];
      if (global >= offset) {
        return {
          index,
          offset,
          level: levels[index],
          local: global - offset,
        };
      }
    }
    assert(false);
  };

  /** @type {import('./topology.js').AdvanceFn} */
  const advance = ({
    position: previousGlobalPosition,
    direction: previousDirection,
  }) => {
    // TODO consider binary search here, if many layers.
    for (let index = offsets.length - 1; index >= 0; index -= 1) {
      const start = offsets[index];
      if (previousGlobalPosition >= start) {
        const previousLocalPosition = previousGlobalPosition - start;
        const advanced = levels[index].advance({
          position: previousLocalPosition,
          direction: previousDirection,
        });
        if (advanced === undefined) {
          return undefined;
        }
        const {
          position: nextLocalPosition,
          direction: nextDirection,
          turn,
          transit,
        } = advanced;
        const nextGlobalPosition = nextLocalPosition + start;
        return {
          position: nextGlobalPosition,
          direction: nextDirection,
          turn,
          transit,
        };
      }
    }
    assert(false, `Starting position outside world: ${previousGlobalPosition}`);
  };

  const worldModel = makeModel({
    size,
    advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
    snapshot,
  });

  /** @type {Array<Level>} */
  const levels = snapshot.levels.map((level, i) => {
    const offset = offsets[i];

    /**
     * @param {Iterable<number>} locations
     * @param {(location: number) => void} watcher
     */
    const watchTerrain = (locations, watcher) => {
      return worldModel.watchTerrain(
        [...locations].map(location => location + offset),
        watcher,
      );
    };

    /**
     * @param {Iterable<number>} locations
     * @param {(location: number) => void} watcher
     */
    const unwatchTerrain = (locations, watcher) => {
      return worldModel.watchTerrain(
        [...locations].map(location => location + offset),
        watcher,
      );
    };

    /**
     * @param {number} location
     */
    const getTerrainFlags = location => {
      return worldModel.getTerrainFlags(location + offset);
    };

    /** @type {import('./view-model.js').EntityWatchFn} */
    const watchEntities = (tiles, watcher) => {
      return worldViewModel.watchEntities(
        new Map(
          [...tiles.entries()].map(([local, coord]) => [local + offset, coord]),
        ),
        watcher,
      );
    };

    /** @type {import('./view-model.js').EntityWatchFn} */
    const unwatchEntities = (tiles, watcher) => {
      return worldViewModel.unwatchEntities(
        new Map(
          [...tiles.entries()].map(([local, coord]) => [local + offset, coord]),
        ),
        watcher,
      );
    };

    const { topology } = level;
    if (topology === 'daia') {
      return daia.makeLevel({
        level,
        frustumRadius,
        parentElement,
        nextSibling,
        tileSizePx,
        createEntity,
        watchTerrain,
        unwatchTerrain,
        getTerrainFlags,
        watchEntities,
        unwatchEntities,
        colorNamePalettes: level.colors,
        colorsByName: snapshot.colorsByName,
      });
    } else if (topology === 'torus') {
      return torus.makeLevel({
        level,
        // frustumRadius,
        parentElement,
        nextSibling,
        tileSizePx,
        createEntity,
        watchTerrain,
        unwatchTerrain,
        getTerrainFlags,
        watchEntities,
        unwatchEntities,
        colorNamePalette: level.colors,
        colorsByName: snapshot.colorsByName,
      });
    }
    assert(false, `Unrecognized level topology ${topology}`);
  });

  /**
   * @param {number | undefined} player
   */
  const capture = player => {
    return {
      colors: Object.fromEntries(snapshot.colorsByName.entries()),
      levels: levels.map(({ descriptor }) => descriptor),
      ...worldModel.capture(player),
    };
  };

  /** @type {number | undefined} */
  let cursorLevel;
  /** @type {number | undefined} */
  let nextLevel;

  /** @param {number} top */
  const display = top => {
    for (let index = 0; index < top; index += 1) {
      levels[index].hide();
    }
    levels[top].show();
    for (let index = top + 1; index < levels.length; index += 1) {
      levels[index].hide();
    }
  };

  /** @type {import('./controller.js').CameraController} */
  const cameraController = {
    jump(global) {
      // TODO detect level change, hide map, show map,
      // convert jump to enter and exit if necessary.
      const { level, local, index } = locate(global);
      if (cursorLevel !== index) {
        cursorLevel = index;
        nextLevel = index;
      }
      return level.cameraController.jump(local);
    },
    move(global, change) {
      const { level, local } = locate(global);
      return level.cameraController.move(local, change);
    },
    animate(progress) {
      if (nextLevel !== undefined && progress.linear >= 0.5) {
        display(nextLevel);
        nextLevel = undefined;
      }
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
      if (nextLevel !== undefined) {
        display(nextLevel);
        nextLevel = undefined;
      }
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
