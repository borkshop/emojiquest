// @ts-check

import {assert} from './assert.js';
import {nn, ne, ee, se, ss, sw, ww, nw, halfOcturn, fullOcturn} from './geometry2d.js';
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

const inventoryIndexForCommand = [undefined, 0, 1, 2, 3, undefined, 4, 5, 6, 7];
const entityIndexForInventoryIndex = [0, 1, 2, 3, 5, 6, 7, 8];
const inventoryIndexForEntityIndex = [0, 1, 2, 3, undefined, 4, 5, 6, 7];

const itemLocations = [
  locate(0, 2),
  locate(1, 2),
  locate(2, 2),
  locate(0, 1),
  locate(2, 1),
  locate(0, 0),
  locate(1, 0),
  locate(2, 0),
];

const defaultItemTileTypes = [
  tileTypesByName.one,
  tileTypesByName.two,
  tileTypesByName.three,

  tileTypesByName.four,

  tileTypesByName.six,

  tileTypesByName.seven,
  tileTypesByName.eight,
  tileTypesByName.nine,
];


// itemIndex to vector to or from that item index
const directionToForInventoryIndex = [sw, ss, se, ww, ee, nw, nn, ne];
const directionFromForInventoryIndex = directionToForInventoryIndex.map(
  direction => (direction + halfOcturn) % fullOcturn
);

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
    create(tileTypesByName.empty, locate(2, 0)),
  ];

  let items = [
    itemTypesByName.empty, // command === 1
    itemTypesByName.empty, // command === 2
    itemTypesByName.empty, // command === 3

    itemTypesByName.empty, // command === 4

    itemTypesByName.empty, // command === 6

    itemTypesByName.empty, // command === 7
    itemTypesByName.empty, // command === 8
    itemTypesByName.empty, // command === 9
  ];

  /** @type {number} */
  let leftItemType = itemTypesByName.empty;
  /** @type {number} */
  let rightItemType = itemTypesByName.empty;
  /** @type {number} */
  let effectTileType = tileTypesByName.empty;
  /** @type {number} */
  let packTileType = tileTypesByName.backpack;

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

  const inventory = {
    get left() {
      return leftItemType;
    },
    /**
     * @param {number} type
     */
    set left(type) {
      const packWasVisible = packVisibility();

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

      const packIsVisible = packVisibility();
      updatePack(packWasVisible, packIsVisible);
    },
    get right() {
      return rightItemType;
    },
    /**
     * @param {number} type
     */
    set right(type) {
      const packWasVisible = packVisibility();

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

      const packIsVisible = packVisibility();
      updatePack(packWasVisible, packIsVisible);
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
      dismiss(8); // effect

      const leftItemEntity = entities[0];
      assert(leftItemEntity !== undefined);
      macroViewModel.move(leftItemEntity, locate(1, 1), ne, 0);
      entities[0] = undefined;
      entities[4] = leftItemEntity;
      macroViewModel.up(leftItemEntity);

      if (rightItemType !== itemTypesByName.empty) {
        const rightItemEntity = entities[2];
        assert(rightItemEntity !== undefined);
        macroViewModel.move(rightItemEntity, locate(1, 2), ww, 0);
        entities[1] = rightItemEntity;
        restoreRightHand();
      }

      if (!packVisibility() && !items.every(Boolean)) {
        restorePack();
      }
      restoreTrash();
      restoreLeftHand();

      return inventoryMode(leftItemType, rightItemType, -1);
    } else if (command === 3 && rightItemType !== itemTypesByName.empty) {
      dismissDpad();
      dismiss(8); // effect

      const rightItemEntity = entities[2];
      assert(rightItemEntity !== undefined);
      macroViewModel.move(rightItemEntity, locate(1, 1), nw, 0);
      entities[2] = undefined;
      entities[4] = rightItemEntity;
      macroViewModel.up(rightItemEntity);

      if (leftItemType !== itemTypesByName.empty) {
        const leftItemEntity = entities[0];
        assert(leftItemEntity !== undefined);
        macroViewModel.move(leftItemEntity, locate(1, 2), ee, 0);
        entities[1] = leftItemEntity;
        restoreLeftHand();
      }

      if (!packVisibility() && !items.every(Boolean)) {
        restorePack();
      }
      restoreTrash();
      restoreRightHand();

      return inventoryMode(rightItemType, leftItemType, 1);
    } else if (command === 7 && items.some(Boolean)) { // stash
      dismissPack();
      dismiss(8); // effect
      dismissDpad();

      if (leftItemType === itemTypesByName.empty) {
        dismissLeft();
        dismissRight();
        restorePackItems();
        return packMode(leftItemType, rightItemType, -1);
      } else if (rightItemType === itemTypesByName.empty) {
        dismissLeft();
        dismissRight();
        restorePackItems();
        return packMode(rightItemType, leftItemType, 1);
      } else {
        const leftEntity = entities[0];
        assert(leftEntity !== undefined);
        macroViewModel.move(leftEntity, locate(1, 1), ne, 0);
        entities[4] = leftEntity;
        entities[0] = undefined;
        dismissRight();
        restorePackItems();
        return packMode(leftItemType, rightItemType, -1);
      }
    }
    return playMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function inventoryMode(itemType, otherItemType, leftOrRight) {
    // Invariant: the pack should be visible iff there are any empty slots.
    const packWasVisible = !items.every(Boolean);

    /** @type {Mode} */
    const mode = command => {
      if (command === 9) { // trash
        const trashedItemEntity = entities[4];
        assert(trashedItemEntity !== undefined);
        macroViewModel.take(trashedItemEntity, ne);
        dismiss(8); // trash
        if (packWasVisible && !packVisibility()) {
          dismissPack();
        }

        if (leftOrRight < 0) {
          leftItemType = itemTypesByName.empty;
        } else if (leftOrRight > 0) {
          rightItemType = itemTypesByName.empty;
        }
        restoreCenterItem(otherItemType, leftOrRight);
        restoreDpad();
        restoreEffect();

        return playMode;
      } else if (command === 2 && otherItemType !== itemTypesByName.empty) { // combine

        const entity = entities[4];
        assert(entity !== undefined);
        const otherEntity = entities[1];
        assert(otherEntity !== undefined);
        macroViewModel.take(otherEntity, nn);

        [itemType, otherItemType] = combine(itemType, otherItemType);

        const itemTileType = tileTypeForItemType[itemType];
        macroViewModel.replace(entity, itemTileType);

        return mode;
      } else if (command === 1) { // place in left hand
        dismiss(8); // trash
        if (packWasVisible && !packVisibility()) {
          dismissPack();
        }

        const leftItemEntity = entities[4];
        const leftHand = entities[0];

        assert(leftItemEntity !== undefined);
        assert(leftHand !== undefined);

        macroViewModel.move(leftItemEntity, locate(0, 2), sw, 0);
        macroViewModel.exit(leftHand);

        entities[0] = leftItemEntity;

        leftItemType = itemType;
        rightItemType = otherItemType;

        restoreCenterItem(otherItemType, -1);
        restoreDpad();
        restoreEffect();

        return playMode;
      } else if (command === 3) { // place in right hand
        dismiss(8); // trash
        if (packWasVisible && !packVisibility()) {
          dismissPack();
        }

        const rightItemEntity = entities[4];
        const rightHandEntity = entities[2];

        assert(rightItemEntity !== undefined);
        assert(rightHandEntity !== undefined);

        macroViewModel.move(rightItemEntity, locate(2, 2), se, 0);
        macroViewModel.exit(rightHandEntity);

        entities[2] = rightItemEntity;

        rightItemType = itemType;
        leftItemType = otherItemType;

        restoreCenterItem(otherItemType, 1);
        restoreDpad();
        restoreEffect();

        return playMode;
      } else if (command === 7) { // stash
        dismissPack();
        dismiss(8); // trash
        dismissLeft();
        dismissRight();
        if (otherItemType !== itemTypesByName.empty) {
          dismissCenter();
        }
        restorePackItems();

        return packMode(itemType, otherItemType, leftOrRight);
      }
      return mode;
    };
    return mode;
  }

  /**
   * @param {number} heldItemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function packMode(heldItemType, otherItemType, leftOrRight) {
    /** @type {Mode} */
    function mode(command) {
      if (command === 5) { // keep
        dismissPackItemsExcept(-1);

        const entity = entities[4];
        assert(entity !== undefined);
        macroViewModel.up(entity);

      } else { // put or swap
        const inventoryIndex = inventoryIndexForCommand[command];
        assert(inventoryIndex !== undefined);
        const inventoryEntityIndex = entityIndexForInventoryIndex[inventoryIndex];
        const toItemDirection = directionToForInventoryIndex[inventoryIndex];
        const fromItemDirection = directionFromForInventoryIndex[inventoryIndex];
        const inventoryItemType = items[inventoryIndex];

        const inventoryEntity = entities[inventoryEntityIndex];
        assert(inventoryEntity !== undefined);
        macroViewModel.up(inventoryEntity);

        // From hand to inventory (which is immediately disappearing)
        if (heldItemType !== itemTypesByName.empty) {
          const itemEntity = entities[4];
          assert(itemEntity !== undefined);
          macroViewModel.take(itemEntity, toItemDirection);
        }

        // From inventory to hand (everything else disappearing)
        if (inventoryItemType !== itemTypesByName.empty) {
          macroViewModel.move(inventoryEntity, locate(1, 1), fromItemDirection, 0);
          entities[4] = inventoryEntity;
          entities[inventoryEntityIndex] = undefined;
        } else {
          dismiss(command - 1);
        }

        dismissPackItemsExcept(inventoryIndex);

        ([heldItemType, items[inventoryIndex]] = [items[inventoryIndex], heldItemType]);
      }

      if (heldItemType !== itemTypesByName.empty) {
        restoreLeftHand();
        restoreRightHand();
        restoreTrash();
        restorePack();
        if (otherItemType !== itemTypesByName.empty) {
          const otherItemTileType = tileTypeForItemType[otherItemType];
          const centerItemEntity = create(otherItemTileType, locate(1, 3));
          macroViewModel.move(centerItemEntity, locate(1, 2), nn, 0);
          entities[1] = centerItemEntity;
        }
        return inventoryMode(heldItemType, otherItemType, leftOrRight);
      } else { // back to play mode with an empty hand

        if (leftOrRight < 0) {
          leftItemType = itemTypesByName.empty;
          restoreLeftHand();
          if (otherItemType === itemTypesByName.empty) {
            restoreRightHand();
          } else {
            restoreRightItem();
          }
        } else if (leftOrRight > 0) {
          rightItemType = itemTypesByName.empty;
          restoreRightHand();
          if (otherItemType === itemTypesByName.empty) {
            restoreLeftHand();
          } else {
            restoreLeftItem();
          }
        }

        restoreDpad();
        restoreEffect();

        if (items.some(Boolean)) {
          restorePack();
        }

        return playMode;
      }

    }

    return mode;
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

  function restoreLeftHand() {
    const leftHandEntity = create(tileTypesByName.left, locate(-1, 3));
    macroViewModel.move(leftHandEntity, locate(0, 2), ne, 0);
    entities[0] = leftHandEntity;
  }

  function restoreRightHand() {
    const rightHandEntity = create(tileTypesByName.right, locate(3, 3));
    macroViewModel.move(rightHandEntity, locate(2, 2), nw, 0);
    entities[2] = rightHandEntity;
  }

  function restoreLeftItem() {
    const leftTileType = tileTypeForItemType[leftItemType];
    const leftItemEntity = create(leftTileType, locate(3, 3));
    macroViewModel.move(leftItemEntity, locate(0, 2), ne, 0);
    entities[0] = leftItemEntity;
  }

  function restoreRightItem() {
    const rightTileType = tileTypeForItemType[rightItemType];
    const rightItemEntity = create(rightTileType, locate(3, 3));
    macroViewModel.move(rightItemEntity, locate(2, 2), nw, 0);
    entities[2] = rightItemEntity;
  }

  /** @param {number} slot */
  function dismiss(slot) {
    const entity = entities[slot];
    assert(entity !== undefined);
    macroViewModel.exit(entity);
    entities[slot] = undefined;
  }

  function restoreTrash() {
    const trashEntity = create(tileTypesByName.trash, locate(3, -1));
    macroViewModel.move(trashEntity, locate(2, 0), sw, 0);
    entities[8] = trashEntity;
  }

  function restoreEffect() {
    const effectEntity = create(effectTileType, locate(3, -1));
    macroViewModel.move(effectEntity, locate(2, 0), sw, 0);
    entities[8] = effectEntity;
  }

  function packVisibility() {
    return items.some(Boolean);
    // if (leftItemType || rightItemType) return items.some(Boolean);
    // if (!leftItemType || !rightItemType) return items.some(Boolean);
    // return false;
  }

  /**
   * @param {boolean} packWasVisible
   * @param {boolean} packIsVisible
   */
  function updatePack(packWasVisible, packIsVisible) {
    if (packWasVisible && !packIsVisible) {
      dismissPack();
    }
    if (!packWasVisible && packIsVisible) {
      restorePack();
    }
  }

  function restorePack() {
    const packEntity = create(packTileType, locate(-1, -1));
    macroViewModel.move(packEntity, locate(0, 0), se, 0);
    entities[6] = packEntity;
  }

  function dismissPack() {
    const packEntity = entities[6];
    assert(packEntity !== undefined);
    macroViewModel.take(packEntity, nw);
    entities[6] = undefined;
  }

  function dismissLeft() {
    const leftItemEntity = entities[0];
    assert(leftItemEntity !== undefined);
    macroViewModel.take(leftItemEntity, sw);
    entities[0] = undefined;
  }

  function dismissRight() {
    const leftItemEntity = entities[2];
    assert(leftItemEntity !== undefined);
    macroViewModel.take(leftItemEntity, se);
    entities[2] = undefined;
  }

  function dismissCenter() {
    const centerItemEntity = entities[1];
    assert(centerItemEntity !== undefined);
    macroViewModel.take(centerItemEntity, ss);
    entities[1] = undefined;
  }

  function restorePackItems() {
    for (let i = 0; i < items.length; i++) {
      const itemType = items[i];
      const entityIndex = entityIndexForInventoryIndex[i];
      const itemLocation = itemLocations[i];
      const itemTileType = itemType !== itemTypesByName.empty ? tileTypeForItemType[itemType] : defaultItemTileTypes[i];
      const itemEntity = create(itemTileType, itemLocation);
      macroViewModel.enter(itemEntity);
      entities[entityIndex] = itemEntity;
    }
  }

  /**
   * @param {number} exceptItem
   */
  function dismissPackItemsExcept(exceptItem) {
    for (let i = 0; i < items.length; i++) {
      if (i !== exceptItem) {
        const inventoryEntityIndex = entityIndexForInventoryIndex[i];
        dismiss(inventoryEntityIndex);
      }
    }
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
  function restoreCenterItem(otherItemType, leftOrRight) {
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
