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

import {assert, assertDefined, assertNonZero, assumeDefined, assumeGreaterThanZero} from './assert.js';
import {nn, ne, ee, se, ss, sw, ww, nw, halfOcturn, fullOcturn, octurnVectors} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {
  viewText,
  tileTypesByName,
  itemTypes,
  agentTypes,
  itemTypesByName,
  tileTypeForItemType,
  tileTypeForEffectType,
  defaultTileTypeForAgentType,
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

/**
 * @callback PressFn
 * @param {number} command
 * @param {boolean} repeat
 */

/**
 * @typedef {Object} Mode
 * @prop {PressFn} press
 */

const svgNS = "http://www.w3.org/2000/svg";

const leftHandInventoryIndex = 0;
const rightHandInventoryIndex = 1;
const inventoryIndexForCommand = [-1, 2, 3, 4, 5, -1, 6, 7, 8, 9];
const entityIndexForInventoryIndex = [-1, -1, 0, 1, 2, 3, 5, 6, 7, 8];

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

const octurnGridIndexes = [
  7, 8, 5, 2, 1, 0, 3, 6,
];

const agentOffsets = [
  -4, -1,  2,
  -3,      3,
  -2,  1,  4,
];

const agentOffsetForGridIndex = [
  -4, -1,  2,
  -3,  0,  3,
  -2,  1,  4,
];

const gridCoordinates = [
  {x: 0, y: 2},
  {x: 1, y: 2},
  {x: 2, y: 2},
  {x: 0, y: 1},
  {x: 1, y: 1},
  {x: 2, y: 1},
  {x: 0, y: 0},
  {x: 1, y: 0},
  {x: 2, y: 0},
];

const gridLocations = gridCoordinates.map(({x, y}) => locate(x, y));

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
const directionToForPackIndex = [sw, ss, se, ww, ee, nw, nn, ne];
const directionFromForPackIndex = directionToForPackIndex.map(
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

  let next = 1; // 0 is a sentinel for absence.
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
   * @param {number} index
   * @param {number} tileType
   */
  function spawn(index, tileType) {
    const location = gridLocations[index];
    const entity = create(tileType, location);
    macroViewModel.enter(entity);
    entities[index] = entity;
  }

  /**
   * @param {number} entity
   * @param {number} type
   */
  function createElement(entity, type) {
    if (type === -1) {
      const element = document.createElementNS(svgNS, 'circle');
      element.setAttributeNS(null, 'class', 'reticle');
      element.setAttributeNS(null, 'r', '0.75');
      elements.set(entity, element);
      return element;
    } else {
      const text = viewText[type];
      const element = document.createElementNS(svgNS, 'text');
      element.setAttributeNS(null, 'class', 'moji');
      element.appendChild(document.createTextNode(text));
      elements.set(entity, element);
      return element;
    }
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
    const element = assumeDefined(elements.get(entity));
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

  const inventory = worldModel.entityInventory(agent);
  assert(inventory.length === 10);

  const priorHands = [emptyItem, emptyItem];

  // index of enabled effect, or -1 for no effect
  const effectType = worldModel.entityEffect(agent);
  // indexed by command - 1
  /** @type {Array<number>} */
  let entities = [
    create(tileTypesByName.left, locate(0, 2)),
    create(tileTypesByName.south, locate(1, 2)),
    create(tileTypesByName.right, locate(2, 2)),
    create(tileTypesByName.west, locate(0, 1)),
    create(tileTypesByName.watch, locate(1, 1)),
    create(tileTypesByName.east, locate(2, 1)),
    packEmpty() ? 0 : create(tileTypesByName.backpack, locate(0, 0)),
    create(tileTypesByName.north, locate(1, 0)),
    create(tileTypeForEffectType[effectType], locate(2, 0)),
  ];

  /** @type {number} */
  let packTileType = tileTypesByName.backpack;

  // Common queries:

  /**
   * @param {number} inventoryIndex
   * @param {number} itemType
   */
  function setInventoryItemType(inventoryIndex, itemType) {
    inventory[inventoryIndex] = itemType;
  }

  /**
   * @param {number} inventoryIndex
   */
  function getInventoryItemType(inventoryIndex) {
    return inventory[inventoryIndex];
  }

  /**
   * @param {number} itemType
   */
  function setLeftHandItemType(itemType) {
    setInventoryItemType(leftHandInventoryIndex, itemType);
  }

  /**
   * @param {number} itemType
   */
  function setRightHandItemType(itemType) {
    setInventoryItemType(rightHandInventoryIndex, itemType);
  }

  function leftHandItemType() {
    return getInventoryItemType(leftHandInventoryIndex);
  }

  function rightHandItemType() {
    return getInventoryItemType(rightHandInventoryIndex);
  }

  function packNotFull() {
    return inventory.slice(2).some(isEmptyItem);
  }

  function packNotEmpty() {
    return !inventory.slice(2).every(isEmptyItem);
  }

  function packEmpty() {
    return inventory.slice(2).every(isEmptyItem);
  }

  // Superfluous:
  // function packFull() {
  //   return !inventory.slice(2).some(isEmptyItem);
  // }

  // Modes:

  /** @type {Mode} */
  const playMode = {
    press(command, repeat) {
      const direction = commandDirection[command];
      if (direction !== undefined) {
        worldModel.intend(agent, direction, repeat);
        tick();
        return playMode;
      } else if (command === 5) { // stay
        tick();
        return playMode;
      } else if (command === 1 && isNotEmptyItem(leftHandItemType())) {
        return handleLeftItem();
      } else if (command === 3 && isNotEmptyItem(rightHandItemType())) {
        return handleRightItem();
      } else if (command === 7 && packNotEmpty()) { // stash
        return openStash();
      } else if (command === 9 && worldModel.entityEffects(agent) !== 0) { // effect chooser
        return openEffects();
      } else if (command === 0) {
        return openEditor();
      } else {
        return playMode;
      }
    }
  };

  /**
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function itemMode(leftOrRight, packWasVisible = packNotFull()) {
    // Invariant: the pack should be visible iff there are any empty slots.

    /** @type {Mode} */
    const mode = {
      press(command) {
        if (command === 9) { // trash / consume / convert to effect
          return useItem(leftOrRight, packWasVisible);
        } else if (command === 2 && isNotEmptyItem(rightHandItemType())) { // craft
          return craftItems(leftOrRight, packWasVisible);
        } else if (command === 1) { // place in left hand
          return placeItemInLeftHand(packWasVisible);
        } else if (command === 3) { // place in right hand
          return placeItemInRightHand(packWasVisible);
        } else if (command === 7) { // stash
          return stashItem(leftOrRight);
        }
        return mode;
      },
    };
    return mode;
  }

  /**
   * @param {number} leftOrRight
   */
  function packMode(leftOrRight) {
    /** @type {Mode} */
    const mode = {
      press(command) {
        if (command === 5) { // keep
          dismissPackItemsExcept(-1);

          if (isNotEmptyItem(leftHandItemType())) {
            const entity = entities[4];
            assertNonZero(entity);
            macroViewModel.up(entity);
          }

        } else if (command >= 1 && command <= 9) { // put or swap
          const inventoryIndex = inventoryIndexForCommand[command];
          assertDefined(inventoryIndex);
          assert(inventoryIndex !== -1);
          const inventoryEntityIndex = entityIndexForInventoryIndex[inventoryIndex];
          const toItemDirection = directionToForPackIndex[inventoryIndex - 2];
          const fromItemDirection = directionFromForPackIndex[inventoryIndex - 2];
          const inventoryItemType = getInventoryItemType(inventoryIndex);

          const inventoryEntity = entities[inventoryEntityIndex];
          assertNonZero(inventoryEntity);
          macroViewModel.up(inventoryEntity);

          // From hand to inventory (which is immediately disappearing)
          if (isNotEmptyItem(leftHandItemType())) {
            const itemEntity = entities[4];
            assertNonZero(itemEntity);
            macroViewModel.take(itemEntity, toItemDirection);
          }

          // From inventory to hand (everything else disappearing)
          if (isNotEmptyItem(inventoryItemType)) {
            macroViewModel.move(inventoryEntity, locate(1, 1), fromItemDirection, 0);
            entities[4] = inventoryEntity;
            entities[inventoryEntityIndex] = 0;
          } else {
            dismiss(command - 1);
          }

          dismissPackItemsExcept(inventoryIndex);

          worldModel.swap(agent, leftHandInventoryIndex, inventoryIndex);
        } else {
          return mode;
        }

        if (isNotEmptyItem(leftHandItemType())) {
          restoreControllerReticle();
          restoreLeftHand();
          restoreRightHand();
          restoreRecepticle(leftHandItemType());
          restorePack();
          if (isNotEmptyItem(rightHandItemType())) {
            const otherItemTileType = tileTypeForItemType[rightHandItemType()];
            const centerItemEntity = create(otherItemTileType, locate(1, 3));
            macroViewModel.move(centerItemEntity, locate(1, 2), nn, 0);
            entities[1] = centerItemEntity;
          }
          return itemMode(leftOrRight);
        } else { // back to play mode with an empty hand

          if (leftOrRight < 0) {
            setLeftHandItemType(emptyItem);
            restoreLeftHand();

            if (isEmptyItem(rightHandItemType())) {
              restoreRightHand();
            } else {
              restoreRightItem();
            }
          } else if (leftOrRight > 0) {
            worldModel.swap(agent, leftHandInventoryIndex, rightHandInventoryIndex);
            restoreRightHand();

            if (isEmptyItem(leftHandItemType())) {
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
        if (worldModel.entityHasEffect(agent, chosenType)) {
          return chooseEffect(chosenType);
        }
        return effectMode;
      } else {
        return effectMode;
      }
    }
  };


  /** @type {number} */
  let editType = 0;

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
      } else if (command === 1) { // fill
        if (editType !== 0) {
          worldModel.set(cursor.position, editType);
        }
        return editMode;
      } else if (command === 3) { // dig
        worldModel.remove(cursor.position);
        return editMode;
      } else if (command === 9) { // cut
        const type = worldModel.get(cursor.position);
        if (type !== undefined) {
          worldModel.remove(cursor.position);
          editType = type;
          const entity = entities[4];
          if (entity !== 0) {
            macroViewModel.replace(entity, defaultTileTypeForAgentType[editType]);
          } else {
            restoreCc(defaultTileTypeForAgentType[editType]);
          }
        }
        return editMode;
      } else if (command === 7) { // copy
        const type = worldModel.get(cursor.position);
        if (type !== undefined) {
          editType = type;
          const entity = entities[4];
          if (entity !== 0) {
            macroViewModel.replace(entity, defaultTileTypeForAgentType[editType]);
          } else {
            restoreCc(defaultTileTypeForAgentType[editType]);
          }
        }
        return editMode;
      } else if (command === 5) {
        return openAgentChooser();
      } else if (command === 0) {
        return closeEditor();
      } else {
        return editMode;
      }
    },
  };

  /** @type {Mode} */
  const chooseAgentMode = {
    press(command) {
      if (command === 8) {
        macroViewModel.up(assumeDefined(entities[7]));
        assertNonZero(editType);
        editType = agentTypeForOffset(1);
        shiftAgentsSouth();
      } else if (command === 2) {
        macroViewModel.up(assumeDefined(entities[1]));
        assertNonZero(editType);
        editType = agentTypeForOffset(-1);
        shiftAgentsNorth();
      } else if (command === 6) {
        macroViewModel.up(assumeDefined(entities[5]));
        assertNonZero(editType);
        editType = agentTypeForOffset(3);
        shiftAgentsWest();
      } else if (command === 4) {
        macroViewModel.up(assumeDefined(entities[3]));
        assertNonZero(editType);
        editType = agentTypeForOffset(-3);
        shiftAgentsEast();
      } else if (command === 5) {
        return closeAgentChooser();
      }
      return chooseAgentMode;
    }
  };

  // Mode transitions:

  function handleLeftItem() {
    // Transition from play mode to item handling mode.
    dismissDpad();
    dismissWatch();
    dismissEffect();

    const leftItemEntity = entities[0];
    assertNonZero(leftItemEntity);
    macroViewModel.move(leftItemEntity, locate(1, 1), ne, 0);
    entities[0] = 0;
    entities[4] = leftItemEntity;
    macroViewModel.up(leftItemEntity);

    if (isNotEmptyItem(rightHandItemType())) {
      const rightItemEntity = entities[2];
      assertNonZero(rightItemEntity);
      macroViewModel.move(rightItemEntity, locate(1, 2), ww, 0);
      entities[1] = rightItemEntity;
      restoreRightHand();
    }

    if (packEmpty()) {
      restorePack();
    }
    restoreRecepticle(leftHandItemType());
    restoreLeftHand();
    restoreControllerReticle();

    return itemMode(-1);
  }

  function handleRightItem() {
    // Transition from play mode to item handling mode.
    dismissDpad();
    dismissWatch();
    dismissEffect();

    const rightItemEntity = entities[2];
    assertNonZero(rightItemEntity);
    macroViewModel.move(rightItemEntity, locate(1, 1), nw, 0);
    entities[2] = 0;
    entities[4] = rightItemEntity;
    macroViewModel.up(rightItemEntity);

    if (isNotEmptyItem(leftHandItemType())) {
      const leftItemEntity = entities[0];
      assertNonZero(leftItemEntity);
      macroViewModel.move(leftItemEntity, locate(1, 2), ee, 0);
      entities[1] = leftItemEntity;
      restoreLeftHand();
    }

    if (packEmpty()) {
      restorePack();
    }
    restoreRecepticle(rightHandItemType());
    restoreRightHand();
    restoreControllerReticle();

    worldModel.swap(agent, leftHandInventoryIndex, rightHandInventoryIndex);
    return itemMode(1);
  }

  function openStash() {
    dismissPack();
    dismissEffect();
    dismissDpad();
    dismissWatch();

    if (isEmptyItem(leftHandItemType())) {
      dismissLeft();
      dismissRight();
      restorePackItems();
      return packMode(-1);
    } else if (isEmptyItem(rightHandItemType())) {
      worldModel.swap(agent, leftHandInventoryIndex, rightHandInventoryIndex);
      dismissLeft();
      dismissRight();
      restorePackItems();
      return packMode(1);
    } else {
      const leftEntity = entities[0];
      assertNonZero(leftEntity);
      macroViewModel.move(leftEntity, locate(1, 1), ne, 0);
      entities[4] = leftEntity;
      entities[0] = 0;
      dismissRight();
      restorePackItems();
      return packMode(-1);
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
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function useItem(leftOrRight, packWasVisible) {
    const itemEntity = entities[4];
    assertNonZero(itemEntity);

    dismiss(8); // trash / mouth / or effect

    const use = worldModel.use(agent, leftHandItemType());
    setLeftHandItemType(emptyItem); // TODO should be inventoryIndex above and this line should be implied

    if (use === 'effect') {
      macroViewModel.move(itemEntity, locate(2, 0), ne, 0);
      entities[8] = itemEntity;
      entities[4] = 0;

    } else {
      macroViewModel.take(itemEntity, ne);
      restoreEffect();
    }

    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    if (isEmptyItem(rightHandItemType())) {
    } else if (leftOrRight < 0) {
      worldModel.swap(agent, leftHandInventoryIndex, rightHandInventoryIndex);
      shiftBottomItemToRightHand();
    } else if (leftOrRight > 0) {
      shiftBottomItemToLeftHand();
    }

    restoreDpad();
    restoreWatch();
    dismissControllerReticle();

    tick();

    return playMode;
  }

  /**
   * @param {number} leftOrRight
   * @param {boolean} packWasVisible
   */
  function craftItems(leftOrRight, packWasVisible) {
    const entity = assumeGreaterThanZero(entities[4]);
    const otherEntity = assumeGreaterThanZero(entities[1]);

    const itemType = leftHandItemType();
    const otherItemType = rightHandItemType();

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
        entities[1] = 0;
      }
    }

    // Correct recepticle tile type, if necessary.
    const newRecepticleTileType = recepticleTileType(productType);
    if (recepticleTileType(itemType) !== newRecepticleTileType) {
      macroViewModel.replace(entities[8], newRecepticleTileType);
    }

    setLeftHandItemType(productType);
    setRightHandItemType(byproductType);
    return itemMode(leftOrRight, packWasVisible);
  }

  /**
   * @param {boolean} packWasVisible
   */
  function placeItemInLeftHand(packWasVisible) {
    dismissControllerReticle();
    dismiss(8); // trash
    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    const leftItemEntity = entities[4];
    const leftHand = entities[0];

    assertNonZero(leftItemEntity);
    assertNonZero(leftHand);

    macroViewModel.move(leftItemEntity, locate(0, 2), sw, 0);
    macroViewModel.exit(leftHand);

    entities[0] = leftItemEntity;

    if (isNotEmptyItem(rightHandItemType())) {
      shiftBottomItemToRightHand();
    }

    restoreDpad();
    restoreWatch();
    restoreEffect();

    return playMode;
  }

  /**
   * @param {boolean} packWasVisible
   */
  function placeItemInRightHand(packWasVisible) {
    worldModel.swap(agent, leftHandInventoryIndex, rightHandInventoryIndex);

    dismissControllerReticle();
    dismiss(8); // trash
    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    const rightItemEntity = entities[4];
    const rightHandEntity = entities[2];

    assertNonZero(rightItemEntity);
    assertNonZero(rightHandEntity);

    macroViewModel.move(rightItemEntity, locate(2, 2), se, 0);
    macroViewModel.exit(rightHandEntity);

    entities[2] = rightItemEntity;

    if (isNotEmptyItem(leftHandItemType())) {
      shiftBottomItemToLeftHand();
    }
    restoreDpad();
    restoreWatch();
    restoreEffect();

    return playMode;
  }

  /**
   * @param {number} leftOrRight
   */
  function stashItem(leftOrRight) {
    dismissControllerReticle();
    dismissPack();
    dismiss(8); // trash
    dismissLeft();
    dismissRight();
    if (isNotEmptyItem(rightHandItemType())) {
      dismissOctant(ss);
    }
    restorePackItems();

    return packMode(leftOrRight);
  }

  /**
   * @param {number} chosenType
   */
  function chooseEffect(chosenType) {
    worldModel.chooseEffect(agent, chosenType);

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

    restoreEditorBezel();

    if (editType !== 0) {
      restoreCc(defaultTileTypeForAgentType[editType]);
    }

    lastAgentCursor = cursor;
    worldModel.unfollow(agent, followAgent);
    restoreEditorReticle();

    return editMode;
  }

  function closeEditor() {
    dismissEditorBezel();
    if (editType !== 0) {
      dismissCc();
    }

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
    dismissEditorReticle();

    return playMode;
  }

  /** @type {number} */
  let reticleEntity = 0;

  const firstEligibleEntityType = 4;
  const eligibleEntityCount = agentTypes.length - firstEligibleEntityType;

  /**
   * @param {number} offset
   */
  function agentTypeForOffset(offset) {
    assertNonZero(editType);
    return (
      (eligibleEntityCount + editType - firstEligibleEntityType + offset) % eligibleEntityCount +
      firstEligibleEntityType
    );
  }

  function openAgentChooser() {
    dismissEditorReticle();
    dismissEditorBezel();
    dismissDpad();

    if (editType === 0) {
      editType = 4;
      spawn(4, defaultTileTypeForAgentType[editType]);
    }

    // Initialize board with agent type neighborhood around current edit type.
    for (let index = 0; index < agentOffsets.length; index += 1) {
      const offset = agentOffsets[index];
      const gridIndex = itemGridIndexes[index];
      const agentType = agentTypeForOffset(offset)
      const tileType = defaultTileTypeForAgentType[agentType];
      spawn(gridIndex, tileType);
    }

    restoreControllerReticle();
    return chooseAgentMode;
  }

  function closeAgentChooser() {
    dismissControllerReticle();

    for (let direction = 0; direction < fullOcturn; direction += 1) {
      dismissOctant(direction);
    }

    restoreEditorReticle();
    restoreEditorBezel();
    restoreDpad();

    return editMode;
  }

  // Entity management:

  function updateHands() {
    const packWasVisible = packNotEmpty();

    updateHand(0, 0, tileTypesByName.left);
    updateHand(2, 1, tileTypesByName.right);

    const packIsVisible = packNotEmpty();
    updatePack(packWasVisible, packIsVisible);
  }

  /**
   * @param {number} gridIndex
   * @param {number} inventoryIndex
   * @param {number} handTileType
   */
  function updateHand(gridIndex, inventoryIndex, handTileType) {
    const itemType = getInventoryItemType(inventoryIndex)
    const priorItemType = priorHands[inventoryIndex];
    if (itemType !== priorItemType) {
      priorHands[inventoryIndex] = itemType;

      const entity = entities[gridIndex];
      if (isEmptyItem(itemType)) {
        macroViewModel.replace(entity, handTileType);
      } else {
        const tileType = tileTypeForItemType[itemType];
        macroViewModel.replace(entity, tileType);
      }
    }
  }

  function dismissControllerReticle() {
    assertNonZero(reticleEntity);
    macroViewModel.exit(reticleEntity);
    reticleEntity = 0;
  }

  function restoreControllerReticle() {
    reticleEntity = create(-1, locate(1, 1)); // reticle
    macroViewModel.enter(reticleEntity);
  }

  /** @param {number} slot */
  function dismiss(slot) {
    const entity = entities[slot];
    assertNonZero(entity);
    macroViewModel.exit(entity);
    entities[slot] = 0;
  }

  /**
   * @param {number} tileType
   */
  function restoreCc(tileType) {
    const entity = create(tileType, locate(1, 1));
    macroViewModel.enter(entity);
    entities[4] = entity;
  }

  /**
   * @param {number} tileType
   */
  function restoreNw(tileType) {
    const entity = create(tileType, locate(-1, -1));
    macroViewModel.move(entity, locate(0, 0), se, 0);
    entities[6] = entity;
  }

  /**
   * @param {number} tileType
   */
  function restoreNe(tileType) {
    const entity = create(tileType, locate(3, -1));
    macroViewModel.move(entity, locate(2, 0), sw, 0);
    entities[8] = entity;
  }

  /**
   * @param {number} tileType
   */
  function restoreSw(tileType) {
    const entity = create(tileType, locate(-1, 3));
    macroViewModel.move(entity, locate(0, 2), ne, 0);
    entities[0] = entity;
  }

  /**
   * @param {number} tileType
   */
  function restoreSe(tileType) {
    const entity = create(tileType, locate(3, 3));
    macroViewModel.move(entity, locate(2, 2), nw, 0);
    entities[2] = entity;
  }

  /**
   * @param {number} directionOcturns
   */
  function dismissOctant(directionOcturns) {
    const gridIndex = octurnGridIndexes[directionOcturns];
    const entity = entities[gridIndex];
    assertNonZero(entity, `Expected an entity at gridIndex ${gridIndex} for direction ${directionOcturns}/8th turn clockwise from north`);
    macroViewModel.take(entity, directionOcturns);
    entities[gridIndex] = 0;
  }

  /**
   * @param {number} tileType
   * @param {number} directionOcturns
   */
  function restoreOctant(tileType, directionOcturns) {
    const gridIndex = octurnGridIndexes[directionOcturns];
    const {x, y} = octurnVectors[directionOcturns];
    const entity = create(tileType, locate(1 + x * 2, 1 + y * 2));
    macroViewModel.move(entity, locate(1 + x, 1 + y), (directionOcturns + halfOcturn) % fullOcturn, 0);
    entities[gridIndex] = entity;
  }

  function dismissCc() {
    const watch = entities[4];
    assertNonZero(watch);
    macroViewModel.exit(watch);
    entities[4] = 0;
  }

  function restoreDpad() {
    restoreOctant(tileTypesByName.north, nn);
    restoreOctant(tileTypesByName.east, ee);
    restoreOctant(tileTypesByName.south, ss);
    restoreOctant(tileTypesByName.west, ww);
  }

  function restoreWatch() {
    restoreCc(tileTypesByName.watch);
  }

  function restoreLeft() {
    if (isEmptyItem(leftHandItemType())) {
      restoreLeftHand();
    } else {
      restoreLeftItem();
    }
  }

  function restoreRight() {
    if (isEmptyItem(rightHandItemType())) {
      restoreRightHand();
    } else {
      restoreRightItem();
    }
  }

  function restoreLeftHand() {
    restoreSw(tileTypesByName.left);
  }

  function restoreRightHand() {
    restoreSe(tileTypesByName.right);
  }

  function restoreLeftItem() {
    restoreSw(tileTypeForItemType[leftHandItemType()]);
  }

  function restoreRightItem() {
    restoreSe(tileTypeForItemType[rightHandItemType()]);
  }

  /**
   * @param {number} itemType
   */
  function recepticleTileType(itemType) {
    const { comestible = false, effect = undefined } = itemTypes[itemType];
    let recepticleTileType = tileTypesByName.trash;
    if (effect !== undefined) {
      recepticleTileType = tileTypesByName.arm;
    } else if (comestible) {
      recepticleTileType = tileTypesByName.mouth;
    }
    return recepticleTileType;
  }

  /**
   * @param {number} itemType
   */
  function restoreRecepticle(itemType) {
    restoreNe(recepticleTileType(itemType));
  }

  function restoreEffect() {
    const effectType = worldModel.entityEffect(agent);
    const effectTileType = assumeDefined(tileTypeForEffectType[effectType]);
    restoreNe(effectTileType);
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
    restoreNw(packTileType);
  }

  function dismissPack() {
    dismissOctant(nw);
  }

  function dismissEffect() {
    dismiss(8); // effect
  }

  function dismissLeft() {
    dismissOctant(sw);
  }

  function dismissRight() {
    dismissOctant(se);
  }

  function restorePackItems() {
    for (let i = 0; i < 8; i++) {
      const inventoryIndex = i + 2;
      const itemType = getInventoryItemType(inventoryIndex);
      const entityIndex = entityIndexForInventoryIndex[inventoryIndex];
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
      const effectTileType = worldModel.entityHasEffect(agent, i) ? tileTypeForEffectType[i] : gridTileTypes[i];
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
    for (let i = 2; i < inventory.length; i++) {
      if (i !== exceptItem) {
        const inventoryEntityIndex = entityIndexForInventoryIndex[i];
        dismiss(inventoryEntityIndex);
      }
    }
  }

  function dismissDpad() {
    dismissOctant(nn);
    dismissOctant(ee);
    dismissOctant(ss);
    dismissOctant(ww);
  }

  function dismissWatch() {
    dismissCc();
  }

  function restoreEditorBezel() {
    restoreNe(tileTypesByName.scissors);
    restoreNw(tileTypesByName.twin);
    restoreSw(tileTypesByName.paint);
    restoreSe(tileTypesByName.spoon);
  }

  function dismissEditorBezel() {
    dismissOctant(nw);
    dismissOctant(ne);
    dismissOctant(sw);
    dismissOctant(se);
  }

  function restoreEditorReticle() {
    worldMacroViewModel.put(-1, cursor.position, -1);
  }

  function dismissEditorReticle() {
    worldMacroViewModel.remove(-1);
  }

  function shiftBottomItemToLeftHand() {
    const leftHand = entities[0];
    assertNonZero(leftHand);
    const leftItemEntity = entities[1];
    assertNonZero(leftItemEntity);
    macroViewModel.move(leftItemEntity, locate(0, 2), ww, 0);
    macroViewModel.take(leftHand, sw);
    entities[1] = 0;
    entities[0] = leftItemEntity;
  }

  function shiftBottomItemToRightHand() {
    // If the primary item was on the left,
    // the secondary item goes back to the right.
    const rightHandEntity = entities[2];
    assertNonZero(rightHandEntity);
    const rightItemEntity = entities[1];
    assertNonZero(rightItemEntity);
    macroViewModel.move(rightItemEntity, locate(2, 2), ee, 0);
    macroViewModel.take(rightHandEntity, se);
    entities[1] = 0;
    entities[2] = rightItemEntity;
  }

  /**
   * @param {number} gridIndex
   * @param {number} directionOcturns
   */
  function enterAgent(gridIndex, directionOcturns) {
    const agentOffset = agentOffsetForGridIndex[gridIndex];
    const {x, y} = gridCoordinates[gridIndex];
    const {x: dx, y: dy} = octurnVectors[directionOcturns];
    const startLocation = locate(x - dx, y - dy);
    const endLocation = locate(x, y);
    const agentType = agentTypeForOffset(agentOffset);
    const tileType = defaultTileTypeForAgentType[agentType];
    const agentEntity = create(tileType, startLocation);
    macroViewModel.move(agentEntity, endLocation, directionOcturns, 0);
    return agentEntity;
  }

  function shiftAgentsWest() {
    for (let start = 0; start < 3; start += 1) {
      macroViewModel.take(assumeDefined(entities[start * 3]), ww);
    }
    for (let index = 0; index < 9; index += 3) {
      macroViewModel.move(assumeDefined(entities[1 + index]), gridLocations[0 + index], ww, 0);
      macroViewModel.move(assumeDefined(entities[2 + index]), gridLocations[1 + index], ww, 0);
    }
    for (let index = 0; index < 9; index += 3) {
      entities[0 + index] = entities[1 + index];
      entities[1 + index] = entities[2 + index];
    }
    for (let index = 0; index < 9; index += 3) {
      entities[2 + index] = enterAgent(2 + index, ww);
    }
  }

  function shiftAgentsEast() {
    for (let index = 2; index < 9; index += 3) {
      macroViewModel.take(assumeDefined(entities[index]), ee);
    }
    for (let index = 0; index < 9; index += 3) {
      macroViewModel.move(assumeDefined(entities[0 + index]), gridLocations[1 + index], ee, 0);
      macroViewModel.move(assumeDefined(entities[1 + index]), gridLocations[2 + index], ee, 0);
    }
    for (let index = 6; index >= 0; index -= 3) {
      entities[2 + index] = entities[1 + index];
      entities[1 + index] = entities[0 + index];
    }
    for (let index = 0; index < 9; index += 3) {
      entities[index] = enterAgent(index, ee);
    }
  }

  function shiftAgentsNorth() {
    for (let start = 0; start < 3; start += 1) {
      macroViewModel.take(assumeDefined(entities[start + 6]), ne);
    }
    for (let start = 0; start < 6; start += 1) {
      macroViewModel.move(assumeDefined(entities[start]), gridLocations[start + 3], nn, 0);
    }
    entities.copyWithin(3, 0);
    for (let start = 0; start < 3; start += 1) {
      entities[start] = enterAgent(start, ne);
    }
  }

  function shiftAgentsSouth() {
    for (let start = 0; start < 3; start += 1) {
      macroViewModel.take(assumeDefined(entities[start]), sw);
    }
    for (let start = 0; start < 6; start += 1) {
      macroViewModel.move(assumeDefined(entities[start + 3]), gridLocations[start], ss, 0);
    }
    entities.copyWithin(0, 3);
    for (let start = 0; start < 3; start += 1) {
      entities[start + 6] = enterAgent(start + 6, sw);
    }
  }

  /**
   * @param {number} command
   */
  function down(command) {
    if (command < 1 || command > 9) {
      return;
    }
    const entity = assumeDefined(entities[command - 1], `Failed invariant of controller, entity at index ${command - 1} for command ${command} is not defined`);
    if (entity !== 0) {
      macroViewModel.down(entity);
    }
  }

  /**
   * @param {number} command
   */
  function up(command) {
    if (command < 1 || command > 9) {
      return;
    }
    const entity = assumeDefined(entities[command - 1], `Failed invariant of controller, entity at index ${command - 1} for command ${command} is not defined`);
    if (entity !== 0) {
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

  function tick() {
    priorHands[0] = leftHandItemType();
    priorHands[1] = rightHandItemType();
    worldModel.tick();
    updateHands();
  }

  function reset() {
    worldModel.tock();
    worldViewModel.reset();
    keepTilesAround(cursor.position, frustumRadius);
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
  };
}
