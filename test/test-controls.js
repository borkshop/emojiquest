import test from 'ava';
import { makeDaia } from '../daia.js';
import { makeModel } from '../model.js';
import { makeMechanics } from '../mechanics.js';
import { makeController } from '../controls.js';
import { makeViewModel } from '../view-model.js';
import { makeMacroViewModel } from '../macro-view-model.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from '../data.js';

/**
 * @param {string} name
 * @param {any[]} lines
 */
const scenario = (name, lines) => {
  test(name, (/** @type {import('ava').ExecutionContext} t */ t) => {
    const world = makeDaia({
      faceSize: 3,
      tileSizePx: NaN,
    });

    /** @type {import('../tile-view.js').TileView} */
    const nineKeyTileView = {
      enter(entity) {
        t.log('9x9 enter', entity);
      },
      exit(entity) {
        t.log('9x9 exit', entity);
      },
    };

    /** @type {import('../tile-view.js').TileView} */
    const oneKeyTileView = {
      enter(entity) {
        t.log('1x1 enter', entity);
      },
      exit(entity) {
        t.log('1x1 exit', entity);
      },
    };

    /** @type {import('../view-model.js').PlaceFn} */
    const placeOneKey = (entity, coord, _pressure, _progress, _transition) => {
      t.log('1x1 place', entity, coord);
    };
    /** @type {import('../view-model.js').PlaceFn} */
    const placeNineKey = (entity, coord, _pressure, _progress, _transition) => {
      t.log('9x9 place', entity, coord);
    };

    const worldViewModel = makeViewModel();
    const worldMacroViewModel = makeMacroViewModel(worldViewModel);

    const mechanics = makeMechanics({
      recipes,
      actions,
      tileTypes,
      validAgentTypes,
      validItemTypes,
      validEffectTypes,
    });

    const worldModel = makeModel({
      size: world.worldArea,
      advance: world.advance,
      macroViewModel: worldMacroViewModel,
      mechanics,
    });

    const cursor = { position: 0, direction: 0 };

    const agent = worldModel.init(cursor.position);

    const cameraController = {
      move() {},
      jump() {},
      animate() {},
      tick() {},
      tock() {},
    };

    const { toponym, advance } = world;

    /**
     * @param {number} _destination
     * @param {import('../daia.js').CursorChange} _change
     */
    const followCursor = (_destination, _change) => {};

    const menuController = {
      goNorth() {},
      goSouth() {},
      getState() {
        return 'play';
      },
      show() {},
      hide() {},
      animate() {},
      tock() {},
    };

    const dialogController = {
      log() {},
      /** @param {string} message */
      logHTML(message) {
        t.log('logHTML', message);
      },
      close() {},
      animate() {},
      tock() {},
    };

    const healthController = {
      set() {},
      animate() {},
      tock() {},
    };

    const staminaController = {
      set() {},
      animate() {},
      tock() {},
    };

    const controller = makeController({
      nineKeyTileView,
      oneKeyTileView,
      placeOneKey,
      placeNineKey,
      agent,
      cursor,
      worldModel,
      worldMacroViewModel,
      cameraController,
      toponym,
      advance,
      followCursor,
      mechanics,
      menuController,
      dialogController,
      healthController,
      staminaController,
    });

    for (const line of lines) {
      t.log('line', line);
      const { command } = line;
      if (command !== undefined) {
        const { repeat } = line;
        controller.command(command, repeat);
      }
    }

    t.pass();
  });
};

scenario('rest', [{ command: 5 }]);

// TODO goal:
//
// const legend = {
//   '@': 'player',
//   T: 'appleTree',
// };
//
// scenario(
//   'bump apple tree with empty hand',
//   [
//     {
//       scene: `
//         ...
//         .@.
//         .T.
//       `,
//       face: 0,
//     },
//     { left: 'empty' },
//     { command: 2 },
//     { left: 'apple' },
//   ],
//   legend,
// );
