/**
 * The controls module manages a view of the player's control pad, receives
 * commands, manages the commands that pertain to inventory management, and
 * forwards other commands that pertain to player motion in the world.
 * The control pad consists of a state machine that responds to the commands
 * in the Emoji Quest command vocabulary, normalized to the digits 1-9 and
 * arranged similarly on a 3x3 grid like a calculator.
 * The controller is responsible for orchestrating the animated transitions of
 * all the buttons on the control pad as the user flows between input modes and
 * may also in the future take responsibility for orchestrating corresponding
 * sounds.
 */

// @ts-check

import {assert} from './assert.js';
import {nn, ne, ee, se, ss, sw, ww, nw, halfOcturn, fullOcturn} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {
  viewText,
  tileTypesByName,
  itemTypes,
  itemTypesByName,
  effectTypesByName,
  tileTypeForItemType,
  tileTypeForEffectType,
  craft
} from './mechanics.js';
import {commandDirection} from './driver.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */

/**
 * @callback FollowCursorFn
 * @param {number} destination
 * @param {import('./daia.js').CursorChange} change
 */

const svgNS = "http://www.w3.org/2000/svg";

const inventoryIndexForCommand = [undefined, 0, 1, 2, 3, undefined, 4, 5, 6, 7];
const entityIndexForInventoryIndex = [0, 1, 2, 3, 5, 6, 7, 8];
// const inventoryIndexForEntityIndex = [0, 1, 2, 3, undefined, 4, 5, 6, 7];

// const emptyTile = tileTypesByName.empty;
const emptyItem = itemTypesByName.empty;

/**
 * @param {number} itemType
 */
function isEmptyItem(itemType) {
  return itemType === emptyItem;
}

/**
 * @param {number} itemType
 */
function isNotEmptyItem(itemType) {
  return itemType !== emptyItem;
}

// /**
//  * @param {number} effectType
//  */
// function isEmptyEffect(effectType) {
//   return effectType === emptyEffect;
// }


const itemGridIndexes = [
  0, 1, 2,
  3,    5,
  6, 7, 8,
]

const gridLocations = [
  locate(0, 2),
  locate(1, 2),
  locate(2, 2),
  locate(0, 1),
  locate(1, 1),
  locate(2, 1),
  locate(0, 0),
  locate(1, 0),
  locate(2, 0),
];

