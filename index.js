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
const autoSaveKey = 'emojiquest:autosave';

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

  const scrimElement = document.createElement('div');
  scrimElement.className = 'scrim';
  scrimElement.style.display = 'none';
  bodyElement.appendChild(scrimElement);

  documentElement.style.setProperty('--tileSizePx', `${tileSizePx}`);

  const $mapAnchor = document.createTextNode('');
  playElement.insertBefore($mapAnchor, null);

  const { element: $dialogBox, controller: dialogController } =
    createDialogBox();
  playElement.insertBefore($dialogBox, null);

  const { element: $staminaBar, controller: staminaController } =
    writeStaminaBar({
      tileSizePx,
      staminaTileType: builtinTileTypesByName.stamina,
      createElement: createEntity,
    });
  playElement.insertBefore($staminaBar, null);

  const { element: $healthBar, controller: healthController } = writeHealthBar({
    tileSizePx,
    healthTileType: builtinTileTypesByName.health,
    createElement: createEntity,
  });
  playElement.insertBefore($healthBar, null);

  const { $element: $controls, controller: controlsController } =
    createControls({ tileSizePx });
  playElement.insertBefore($controls, null);

  const { $element: $hamburger, controller: hamburgerController } =
    createHamburger({ tileSizePx });
  playElement.insertBefore($hamburger, null);

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
   * @param {number} [slot]
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

  const saveSlotOptions = () => {
    /** @type {Record<string, string>} */
    const options = {};
    if (window.localStorage !== undefined) {
      for (let index = 0; index < 4; index += 1) {
        const name = `${index + 1}`;
        const labelKey = `emojiquest:slot-label:${index}`;
        const label = window.localStorage[labelKey] ?? '🫙 Empty<br>☆☆☆☆☆☆';
        options[name] = `🎰 ${(index % 10) + 1}\ufe0f\u20e3 ${label}`;
      }
    }
    if (window.showOpenFilePicker !== undefined) {
      options.file = '💾 File';
    }
    return options;
  };

  const loadSlotOptions = () => {
    /** @type {Record<string, string>} */
    const options = {};
    if (window.localStorage !== undefined) {
      for (let index = 0; index < 4; index += 1) {
        const name = `${index + 1}`;
        const key = `emojiquest:slot:${index}`;
        if (Object.prototype.hasOwnProperty.call(window.localStorage, key)) {
          const labelKey = `emojiquest:slot-label:${index}`;
          const label = window.localStorage[labelKey] ?? '';
          options[name] = `🎰${(index % 10) + 1}\ufe0f\u20e3 ${label}`;
        }
      }
    }
    if (window.showOpenFilePicker !== undefined) {
      options.file = '💾 File';
    }
    return options;
  };
  /**
   * @param {number} [slot]
   */
  async function* loadWorld(slot) {
    /** @type {Record<string, string>} */
    const options = loadSlotOptions();
    const choice = await choose(options, {
      optionClass: 'halfOption',
      initial: slot !== undefined ? `${slot + 1}` : undefined,
    });

    if (choice === undefined) {
      return undefined;
    } else if (choice === 'file') {
      return await loadWorldFile();
    } else {
      const slot = +choice - 1;
      return await loadWorldSlot(slot);
    }
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {number} slot
   * @param {string} label
   */
  function saveWorldSlot(meta, snapshot, slot, label) {
    const json = format(meta, snapshot);
    const text = `${JSON.stringify(json)}\n`;
    localStorage.setItem(`emojiquest:slot:${slot}`, text);
    localStorage.setItem(`emojiquest:slot-label:${slot}`, label);
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   */
  function autoSaveWorld(meta, snapshot) {
    const json = format(meta, snapshot);
    const text = `${JSON.stringify(json)}\n`;
    localStorage.setItem(autoSaveKey, text);
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   */
  async function saveWorldFile(meta, snapshot) {
    const json = format(meta, snapshot);
    const text = `${JSON.stringify(json)}\n`;

    scrimElement.style.display = 'block';
    try {
      let handle;
      try {
        handle = await window.showSaveFilePicker({ types });
      } catch (error) {
        return;
      }
      const stream = await handle.createWritable();
      const blob = new Blob([text]);
      await stream.write(blob);
      await stream.close();
    } finally {
      scrimElement.style.display = 'none';
    }
  }

  /**
   * @param {number} slot
   */
  async function loadWorldSlot(slot) {
    const text = assumeDefined(localStorage.getItem(`emojiquest:slot:${slot}`));
    const result = parseJson(text);
    if ('error' in result) {
      dialogController.log(`${result.error}`);
      console.error(result.error);
      return undefined;
    }
    return playAllegedWorldDescription(result.value, slot);
  }

  async function loadWorldFile() {
    scrimElement.style.display = 'block';
    try {
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
          return undefined;
        }
        return playAllegedWorldDescription(result.value);
      }
      return undefined;
    } finally {
      scrimElement.style.display = 'none';
    }
  }

  /**
   * @param {import('./schema-types.js').WorldMetaDescription} meta
   * @param {import('./types.js').Snapshot} snapshot
   * @param {number | undefined} slot
   * @param {string} label
   * @return {AsyncGenerator<undefined, number | undefined>}
   */
  async function* saveWorld(meta, snapshot, slot, label) {
    const options = saveSlotOptions();
    const choice = await choose(options, {
      initial: slot !== undefined ? `${slot + 1}` : undefined,
      optionClass: 'halfOption',
    });
    if (choice === undefined) {
      return slot;
    }
    if (choice === 'file') {
      await saveWorldFile(meta, snapshot);
      return undefined;
    }
    slot = +choice - 1;
    saveWorldSlot(meta, snapshot, slot, label);
    return slot;
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
   * @param {object} [opts]
   * @param {string} [opts.label]
   * @param {string} [opts.initial]
   * @param {string} [opts.optionClass]
   * @param {string} [opts.optionsClass]
   */
  const choose = async (options, opts = {}) => {
    const {
      label = undefined,
      initial = undefined,
      optionClass = undefined,
      optionsClass = undefined,
    } = opts;

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

    const cancelElement = document.createElement('div');
    cancelElement.innerText = '🚫';
    cancelElement.className = 'cancel';
    document.body.appendChild(cancelElement);

    const choiceElement = document.createElement('div');
    if (optionsClass !== undefined) {
      choiceElement.classList.add(optionsClass);
    }
    choiceElement.classList.add('choice');
    menuElement.appendChild(choiceElement);

    let labelOffset = 0;
    if (label !== undefined) {
      const labelElement = document.createElement('div');
      labelElement.innerHTML = label;
      labelElement.className = 'label';
      choiceElement.appendChild(labelElement);
      labelOffset = 1;
    }

    let initialIndex = 0;
    let index = 0;
    let match = '';
    /** @type {Array<string>} */
    const search = [];
    /** @type {Array<Element>} */
    const optionElements = [];
    for (const [value, label] of Object.entries(options)) {
      if (value === initial) {
        initialIndex = index;
      }
      const optionElement = document.createElement('div');
      if (optionClass !== undefined) {
        optionElement.classList.add(optionClass);
      }
      optionElement.classList.add('option');
      optionElement.innerHTML = label;
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

    scrollTo(initialIndex);

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

    const onCancel = () => {
      resolve(undefined);
    };

    window.addEventListener('keydown', onKeyDown);
    choiceElement.addEventListener('click', onClick);
    cancelElement.addEventListener('click', onCancel);

    const choice = await promise;

    window.removeEventListener('keydown', onKeyDown);
    choiceElement.removeEventListener('click', onClick);
    cancelElement.removeEventListener('click', onCancel);

    menuElement.remove();
    cancelElement.remove();
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

    const cancelElement = document.createElement('div');
    cancelElement.innerText = '🚫';
    cancelElement.className = 'cancel';
    document.body.appendChild(cancelElement);

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

    const onCancel = () => {
      resolve(undefined);
    };

    inputElement.addEventListener('change', onChange);
    inputElement.addEventListener('keyup', onKeyup);
    cancelElement.addEventListener('click', onCancel);

    inputElement.select();

    await promise;

    inputElement.removeEventListener('change', onChange);
    inputElement.removeEventListener('keyup', onKeyup);
    cancelElement.removeEventListener('click', onCancel);

    menuElement.remove();
    cancelElement.remove();
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
    autoSaveWorld,
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

  const playable = assumeDefined(
    Object.prototype.hasOwnProperty.call(window.localStorage, autoSaveKey)
      ? playAllegedWorldDescription(
          JSON.parse(assumeDefined(window.localStorage.getItem(autoSaveKey))),
        )
      : await createWorld(),
  );
  const { world, mechanics, player, meta } = playable;
  controller.play(world, mechanics, player, meta);
};

main();
