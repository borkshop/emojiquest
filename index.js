// @ts-check

import { assumeDefined } from './lib/assert.js';
import { fullQuarturn } from './lib/geometry2d.js';
import { cell } from './lib/cell.js';
import { parseJson } from './lib/json.js';
import {
  makeController,
  builtinTileText,
  builtinTileTextByName,
  builtinTileTypesByName,
} from './controller.js';
import {
  makeControllerElementWatchers,
  watchControllerCommands,
} from './controller-elements.js';
import { makeDriver } from './driver.js';

import { createDialogBox } from './dialog.js';
import { writeHealthBar } from './health.js';
import { writeStaminaBar } from './stamina.js';

import { makeRotatingElementController } from './rotator.js';
import { makeClock } from './clock.js';

import { makeWorld } from './world.js';
import { validate, format } from './file.js';

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
  const $element = document.createElementNS(svgNS, 'svg');
  $element.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $element.setAttributeNS(null, 'height', `${3 * tileSizePx}`);
  $element.setAttributeNS(null, 'width', `${3 * tileSizePx}`);
  $element.setAttributeNS(null, 'class', 'panel controlPanel');
  const controller = makeRotatingElementController($element, 1);
  return { $element, controller };
};

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
const createHamburger = ({ tileSizePx }) => {
  const $element = document.createElementNS(svgNS, 'svg');
  $element.setAttributeNS(null, 'viewBox', `0 0 1 1`);
  $element.setAttributeNS(null, 'height', `${1 * tileSizePx}`);
  $element.setAttributeNS(null, 'width', `${1 * tileSizePx}`);
  $element.setAttributeNS(null, 'class', 'panel hamburgerPanel');
  const controller = makeRotatingElementController($element, -1);
  return { $element, controller };
};

