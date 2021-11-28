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

import {assert, assertDefined, assertNonZero, assumeDefined} from './assert.js';
import {nn, ne, ee, se, ss, sw, ww, nw, halfOcturn, fullOcturn} from './geometry2d.js';
import {makeTileView} from './tile-view.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {commandDirection} from './driver.js';
import {tileMap, locate, makeNineKeyView} from './nine-key-view.js';
import {makeElementTracker} from './element-tracker.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */

const noop = () => {};

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

// itemIndex to vector to or from that item index
const directionToForPackIndex = [sw, ss, se, ww, ee, nw, nn, ne];
const directionFromForPackIndex = directionToForPackIndex.map(
  direction => (direction + halfOcturn) % fullOcturn
);

/**
 * @param {SVGElement} $controls
 * @param {SVGElement} $hamburger
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
 * @param {import('./mechanics.js').Mechanics} args.mechanics
 * @param {(progress: Progress) => void} args.animateAux
 * @returns {import('./driver.js').Delegate}
 */
export function makeController($controls, $hamburger, {
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
  mechanics,
  animateAux,
}) {

  const {
    agentTypes,
    itemTypes,
    // tileTypes,
    // effectTypes,
    tileTypesByName,
    // agentTypesByName,
    itemTypesByName,
    // effectTypesByName,
    defaultTileTypeForAgentType,
    tileTypeForItemType,
    tileTypeForEffectType,
    // craft,
    // bump,
    viewText,
  } = mechanics;

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

  // State:

  let lastAgentCursor = cursor;

  /**
   * @param {number} _entity
   * @param {number} type
   */
  function createElement(_entity, type) {
    if (type === -1) {
      const element = document.createElementNS(svgNS, 'circle');
      element.setAttributeNS(null, 'class', 'reticle');
      element.setAttributeNS(null, 'r', '0.75');
      return element;
    } else {
      const text = viewText[type];
      const element = document.createElementNS(svgNS, 'text');
      element.setAttributeNS(null, 'class', 'moji');
      element.appendChild(document.createTextNode(text));
      return element;
    }
  }

  const {keepTilesAround} = makeTileKeeper({
    enter: facetView.enter,
    exit: facetView.exit,
    advance: advance
  });

  const {create, collect, place} = makeElementTracker({ createElement });

  const tileView = makeTileView($controls, null, create, collect);
  const {enter, exit} = tileView;

  const hamburgerView = makeTileView($hamburger, null, create, collect);
  const hamburgerViewModel = makeViewModel();
  const oneTileMap = new Map([[0, {x: 0, y: 0, a: 0}]]);
  hamburgerViewModel.watch(oneTileMap, {
    enter: hamburgerView.enter,
    exit: hamburgerView.exit,
    place,
  })
  const oneKeyView = makeMacroViewModel(hamburgerViewModel, { name: 'hamburger', start: -2, stride: -1 });
  oneKeyView.put(0, 0, tileTypesByName.hamburger);

  const controlsViewModel = makeViewModel();
  const macroViewModel = makeMacroViewModel(controlsViewModel, {name: 'controls'});

  controlsViewModel.watch(tileMap, {enter, exit, place});

  /** @type {import('./model.js').FollowFn} */
  function followAgent(_entity, change, destination) {
    cursor = {...change, position: destination};
    followCursor(destination, change);
  }

  worldModel.follow(agent, followAgent);

  const priorHands = [emptyItem, emptyItem];

  // index of enabled effect, or -1 for no effect
  const effectType = worldModel.entityEffect(agent);

  const nineKeyView = makeNineKeyView(macroViewModel);

  const initialTileTypes = [
    tileTypesByName.left,
    tileTypesByName.south,
    tileTypesByName.right,
    tileTypesByName.west,
    tileTypesByName.watch,
    tileTypesByName.east,
    packNotEmpty() ? tileTypesByName.backpack : 0,
    tileTypesByName.north,
    tileTypeForEffectType[effectType],
  ];

  for (let i = 0; i < 9; i += 1) {
    if (initialTileTypes[i] !== 0) {
      nineKeyView.spawn(i, initialTileTypes[i]);
    }
  }

  /** @type {number} */
  let packTileType = tileTypesByName.backpack;

  // Common queries:

  function leftHandItemType() {
    return worldModel.inventory(agent, leftHandInventoryIndex);
  }

  function rightHandItemType() {
    return worldModel.inventory(agent, rightHandInventoryIndex);
  }

  function packNotFull() {
    return !worldModel.allPacked(agent, 2);
  }

  function packNotEmpty() {
    return worldModel.anyPacked(agent, 2);
  }

  function packEmpty() {
    return !worldModel.anyPacked(agent, 2);
  }

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
      } else if (command === 0 && !repeat) {
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

        } else if (command >= 1 && command <= 9) { // put or swap
          const inventoryIndex = inventoryIndexForCommand[command];
          assertDefined(inventoryIndex);
          assert(inventoryIndex !== -1);
          const inventoryEntityIndex = entityIndexForInventoryIndex[inventoryIndex];
          const toItemDirection = directionToForPackIndex[inventoryIndex - 2];
          const fromItemDirection = directionFromForPackIndex[inventoryIndex - 2];
          const inventoryItemType = worldModel.inventory(agent, inventoryIndex);

          // From hand to inventory (which is immediately disappearing)
          if (isNotEmptyItem(leftHandItemType())) {
            nineKeyView.take(4, toItemDirection);
          }

          // From inventory to hand (everything else disappearing)
          if (isNotEmptyItem(inventoryItemType)) {
            nineKeyView.move(inventoryEntityIndex, 4, fromItemDirection, 0);
          } else {
            nineKeyView.despawn(command - 1);
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
            nineKeyView.spawnInward(otherItemTileType, ss);
          }
          return itemMode(leftOrRight);
        } else { // back to play mode with an empty hand

          if (leftOrRight < 0) {
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
    press(command, repeat) {
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
          nineKeyView.replace(4, defaultTileTypeForAgentType[editType]);
        }
        return editMode;
      } else if (command === 7) { // copy
        const type = worldModel.get(cursor.position);
        if (type !== undefined) {
          editType = type;
          nineKeyView.replace(4, defaultTileTypeForAgentType[editType]);
        }
        return editMode;
      } else if (command === 5) {
        return openAgentChooser();
      } else if (command === 0 && !repeat) {
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
        assertNonZero(editType);
        editType = agentTypeForOffset(1);
        shiftAgentsSouth();
      } else if (command === 2) {
        assertNonZero(editType);
        editType = agentTypeForOffset(-1);
        shiftAgentsNorth();
      } else if (command === 6) {
        assertNonZero(editType);
        editType = agentTypeForOffset(3);
        shiftAgentsWest();
      } else if (command === 4) {
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

    nineKeyView.move(0, 4, ne, 0);

    if (isNotEmptyItem(rightHandItemType())) {
      nineKeyView.move(2, 1, ww, 0);
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

    nineKeyView.move(2, 4, nw, 0);

    if (isNotEmptyItem(leftHandItemType())) {
      nineKeyView.move(0, 1, ee, 0);
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
      nineKeyView.move(0, 4, ne, 0);
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
    nineKeyView.despawn(8); // trash / mouth / or effect

    const use = worldModel.use(agent, leftHandInventoryIndex);

    if (use === 'effect') {
      nineKeyView.move(4, 8, ne, 0);
    } else {
      nineKeyView.take(4, ne);
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
    const agentType = leftHandItemType();
    const reagentType = rightHandItemType();

    worldModel.intendToCraft(agent);
    tick();

    const productType = leftHandItemType();
    const byproductType = rightHandItemType();

    console.table({
      agent: itemTypes[agentType].name,
      reagent: itemTypes[reagentType].name,
      product: itemTypes[productType].name,
      byproduct: itemTypes[byproductType].name,
    });

    assert(reagentType !== productType);
    assert(isNotEmptyItem(productType));
    const productTileType = tileTypeForItemType[productType];

    if (reagentType === byproductType && isNotEmptyItem(byproductType)) {
      // The agent is replaced with the product.  The reagent is also the
      // byproduct, in other words, it is a catalyst and just bounces in
      // place.
      nineKeyView.replace(4, productTileType);
      nineKeyView.bounce(4, nn);

    } else if (agentType === byproductType) {
      // The agent becomes the byproduct when the formula above gets
      // reversed.  In this case, the agent becomes the byproduct, or
      // rather, it just moves from the top to the bottom slot.
      nineKeyView.move(4, 1, ss, 0);
      nineKeyView.despawnOutward(nn);
      nineKeyView.spawn(4, productTileType);

    } else {
      nineKeyView.replace(4, productTileType);
      nineKeyView.take(1, nn);

      if (isNotEmptyItem(byproductType)) {
        const byproductTileType = tileTypeForItemType[byproductType];
        nineKeyView.spawn(1, byproductTileType);
      }
    }

    // Correct recepticle tile type, if necessary.
    const newRecepticleTileType = recepticleTileType(productType);
    if (recepticleTileType(agentType) !== newRecepticleTileType) {
      nineKeyView.replace(8, newRecepticleTileType);
    }

    return itemMode(leftOrRight, packWasVisible);
  }

  /**
   * @param {boolean} packWasVisible
   */
  function placeItemInLeftHand(packWasVisible) {
    dismissControllerReticle();
    nineKeyView.despawn(8); // trash
    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    nineKeyView.despawn(0);
    nineKeyView.move(4, 0, sw, 0);

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
    nineKeyView.despawn(8); // trash
    if (packWasVisible && packEmpty()) {
      dismissPack();
    }

    nineKeyView.despawn(2);
    nineKeyView.move(4, 2, se, 0);

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
    nineKeyView.despawn(8); // trash
    dismissLeft();
    dismissRight();
    if (isNotEmptyItem(rightHandItemType())) {
      nineKeyView.despawnOutward(ss);
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
      nineKeyView.spawn(4, defaultTileTypeForAgentType[editType]);
    }

    lastAgentCursor = cursor;
    worldModel.unfollow(agent, followAgent);
    restoreEditorReticle();

    oneKeyView.replace(0, tileTypesByName.back);

    return editMode;
  }

  function closeEditor() {
    dismissEditorBezel();
    if (editType !== 0) {
      nineKeyView.despawn(4);
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

    oneKeyView.replace(0, tileTypesByName.hamburger);

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
      nineKeyView.spawn(4, defaultTileTypeForAgentType[editType]);
    }

    // Initialize board with agent type neighborhood around current edit type.
    for (let index = 0; index < agentOffsets.length; index += 1) {
      const offset = agentOffsets[index];
      const gridIndex = itemGridIndexes[index];
      const agentType = agentTypeForOffset(offset)
      const tileType = defaultTileTypeForAgentType[agentType];
      nineKeyView.spawn(gridIndex, tileType);
    }

    restoreControllerReticle();
    return chooseAgentMode;
  }

  function closeAgentChooser() {
    dismissControllerReticle();

    for (let direction = 0; direction < fullOcturn; direction += 1) {
      nineKeyView.despawnOutward(direction);
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
    const itemType = worldModel.inventory(agent, inventoryIndex)
    const priorItemType = priorHands[inventoryIndex];
    if (itemType !== priorItemType) {
      priorHands[inventoryIndex] = itemType;

      if (isEmptyItem(itemType)) {
        nineKeyView.replace(gridIndex, handTileType);
      } else {
        const tileType = tileTypeForItemType[itemType];
        nineKeyView.replace(gridIndex, tileType);
      }
    }
  }

  function dismissControllerReticle() {
    assertNonZero(reticleEntity);
    macroViewModel.exit(reticleEntity);
    reticleEntity = 0;
  }

  function restoreControllerReticle() {
    reticleEntity = nineKeyView.create(-1, locate(1, 1)); // reticle
    macroViewModel.enter(reticleEntity);
  }

  function restoreDpad() {
    nineKeyView.spawnInward(tileTypesByName.north, nn);
    nineKeyView.spawnInward(tileTypesByName.east, ee);
    nineKeyView.spawnInward(tileTypesByName.south, ss);
    nineKeyView.spawnInward(tileTypesByName.west, ww);
  }

  function restoreWatch() {
    nineKeyView.spawn(4, tileTypesByName.watch);
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
    nineKeyView.spawnInward(tileTypesByName.left, sw);
  }

  function restoreRightHand() {
    nineKeyView.spawnInward(tileTypesByName.right, se);
  }

  function restoreLeftItem() {
    nineKeyView.spawnInward(tileTypeForItemType[leftHandItemType()], sw);
  }

  function restoreRightItem() {
    nineKeyView.spawnInward(tileTypeForItemType[rightHandItemType()], se);
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
    nineKeyView.spawnInward(recepticleTileType(itemType), ne);
  }

  function restoreEffect() {
    const effectType = worldModel.entityEffect(agent);
    const effectTileType = assumeDefined(tileTypeForEffectType[effectType]);
    nineKeyView.spawnInward(effectTileType, ne);
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
    nineKeyView.spawnInward(packTileType, nw);
  }

  function dismissPack() {
    nineKeyView.despawnOutward(nw);
  }

  function dismissEffect() {
    nineKeyView.despawn(8); // effect
  }

  function dismissLeft() {
    nineKeyView.despawnOutward(sw);
  }

  function dismissRight() {
    nineKeyView.despawnOutward(se);
  }

  function restorePackItems() {
    for (let i = 0; i < 8; i++) {
      const inventoryIndex = i + 2;
      const itemType = worldModel.inventory(agent, inventoryIndex);
      const entityIndex = entityIndexForInventoryIndex[inventoryIndex];
      const itemGridIndex = itemGridIndexes[i];
      const itemTileType = isNotEmptyItem(itemType) ? tileTypeForItemType[itemType] : gridTileTypes[itemGridIndex];
      nineKeyView.spawn(entityIndex, itemTileType);
    }
  }

  function restoreEffects() {
    for (let i = 0; i < 9; i++) {
      const effectTileType = worldModel.entityHasEffect(agent, i) ? tileTypeForEffectType[i] : gridTileTypes[i];
      nineKeyView.spawn(i, effectTileType);
    }
  }

  function dismissEffects() {
    for (let i = 0; i < 9; i++) {
      nineKeyView.despawn(i);
    }
  }

  /**
   * @param {number} exceptItem
   */
  function dismissPackItemsExcept(exceptItem) {
    for (let i = 2; i < 10; i++) {
      if (i !== exceptItem) {
        const inventoryEntityIndex = entityIndexForInventoryIndex[i];
        nineKeyView.despawn(inventoryEntityIndex);
      }
    }
  }

  function dismissDpad() {
    nineKeyView.despawnOutward(nn);
    nineKeyView.despawnOutward(ee);
    nineKeyView.despawnOutward(ss);
    nineKeyView.despawnOutward(ww);
  }

  function dismissWatch() {
    nineKeyView.despawn(4);
  }

  function restoreEditorBezel() {
    nineKeyView.spawnInward(tileTypesByName.scissors, ne);
    nineKeyView.spawnInward(tileTypesByName.twin, nw);
    nineKeyView.spawnInward(tileTypesByName.paint, sw);
    nineKeyView.spawnInward(tileTypesByName.spoon, se);
  }

  function dismissEditorBezel() {
    nineKeyView.despawnOutward(nw);
    nineKeyView.despawnOutward(ne);
    nineKeyView.despawnOutward(sw);
    nineKeyView.despawnOutward(se);
  }

  function restoreEditorReticle() {
    worldMacroViewModel.put(-1, cursor.position, -1);
  }

  function dismissEditorReticle() {
    worldMacroViewModel.remove(-1);
  }

  function shiftBottomItemToLeftHand() {
    nineKeyView.despawnOutward(sw);
    nineKeyView.move(1, 0, ww, 0);
  }

  function shiftBottomItemToRightHand() {
    nineKeyView.despawnOutward(se);
    nineKeyView.move(1, 2, ee, 0);
  }

  /**
   * @param {number} gridIndex
   * @param {number} directionOcturns
   */
  function enterAgent(gridIndex, directionOcturns) {
    const agentOffset = agentOffsetForGridIndex[gridIndex];
    const agentType = agentTypeForOffset(agentOffset);
    const tileType = defaultTileTypeForAgentType[agentType];
    nineKeyView.give(gridIndex, tileType, directionOcturns);
  }

  function shiftAgentsWest() {
    for (let start = 0; start < 3; start += 1) {
      nineKeyView.take(start * 3, ww);
    }
    for (let index = 0; index < 9; index += 3) {
      nineKeyView.move(1 + index, 0 + index, ww, 0);
      nineKeyView.move(2 + index, 1 + index, ww, 0);
    }
    for (let index = 0; index < 9; index += 3) {
      enterAgent(2 + index, ww);
    }
  }

  function shiftAgentsEast() {
    for (let index = 2; index < 9; index += 3) {
      nineKeyView.take(index, ee);
    }
    for (let index = 0; index < 9; index += 3) {
      nineKeyView.move(1 + index, 2 + index, ee, 0);
      nineKeyView.move(0 + index, 1 + index, ee, 0);
    }
    for (let index = 0; index < 9; index += 3) {
      enterAgent(index, ee);
    }
  }

  function shiftAgentsNorth() {
    for (let start = 0; start < 3; start += 1) {
      nineKeyView.take(start + 6, ne);
    }
    for (let start = 0; start < 3; start += 1) {
      nineKeyView.move(start + 3, start + 6, nn, 0);
      nineKeyView.move(start + 0, start + 3, nn, 0);
    }
    for (let start = 0; start < 3; start += 1) {
      enterAgent(start, ne);
    }
  }

  function shiftAgentsSouth() {
    for (let start = 0; start < 3; start += 1) {
      nineKeyView.take(start, sw);
    }
    for (let start = 0; start < 6; start += 1) {
      nineKeyView.move(start + 3, start, ss, 0);
    }
    for (let start = 0; start < 3; start += 1) {
      enterAgent(start + 6, sw);
    }
  }

  /**
   * @param {number} command
   */
  function down(command) {
    if (command >= 1 && command <= 9) {
      return nineKeyView.down(command - 1);
    }
    if (command === 0) {
      return oneKeyView.down(0);
    }
    return noop;
  }

  /**
   * @param {Progress} progress
   */
  function animate(progress) {
    camera.animate(progress.now);
    worldViewModel.animate(progress);
    macroViewModel.animate(progress);
    hamburgerViewModel.animate(progress);
    animateAux(progress);
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
    oneKeyView.reset();
  }

  let mode = playMode;

  /** @type {PressFn} */
  function command(command, repeat) {
    mode = mode.press(command, repeat);
  }

  return {
    reset,
    animate,
    down,
    command,
  };
}

/**
 * @param {Element} $controls
 * @param {Element} $hamburger
 * @param {import('./commands.js').CommandDispatcher} dispatcher
 * @param {Object} args
 * @param {number} args.tileSize
 */
export const watchControllerCommands = ($controls, $hamburger, dispatcher, {
  tileSize,
}) => {

  let previousCommand = -1;

  /**
   * @param {MouseEvent} event
   */
  const controlEventToCommand = event => {
    const {offsetX, offsetY} = event;
    const coord = {x: Math.floor(offsetX / tileSize), y: Math.floor(offsetY / tileSize)};
    const {x, y} = coord;
    if (x >= 3 || y >= 3 || x < 0 || y < 0) return -1;
    return x + (2 - y) * 3 + 1;
  };

  /**
   * @param {number} command
   * @param {boolean} pressed
   */
  const onControlMouseStateChange = (command, pressed) => {
    if (pressed) {
      if (previousCommand === -1) { // unpressed to pressed
        previousCommand = command;
        dispatcher.down('Mouse', previousCommand);
      } else { // steadily down, maybe relocated
        if (previousCommand !== command) {
          dispatcher.up('Mouse', previousCommand);
          previousCommand = command;
          dispatcher.down('Mouse', previousCommand);
        }
      }
    } else { // to unpressed
      if (previousCommand !== -1) { // pressed to unpressed
        dispatcher.up('Mouse', previousCommand);
        previousCommand = -1;
      } /* else { // steadily unpressed
      } */
    }
  }

  /**
   * @param {Event} event
   */
  const onControlsMouseChange = event => {
    const mouseEvent = /** @type {MouseEvent} */(event);
    const command = controlEventToCommand(mouseEvent);
    onControlMouseStateChange(command, (mouseEvent.buttons & 1) !== 0);
  };

  /**
   * @param {Event} event
   */
  const onControlsMouseEnter = event => {
    const mouseEvent = /** @type {MouseEvent} */(event);
    const command = controlEventToCommand(mouseEvent);
    onControlMouseStateChange(command, (mouseEvent.buttons & 1) !== 0);
    $controls.addEventListener('mousemove', onControlsMouseChange);
  };

  const onControlsMouseLeave = () => {
    onControlMouseStateChange(-1, false);
    $controls.removeEventListener('mousemove', onControlsMouseChange);
  };

  $controls.addEventListener('mouseenter', onControlsMouseEnter);
  $controls.addEventListener('mouseleave', onControlsMouseLeave);
  $controls.addEventListener('mouseup', onControlsMouseChange);
  $controls.addEventListener('mousedown', onControlsMouseChange);

  const onHamburgerMouseDown = () => {
    dispatcher.down('Mouse', 0);
  };

  const onHamburgerMouseUp = () => {
    dispatcher.up('Mouse', 0);
  };

  $hamburger.addEventListener('mousedown', onHamburgerMouseDown);
  $hamburger.addEventListener('mouseup', onHamburgerMouseUp);
};
