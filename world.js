// @ts-check

import { assert } from './lib/assert.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeModel } from './model.js';

// Supported level types:
import * as daia from './topology/daia/level.js';
import * as torus from './topology/torus/level.js';
import * as rect from './topology/rect/level.js';

/**
 * @typedef {object} LevelView
 * @prop {import('./controller.js').CameraController} cameraController
 * @prop {() => void} show
 * @prop {() => void} hide
 * @prop {() => void} dispose
 */

/**
 * @typedef {object} Level
 * @prop {import('./file.js').Level} descriptor
 * @prop {number} size
 * @prop {import('./types.js').AdvanceFn} advance
 * @prop {import('./types.js').ToponymFn} toponym
 * @prop {(args: { parentElement: Node, nextSibling: Node }) => LevelView} makeView
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
    } else if (topology === 'rect') {
      return rect.sizeLevel(level);
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

  /** @type {import('./types.js').AdvanceFn} */
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
  const levels = snapshot.levels.map((level, index) => {
    const offset = offsets[index];

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

    /** @type {import('./types.js').WatchEntitiesFn} */
    const watchEntities = (tiles, watcher) => {
      return worldViewModel.watchEntities(
        new Map(
          [...tiles.entries()].map(([local, coord]) => [local + offset, coord]),
        ),
        watcher,
      );
    };

    /** @type {import('./types.js').WatchEntitiesFn} */
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
        offset,
        level,
        frustumRadius,
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
        offset,
        level,
        // frustumRadius,
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
    } else if (topology === 'rect') {
      return rect.makeLevel({
        offset,
        level,
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

  /** @type {LevelView | undefined} */
  let currentLevelView;
  /** @type {LevelView | undefined} */
  let nextLevelView;

  let currentLevelIndex = -1;
  let nextLevelIndex = -1;

  // /** @param {number} top */
  // const display = top => {
  //   for (let index = 0; index < top; index += 1) {
  //     levels[index].hide();
  //   }
  //   levels[top].show();
  //   for (let index = top + 1; index < levels.length; index += 1) {
  //     levels[index].hide();
  //   }
  // };

  const squash = () => {
    if (nextLevelView !== undefined) {
      if (currentLevelView !== undefined) {
        currentLevelView.dispose();
      }
      currentLevelView = nextLevelView;
      currentLevelIndex = nextLevelIndex;
      currentLevelView.show(); // XXX may not be necessary anymore
      nextLevelView = undefined;
      nextLevelIndex = -1;
    }
  };

  /** @type {import('./controller.js').CameraController} */
  const cameraController = {
    jump(global) {
      const { level, local, index } = locate(global);
      if (currentLevelView === undefined) {
        currentLevelView = level.makeView({
          parentElement,
          nextSibling,
        });
        currentLevelIndex = index;
        currentLevelView.cameraController.jump(local);
      } else {
        squash();
        if (currentLevelIndex === index) {
          currentLevelView.cameraController.jump(local);
        }
        nextLevelView = level.makeView({
          parentElement,
          nextSibling,
        });
        nextLevelIndex = index;
        nextLevelView.cameraController.jump(local);
        nextLevelView.hide();
      }
    },
    move(global, change) {
      const { index, local } = locate(global);
      if (currentLevelView !== undefined && currentLevelIndex === index) {
        currentLevelView.cameraController.move(local, change);
      }
      if (nextLevelView !== undefined && nextLevelIndex === index) {
        nextLevelView.cameraController.move(local, change);
      }
    },
    animate(progress) {
      if (nextLevelView !== undefined) {
        if (progress.linear >= 0.5) {
          if (currentLevelView !== undefined) {
            currentLevelView.hide();
          }
          nextLevelView.show();
        }
        nextLevelView.cameraController.animate(progress);
      }
      if (currentLevelView !== undefined) {
        currentLevelView.cameraController.animate(progress);
      }
    },
    tick() {
      if (nextLevelView !== undefined) {
        nextLevelView.cameraController.tick();
      }
      if (currentLevelView !== undefined) {
        currentLevelView.cameraController.tick();
      }
    },
    tock() {
      squash();
      if (currentLevelView !== undefined) {
        currentLevelView.cameraController.tock();
      }
    },
  };

  /** @param {number} global */
  const toponym = global => {
    const { level, local } = locate(global);
    return level.toponym(local);
  };

  const dispose = () => {
    if (currentLevelView !== undefined) {
      currentLevelView.dispose();
      currentLevelView = undefined;
    }
    if (nextLevelView !== undefined) {
      nextLevelView.dispose();
      nextLevelView = undefined;
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
