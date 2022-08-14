// @ts-check

import { assert } from './lib/assert.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeModel } from './model.js';

// Supported level types:
import { sizeDaiaLevel, makeDaiaLevel } from './daia/level.js';

/**
 * @typedef {object} Level
 * @prop {import('./file.js').Level} descriptor
 * @prop {number} size
 * @prop {import('./topology.js').AdvanceFn} advance
 * @prop {import('./topology.js').ToponymFn} toponym
 * @prop {import('./controller.js').CameraController} cameraController
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
    if (level.topology === 'daia') {
      return sizeDaiaLevel(level);
    }
    assert(false, `Unrecognized level topology ${level.topology}`);
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

  /** @type {import('./topology.js').AdvanceFn} */
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

  /** @type {Array<Level>} */
  const levels = snapshot.levels.map((level, i) => {
    if (level.topology === 'daia') {
      return makeDaiaLevel({
        level,
        offset: starts[i],
        frustumRadius,
        parentElement,
        nextSibling,
        tileSizePx,
        createEntity,
        worldModel,
        worldViewModel,
      });
    }
    assert(false, `Unrecognized level topology ${level.topology}`);
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