const main = async () => {
  const tileSizePx = 130; // the height and width of a tile in pixels
  const animatedTransitionDuration = 300;

  const createEntity = makeEntityCreator([]);

  const documentElement = document.documentElement;
  const bodyElement = document.body;

  const playElement = document.createElement('div');
  playElement.className = 'play';
  bodyElement.insertBefore(playElement, null);
  const lastPlayChild = null;

  const scrimElement = document.createElement('div');
  scrimElement.className = 'scrim';
  scrimElement.style.display = 'none';
  bodyElement.appendChild(scrimElement);

  documentElement.style.setProperty('--tileSizePx', `${tileSizePx}`);

  const $mapAnchor = document.createTextNode('');
  playElement.insertBefore($mapAnchor, lastPlayChild);

  const { element: $dialogBox, controller: dialogController } =
    createDialogBox();
  playElement.insertBefore($dialogBox, lastPlayChild);

  const { element: $staminaBar, controller: staminaController } =
    writeStaminaBar({
      tileSizePx,
      staminaTileType: builtinTileTypesByName.stamina,
      createElement: createEntity,
    });
  playElement.insertBefore($staminaBar, lastPlayChild);

  const { element: $healthBar, controller: healthController } = writeHealthBar({
    tileSizePx,
    healthTileType: builtinTileTypesByName.health,
    createElement: createEntity,
  });
  playElement.insertBefore($healthBar, lastPlayChild);

  const { $element: $controls, controller: controlsController } =
    createControls({ tileSizePx });
  playElement.insertBefore($controls, lastPlayChild);

  const { $element: $hamburger, controller: hamburgerController } =
    createHamburger({ tileSizePx });
  playElement.insertBefore($hamburger, lastPlayChild);

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
   * @param {import('./types.js').CursorChange} change
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
   * @param {string} [slot]
   */
  const playAllegedWorldDescription = (allegedWholeWorldDescription, slot) => {
    const result = validate(allegedWholeWorldDescription);
    if ('errors' in result) {
      let message = '';
      for (const error of result.errors) {
        message += `${error}<br>`;
        console.error(error);
      }
      dialogController.logHTML(message);
      return;
    }
    const { snapshot, mechanics, meta } = result;

    const { world } = playWorld(meta, snapshot, mechanics);

    const { player } = snapshot;

    return {
      world,
      mechanics,
      player,
      meta,
      slot,
    };
  };

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot | undefined} snapshot
   * @param {import('./mechanics.js').Mechanics} mechanics
   */
  const playWorld = (meta, snapshot, mechanics) => {
    const createElement = makeEntityCreator(mechanics.viewText);
    nineKeyWatcher.reset(createElement);
    oneKeyWatcher.reset(createElement);

    // Dispose of prior world.
    dispose();

    const createEntity = makeEntityCreator(mechanics.viewText);

    const world = makeWorld(meta, snapshot, playElement, $mapAnchor, {
      tileSizePx,
      createEntity,
      mechanics,
    });

    dispose = world.dispose;

    return { world };
  };

  const types = [
    {
      description: 'Emoji Quest Game Save',
      accept: {
        'application/json': ['.json'],
      },
    },
  ];

  const slotOptions = () => {
    /** @type {Record<string, string>} */
    const options = {};
    if (window.localStorage !== undefined) {
      let index = 0;
      for (const key of Object.keys(window.localStorage)) {
        const match = /^emojiquest:(slot:(.*))$/.exec(key);
        if (match) {
          const [_, name, label] = match;
          options[name] = `${(index % 10) + 1}\ufe0f\u20e3 ${label}`;
          index += 1;
        }
      }
    }
    return options;
  };

  /**
   * @param {string} [slot]
   */
  async function* loadWorld(slot) {
    if (slot === undefined) {
      /** @type {Record<string, string>} */
      const options = slotOptions();
      if (window.showOpenFilePicker !== undefined) {
        options.file = '💾 File';
      }

      slot = await choose(options);

      if (slot === undefined) {
        return undefined;
      }
    }

    return await loadWorldSlot(slot);
  }

  /**
   * @param {Record<string, string>} options
   */
  async function chooseNewOrOldSlot(options) {
    let slot = await choose(options);

    if (slot === 'new') {
      const name = await input({ placeholder: 'name' });
      if (name === undefined) {
        return;
      }
      slot = `slot:${name}`;
    }

    return slot;
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   */
  async function* slotsMenu(meta, snapshot) {
    const options = slotOptions();
    options.new = '🎰 New Slot';
    const slot = await chooseNewOrOldSlot(options);

    if (slot === undefined) {
      return undefined;
    }

    return yield* slotMenu(meta, snapshot, slot);
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {string} slot
   */
  async function* slotMenu(meta, snapshot, slot) {
    const key = `emojiquest:${slot}`;

    /** @type {Record<string, string>} */
    const options = Object.create(null);
    options.save = '🛟  Save  '; //  🏦
    if (localStorage.getItem(key)) {
      options.load = '🛻  Load'; // 🚜 🏗
    }
    options.delete = '🪓  Delete'; // 💣 🧨
    const choice = await choose(options);

    if (choice === undefined) {
      return undefined;
    } else if (choice === 'save') {
      await saveWorldSlot(meta, snapshot, slot);
      return undefined;
    } else if (choice === 'load') {
      return loadWorldSlot(slot);
    } else if (choice === 'delete') {
      deleteWorldSlot(slot);
      return undefined;
    } else {
      throw new Error('not reachable');
    }
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {string | undefined} slot
   */
  async function saveWorldSlot(meta, snapshot, slot) {
    const json = format(meta, snapshot);
    const text = `${JSON.stringify(json)}\n`;

    if (slot === 'file') {
      scrimElement.style.display = 'block';
      try {
        let handle;
        try {
          handle = await window.showSaveFilePicker({ types });
        } catch (error) {
          return undefined;
        }
        const stream = await handle.createWritable();
        const blob = new Blob([text]);
        await stream.write(blob);
        await stream.close();
        return slot;
      } finally {
        scrimElement.style.display = 'none';
      }
    } else {
      localStorage.setItem(`emojiquest:${slot}`, text);
      return slot;
    }
  }

  /**
   * @param {string | undefined} slot
   */
  async function loadWorldSlot(slot) {
    scrimElement.style.display = 'block';
    try {
      if (slot === 'file') {
        let handle;
        try {
          [handle] = await window.showOpenFilePicker({
            types,
            multiple: false,
          });
        } catch (error) {
          dialogController.log(`⚠️ No new world selected.`);
          console.error(error);
          return undefined;
        }
        if (handle !== undefined) {
          const file = await handle.getFile();
          const text = await file.text();
          const result = parseJson(text);
          if ('error' in result) {
            dialogController.log(`${result.error}`);
            console.error(result.error);
            return;
          }
          return playAllegedWorldDescription(result.value, slot);
        }
        return;
      } else {
        const text = assumeDefined(localStorage.getItem(`emojiquest:${slot}`));
        const result = parseJson(text);
        if ('error' in result) {
          dialogController.log(`${result.error}`);
          console.error(result.error);
          return undefined;
        }
        return playAllegedWorldDescription(result.value, slot);
      }
    } finally {
      scrimElement.style.display = 'none';
    }
  }

  /**
   * @param {string} slot
   */
  function deleteWorldSlot(slot) {
    const key = `emojiquest:${slot}`;
    localStorage.removeItem(key);
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {string} [slot]
   */
  async function* saveWorld(meta, snapshot, slot) {
    if (slot === undefined) {
      const options = slotOptions();
      options.new = '🎰 New Slot';
      if (window.showOpenFilePicker !== undefined) {
        options.file = '💾 File';
      }
      slot = await chooseNewOrOldSlot(options);
    }

    if (slot === undefined) {
      return undefined;
    }

    return saveWorldSlot(meta, snapshot, slot);
  }

  async function createWorld() {
    const response = await fetch(
      new URL('emojiquest/emojiquest.json', import.meta.url).href,
      { cache: 'no-cache' },
    );
    const allegedWholeWorldDescription = await response.json();
    return playAllegedWorldDescription(allegedWholeWorldDescription);
  }

  /**
   * @param {Record<string, string>} options
   * @param {string} [label]
   */
  const choose = async (options, label) => {
    driver.cancel();

    const values = Object.keys(options);
    if (values.length === 0) {
      return undefined;
    }

    controlsController.hide();
    hamburgerController.hide();
    scrimElement.style.display = 'block';
    document.documentElement.style.overflow = 'auto';

    const menuElement = document.createElement('div');
    menuElement.className = 'menu';
    document.body.appendChild(menuElement);

    const choiceElement = document.createElement('div');
    choiceElement.className = 'choice';
    menuElement.appendChild(choiceElement);

    let labelOffset = 0;
    if (label !== undefined) {
      const labelElement = document.createElement('div');
      labelElement.innerText = label;
      labelElement.className = 'label';
      choiceElement.appendChild(labelElement);
      labelOffset = 1;
    }

    let index = 0;
    let match = '';
    /** @type {Array<string>} */
    const search = [];
    /** @type {Array<Element>} */
    const optionElements = [];
    for (const [value, label] of Object.entries(options)) {
      const optionElement = document.createElement('div');
      optionElement.className = 'option';
      optionElement.innerText = label;
      optionElement.dataset.value = value;
      optionElement.style.setProperty('--index', `${index + labelOffset}`);
      choiceElement.appendChild(optionElement);
      optionElements.push(optionElement);
      index += 1;
      search.push(value.replace(/\W/g, '').toLowerCase());
    }

    let cursor = 0;
    const cursorElement = document.createElement('div');
    cursorElement.innerText = builtinTileTextByName.east;
    cursorElement.className = 'cursor';
    cursorElement.style.setProperty('--index', `${cursor + labelOffset}`);
    choiceElement.appendChild(cursorElement);

    /** @type {(value: string | undefined) => void} */
    let resolve;
    /** @type {Promise<string | undefined>} */
    const promise = new Promise(res => (resolve = res));

    /** @param {Event} event */
    const onClick = event => {
      const value = /** @type {HTMLElement} */ (event?.target)?.dataset?.value;
      // undefined if clicked a non-option
      resolve(value);
    };

    /** @param {number} index */
    const scrollTo = index => {
      cursor = index;
      cursorElement.style.setProperty('--index', `${cursor + labelOffset}`);
      if (index === 0) {
        scrimElement.scrollTop = 0;
      } else {
        optionElements[cursor].scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest',
        });
      }
    };

    /** @param {KeyboardEvent} event */
    const onKeyDown = event => {
      const { key, ctrlKey, altKey, metaKey } = event;
      if (ctrlKey || altKey || metaKey) {
        return;
      }
      if (key === 'Escape') {
        resolve(undefined);
      } else if (key === 'Enter') {
        resolve(values[cursor]);
      } else if (key === 'ArrowUp') {
        scrollTo((values.length + cursor - 1) % values.length);
      } else if (key === 'ArrowDown') {
        scrollTo((cursor + 1) % values.length);
      } else if (/^\w$/.test(key)) {
        match = match + key.toLowerCase();
        SEARCH: while (match.length > 0) {
          for (let index = 0; index < values.length; index += 1) {
            if (search[index].slice(0, match.length) === match) {
              scrollTo(index);
              break SEARCH;
            }
          }
          match = match.slice(1);
        }
      } else if (key === 'Tab') {
        SEARCH: while (match.length > 0) {
          for (let offset = 0; offset < values.length; offset += 1) {
            const index = (cursor + offset + 1) % values.length;
            if (search[index].slice(0, match.length) === match) {
              scrollTo(index);
              break SEARCH;
            }
          }
          match = match.slice(1);
        }
      } else {
        return;
      }
      event.stopPropagation();
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    choiceElement.addEventListener('click', onClick);

    const choice = await promise;

    window.removeEventListener('keydown', onKeyDown);
    choiceElement.removeEventListener('click', onClick);

    menuElement.remove();
    scrimElement.style.display = 'none';
    controlsController.show();
    hamburgerController.show();
    scrimElement.scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';

    return choice;
  };

  /**
   * @param {object} [options]
   * @param {string} [options.placeholder]
   * @param {string} [options.initial]
   * @param {string} [options.type]
   */
  const input = async ({
    placeholder = '',
    initial = '',
    type = 'text',
  } = {}) => {
    driver.cancel();

    controlsController.hide();
    hamburgerController.hide();
    scrimElement.style.display = 'block';

    const menuElement = document.createElement('div');
    menuElement.className = 'menu';
    document.body.appendChild(menuElement);

    const inputElement = document.createElement('input');
    inputElement.className = 'input';
    inputElement.placeholder = placeholder;
    inputElement.value = initial;
    inputElement.type = type;
    menuElement.appendChild(inputElement);

    /** @type {(value: string | undefined) => void} */
    let resolve;
    /** @type {Promise<string | undefined>} */
    const promise = new Promise(res => (resolve = res));

    /** @param {Event} event */
    const onChange = event => {
      resolve(inputElement.value);
      event.stopPropagation();
    };

    /** @param {KeyboardEvent} event */
    const onKeyup = event => {
      if (event.key === 'Escape') {
        resolve(undefined);
        event.stopPropagation();
      }
    };

    inputElement.addEventListener('change', onChange);
    inputElement.addEventListener('keyup', onKeyup);
    inputElement.select();

    await promise;

    inputElement.removeEventListener('change', onChange);
    inputElement.removeEventListener('keyup', onKeyup);

    menuElement.remove();
    scrimElement.style.display = 'none';
    controlsController.show();
    hamburgerController.show();

    return promise;
  };

  const supplementaryAnimation = makeClock();
  supplementaryAnimation.add(controlsController);
  supplementaryAnimation.add(hamburgerController);
  supplementaryAnimation.add(healthController);
  supplementaryAnimation.add(staminaController);

  const controller = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    dialogController,
    healthController,
    staminaController,
    followCursor,
    loadWorld,
    saveWorld,
    slotsMenu,
    playWorld,
    createWorld,
    choose,
    input,
    supplementaryAnimation,
  });

  const driver = makeDriver(controller, {
    moment,
    animatedTransitionDuration,
  });

  watchControllerCommands(window, $controls, $hamburger, driver, {
    tileSizePx,
  });

  // Disable double-tap to zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    event => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false,
  );

  const { world, mechanics, player, meta } = assumeDefined(await createWorld());
  controller.play(world, mechanics, player, meta);
};

main();
