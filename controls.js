// @ts-check

import {nn, ne, ee, se, ss, sw, ww, nw} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {viewText, tileTypesByName, itemTypes, itemTypesByName} from './data.js';
import {commandDirection} from './driver.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */
/** @typedef {ReturnType<makeController>} Controls */

/**
 * @param {any} condition
 * @returns {asserts condition}
 */
function assert(condition) {
  if (!condition) {
    throw new Error(`Assertion failed`);
  }
}

const svgNS = "http://www.w3.org/2000/svg";
const tileSize = 75;

export function createControls() {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'id', 'controls');
  $controls.setAttributeNS(null, 'class', 'panel');
  return $controls;
}

/**
 * @param {number} x
 * @param {number} y
 */
function locate(x, y) {
  return (y + 1) * 5 + x + 1;
}

function makeTileMap() {
  const map = new Map();
  for (let x = -1; x < 4; x += 1) {
    for (let y = -1; y < 4; y += 1) {
      map.set(locate(x, y), {x, y, a: 0});
    }
  }
  return map;
}

const tileMap = makeTileMap();

/**
 * @param {Element} $parent
 * @param {Object} options
 * @param {(direction: number, repeat: boolean, inventory: import('./model.js').Inventory) => void} options.commandWorld
 * @param {() => void} options.resetWorld - to be called when an animated
 * transition ends
 * @param {(progress: Progress) => void} options.animateWorld
 * so the frustum can update its retained facets.
 */