const gridTileTypes = [
  tileTypesByName.one,
  tileTypesByName.two,
  tileTypesByName.three,
  tileTypesByName.four,
  tileTypesByName.five,
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
 * @param {Element} $controls
 * @param {Object} args
 * @param {number} args.agent
 * @param {number} args.frustumRadius
 * @param {import('./daia.js').AdvanceFn} args.advance,
 * @param {import('./daia.js').CameraTransformFn} args.cameraTransform
 * @param {import('./daia.js').Cursor} args.cursor
 * @param {import('./model.js').Model} args.worldModel
 * @param {import('./facet-view.js').FacetView} args.facetView
 * @param {import('./view-model.js').ViewModel} args.worldViewModel
 * @param {import('./macro-view-model.js').MacroViewModel} args.worldMacroViewModel
 * @param {import('./camera.js').Camera} args.camera
 * so the frustum can update its retained facets.
 * @param {FollowCursorFn} args.followCursor
 * @returns {import('./driver.js').Delegate}
 */
export function makeController($controls, {
  agent,
  cursor,
  frustumRadius,
  worldModel,
  worldViewModel,
  worldMacroViewModel,
  advance,
  cameraTransform,
  facetView,
  camera,
  followCursor,
}) {

  // State:

  let lastAgentCursor = cursor;

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

  const {keepTilesAround} = makeTileKeeper({
    enter: facetView.enter,
    exit: facetView.exit,
    advance: advance
  });

  const tileView = makeTileView($controls, createElement, collectElement);
  const {enter, exit} = tileView;

  /** @type {PlaceFn} */
  function place(entity, coord, pressure, progress, transition) {
    const element = elements.get(entity);
    assert(element !== undefined);
    placeEntity(element, coord, pressure, progress, transition);
  }

  const controlsViewModel = makeViewModel();
  const macroViewModel = makeMacroViewModel(controlsViewModel, {name: 'controls'});

  controlsViewModel.watch(tileMap, {enter, exit, place});

  /** @type {import('./model.js').FollowFn} */
  function followAgent(_entity, change, destination) {
    cursor = {...change, position: destination};
    followCursor(destination, change);
  }

  worldModel.follow(agent, followAgent);

  let items = [
    emptyItem, // command === 1
    emptyItem, // command === 2
    emptyItem, // command === 3

    emptyItem, // command === 4

    emptyItem, // command === 6

    emptyItem, // command === 7
    emptyItem, // command === 8
    emptyItem, // command === 9
  ];

  // index of enabled effect, or -1 for no effect
  let effectType = effectTypesByName.none;
  // bit mask of owned effect types
  let effects = 1 << effectType;
  // indexed by command - 1
  /** @type {Array<number | undefined>} */
  let entities = [
    create(tileTypesByName.left, locate(0, 2)),
    create(tileTypesByName.south, locate(1, 2)),
    create(tileTypesByName.right, locate(2, 2)),
    create(tileTypesByName.west, locate(0, 1)),
    create(tileTypesByName.watch, locate(1, 1)),
    create(tileTypesByName.east, locate(2, 1)),
    packEmpty() ? undefined : create(tileTypesByName.backpack, locate(0, 0)),
    create(tileTypesByName.north, locate(1, 0)),
    create(tileTypeForEffectType[effectType], locate(2, 0)),
  ];

  /** @type {number} */
  let leftItemType = emptyItem;
  /** @type {number} */
  let rightItemType = emptyItem;
  /** @type {number} */
  let packTileType = tileTypesByName.backpack;

  const inventory = {
    get left() {
      return leftItemType;
    },
    /**
     * @param {number} type
     */
    set left(type) {
      const packWasVisible = packNotEmpty();

      leftItemType = type;
      if (isEmptyItem(type)) {
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

      const packIsVisible = packNotEmpty();
      updatePack(packWasVisible, packIsVisible);
    },
    get right() {
      return rightItemType;
    },
    /**
     * @param {number} type
     */
    set right(type) {
      const packWasVisible = packNotEmpty();

      rightItemType = type;
      if (isEmptyItem(type)) {
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

      const packIsVisible = packNotEmpty();
      updatePack(packWasVisible, packIsVisible);
    },
  };

  // Common queries:

  function packNotFull() {
    return items.some(isEmptyItem);
  }

  function packNotEmpty() {
    return !items.every(isEmptyItem);
  }

  function packEmpty() {
    return items.every(isEmptyItem);
  }

  // Modes:

  /**
   * @callback PressFn
   * @param {number} command
   * @param {boolean} repeat
   */

  /**
   * @typedef {Object} Mode
   * @prop {PressFn} press
   */

  /** @type {Mode} */
  const playMode = {
    press(command, repeat) {
      const direction = commandDirection[command];
      if (direction !== undefined) {
        worldModel.intend(agent, direction, repeat);
        worldModel.tick(inventory);
        return playMode;
      } else if (command === 5) { // stay
        worldModel.tick(inventory);
        return playMode;
      } else if (command === 1 && isNotEmptyItem(leftItemType)) { // && left non-empty
        return handleLeftItem();
      } else if (command === 3 && isNotEmptyItem(rightItemType)) {
        return handleRightItem();
      } else if (command === 7 && packNotEmpty()) { // stash
        return openStash();
      } else if (command === 9 && effects !== 0) { // effect chooser
        return openEffects();
      } else if (command === 0) {
        return openEditor();
      } else {
        return playMode;
      }
    }
  };

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function itemMode(itemType, otherItemType, leftOrRight, packWasVisible = packNotFull()) {
    // Invariant: the pack should be visible iff there are any empty slots.

    /** @type {Mode} */
    const mode = {
      press(command) {
        if (command === 9) { // trash / consume / convert to effect
          return useItem(itemType, otherItemType, leftOrRight, packWasVisible);
        } else if (command === 2 && isNotEmptyItem(otherItemType)) { // craft
          return craftItems(itemType, otherItemType, leftOrRight, packWasVisible);
        } else if (command === 1) { // place in left hand
          return placeItemInLeftHand(itemType, otherItemType, packWasVisible);
        } else if (command === 3) { // place in right hand
          return placeItemInRightHand(itemType, otherItemType, packWasVisible);
        } else if (command === 7) { // stash
          return stashItem(itemType, otherItemType, leftOrRight);
        }
        return mode;
      },
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
    const mode = {
      press(command) {
        if (command === 5) { // keep
          dismissPackItemsExcept(-1);

          if (isNotEmptyItem(heldItemType)) {
            const entity = entities[4];
            assert(entity !== undefined);
            macroViewModel.up(entity);
          }

        } else if (command >= 1 && command <= 9) { // put or swap
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
          if (isNotEmptyItem(heldItemType)) {
            const itemEntity = entities[4];
            assert(itemEntity !== undefined);
            macroViewModel.take(itemEntity, toItemDirection);
          }

          // From inventory to hand (everything else disappearing)
          if (isNotEmptyItem(inventoryItemType)) {
            macroViewModel.move(inventoryEntity, locate(1, 1), fromItemDirection, 0);
            entities[4] = inventoryEntity;
            entities[inventoryEntityIndex] = undefined;
          } else {
            dismiss(command - 1);
          }

          dismissPackItemsExcept(inventoryIndex);

          ([heldItemType, items[inventoryIndex]] = [items[inventoryIndex], heldItemType]);
        } else {
          assert(false);
        }

        if (isNotEmptyItem(heldItemType)) {
          restoreLeftHand();
          restoreRightHand();
          restoreRecepticle(heldItemType);
          restorePack();
          if (isNotEmptyItem(otherItemType)) {
            const otherItemTileType = tileTypeForItemType[otherItemType];
            const centerItemEntity = create(otherItemTileType, locate(1, 3));
            macroViewModel.move(centerItemEntity, locate(1, 2), nn, 0);
            entities[1] = centerItemEntity;
          }
          return itemMode(heldItemType, otherItemType, leftOrRight);
        } else { // back to play mode with an empty hand

          if (leftOrRight < 0) {
            leftItemType = emptyItem;
            restoreLeftHand();

            rightItemType = otherItemType;
            if (isEmptyItem(otherItemType)) {
              restoreRightHand();
            } else {
              restoreRightItem();
            }
          } else if (leftOrRight > 0) {
            rightItemType = emptyItem;
            restoreRightHand();

            leftItemType = otherItemType;
            if (isEmptyItem(otherItemType)) {
              restoreLeftHand();
            } else {
              restoreLeftItem();
            }
          }

          restoreDpad();
          restoreWatch();
          restoreEffect();

          if (packNotEmpty()) {
            restorePack();
          }

          return playMode;
        }
      }
    };

    return mode;
  }

  /** @type {Mode} */
  const effectMode = {
    press(command) {
      if (command >= 1 && command <= 9) {
        const chosenType = command - 1;
        if ((effects & (1 << chosenType)) !== 0) {
          return chooseEffect(chosenType);
        }
        return effectMode;
      } else {
        assert(false);
      }
    }
  };

  /** @type {Mode} */
  const editMode = {
    press(command) {
      const direction = commandDirection[command];
      if (direction !== undefined) {
        const position = cursor.position;
        const change = advance({...cursor, direction});
        cursor = change;
        followCursor(cursor.position, {...change, direction, position});
        worldMacroViewModel.move(-1, cursor.position, direction * 2, 0);
        return editMode;
      } else if (command === 0) {
        return closeEditor();
      } else {
        return editMode;
      }
    }
  };

  // Mode transitions:

  function handleLeftItem() {
    // Transition from play mode to item handling mode.
    dismissDpad();
    dismissWatch();
    dismissEffect();

    const leftItemEntity = entities[0];
    assert(leftItemEntity !== undefined);
    macroViewModel.move(leftItemEntity, locate(1, 1), ne, 0);
    entities[0] = undefined;
    entities[4] = leftItemEntity;
    macroViewModel.up(leftItemEntity);

    if (isNotEmptyItem(rightItemType)) {
      const rightItemEntity = entities[2];
      assert(rightItemEntity !== undefined);
      macroViewModel.move(rightItemEntity, locate(1, 2), ww, 0);
      entities[1] = rightItemEntity;
      restoreRightHand();
    }

    if (packEmpty()) {
      restorePack();
    }
    restoreRecepticle(leftItemType);
    restoreLeftHand();

    return itemMode(leftItemType, rightItemType, -1);
  }

  function handleRightItem() {
    // Transition from play mode to item handling mode.
    dismissDpad();
    dismissWatch();
    dismissEffect();

    const rightItemEntity = entities[2];
    assert(rightItemEntity !== undefined);
    macroViewModel.move(rightItemEntity, locate(1, 1), nw, 0);
    entities[2] = undefined;
    entities[4] = rightItemEntity;
    macroViewModel.up(rightItemEntity);

    if (isNotEmptyItem(leftItemType)) {
      const leftItemEntity = entities[0];
      assert(leftItemEntity !== undefined);
      macroViewModel.move(leftItemEntity, locate(1, 2), ee, 0);
      entities[1] = leftItemEntity;
      restoreLeftHand();
    }

    if (packEmpty()) {
      restorePack();
    }
    restoreRecepticle(rightItemType);
    restoreRightHand();

    return itemMode(rightItemType, leftItemType, 1);
  }

  function openStash() {
    dismissPack();
    dismissEffect();
    dismissDpad();
    dismissWatch();

    if (isEmptyItem(leftItemType)) {
      dismissLeft();
      dismissRight();
      restorePackItems();
      return packMode(leftItemType, rightItemType, -1);
    } else if (isEmptyItem(rightItemType)) {
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

  function openEffects() {
    // Transition from play mode to effect mode.
    if (packNotEmpty()) {
      dismissPack();
    }
    dismissEffect();
    dismissDpad();
    dismissWatch();
    dismissLeft();
    dismissRight();

    restoreEffects();

    return effectMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function useItem(itemType, otherItemType, leftOrRight, packWasVisible) {
    const effectName = itemTypes[itemType].effect;
    const itemEntity = entities[4];
    assert(itemEntity !== undefined);

    dismiss(8); // trash / mouth / or effect

    if (effectName !== undefined) {
      effectType = effectTypesByName[effectName];
      effects |= 1 << effectType;
      macroViewModel.move(itemEntity, locate(2, 0), ne, 0);
      entities[8] = itemEntity;
      entities[4] = undefined;

    } else {
      macroViewModel.take(itemEntity, ne);

      restoreEffect();
    }

    // TODO effects of eating (+health, +stamina)

    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    if (leftOrRight < 0) {
      leftItemType = emptyItem;
      rightItemType = otherItemType;
    } else if (leftOrRight > 0) {
      rightItemType = emptyItem;
      leftItemType = otherItemType;
    }
    restoreCenterItem(otherItemType, leftOrRight);
    restoreDpad();
    restoreWatch();

    // TODO take a turn of the simulation

    return playMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function craftItems(itemType, otherItemType, leftOrRight, packWasVisible) {
    const entity = entities[4];
    assert(entity !== undefined);
    const otherEntity = entities[1];
    assert(otherEntity !== undefined);

    const [productType, byproductType] = craft(itemType, otherItemType);

    console.table({
      agent: itemTypes[itemType].name,
      reagent: itemTypes[otherItemType].name,
      product: itemTypes[productType].name,
      byproduct: itemTypes[byproductType].name,
    });

    assert(otherItemType !== productType);
    assert(isNotEmptyItem(productType));
    const productTileType = tileTypeForItemType[productType];

    if (otherItemType === byproductType && isNotEmptyItem(byproductType)) {
      // The agent is replaced with the product.  The reagent is also the
      // byproduct, in other words, it is a catalyst and just bounces in
      // place.
      macroViewModel.replace(entity, productTileType);
      macroViewModel.bounce(otherEntity, nn);

    } else if (itemType === byproductType) {
      // The agent becomes the byproduct when the formula above gets
      // reversed.  In this case, the agent becomes the byproduct, or
      // rather, it just moves from the top to the bottom slot.
      macroViewModel.move(entity, locate(1, 2), ss, 0);
      entities[1] = entity;

      macroViewModel.take(otherEntity, nn);

      const productEntity = create(productTileType, locate(1, 1));
      macroViewModel.enter(productEntity);
      entities[4] = productEntity;

    } else {
      macroViewModel.replace(entity, productTileType);

      macroViewModel.take(otherEntity, nn);

      if (isNotEmptyItem(byproductType)) {
        const byproductTileType = tileTypeForItemType[byproductType];
        const byproductEntity = create(byproductTileType, locate(1, 2));
        macroViewModel.enter(byproductEntity);
        entities[1] = byproductEntity;
      } else {
        entities[1] = undefined;
      }
    }

    return itemMode(productType, byproductType, leftOrRight, packWasVisible);
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {boolean} packWasVisible
   */
  function placeItemInLeftHand(itemType, otherItemType, packWasVisible) {
    dismiss(8); // trash
    if (packWasVisible && packEmpty()) {
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
    restoreWatch();
    restoreEffect();

    return playMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {boolean} packWasVisible
   */
  function placeItemInRightHand(itemType, otherItemType, packWasVisible) {
    dismiss(8); // trash
    if (packWasVisible && packEmpty()) {
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
    restoreWatch();
    restoreEffect();

    return playMode;
  }

  /**
   * @param {number} itemType
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function stashItem(itemType, otherItemType, leftOrRight) {
    dismissPack();
    dismiss(8); // trash
    dismissLeft();
    dismissRight();
    if (isNotEmptyItem(otherItemType)) {
      dismissCenter();
    }
    restorePackItems();

    return packMode(itemType, otherItemType, leftOrRight);
  }

  /**
   * @param {number} chosenType
   */
  function chooseEffect(chosenType) {
    effectType = chosenType;

    dismissEffects();
    restoreLeft();
    restoreRight()
    restoreDpad();
    restoreWatch();
    restoreEffect();
    if (packNotEmpty()) {
      restorePack();
    }

    return playMode;
  }

  function openEditor() {
    dismissLeft();
    dismissRight();
    dismissEffect();
    if (packNotEmpty()) {
      dismissPack();
    }
    dismissWatch();

    lastAgentCursor = cursor;
    worldModel.unfollow(agent, followAgent);
    // Reveal editor reticle.
    worldMacroViewModel.put(-1, cursor.position, -1);

    return editMode;
  }

  function closeEditor() {
    restoreLeft();
    restoreRight();
    restoreEffect();
    if (packNotEmpty()) {
      restorePack();
    }
    restoreWatch();

    cursor = lastAgentCursor;
    camera.reset(cameraTransform(cursor.position));
    worldModel.follow(agent, followAgent);
    // Hide editor reticle.
    worldMacroViewModel.remove(-1);

    return playMode;
  }

  // Entity management:

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
  }

  function restoreWatch() {
    const watch = create(tileTypesByName.watch, locate(1, 1));
    macroViewModel.enter(watch);
    entities[4] = watch;
  }

  function restoreLeft() {
    if (isEmptyItem(leftItemType)) {
      restoreLeftHand();
    } else {
      restoreLeftItem();
    }
  }

  function restoreRight() {
    if (isEmptyItem(rightItemType)) {
      restoreRightHand();
    } else {
      restoreRightItem();
    }
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

  /**
   * @param {number} itemType
   */
  function restoreRecepticle(itemType) {
    const { comestible = false, effect = undefined } = itemTypes[itemType];
    let recepticleTileType = tileTypesByName.trash;
    if (effect !== undefined) {
      recepticleTileType = tileTypesByName.arm;
    } else if (comestible) {
      recepticleTileType = tileTypesByName.mouth;
    }
    const recepticleEntity = create(recepticleTileType, locate(3, -1));
    macroViewModel.move(recepticleEntity, locate(2, 0), sw, 0);
    entities[8] = recepticleEntity;
  }

  function restoreEffect() {
    const effectTileType = tileTypeForEffectType[effectType];
    assert(effectTileType !== undefined);
    const effectEntity = create(effectTileType, locate(3, -1));
    macroViewModel.move(effectEntity, locate(2, 0), sw, 0);
    entities[8] = effectEntity;
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

  function dismissEffect() {
    dismiss(8); // effect
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
      const itemGridIndex = itemGridIndexes[i];
      const itemLocation = gridLocations[itemGridIndex];
      const itemTileType = isNotEmptyItem(itemType) ? tileTypeForItemType[itemType] : gridTileTypes[itemGridIndex];
      const itemEntity = create(itemTileType, itemLocation);
      macroViewModel.enter(itemEntity);
      entities[entityIndex] = itemEntity;
    }
  }

  function restoreEffects() {
    for (let i = 0; i < 9; i++) {
      const effectBit = 1 << i;
      const effectTileType = effects & effectBit ? tileTypeForEffectType[i] : gridTileTypes[i];
      const effectLocation = gridLocations[i];
      const effectEntity = create(effectTileType, effectLocation);
      macroViewModel.enter(effectEntity);
      entities[i] = effectEntity;
    }
  }

  function dismissEffects() {
    for (let i = 0; i < 9; i++) {
      dismiss(i);
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
    const east = entities[5];
    const south = entities[1];

    assert(north !== undefined);
    assert(south !== undefined);
    assert(east !== undefined);
    assert(west !== undefined);

    macroViewModel.take(north, nn);
    macroViewModel.take(south, ss);
    macroViewModel.take(east, ee);
    macroViewModel.take(west, ww);

    entities[7] = undefined;
    entities[3] = undefined;
    entities[5] = undefined;
    entities[1] = undefined;
  }

  function dismissWatch() {
    const watch = entities[4];
    assert(watch !== undefined);
    macroViewModel.exit(watch);
    entities[4] = undefined;
  }

  /**
   * @param {number} otherItemType
   * @param {number} leftOrRight
   */
  function restoreCenterItem(otherItemType, leftOrRight) {
    if (isNotEmptyItem(otherItemType)) {
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

  // Superfluous:
  // function packFull() {
  //   return !items.some(isEmptyItem);
  // }

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

  /**
   * @param {Progress} progress
   */
  function animate(progress) {
    camera.animate(progress.now);
    worldViewModel.animate(progress);
    macroViewModel.animate(progress);
  }

  function reset() {
    keepTilesAround(cursor.position, frustumRadius);
    worldModel.tock();
    worldViewModel.reset();
    macroViewModel.reset();
  }

  let mode = playMode;

  /** @type {PressFn} */
  function command(command, repeat) {
    mode = mode.press(command, repeat);
  }

  return {
    reset,
    animate,
    up,
    down,
    command,
  }
}
