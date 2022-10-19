// @ts-check

import { fullQuarturn } from './lib/geometry2d.js';
import { cell } from './lib/cell.js';
import { parseJson } from './lib/json.js';
import {
  makeController,
  builtinTileText,
  builtinTileTypesByName,
} from './controller.js';
import {
  makeControllerElementWatchers,
  watchControllerCommands,
} from './controller-elements.js';
import { makeDriver } from './driver.js';

import { createDialogBox } from './dialog.js';
import { createMenuBlade } from './menu.js';
import { writeHealthBar } from './health.js';
import { writeStaminaBar } from './stamina.js';

import { makeWorld } from './world.js';
import { validate } from './file.js';

const svgNS = 'http://www.w3.org/2000/svg';

/** @typedef {import('./animation2d.js').Coord} Coord */

/**
 * @callback MakeEntityCreatorFn
 * @param {Array<string>} viewText
 * @returns {import('./world.js').CreateEntityFn}
 */

/** @type {MakeEntityCreatorFn} */
export const makeEntityCreator = viewText => {
  /** @type {import('./world.js').CreateEntityFn} */
  const createEntity = (_entity, type) => {
    if (type === -1) {
      const $entity = document.createElementNS(svgNS, 'circle');
      $entity.setAttributeNS(null, 'class', 'reticle');
      $entity.setAttributeNS(null, 'r', '0.75');
      return $entity;
    } else {
      const $entity = document.createElementNS(svgNS, 'g');
      const $text = document.createElementNS(svgNS, 'text');
      $text.setAttributeNS(null, 'class', 'moji');
      $text.appendChild(
        document.createTextNode(
          (type < -1 ? builtinTileText[-type - 2] : viewText[type]) || '�',
        ),
      );
      $entity.appendChild($text);
      return $entity;
    }
  };
  return createEntity;
};

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
const createControls = ({ tileSizePx }) => {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSizePx}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSizePx}`);
  $controls.setAttributeNS(null, 'class', 'panel controlPanel');
  return $controls;
};

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
const createHamburger = ({ tileSizePx }) => {
  const $hamburger = document.createElementNS(svgNS, 'svg');
  $hamburger.setAttributeNS(null, 'viewBox', `0 0 1 1`);
  $hamburger.setAttributeNS(null, 'height', `${1 * tileSizePx}`);
  $hamburger.setAttributeNS(null, 'width', `${1 * tileSizePx}`);
  $hamburger.setAttributeNS(null, 'class', 'panel hamburgerPanel');
  return $hamburger;
};

const main = async () => {
  const tileSizePx = 130; // the height and width of a tile in pixels
  const animatedTransitionDuration = 300;

  const createEntity = makeEntityCreator([]);

  const documentElement = document.documentElement;
  const parentElement = document.body;
  const nextSibling = null;

  documentElement.style.setProperty('--tileSizePx', `${tileSizePx}`);

  const $mapAnchor = document.createTextNode('');
  parentElement.insertBefore($mapAnchor, nextSibling);

  const { element: $dialogBox, controller: dialogController } =
    createDialogBox();
  parentElement.insertBefore($dialogBox, nextSibling);

  const { element: $staminaBar, controller: staminaController } =
    writeStaminaBar({
      tileSizePx,
      staminaTileType: builtinTileTypesByName.stamina,
      createElement: createEntity,
    });
  parentElement.insertBefore($staminaBar, nextSibling);

  const { element: $healthBar, controller: healthController } = writeHealthBar({
    tileSizePx,
    healthTileType: builtinTileTypesByName.health,
    createElement: createEntity,
  });
  parentElement.insertBefore($healthBar, nextSibling);

  const { $menuBlade, menuController } = createMenuBlade({
    tileSizePx,
    pointerTileType: builtinTileTypesByName.east,
    createElement: createEntity,
  });
  parentElement.appendChild($menuBlade);

  const $controls = createControls({ tileSizePx });
  parentElement.insertBefore($controls, nextSibling);

  const $hamburger = createHamburger({ tileSizePx });
  parentElement.insertBefore($hamburger, nextSibling);

  /**
   * The moment preserves the intended heading of the player agent if they
   * transit from one face of the world to another and suffer a forced
   * orientation change. For example, transiting over the north edge of the north
   * polar facet of the world implies a 180 degree rotation, so if the player
   * continues "north", they would otherwise bounce back and forth between the
   * top and back face of the world.  Preserving the moment allows northward
   * travel to translate to southward travel along the back face, until the
   * player releases the "north" key.
   */
  const moment = cell(0);

  /**
   * @param {number} _destination
   * @param {import('./topology.js').CursorChange} change
   */
  const followCursor = (_destination, change) => {
    moment.set((moment.get() + change.turn + fullQuarturn) % fullQuarturn);
  };

  const { nineKeyWatcher, oneKeyWatcher } = makeControllerElementWatchers(
    $controls,
    $hamburger,
    { createEntity },
  );

  let dispose = Function.prototype;

  /**
   * @param {unknown} allegedWholeWorldDescription
   */
  const playWorld = allegedWholeWorldDescription => {
    const result = validate(allegedWholeWorldDescription);
    if ('errors' in result) {
      let message = '';
      for (const error of result.errors) {
        message += `${error}<br>`;
        console.error(error);
      }
      dialogController.logHTML(message);
      // TODO abort load and return to previous world
      return;
    }
    const { snapshot, mechanics, wholeWorldDescription } = result;

    const createElement = makeEntityCreator(mechanics.viewText);
    nineKeyWatcher.reset(createElement);
    oneKeyWatcher.reset(createElement);

    // Dispose of prior world.
    dispose();

    const createEntity = makeEntityCreator(mechanics.viewText);

    const world = makeWorld(snapshot, parentElement, $mapAnchor, {
      tileSizePx,
      createEntity,
      mechanics,
    });

    dispose = world.dispose;

    const { player } = snapshot;
    controller.play(world, mechanics, player, wholeWorldDescription);
  };

  const types = [
    {
      description: 'Emoji Quest Game Save',
      accept: {
        'application/json': ['.json'],
      },
    },
  ];

  const loadWorld = async () => {
    const [handle] = await window.showOpenFilePicker({
      types,
      multiple: false,
    });
    if (handle !== undefined) {
      const file = await handle.getFile();
      const text = await file.text();
      const result = parseJson(text);
      if ('error' in result) {
        dialogController.log(`${result.error}`);
        console.error(result.error);
        return;
      }
      playWorld(result.value);
    }
    return;
  };

  /**
   * @param {import('./file.js').WholeWorldDescription} wholeWorldDescription
   */
  const saveWorld = async wholeWorldDescription => {
    const handle = await window.showSaveFilePicker({ types });
    const stream = await handle.createWritable();
    const text = `${JSON.stringify(wholeWorldDescription)}\n`;
    const blob = new Blob([text]);
    await stream.write(blob);
    await stream.close();
  };

  const controller = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    menuController,
    dialogController,
    healthController,
    staminaController,
    followCursor,
    loadWorld,
    saveWorld,
  });

  const driver = makeDriver(controller, {
    moment,
    animatedTransitionDuration,
  });

  watchControllerCommands(window, $controls, $hamburger, driver, {
    tileSizePx,
  });

  const response = await fetch(
    new URL('emojiquest/emojiquest.json', import.meta.url).href,
  );
  const allegedWholeWorldDescription = await response.json();
  playWorld(allegedWholeWorldDescription);
};

main();