export function makeController($parent, {
  commandWorld,
  resetWorld,
  animateWorld,
}) {
  const $controls = createControls();
  $parent.appendChild($controls);

  const elements = new Map();

  let next = 0;
  /**
   * @param {number} type
   * @param {number} location
   */
  function create(type, location) {
    const entity = next;
    next = next + 1;
    macroViewModel.put(entity, location, type);
    return entity;
  }

  /**
   * @param {number} entity
   * @param {number} type
   */
  function createElement(entity, type) {
    const text = viewText[type];
    const element = document.createElementNS(svgNS, 'text');
    element.setAttributeNS(null, 'class', 'moji');
    element.appendChild(document.createTextNode(text));
    elements.set(entity, element);
    return element;
  }

  /**
   * @param {number} entity
   */
  function collectElement(entity) {
    elements.delete(entity);
  }

  const tileView = makeTileView($controls, createElement, collectElement);
  const {enter, exit} = tileView;

  /** @type {PlaceFn} */
  function place(entity, coord, pressure, progress, transition) {
    const element = elements.get(entity);
    // TODO y u no element evar?
    if (element) {
      placeEntity(element, coord, pressure, progress, transition);
    }
  }

  const controlsViewModel = makeViewModel();
  const macroViewModel = makeMacroViewModel(controlsViewModel, {name: 'controls'});

  controlsViewModel.watch(tileMap, {enter, exit, place});

  // indexed by command - 1
  /** @type {Array<number | undefined>} */
  let entities = [
    create(tileTypesByName.left, locate(0, 2)),
    create(tileTypesByName.south, locate(1, 2)),
    create(tileTypesByName.right, locate(2, 2)),
    create(tileTypesByName.west, locate(0, 1)),
    create(tileTypesByName.watch, locate(1, 1)),
    create(tileTypesByName.east, locate(2, 1)),
    undefined,
    create(tileTypesByName.north, locate(1, 0)),
    undefined,
  ];

  /**
   * @param {number} command
   */
  function down(command) {
    const entity = entities[command - 1];
    if (entity !== undefined) {
      macroViewModel.down(entity);
    }
  }

  /**
   * @param {number} command
   */
  function up(command) {
    const entity = entities[command - 1];
    if (entity !== undefined) {
      macroViewModel.up(entity);
    }
  }

  /** @type {number} */
  let left = itemTypesByName.empty;
  /** @type {number} */
  let right = itemTypesByName.empty;

  const inventory = {
    get left() {
      return left;
    },
    /**
     * @param {number} type
     */
    set left(type) {
      left = type;
      if (type === itemTypesByName.empty) {
        if (entities[0] !== undefined) {
          macroViewModel.replace(entities[0], tileTypesByName.left);
        }
      } else {
        const itemType = itemTypes[type];
        const tileName = itemType.tile || itemType.name;
        if (entities[0] !== undefined) {
          macroViewModel.replace(entities[0], tileTypesByName[tileName]);
        }
      }
    },
    get right() {
      return right;
    },
    /**
     * @param {number} type
     */
    set right(type) {
      right = type;
      if (type === itemTypesByName.empty) {
        if (entities[2] !== undefined) {
          macroViewModel.replace(entities[2], tileTypesByName.right);
        }
      } else {
        const itemType = itemTypes[type];
        const tileName = itemType.tile || itemType.name;
        if (entities[2] !== undefined) {
          macroViewModel.replace(entities[2], tileTypesByName[tileName]);
        }
      }
    },
  };

  /**
   * @param {Progress} progress
   */
  function animate(progress) {
    animateWorld(progress);
    macroViewModel.animate(progress);
  }

  function reset() {
    resetWorld();
    macroViewModel.reset();
  }

  /**
   * @callback State
   * @param {number} command
   * @param {boolean} repeat
   */

  /** @type {State} */
  function play(command, repeat) {
    const direction = commandDirection[command];
    if (direction !== undefined) {
      commandWorld(direction, repeat, inventory);

    } else if (command === 1 && left !== itemTypesByName.empty) { // && left non-empty
      removeDpad();

      const leftItem = entities[0];
      assert(leftItem !== undefined);
      macroViewModel.up(leftItem);
      macroViewModel.move(leftItem, locate(1, 1), ne, 0);
      entities[0] = undefined;
      entities[4] = leftItem;

      if (right !== itemTypesByName.empty) {
        const rightItem = entities[2];
        assert(rightItem !== undefined);
        const right = create(tileTypesByName.right, locate(3, 3));
        macroViewModel.move(rightItem, locate(1, 2), ww, 0);
        macroViewModel.move(right, locate(2, 2), nw, 0);
        entities[1] = rightItem;
        entities[2] = right;
      }

      const trash = create(tileTypesByName.trash, locate(3, -1));
      macroViewModel.move(trash, locate(2, 0), sw, 0);
      entities[8] = trash;

      const leftHand = create(tileTypesByName.left, locate(-1, 3));
      macroViewModel.move(leftHand, locate(0, 2), ne, 0);
      entities[0] = leftHand;

      return inventoryMode(left, right, -1);
    } else if (command === 3 && right !== itemTypesByName.empty) {
      removeDpad();

      const rightItem = entities[2];
      assert(rightItem !== undefined);
      macroViewModel.up(rightItem);
      macroViewModel.move(rightItem, locate(1, 1), nw, 0);
      entities[2] = undefined;
      entities[4] = rightItem;

      if (left !== itemTypesByName.empty) {
        const leftItem = entities[0];
        assert(leftItem !== undefined);
        const left = create(tileTypesByName.left, locate(-1, 3));
        macroViewModel.move(leftItem, locate(1, 2), ee, 0);
        macroViewModel.move(left, locate(0, 2), ne, 0);
        entities[1] = leftItem;
        entities[0] = left;
      }

      const trash = create(tileTypesByName.trash, locate(3, -1));
      macroViewModel.move(trash, locate(2, 0), sw, 0);
      entities[8] = trash;

      const rightHand = create(tileTypesByName.right, locate(3, 3));
      macroViewModel.move(rightHand, locate(2, 2), nw, 0);
      entities[2] = rightHand;

      return inventoryMode(right, left, 1);
    }
    return play;
  }

  /**
   * @param {number} item
   * @param {number} otherItem
   * @param {number} leftOrRight
   */
  function inventoryMode(item, otherItem, leftOrRight) {
    /** @type {State} */
    const state = command => {
      if (command === 9) { // trash
        const trashItem = entities[4];
        assert(trashItem !== undefined);
        inventory.left = itemTypesByName.empty;
        assert(entities[8] !== undefined);
        macroViewModel.exit(entities[8]);
        entities[8] = undefined;
        macroViewModel.take(trashItem, ne);

        restoreOtherItem(otherItem, leftOrRight);
        restoreDpad();

        if (leftOrRight < 0) {
          left = itemTypesByName.empty;
        } else if (leftOrRight > 0) {
          right = itemTypesByName.empty;
        }

        return play;
      } else if (command === 1) { // place in left hand
        const trash = entities[8];
        const leftItem = entities[4];
        const leftHand = entities[0];

        assert(trash !== undefined);
        assert(leftItem !== undefined);
        assert(leftHand !== undefined);

        macroViewModel.exit(trash);
        macroViewModel.move(leftItem, locate(0, 2), sw, 0);
        macroViewModel.exit(leftHand);

        entities[0] = leftItem;
        entities[8] = undefined;

        restoreOtherItem(otherItem, -1);
        restoreDpad();

        left = item;
        right = otherItem;

        return play;
      } else if (command === 3) { // place in right hand
        const trash = entities[8];
        const rightItem = entities[4];
        const rightHand = entities[2];

        assert(trash !== undefined);
        assert(rightItem !== undefined);
        assert(rightHand !== undefined);

        macroViewModel.exit(trash);
        macroViewModel.move(rightItem, locate(2, 2), se, 0);
        macroViewModel.exit(rightHand);

        entities[2] = rightItem;
        entities[8] = undefined;

        restoreOtherItem(otherItem, 1);
        restoreDpad();

        right = item;
        left = otherItem;

        return play;
      }
      return state;
    };
    return state;
  }

  function restoreDpad() {
    const north = create(tileTypesByName.north, locate(1, -1));
    macroViewModel.move(north, locate(1, 0), ss, 0);
    entities[7] = north;

    const south = create(tileTypesByName.south, locate(1, 3));
    macroViewModel.move(south, locate(1, 2), nn, 0);
    entities[1] = south;

    const west = create(tileTypesByName.west, locate(-1, 1));
    macroViewModel.move(west, locate(0, 1), ee, 0);
    entities[3] = west;

    const east = create(tileTypesByName.east, locate(3, 1));
    macroViewModel.move(east, locate(2, 1), ww, 0);
    entities[5] = east;

    const watch = create(tileTypesByName.watch, locate(1, 1));
    macroViewModel.enter(watch);
    entities[4] = watch;
  }

  function removeDpad() {
    const north = entities[7];
    const west = entities[3];
    const watch = entities[4];
    const east = entities[5];
    const south = entities[1];

    assert(north !== undefined);
    assert(south !== undefined);
    assert(east !== undefined);
    assert(west !== undefined);
    assert(watch !== undefined);

    macroViewModel.take(north, nn);
    macroViewModel.take(south, ss);
    macroViewModel.take(east, ee);
    macroViewModel.take(west, ww);
    macroViewModel.exit(watch);

    entities[7] = undefined;
    entities[3] = undefined;
    entities[4] = undefined;
    entities[5] = undefined;
    entities[1] = undefined;
  }

  /**
   * @param {number} otherItem
   * @param {number} leftOrRight
   */
  function restoreOtherItem(otherItem, leftOrRight) {
    if (otherItem !== itemTypesByName.empty) {
      if (leftOrRight < 0) {
        // If the primary item was on the left,
        // the secondary item goes back to the right.
        const rightHand = entities[2];
        assert(rightHand !== undefined);
        const rightItem = entities[1];
        assert(rightItem !== undefined);
        macroViewModel.move(rightItem, locate(2, 2), ee, 0);
        macroViewModel.take(rightHand, se);
        entities[1] = undefined;
        entities[2] = rightItem;
      } else if (leftOrRight > 0) {
        const leftHand = entities[0];
        assert(leftHand !== undefined);
        const leftItem = entities[1];
        assert(leftItem !== undefined);
        macroViewModel.move(leftItem, locate(0, 2), ww, 0);
        macroViewModel.take(leftHand, sw);
        entities[1] = undefined;
        entities[0] = leftItem;
      } else {
        assert(false);
      }
    }
  }

  let state = play;

  /** @type {State} */
  function command(command, repeat) {
    state = state(command, repeat);
  }

  return {
    reset,
    animate,
    up,
    down,
    command,
  }
}
