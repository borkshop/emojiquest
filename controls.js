// @ts-check

import {assert} from './assert.js';
import {nn, ne, ee, se, ss, sw, ww, nw} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {viewText, tileTypesByName, itemTypes, itemTypesByName, tileTypeForItemType, combine} from './data.js';
import {commandDirection} from './driver.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */
/** @typedef {ReturnType<makeController>} Controls */

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
    create(tileTypesByName.back, locate(0, 0)),
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
  let leftItemType = itemTypesByName.empty;
  /** @type {number} */
  let rightItemType = itemTypesByName.empty;
  /** @type {number} */
  let packedItemType = itemTypesByName.empty;

  const inventory = {
    get left() {
      return leftItemType;
    },
    /**
     * @param {number} type
     */
    set left(type) {
      leftItemType = type;
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
      return rightItemType;
    },
    /**
     * @param {number} type
     */
    set right(type) {
      rightItemType = type;
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
   * @callback Mode
   * @param {number} command
   * @param {boolean} repeat
   */

  /** @type {Mode} */
  function playMode(command, repeat) {
    const direction = commandDirection[command];
    if (direction !== undefined) {
      commandWorld(direction, repeat, inventory);

    } else if (command === 1 && leftItemType !== itemTypesByName.empty) { // && left non-empty
      dismissDpad();

      const leftItemEntity = entities[0];
      assert(leftItemEntity !== undefined);
      macroViewModel.move(leftItemEntity, locate(1, 1), ne, 0);
      entities[0] = undefined;
      entities[4] = leftItemEntity;
      macroViewModel.up(leftItemEntity);

      if (rightItemType !== itemTypesByName.empty) {
        const rightItemEntity = entities[2];
        assert(rightItemEntity !== undefined);
        const rightHandEntity = create(tileTypesByName.right, locate(3, 3));
        macroViewModel.move(rightItemEntity, locate(1, 2), ww, 0);
        macroViewModel.move(rightHandEntity, locate(2, 2), nw, 0);
        entities[1] = rightItemEntity;
        entities[2] = rightHandEntity;
      }

      restoreTrash();

      const leftHand = create(tileTypesByName.left, locate(-1, 3));
      macroViewModel.move(leftHand, locate(0, 2), ne, 0);
      entities[0] = leftHand;

      return inventoryMode(leftItemType, rightItemType, -1);
    } else if (command === 3 && rightItemType !== itemTypesByName.empty) {
      dismissDpad();

      const rightItemEntity = entities[2];
      assert(rightItemEntity !== undefined);
      macroViewModel.move(rightItemEntity, locate(1, 1), nw, 0);
      entities[2] = undefined;
      entities[4] = rightItemEntity;
      macroViewModel.up(rightItemEntity);

      if (leftItemType !== itemTypesByName.empty) {
        const leftItemEntity = entities[0];
        assert(leftItemEntity !== undefined);
        const leftHandEntity = create(tileTypesByName.left, locate(-1, 3));
        macroViewModel.move(leftItemEntity, locate(1, 2), ee, 0);
        macroViewModel.move(leftHandEntity, locate(0, 2), ne, 0);
        entities[1] = leftItemEntity;
        entities[0] = leftHandEntity;
      }

      restoreTrash();

      const rightHandEntity = create(tileTypesByName.right, locate(3, 3));
      macroViewModel.move(rightHandEntity, locate(2, 2), nw, 0);
      entities[2] = rightHandEntity;

      return inventoryMode(rightItemType, leftItemType, 1);
    } else if (command === 7 && packedItemType !== itemTypesByName.empty) {
      dismissDpad();

      const packedItemEntity = entities[6];
      assert(packedItemEntity !== undefined);

      macroViewModel.move(packedItemEntity, locate(1, 1), se, 0);
      entities[4] = packedItemEntity;

      macroViewModel.up(packedItemEntity);

      restoreBack();
      restoreTrash();

      return backMode;
    }
    return playMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function inventoryMode(itemType, otherItemType, leftOrRight) {
    /** @type {Mode} */
    const mode = command => {
      if (command === 9) { // trash
        const trashedItemEntity = entities[4];
        const trashEntity = entities[8];
        assert(trashedItemEntity !== undefined);
        leftItemType = itemTypesByName.empty;
        assert(trashEntity !== undefined);
        macroViewModel.exit(trashEntity);
        entities[8] = undefined;
        macroViewModel.take(trashedItemEntity, ne);

        if (leftOrRight < 0) {
          leftItemType = itemTypesByName.empty;
        } else if (leftOrRight > 0) {
          rightItemType = itemTypesByName.empty;
        }
        restoreOtherItem(otherItemType, leftOrRight);
        restoreDpad();

        return playMode;
      } else if (command === 2 && otherItemType !== itemTypesByName.empty) { // combine

        const entity = entities[4];
        assert(entity !== undefined);
        const otherEntity = entities[1];
        assert(otherEntity !== undefined);
        macroViewModel.take(otherEntity, nn);

        itemType = combine(itemType, otherItemType);
        otherItemType = itemTypesByName.empty;

        const itemTileType = tileTypeForItemType[itemType];
        macroViewModel.replace(entity, itemTileType);

        return mode;
      } else if (command === 1) { // place in left hand
        dismissTrash();
        const leftItemEntity = entities[4];
        const leftHand = entities[0];

        assert(leftItemEntity !== undefined);
        assert(leftHand !== undefined);

        macroViewModel.move(leftItemEntity, locate(0, 2), sw, 0);
        macroViewModel.exit(leftHand);

        entities[0] = leftItemEntity;

        restoreOtherItem(otherItemType, -1);
        restoreDpad();

        leftItemType = itemType;
        rightItemType = otherItemType;

        return playMode;
      } else if (command === 3) { // place in right hand
        dismissTrash();

        const rightItemEntity = entities[4];
        const rightHandEntity = entities[2];

        assert(rightItemEntity !== undefined);
        assert(rightHandEntity !== undefined);

        macroViewModel.move(rightItemEntity, locate(2, 2), se, 0);
        macroViewModel.exit(rightHandEntity);

        entities[2] = rightItemEntity;

        restoreOtherItem(otherItemType, 1);
        restoreDpad();

        rightItemType = itemType;
        leftItemType = otherItemType;

        return playMode;
      } else if (command === 7 && packedItemType == itemTypesByName.empty) { // stash
        dismissBack();

        const packItemEntity = entities[4];
        assert(packItemEntity !== undefined);
        macroViewModel.move(packItemEntity, locate(0, 0), nw, 0);
        entities[4] = undefined;
        entities[6] = packItemEntity;

        restoreOtherItem(otherItemType, leftOrRight);

        packedItemType = itemType;
        if (leftOrRight < 0) {
          leftItemType = itemTypesByName.empty;
        } else if (leftOrRight > 0) {
          rightItemType = itemTypesByName.empty;
        }

        dismissTrash();
        restoreDpad();

        return playMode;
      }
      return mode;
    };
    return mode;
  }

  /** @type {Mode} */
  function backMode(command) {
    const packedEntity = entities[4];
    assert(packedEntity !== undefined);

    if (command === 9) { // trash
      const trashEntity = entities[8];
      assert(trashEntity !== undefined);
      macroViewModel.exit(trashEntity);
      macroViewModel.take(packedEntity, ne);
      entities[4] = undefined;
      entities[8] = undefined;

      packedItemType = itemTypesByName.empty;

      restoreDpad();
      // Trash entity exited in place instead of dismissTrash().
      return playMode;

    } else if (command === 7) { // put back
      dismissBack();
      dismissTrash();

      macroViewModel.move(packedEntity, locate(0, 0), nw, 0);
      entities[6] = packedEntity;
      entities[4] = undefined;

      restoreDpad();
      return playMode;

    } else if (command === 1 && leftItemType === itemTypesByName.empty) { // left
      const leftHandEntity = entities[0];
      assert(leftHandEntity !== undefined);
      macroViewModel.take(leftHandEntity, sw);
      macroViewModel.move(packedEntity, locate(0, 2), sw, 0);
      entities[0] = packedEntity;
      entities[4] = undefined;

      macroViewModel.up(packedEntity);

      restoreDpad();
      dismissTrash();

      leftItemType = packedItemType;
      packedItemType = itemTypesByName.empty;

      return playMode;

    } else if (command == 3 && rightItemType === itemTypesByName.empty) { // right
      const rightHandEntity = entities[2];
      assert(rightHandEntity !== undefined);
      macroViewModel.take(rightHandEntity, se);
      macroViewModel.move(packedEntity, locate(2, 2), se, 0);
      entities[2] = packedEntity;
      entities[4] = undefined;

      macroViewModel.up(packedEntity);

      restoreDpad();
      dismissTrash();

      rightItemType = packedItemType;
      packedItemType = itemTypesByName.empty;

      return playMode;
    }

    return backMode;
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

  function restoreTrash() {
    const trashEntity = create(tileTypesByName.trash, locate(3, -1));
    macroViewModel.move(trashEntity, locate(2, 0), sw, 0);
    entities[8] = trashEntity;
  }

  function dismissTrash() {
    const trashEntity = entities[8];
    assert(trashEntity !== undefined);
    macroViewModel.exit(trashEntity);
    entities[8] = undefined;
  }

  function restoreBack() {
    const backEntity = create(tileTypesByName.back, locate(-1, -1));
    macroViewModel.move(backEntity, locate(0, 0), se, 0);
    entities[6] = backEntity;
  }

  function dismissBack() {
    const backEntity = entities[6];
    assert(backEntity !== undefined);
    macroViewModel.take(backEntity, nw);
    entities[6] = undefined;
  }

  function dismissDpad() {
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
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function restoreOtherItem(otherItemType, leftOrRight) {
    if (otherItemType !== itemTypesByName.empty) {
      if (leftOrRight < 0) {
        // If the primary item was on the left,
        // the secondary item goes back to the right.
        const rightHandEntity = entities[2];
        assert(rightHandEntity !== undefined);
        const rightItemEntity = entities[1];
        assert(rightItemEntity !== undefined);
        macroViewModel.move(rightItemEntity, locate(2, 2), ee, 0);
        macroViewModel.take(rightHandEntity, se);
        entities[1] = undefined;
        entities[2] = rightItemEntity;
      } else if (leftOrRight > 0) {
        const leftHand = entities[0];
        assert(leftHand !== undefined);
        const leftItemEntity = entities[1];
        assert(leftItemEntity !== undefined);
        macroViewModel.move(leftItemEntity, locate(0, 2), ww, 0);
        macroViewModel.take(leftHand, sw);
        entities[1] = undefined;
        entities[0] = leftItemEntity;
      } else {
        assert(false);
      }
    }
  }

  let mode = playMode;

  /** @type {Mode} */
  function command(command, repeat) {
    mode = mode(command, repeat);
  }

  return {
    reset,
    animate,
    up,
    down,
    command,
  }
}
