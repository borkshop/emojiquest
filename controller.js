/**
 * The controls module manages a view of the player's control pad, receives
 * commands, manages the commands that pertain to inventory management, and
 * forwards other commands that pertain to player motion in the world.
 * The control pad consists of a state machine that responds to the commands
 * in the Emoji Quest command vocabulary, normalized to the its 1-9 and
 * arranged similarly on a 3x3 grid like a calculator.
 * The controller is responsible for orchestrating the animated transitions of
 * all the buttons on the control pad as the user flows between input modes and
 * may also in the future take responsibility for orchestrating corresponding
 * sounds.
 */

// @ts-check

import {
  assert,
  assertDefined,
  assertNonZero,
  assumeDefined,
} from './lib/assert.js';
import {
  north,
  west,
  east,
  south,
  nn,
  ne,
  ee,
  se,
  ss,
  sw,
  ww,
  nw,
  halfOcturn,
  fullOcturn,
} from './lib/geometry2d.js';
import { terrainWater, terrainLava, terrainCold, terrainHot } from './model.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { tileMap, locate, makeNineKeyView } from './nine-key-view.js';
import { makeBoxTileMap } from './tile-map-box.js';

/** @typedef {import('./progress.js').AnimateFn} AnimateFn */
/** @typedef {import('./progress.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./types.js').Watcher} Watcher */
/** @typedef {import('./types.js').PlaceFn} PlaceFn */
/** @typedef {import('./types.js').WatchEntitiesFn} WatchEntitiesFn */

/**
 * @callback InputFn
 * @param {object} [options]
 * @param {string} [options.placeholder]
 * @param {string} [options.initial]
 * @returns {Promise<string | undefined>}
 */

/**
 * @callback ChooseFn
 * @param {Record<string, any>} options
 * @returns {Promise<any | undefined>}
 */

/**
 * @typedef {object} LoadedWorld
 * @property {number | undefined} player
 * @property {ReturnType<import('./world.js').makeWorld>} world
 * @property {import('./mechanics.js').Mechanics} mechanics
 * @property {import('./file.js').WholeWorldDescription} wholeWorldDescription
 */

/**
 * @callback LoadWorldFn
 * @returns {Promise<undefined | LoadedWorld>}
 */

/**
 * @param {Object} object
 * @param {string | number | symbol} key
 */
const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

/** @type {Map<number, number>} */
export const commandDirection = new Map([
  [8, north],
  [4, west],
  [6, east],
  [2, south],
]);

/** @type {Map<number, number>} */
export const directionCommand = new Map(
  [...commandDirection.entries()].map(([command, direction]) => [
    +direction,
    +command,
  ]),
);

const arrowKeys = {
  ArrowUp: 8,
  ArrowLeft: 4,
  ArrowRight: 6,
  ArrowDown: 2,

  h: 4,
  j: 2,
  k: 8,
  l: 6,

  w: 8,
  a: 4,
  s: 2,
  d: 6,
};

const handKeys = {
  ' ': 5, // rest

  z: 1, // left
  c: 3, // right
  q: 7, // pack
  e: 9, // use/trash

  u: 1, // left
  i: 3, // right
  p: 7, // pack
  o: 9, // use/trash
};

const numberKeys = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
};

const noop = () => {};

/**
 * @callback FollowCursorFn
 * @param {number} destination
 * @param {import('./types.js').CursorChange} change
 */

/**
 * @template T
 * @template U
 * @typedef {AsyncIterator<T, U> & {[Symbol.asyncIterator]: () => AsyncIterator<T, U>}} AsyncIteration
 */

/**
 * @callback HandleCommandFn
 * @param {number} command
 * @param {boolean} repeat
 * @returns {AsyncIteration<void, void>}
 */

/**
 * @callback HandleModeCommandFn
 * @param {number} command
 * @param {boolean} repeat
 * @returns {AsyncIteration<void, Mode>}
 */

/**
 * @callback HandleMiscKeyPress - a hopefully temporary hack that allows me to feed
 * arbitrary keypresses to some modes in order to defer the problem of creating
 * a coherent user interface for these experimental bindings.
 * @param {string} key
 * @returns {boolean} used
 */

/**
 * @callback InventoryFn
 * @param {number} slot
 * @param {number} itemType
 */

/**
 * @callback CraftFn
 * @param {import('./types.js').Recipe} recipe
 */

/**
 * @callback PlayFn
 * @param {World} world
 * @param {import('./mechanics.js').Mechanics} mechanics
 * @param {number | undefined} player
 * @param {import('./file.js').WholeWorldDescription} wholeWorldDescription
 * @returns {Mode}
 */

/**
 * @callback MoveFn
 * @param {import('./types.js').CursorChange} change
 * @param {number} destination
 */

/**
 * @callback JumpFn
 * @param {number} destination
 */

/**
 * @typedef {object} Mode
 * @prop {string} name
 * @prop {HandleModeCommandFn} handleCommand
 * @prop {{[key: string]: number}} commandKeys - accelerator table
 * @prop {HandleMiscKeyPress} [handleMiscKeyPress]
 * @prop {MoveFn} [move]
 * @prop {JumpFn} [jump]
 * @prop {CraftFn} [craft]
 * @prop {InventoryFn} [inventory]
 * @prop {PlayFn} [play]
 */

const leftHandInventoryIndex = 0;
const rightHandInventoryIndex = 1;
const inventoryIndexForCommand = [-1, 2, 3, 4, 5, -1, 6, 7, 8, 9];
const entityIndexForInventoryIndex = [-1, -1, 0, 1, 2, 3, 5, 6, 7, 8];

// itemIndex to vector to or from that item index
const directionToForPackIndex = [sw, ss, se, ww, ee, nw, nn, ne];
const directionFromForPackIndex = directionToForPackIndex.map(
  direction => (direction + halfOcturn) % fullOcturn,
);

/**
 * @typedef {Object} CameraController
 * @prop {(location: number) => void} jump
 * @prop {(destination: number, change: import('./types.js').CursorChange) => void} move
 * @prop {() => void} tick
 * @prop {() => void} tock
 * @prop {(progress: Progress) => void} animate
 */

/**
 * @typedef {Object} TileView
 * @prop {(tileNumber: number, tileType: number) => void} enter
 * @prop {(tileNumber: number) => void} exit
 */

/**
 * @typedef {object} Clock
 * @prop {() => void} tick
 * @prop {() => void} tock
 * @prop {(progress: Progress) => void} animate
 */

/**
 * @typedef {object} Face
 * @prop {string} name
 * @prop {number} offset
 * @prop {number} size
 */

/**
 * @typedef {object} Level
 * @prop {string} name
 * @prop {number} offset
 * @prop {number} size
 * @prop {Array<Face>} faces
 */

/**
 * @typedef {object} World
 * @prop {string} name
 * @prop {Array<Level>} levels
 * @prop {import('./types.js').ModelFacetForController} worldModel
 * @prop {import('./types.js').MacroViewModelFacetForController} worldMacroViewModel
 * @prop {import('./types.js').AdvanceFn} advance,
 * @prop {import('./types.js').ToponymFn} toponym
 * @prop {import('./model.js').CaptureFn} capture
 * @prop {CameraController} cameraController
 */

export const builtinTileTextByName = {
  invalid: '�', // iota + 2
  empty: '',
  any: '*',
  hamburger: '🍔',
  backpack: '🎒',
  watch: '⏱',
  left: '🫲',
  right: '🫱',
  trash: '🗑',
  mouth: '👄',
  thumbUp: '👍',
  north: '👆',
  east: '👉',
  south: '👇',
  west: '👈',
  cut: '✂️',
  copy: '📸',
  draw: '✏️',
  erase: '🗑',
  health: '❤️',
  stamina: '💛  ',
};

const invalidItem = 0;
const emptyItem = 1;
// const anyItem = 2;

/**
 * @param {number} itemType
 */
const isEmptyItem = itemType => {
  assert(itemType !== invalidItem, `Invalid item type ${itemType}`);
  return itemType === emptyItem;
};

/**
 * @param {number} itemType
 */
const isNotEmptyItem = itemType => {
  assert(itemType !== invalidItem, `Invalid item type ${itemType}`);
  return itemType !== emptyItem;
};

export const builtinTileTypesByName = Object.fromEntries(
  Object.keys(builtinTileTextByName).map((name, index) => [name, -index - 2]),
);

export const builtinTileText = Object.values(builtinTileTextByName);

export const builtinTileNames = Object.keys(builtinTileTypesByName);

/**
 * @param {Object} args
 * @param {import('./view-model.js').Watcher} args.nineKeyWatcher
 * @param {import('./view-model.js').Watcher} args.oneKeyWatcher
 * @param {import('./dialog.js').DialogController} args.dialogController
 * @param {import('./health.js').HealthController} args.healthController
 * @param {import('./stamina.js').StaminaController} args.staminaController
 * @param {LoadWorldFn} args.loadWorld
 * @param {(worldData: import('./file.js').WholeWorldDescription) => Promise<void>} args.saveWorld
 * @param {FollowCursorFn} args.followCursor
 * @param {ChooseFn} args.choose
 * @param {InputFn} args.input
 * @param {import('./types.js').Clock} args.supplementaryAnimation
 */
export const makeController = ({
  nineKeyWatcher,
  oneKeyWatcher,
  dialogController,
  healthController,
  staminaController,
  followCursor,
  loadWorld,
  saveWorld,
  choose,
  input,
  supplementaryAnimation,
}) => {
  // State:

  const oneKeyViewModel = makeViewModel();
  const oneTileMap = makeBoxTileMap();
  oneKeyViewModel.watchEntities(oneTileMap, oneKeyWatcher);
  const oneKeyView = makeMacroViewModel(oneKeyViewModel, {
    name: 'hamburger',
  });
  oneKeyView.put(0, 0, builtinTileTypesByName.hamburger);

  const nineKeyViewModel = makeViewModel();
  const nineKeyMacroViewModel = makeMacroViewModel(nineKeyViewModel, {
    name: 'controls',
  });
  const nineKeyView = makeNineKeyView(nineKeyMacroViewModel);

  nineKeyViewModel.watchEntities(tileMap, nineKeyWatcher);

  /** @type {import('./types.js').ModelFollower} */
  const playerFollower = {
    move(_entity, change, destination) {
      if (mode.move !== undefined) {
        mode.move(change, destination);
      }
    },
    jump(_entity, destination) {
      if (mode.jump !== undefined) {
        mode.jump(destination);
      }
    },
    craft(_entity, recipe) {
      assert(mode.name === 'item');
      if (mode.craft !== undefined) {
        mode.craft(recipe);
      }
    },
    inventory(_entity, slot, item) {
      if (mode.inventory !== undefined) {
        mode.inventory(slot, item);
      }
    },
    dialog(_entity, text) {
      dialogController.logHTML(text);
    },
    health(_entity, health) {
      healthController.set(health);
    },
    stamina(_entity, stamina) {
      staminaController.set(stamina);
    },
  };

  // Pack visibility state in play mode.
  let packVisible = false;

  /** @type {number} */
  let packTileType = builtinTileTypesByName.backpack;

  /** @type {number} */
  let reticleEntity = 0;

  /** @type {number} */
  let editType = 0;

  // Modes:

  /**
   * @param {World} world
   * @param {import('./mechanics.js').Mechanics} mechanics
   * @param {import('./file.js').WholeWorldDescription} wholeWorldDescription
   */
  const makeWorldModes = (world, mechanics, wholeWorldDescription) => {
    const {
      levels,
      worldModel,
      worldMacroViewModel,
      cameraController,
      toponym,
      advance,
      capture,
    } = world;
    const {
      agentTypes,
      itemTypes,
      tileTypes,
      // effectTypes,
      // tileTypesByName,
      agentTypesByName,
      // itemTypesByName,
      // effectTypesByName,
      defaultTileTypeForAgentType,
      tileTypeForItemType,
      describeSlot,
      // tileTypeForEffectType,
      // craft,
      // bump,
      // viewText,
    } = mechanics;

    // TODO persistence of marks
    /** @type {Map<string, number>} */
    const marks = new Map();

    /**
     * @param {number} player
     * @param {Object} handoff
     * @param {boolean} [handoff.north]
     * @param {boolean} [handoff.south]
     * @param {boolean} [handoff.east]
     * @param {boolean} [handoff.west]
     */
    const enterPlayMode = (player, handoff) => {
      const position = worldModel.locate(player);
      let cursor = { position, direction: north };

      // Common queries:
      const leftHandItemType = () =>
        worldModel.inventory(player, leftHandInventoryIndex);
      const rightHandItemType = () =>
        worldModel.inventory(player, rightHandInventoryIndex);
      const packNotFull = () => !worldModel.allPacked(player, 2);
      const packNotEmpty = () => worldModel.anyPacked(player, 2);
      const packEmpty = () => !worldModel.anyPacked(player, 2);

      // Entity management:

      const restoreWatch = () => {
        nineKeyView.spawn(4, builtinTileTypesByName.watch);
      };

      const openLeftHand = () => {
        nineKeyView.spawn(0, builtinTileTypesByName.left);
      };

      const openRightHand = () => {
        nineKeyView.spawn(2, builtinTileTypesByName.right);
      };

      const closeLeftHand = () => {
        nineKeyView.despawn(0);
      };

      const closeRightHand = () => {
        nineKeyView.despawn(2);
      };

      const restoreLeft = () => {
        if (isEmptyItem(leftHandItemType())) {
          restoreLeftHand();
        } else {
          restoreLeftItem();
        }
      };

      const restoreRight = () => {
        if (isEmptyItem(rightHandItemType())) {
          restoreRightHand();
        } else {
          restoreRightItem();
        }
      };

      const restoreLeftHand = () => {
        nineKeyView.spawnInward(builtinTileTypesByName.left, sw);
      };

      const restoreRightHand = () => {
        nineKeyView.spawnInward(builtinTileTypesByName.right, se);
      };

      const restoreLeftItem = () => {
        nineKeyView.spawnInward(tileTypeForItemType[leftHandItemType()], sw);
      };

      const restoreRightItem = () => {
        nineKeyView.spawnInward(tileTypeForItemType[rightHandItemType()], se);
      };

      /**
       * @param {number} itemType
       */
      const recepticleTileType = itemType => {
        const { comestible = false } = itemTypes[itemType];
        let recepticleTileType = builtinTileTypesByName.trash;
        if (comestible) {
          recepticleTileType = builtinTileTypesByName.mouth;
        }
        return recepticleTileType;
      };

      /**
       * @param {number} itemType
       */
      const restoreRecepticle = itemType => {
        nineKeyView.spawnInward(recepticleTileType(itemType), ne);
      };

      const restorePack = () => {
        nineKeyView.spawnInward(packTileType, nw);
        packVisible = true;
      };

      const dismissPack = () => {
        nineKeyView.despawnOutward(nw);
        packVisible = false;
      };

      const dismissTrash = () => {
        nineKeyView.despawnOutward(ne);
      };

      const dismissLeft = () => {
        nineKeyView.despawnOutward(sw);
      };

      const dismissRight = () => {
        nineKeyView.despawnOutward(se);
      };

      const restorePackItems = () => {
        const playerType = worldModel.entityType(player);
        for (let i = 0; i < 8; i++) {
          const inventoryIndex = i + 2;
          const itemType = worldModel.inventory(player, inventoryIndex);
          const entityIndex = entityIndexForInventoryIndex[inventoryIndex];
          const itemTileType = isNotEmptyItem(itemType)
            ? tileTypeForItemType[itemType]
            : describeSlot(playerType, inventoryIndex).tileType;
          nineKeyView.spawn(entityIndex, itemTileType);
        }
      };

      /**
       * @param {number} exceptItem
       */
      const dismissPackItemsExcept = exceptItem => {
        for (let i = 2; i < 10; i++) {
          if (i !== exceptItem) {
            const inventoryEntityIndex = entityIndexForInventoryIndex[i];
            nineKeyView.despawn(inventoryEntityIndex);
          }
        }
      };

      const dismissWatch = () => {
        nineKeyView.despawn(4);
      };

      const shiftBottomItemToLeftHand = () => {
        closeLeftHand();
        nineKeyView.move(1, 0, ww, 0);
      };

      const shiftBottomItemToRightHand = () => {
        closeRightHand();
        nineKeyView.move(1, 2, ee, 0);
      };

      /** @type {Mode} */
      const playMode = {
        name: 'play',
        commandKeys: {
          ...numberKeys,
          ...arrowKeys,
          ...handKeys,
          Escape: 0,
        },
        handleCommand: async function* (command, repeat) {
          repeat = repeat && worldModel.entityHealth(player) === 5;
          const direction = commandDirection.get(command);
          if (direction !== undefined) {
            worldModel.intendToMove(player, direction, repeat);
            worldModel.tick();
            return playMode;
          } else if (command === 5) {
            // stay
            worldModel.tick();
            return playMode;
          } else if (
            command === 1 &&
            isNotEmptyItem(leftHandItemType()) &&
            !repeat
          ) {
            return handleLeftItem();
          } else if (
            command === 3 &&
            isNotEmptyItem(rightHandItemType()) &&
            !repeat
          ) {
            return handleRightItem();
          } else if (command === 7 && packNotEmpty() && !repeat) {
            // stash
            return openStash();
          } else if (command === 0 && !repeat) {
            return yield* playToMenuMode(cursor.position, player);
          } else {
            return playMode;
          }
        },
        move(change, destination) {
          cursor = { ...change, position: destination };
          cameraController.move(destination, change);
          followCursor(destination, change);
        },
        jump(destination) {
          cursor = { position: destination, direction: north };
          cameraController.jump(destination);
          // TODO reset momentum somehow like:
          // followCursor(destination, change);
        },
        inventory(slot, itemType) {
          if (slot === 0) {
            const gridIndex = 0;
            const handTileType = builtinTileTypesByName.left;
            if (isEmptyItem(itemType)) {
              nineKeyView.replace(gridIndex, handTileType);
            } else {
              const tileType = tileTypeForItemType[itemType];
              nineKeyView.replace(gridIndex, tileType);
            }
          }
          if (slot === 1) {
            const gridIndex = 2;
            const handTileType = builtinTileTypesByName.right;
            if (isEmptyItem(itemType)) {
              nineKeyView.replace(gridIndex, handTileType);
            } else {
              const tileType = tileTypeForItemType[itemType];
              nineKeyView.replace(gridIndex, tileType);
            }
          }

          const packShouldBeVisible = packNotEmpty();
          if (packVisible && !packShouldBeVisible) {
            dismissPack();
          }
          if (!packVisible && packShouldBeVisible) {
            restorePack();
          }
        },
      };

      /**
       * @param {number} leftOrRight
       * @param {Object} opts
       * @param {boolean} opts.announce
       */
      const enterItemMode = (leftOrRight, { announce = false }) => {
        /** @type {Mode} */
        const itemMode = {
          name: 'item',
          commandKeys: {
            ...numberKeys,
            ...handKeys,
            Backspace: 9,
            Escape: 1,
            // ' ': 5,
          },
          handleCommand: async function* (command, repeat) {
            if (repeat) return itemMode;
            if (command === 9) {
              // trash / consume
              return useItem(leftOrRight);
            } else if (command === 2 && isNotEmptyItem(rightHandItemType())) {
              // craft
              worldModel.intendToCraft(player);
              worldModel.tick();
              return enterItemMode(leftOrRight, { announce: false });
            } else if (command === 1) {
              dialogController.close();
              // place in left hand
              return placeItemInLeftHand();
            } else if (command === 3) {
              dialogController.close();
              // place in right hand
              return placeItemInRightHand();
            } else if (command === 7) {
              dialogController.close();
              // stash
              return stashItem(leftOrRight);
            }
            return itemMode;
          },
          craft(recipe) {
            dialogController.close();

            const {
              agent: agentType,
              reagent: reagentType,
              product: productType,
              byproduct: byproductType,
            } = recipe;

            // TODO hook
            // console.table({
            //   agent: itemTypes[agentType].name,
            //   reagent: itemTypes[reagentType].name,
            //   product: itemTypes[productType].name,
            //   byproduct: itemTypes[byproductType].name,
            // });

            assert(reagentType !== productType);
            assert(isNotEmptyItem(productType));
            const productTileType = tileTypeForItemType[productType];

            if (
              reagentType === byproductType &&
              isNotEmptyItem(byproductType)
            ) {
              // The agent is replaced with the product.  The reagent is also the
              // byproduct, in other words, it is a catalyst and just bounces in
              // place.
              nineKeyView.replace(4, productTileType);
            } else if (agentType === byproductType) {
              // The agent becomes the byproduct when the formula above gets
              // reversed.  In this case, the agent becomes the byproduct, or
              // rather, it just moves from the top to the bottom slot.
              nineKeyView.despawn(1);
              nineKeyView.move(4, 1, ss, 0);
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
          },
        };

        if (!packVisible && packNotFull()) {
          restorePack();
        }

        if (announce) {
          const itemType = leftHandItemType();
          const itemDesc = itemTypes[itemType];
          if (itemDesc.tip !== undefined) {
            dialogController.logHTML(itemDesc.tip);
          }
        }

        return itemMode;
      };

      /**
       * @param {number} leftOrRight
       */
      const enterPackMode = leftOrRight => {
        /** @type {Mode} */
        const packMode = {
          name: 'pack',
          commandKeys: {
            ...numberKeys,
            Escape: 5,
          },
          handleCommand: async function* (command, repeat) {
            if (repeat) return packMode;
            if (command === 5) {
              // keep
              dismissPackItemsExcept(-1);
            } else if (command >= 1 && command <= 9) {
              // put or swap
              const inventoryIndex = inventoryIndexForCommand[command];
              assertDefined(inventoryIndex);
              assert(inventoryIndex !== -1);
              const inventoryEntityIndex =
                entityIndexForInventoryIndex[inventoryIndex];
              const toItemDirection =
                directionToForPackIndex[inventoryIndex - 2];
              const fromItemDirection =
                directionFromForPackIndex[inventoryIndex - 2];
              const inventoryItemType = worldModel.inventory(
                player,
                inventoryIndex,
              );

              if (
                isEmptyItem(leftHandItemType()) &&
                isEmptyItem(inventoryItemType)
              ) {
                return packMode;
              }

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

              worldModel.swap(player, leftHandInventoryIndex, inventoryIndex);
              // Have to tick when moving things between pack and hands because
              // this can cause a face change.
              worldModel.tick();
            } else {
              return packMode;
            }

            if (isNotEmptyItem(leftHandItemType())) {
              restoreControllerReticle();
              restoreLeftHand();
              restoreRightHand();
              restoreRecepticle(leftHandItemType());
              restorePack();
              if (isNotEmptyItem(rightHandItemType())) {
                const otherItemTileType =
                  tileTypeForItemType[rightHandItemType()];
                nineKeyView.spawnInward(otherItemTileType, ss);
              }
              return enterItemMode(leftOrRight, { announce: true });
            } else {
              // back to play mode with an empty hand

              if (leftOrRight < 0) {
                restoreLeftHand();

                if (isEmptyItem(rightHandItemType())) {
                  restoreRightHand();
                } else {
                  restoreRightItem();
                }
              } else if (leftOrRight > 0) {
                worldModel.swap(
                  player,
                  leftHandInventoryIndex,
                  rightHandInventoryIndex,
                );
                restoreRightHand();

                if (isEmptyItem(leftHandItemType())) {
                  restoreLeftHand();
                } else {
                  restoreLeftItem();
                }
              }

              restoreDpad({});
              restoreWatch();

              if (packNotEmpty()) {
                restorePack();
              }

              return playMode;
            }
          },
        };

        return packMode;
      };

      // Utilities
      const handleLeftItem = () => {
        assert(isNotEmptyItem(leftHandItemType()));

        // Transition from play mode to item handling mode.
        dismissDpad({});
        dismissWatch();

        // Move item in left hand to the center-middle.
        nineKeyView.move(0, 4, ne, 0);

        if (isNotEmptyItem(rightHandItemType())) {
          // Move item in right hand to bottom-middle.
          nineKeyView.move(2, 1, ww, 0);
          openRightHand();
        }

        if (packEmpty()) {
          restorePack();
        }
        restoreRecepticle(leftHandItemType());
        restoreLeftHand();
        restoreControllerReticle();

        return enterItemMode(-1, { announce: true });
      };

      const handleRightItem = () => {
        assert(isNotEmptyItem(rightHandItemType()));

        // Transition from play mode to item handling mode.
        dismissDpad({});
        dismissWatch();

        // Move item in right hand to middle-center.
        nineKeyView.move(2, 4, nw, 0);

        if (isNotEmptyItem(leftHandItemType())) {
          // Move item in left hand to bottom-center.
          nineKeyView.move(0, 1, ee, 0);
          openLeftHand();
        }

        if (packEmpty()) {
          restorePack();
        }
        restoreRecepticle(rightHandItemType());
        restoreRightHand();
        restoreControllerReticle();

        worldModel.swap(
          player,
          leftHandInventoryIndex,
          rightHandInventoryIndex,
        );

        return enterItemMode(1, { announce: true });
      };

      const openStash = () => {
        dismissPack();
        dismissDpad({});
        dismissWatch();

        if (isEmptyItem(leftHandItemType())) {
          dismissLeft();
          dismissRight();
          restorePackItems();
          return enterPackMode(-1);
        } else if (isEmptyItem(rightHandItemType())) {
          worldModel.swap(
            player,
            leftHandInventoryIndex,
            rightHandInventoryIndex,
          );
          dismissLeft();
          dismissRight();
          restorePackItems();
          return enterPackMode(1);
        } else {
          nineKeyView.move(0, 4, ne, 0);
          dismissRight();
          restorePackItems();
          return enterPackMode(-1);
        }
      };

      /**
       * @param {number} leftOrRight
       */
      const useItem = leftOrRight => {
        dismissTrash(); // or mouth

        const use = worldModel.use(player, leftHandInventoryIndex);
        use;
        nineKeyView.take(4, ne);

        if (packVisible && packEmpty()) {
          dismissPack();
        }

        if (isEmptyItem(rightHandItemType())) {
        } else if (leftOrRight < 0) {
          shiftBottomItemToRightHand();
        } else if (leftOrRight > 0) {
          worldModel.swap(
            player,
            leftHandInventoryIndex,
            rightHandInventoryIndex,
          );
          shiftBottomItemToLeftHand();
        }

        restoreDpad({});
        restoreWatch();
        dismissControllerReticle();

        worldModel.tick();

        return playMode;
      };

      const placeItemInLeftHand = () => {
        dismissControllerReticle();
        dismissTrash();
        if (packVisible && packEmpty()) {
          dismissPack();
        }

        closeLeftHand();
        nineKeyView.move(4, 0, sw, 0);

        if (isNotEmptyItem(rightHandItemType())) {
          shiftBottomItemToRightHand();
        }

        restoreDpad({});
        restoreWatch();

        return playMode;
      };

      const placeItemInRightHand = () => {
        worldModel.swap(
          player,
          leftHandInventoryIndex,
          rightHandInventoryIndex,
        );

        dismissControllerReticle();
        dismissTrash();
        if (packVisible && packEmpty()) {
          dismissPack();
        }

        closeRightHand();
        nineKeyView.move(4, 2, se, 0);

        if (isNotEmptyItem(leftHandItemType())) {
          shiftBottomItemToLeftHand();
        }
        restoreDpad({});
        restoreWatch();

        return playMode;
      };

      /**
       * @param {number} leftOrRight
       */
      const stashItem = leftOrRight => {
        dismissControllerReticle();
        dismissPack();
        dismissTrash();
        dismissLeft();
        dismissRight();
        if (isNotEmptyItem(rightHandItemType())) {
          nineKeyView.despawnOutward(ss);
        }
        restorePackItems();

        return enterPackMode(leftOrRight);
      };

      /**
       * @param {number} player
       * @param {Object} handoff
       * @param {boolean} [handoff.north]
       * @param {boolean} [handoff.east]
       * @param {boolean} [handoff.south]
       * @param {boolean} [handoff.west]
       */
      const exitPlayMode = (player, handoff) => {
        dismissDpad(handoff);
        dismissLeft();
        dismissRight();
        if (packNotEmpty()) {
          dismissPack();
        }
        dismissWatch();

        worldModel.unfollow(player, playerFollower);
      };

      /**
       * @param {number} position
       * @param {number} player
       */
      const playToMenuMode = async function* (position, player) {
        const handoff = {};
        exitPlayMode(player, handoff);
        oneKeyView.exit(0);

        return yield* playMenu(position, player);
      };

      restoreDpad(handoff);
      restoreLeft();
      restoreRight();
      if (packNotEmpty()) {
        restorePack();
      }
      restoreWatch();

      worldModel.follow(player, playerFollower);
      cameraController.jump(position);

      staminaController.show();
      healthController.show();

      return playMode;
    };

    /**
     * @param {number} position
     * @param {number | undefined} player - entity of the player from play mode, to which
     * we may return if we do nothing in the menu or edit modes before returning.
     * Without a defined player, we cannot go to play mode.
     * @param {Object} handoff
     * @param {boolean} [handoff.north]
     * @param {boolean} [handoff.south]
     * @param {boolean} [handoff.east]
     * @param {boolean} [handoff.west]
     */
    const enterEditMode = (position, player, handoff) => {
      let cursor = { position, direction: north };

      const updateEditorDialog = () => {
        const dialogTerms = [toponym(cursor.position)];
        const agentType = worldModel.entityTypeAt(cursor.position);
        if (agentType > 0) {
          const agentNumber = worldModel.entityAt(cursor.position);
          const agentName = agentTypes[agentType].name;
          dialogTerms.push(`#${agentNumber}`);
          dialogTerms.push(agentName);
        }
        const terrainFlags = worldModel.getTerrainFlags(cursor.position);
        if ((terrainFlags & terrainLava) !== 0) {
          dialogTerms.push('🌋   ');
        }
        if ((terrainFlags & terrainWater) !== 0) {
          dialogTerms.push('🌊   ');
        }
        if ((terrainFlags & terrainHot) !== 0) {
          dialogTerms.push('🥵   ');
        }
        if ((terrainFlags & terrainCold) !== 0) {
          dialogTerms.push('🥶   ');
        }
        dialogController.close();
        dialogController.log(dialogTerms.join(' '));
      };

      const erase = () => {
        if (editType !== undefined) {
          const entity = worldModel.remove(cursor.position);
          if (entity === player) {
            player = undefined;
          }
        }
      };

      const copy = () => {
        const entityType = worldModel.entityTypeAt(cursor.position);
        if (entityType !== editType) {
          nineKeyView.replace(4, defaultTileTypeForAgentType[editType]);
          editType = entityType;
        }
      };

      const add = () => {
        if (editType !== undefined) {
          const entity = worldModel.set(cursor.position, editType);
          if (editType === agentTypesByName.player) {
            dialogController.logHTML('😊 <b>player</b> updated');
            player = entity;
          }
        }
      };

      /** @param {number} position */
      const teleport = position => {
        cameraController.jump(position);
        worldMacroViewModel.jump(-1, position, 0, -1);
        cursor = { position, direction: north };
        updateEditorDialog();
      };

      /** @type {Mode} */
      const editMode = {
        name: 'edit',
        commandKeys: {
          ...numberKeys,
          ...arrowKeys,
          x: 9, // cut
          y: 9, // yank
          p: 1, // paste
          f: 1, // fill
          z: 3, // erase delete
          Escape: 0,
        },
        handleCommand: async function* (command, repeat) {
          const direction = commandDirection.get(command);
          if (direction !== undefined) {
            const { position: origin } = cursor;
            const nextCursor = advance({ position: origin, direction });
            if (nextCursor === undefined) {
              return editMode;
            }
            const { position: destination, turn, transit } = nextCursor;
            const change = {
              position: origin,
              direction,
              turn,
              transit,
              repeat,
            };
            cursor = nextCursor;
            cameraController.move(destination, change);
            followCursor(destination, change);
            worldMacroViewModel.move(-1, cursor.position, direction * 2, 0);
            updateEditorDialog();
            return editMode;
          } else if (command === 1) {
            // fill
            erase();
            add();
            return editMode;
          } else if (command === 3) {
            erase();
            return editMode;
          } else if (command === 9) {
            // cut
            copy();
            erase();
            return editMode;
          } else if (command === 7) {
            copy();
            return editMode;
          } else if (command === 5) {
            return yield* chooseAgent();
          } else if (command === 0 && !repeat) {
            return yield* editMenu(player);
          } else {
            return editMode;
          }
        },
        handleMiscKeyPress(key) {
          // TODO deepen the menu system so there is a dedicated mode for
          // drawing water and lava flags that can be used on mobile.
          if (key === 'r') {
            worldModel.toggleTerrainFlags(cursor.position, terrainWater);
            return true;
          }
          if (key === 'm') {
            worldModel.toggleTerrainFlags(cursor.position, terrainLava);
            return true;
          }
          return false;
        },
      };

      /**
       * @param {number | undefined} player
       */
      const editMenu = async function* (player) {
        /** @type {Record<string, string>} */
        const options = Object.create(null);
        options.edit = '✏️  Edit'; // 🚧
        if (player !== undefined) {
          options.play = '🎭 Play   '; // 🪁 ▶️
        }
        if (window.showSaveFilePicker !== undefined) {
          options.save = '🛟  Save  '; //  🏦
        }
        if (window.showOpenFilePicker !== undefined) {
          options.load = '🛻  Load'; // 🚜 🏗
        }
        // options.entities = '🙂 Entities';
        // options.addEntity = '👶 Add Entity';
        options.choose = '🎰 Choose Entity';
        options.mark = '📍 Mark';
        if (marks.size) {
          options.marks = '🗺 Marks';
          options.teleport = '🛸 Teleport';
        }
        options.levels = '🪜 Levels';
        // options.addLevel = '🏗 Add Level';
        // options.items = '🎒 Items';
        // options.addItem = '🔨 Add Item';
        // options.recipes = '🧑‍🍳 Recipes';
        // options.addRecipe = '📝 Add Recipe';
        if (marks.size) {
          options.targetEntity = '🏹   Target Entity';
          options.targetLocation = '🎯    Target Location';
        }

        const choice = await choose(options);

        // Plan new animation turn
        yield undefined;

        if (choice === 'play') {
          const handoff = {};
          exitEditMode(handoff);

          assertDefined(player);
          return enterPlayMode(player, {});
        } else if (choice === 'load') {
          const handoff = {};
          exitEditMode(handoff);

          const result = await loadWorld();

          // Plan new animation turn
          yield undefined;

          if (result === undefined) {
            return enterEditMode(position, player, handoff);
          } else {
            const { world, mechanics, player, wholeWorldDescription } = result;
            return enterWorld(world, mechanics, player, wholeWorldDescription);
          }
        } else if (choice === 'save') {
          await saveWorld({
            ...wholeWorldDescription,
            ...capture(player),
          });
          return editMode;
        } else if (choice === 'choose') {
          return yield* chooseAgent();
        } else if (choice === 'mark') {
          const label = await input();

          if (label !== undefined) {
            marks.set(label, cursor.position);
          }

          // Plan new animation turn
          yield undefined;

          return editMode;
        } else if (choice === 'marks') {
          const options = Object.fromEntries(
            [...marks.entries()].map(([label, position]) => [
              label,
              `${label} @${position}`,
            ]),
          );
          const label = await choose(options);

          if (label !== undefined) {
            const verb = await choose({
              teleport: '🛸 Teleport',
              rename: '✍️ Rename',
              delete: '✂️ Delete',
            });
            if (verb === 'teleport') {
              // Start new animated turn
              yield undefined;

              const position = assumeDefined(marks.get(label));
              teleport(position);
            }
            if (verb === 'delete') {
              marks.delete(label);
            }
            if (verb === 'rename') {
              const relabel = await input({
                initial: label,
                placeholder: 'New label',
              });
              if (relabel !== undefined) {
                const position = assumeDefined(marks.get(label));
                marks.delete(label);
                marks.set(relabel, position);

                // Plan new animation turn
                yield undefined;

                dialogController.close();
                dialogController.log(
                  `✍️ Renamed “${label}” to “${relabel}” @${position}`,
                );
              }
            }
          }

          return editMode;
        } else if (choice === 'teleport') {
          const options = Object.fromEntries(
            [...marks.entries()].map(([label, position]) => [
              label,
              `${label} @${position}`,
            ]),
          );
          const label = await choose(options);

          // Plan new animation turn
          yield undefined;

          if (label !== undefined) {
            const position = assumeDefined(marks.get(label));
            teleport(position);
          }

          return editMode;
        } else if (choice === 'levels') {
          const options = Object.fromEntries(
            levels.map((_, index) => [`${index + 1}`, `${index + 1}`]),
          );

          const choice = await choose(options);

          // Plan new animation turn
          yield undefined;

          if (choice !== undefined) {
            const level = levels[choice - 1];
            if (level.faces.length) {
              const options = Object.fromEntries(
                level.faces.map((_, index) => [`${index + 1}`, `${index + 1}`]),
              );

              const choice = await choose(options);

              // Plan new animation turn
              yield undefined;

              if (choice !== undefined) {
                const face = level.faces[choice - 1];
                const position = face.offset + Math.floor(face.size / 2);
                teleport(position);
              }
            } else {
              const position = level.offset + Math.floor(level.size / 2);
              teleport(position);
            }
          }

          return editMode;
        } else if (choice === 'targetEntity') {
          const options = Object.fromEntries(
            [...marks.entries()]
              .filter(([_, location]) => {
                const entityType = worldModel.entityTypeAt(location);
                return entityType !== 0;
              })
              .map(([label, location]) => {
                const entityType = worldModel.entityTypeAt(location);
                const tileType = defaultTileTypeForAgentType[entityType];
                const { text } = tileTypes[tileType];
                return [label, `${text} ${label} @${position}`];
              })
              .filter(entry => entry !== undefined),
          );
          const label = await choose(options);

          const entity = worldModel.entityAt(cursor.position);
          const location = assumeDefined(marks.get(label));
          const target = worldModel.entityAt(location);

          // Plan new animation turn
          yield undefined;

          dialogController.close();
          if (worldModel.setEntityTargetEntity(entity, target)) {
            dialogController.log(`🏹 Target entity set`);
          } else {
            dialogController.log(`⚠️  Failed to set target entity`);
          }

          return editMode;
        } else if (choice === 'targetLocation') {
          const options = Object.fromEntries(
            [...marks.entries()]
              .map(([label, location]) => {
                return [label, `${label} @${location}`];
              })
              .filter(entry => entry !== undefined),
          );
          const label = await choose(options);

          const entity = worldModel.entityAt(cursor.position);
          const target = assumeDefined(marks.get(label));

          // Plan new animation turn
          yield undefined;

          dialogController.close();
          if (worldModel.setEntityTargetLocation(entity, target)) {
            dialogController.log(`🎯 Target location set`);
          } else {
            dialogController.log(`⚠️  Failed to set target entity`);
          }

          return editMode;
        } else {
          return editMode;
        }
      };

      const chooseAgent = async function* () {
        /** @type {Record<string, string>} */
        const options = Object.create(null);
        for (let agentType = 3; agentType < agentTypes.length; agentType += 1) {
          const { name } = agentTypes[agentType];
          const tileType = defaultTileTypeForAgentType[agentType];
          const { text } = tileTypes[tileType];
          options[name] = `${text} ${name}`;
        }

        const agentTypeName = await choose(options);

        // Plan new animation turn
        yield undefined;

        if (agentTypeName !== undefined) {
          const agentType = assumeDefined(agentTypesByName[agentTypeName]);
          const tileType = defaultTileTypeForAgentType[agentType];

          if (editType !== 0) {
            nineKeyView.replace(4, tileType);
          } else {
            nineKeyView.spawn(4, tileType);
          }
          editType = agentType;

          const { text } = tileTypes[tileType];
          dialogController.close();
          dialogController.log(`${text} ${agentTypeName}`);
        }
        return editMode;
      };

      restoreDpad(handoff);

      restoreEditorBezel();

      if (editType !== 0) {
        nineKeyView.spawn(4, defaultTileTypeForAgentType[editType]);
      }

      updateEditorDialog();

      restoreEditorReticle(position);

      staminaController.hide();
      healthController.hide();

      return editMode;
    };

    /**
     * @param {number} position
     * @param {number | undefined} player
     */
    const playMenu = async function* (position, player) {
      /** @type {Record<string, string>} */
      const options = Object.create(null);
      if (player !== undefined) {
        options.play = '🎭 Play   '; // 🪁 ▶️
      }
      options.edit = '✏️  Edit'; // 🚧
      if (window.showSaveFilePicker !== undefined) {
        options.save = '🛟  Save  '; //  🏦
      }
      if (window.showOpenFilePicker !== undefined) {
        options.load = '🛻  Load'; // 🚜 🏗
      }

      const choice = await choose(options);

      // Plan new animation turn.
      yield undefined;

      oneKeyView.put(0, 0, builtinTileTypesByName.hamburger);
      oneKeyView.enter(0);

      if (choice === 'edit') {
        return enterEditMode(position, player, {});
      } else if (choice === 'load') {
        const result = await loadWorld();

        // Plan new animation turn.
        yield undefined;

        if (result === undefined) {
          assertDefined(player);
          return enterPlayMode(player, {});
        } else {
          const { world, mechanics, player, wholeWorldDescription } = result;
          return enterWorld(world, mechanics, player, wholeWorldDescription);
        }
      } else if (choice === 'save') {
        await saveWorld({
          ...wholeWorldDescription,
          ...capture(player),
        });

        // Plan new animation turn.
        yield undefined;

        assertDefined(player);
        return enterPlayMode(player, {});
      } else {
        assertDefined(player);
        return enterPlayMode(player, {});
      }
    };

    /**
     * @param {Object} handoff
     * @param {boolean} [handoff.north]
     * @param {boolean} [handoff.south]
     * @param {boolean} [handoff.east]
     * @param {boolean} [handoff.west]
     */
    const exitEditMode = handoff => {
      dismissDpad(handoff);

      dismissEditorBezel();
      if (editType !== 0) {
        nineKeyView.despawn(4);
      }

      dismissEditorReticle();

      dialogController.close();
    };

    /** @param {number} position */
    const limboToEditMode = position => {
      return enterEditMode(position, undefined, {});
    };

    /**
     * @param {number} player
     */
    const limboToPlayMode = player => {
      const handoff = {};
      return enterPlayMode(player, handoff);
    };

    const tick = () => {
      worldMacroViewModel.tick();
      cameraController.tick();
    };

    const tock = () => {
      worldModel.tock();
      worldMacroViewModel.tock();
      cameraController.tock();
    };

    /**
     * @param {Progress} progress
     */
    const animate = progress => {
      worldMacroViewModel.animate(progress);
      cameraController.animate(progress);
    };

    /**
     * @param {number} position
     */
    const restoreEditorReticle = position => {
      worldMacroViewModel.put(-1, position, -1);
    };

    const dismissEditorReticle = () => {
      worldMacroViewModel.remove(-1);
    };

    return { limboToPlayMode, limboToEditMode, tick, tock, animate };
  };

  // We start in limbo mode and transiton either to edit or play mode
  // depending on the driver, whether they load a world save,
  // and whether the world save designates a player with a starting position.

  /** @type {Clock | undefined} */
  let worldClock = undefined;

  /** @type {Mode} */
  const suspenseMode = {
    name: 'suspense',
    commandKeys: {},
    handleCommand: async function* (_command, _repeat) {
      return suspenseMode;
    },
  };

  /** @type {PlayFn} */
  const enterWorld = (world, mechanics, player, wholeWorldDescription) => {
    const { limboToPlayMode, limboToEditMode, ...clock } = makeWorldModes(
      world,
      mechanics,
      wholeWorldDescription,
    );
    worldClock = clock;
    if (player !== undefined) {
      return limboToPlayMode(player);
    } else {
      return limboToEditMode(0);
    }
  };

  /** @type {Mode} */
  const limboMode = {
    name: 'limbo',
    commandKeys: {},
    handleCommand: async function* (_command, _repeat) {
      return limboMode;
    },
    play: enterWorld,
  };

  /**
   * @param {Object} handoff
   * @param {boolean} [handoff.north]
   * @param {boolean} [handoff.south]
   * @param {boolean} [handoff.east]
   * @param {boolean} [handoff.west]
   */
  const restoreDpad = handoff => {
    if (!handoff.north) {
      nineKeyView.spawnInward(builtinTileTypesByName.north, nn);
    }
    if (!handoff.east) {
      nineKeyView.spawnInward(builtinTileTypesByName.east, ee);
    }
    if (!handoff.south) {
      nineKeyView.spawnInward(builtinTileTypesByName.south, ss);
    }
    if (!handoff.west) {
      nineKeyView.spawnInward(builtinTileTypesByName.west, ww);
    }
  };

  /**
   * @param {Object} handoff
   * @param {boolean} [handoff.north]
   * @param {boolean} [handoff.south]
   * @param {boolean} [handoff.east]
   * @param {boolean} [handoff.west]
   */
  const dismissDpad = handoff => {
    if (!handoff.north) {
      nineKeyView.despawnOutward(nn);
    }
    if (!handoff.east) {
      nineKeyView.despawnOutward(ee);
    }
    if (!handoff.south) {
      nineKeyView.despawnOutward(ss);
    }
    if (!handoff.west) {
      nineKeyView.despawnOutward(ww);
    }
  };

  const restoreEditorBezel = () => {
    nineKeyView.spawnInward(builtinTileTypesByName.cut, ne);
    nineKeyView.spawnInward(builtinTileTypesByName.copy, nw);
    nineKeyView.spawnInward(builtinTileTypesByName.draw, sw);
    nineKeyView.spawnInward(builtinTileTypesByName.erase, se);
  };

  const dismissEditorBezel = () => {
    nineKeyView.despawnOutward(nw);
    nineKeyView.despawnOutward(ne);
    nineKeyView.despawnOutward(sw);
    nineKeyView.despawnOutward(se);
  };

  const dismissControllerReticle = () => {
    assertNonZero(reticleEntity);
    nineKeyMacroViewModel.exit(reticleEntity);
    reticleEntity = 0;
  };

  const restoreControllerReticle = () => {
    reticleEntity = nineKeyView.create(-1, locate(1, 1)); // reticle
    nineKeyMacroViewModel.enter(reticleEntity);
  };

  /**
   * @param {number} command
   */
  const down = command => {
    if (command >= 1 && command <= 9) {
      return nineKeyView.down(command - 1);
    }
    if (command === 0) {
      return oneKeyView.down(0);
    }
    return noop;
  };

  const tick = () => {
    if (worldClock) {
      worldClock.tick();
    }
    dialogController.close();
    nineKeyMacroViewModel.tick();
    oneKeyView.tick();
    supplementaryAnimation.tick();
  };

  /**
   * @param {Progress} progress
   */
  const animate = progress => {
    if (worldClock) {
      worldClock.animate(progress);
    }
    nineKeyMacroViewModel.animate(progress);
    oneKeyViewModel.animate(progress);
    dialogController.animate(progress);
    supplementaryAnimation.animate(progress);
  };

  const tock = () => {
    if (worldClock) {
      worldClock.tock();
    }
    dialogController.tock();
    nineKeyMacroViewModel.tock();
    oneKeyView.tock();
    healthController.tock();
    staminaController.tock();
    supplementaryAnimation.tock();
  };

  let mode = limboMode;

  /** @type {HandleCommandFn} */
  const handleCommand = async function* (command, repeat) {
    const turnGenerator = mode.handleCommand(command, repeat);
    const promise = turnGenerator.next();
    mode = suspenseMode;
    const result = await promise;
    if (result.done) {
      mode = result.value;
      return undefined;
    } else {
      yield result.value;
      mode = yield* turnGenerator;
    }
  };

  /** @param {string} key */
  const handleMiscKeyPress = key => {
    let used = false;
    if (mode.handleMiscKeyPress) {
      used = mode.handleMiscKeyPress(key);
    }
    return used;
  };

  /**
   * @param {World} world
   * @param {import('./mechanics.js').Mechanics} mechanics
   * @param {number | undefined} player
   * @param {import('./file.js').WholeWorldDescription} wholeWorldDescription
   */
  const play = (world, mechanics, player, wholeWorldDescription) => {
    if (mode.play) {
      tock();
      mode = mode.play(world, mechanics, player, wholeWorldDescription);
      tick();
    }
  };

  const modeName = () => {
    return mode.name;
  };

  /**
   * @param {number} direction
   */
  const commandForDirection = direction => {
    return assumeDefined(directionCommand.get(direction));
  };

  /**
   * @param {number} command
   */
  const directionForCommand = command => {
    return commandDirection.get(command);
  };

  /**
   * @param {string} key
   */
  const commandForKey = key => {
    // Ignore the prototype, as a precaution.
    if (key in mode.commandKeys && !hasOwn(mode.commandKeys, key)) {
      return undefined;
    }
    return mode.commandKeys[key];
  };

  return {
    tick,
    tock,
    animate,
    down,
    handleMiscKeyPress,
    handleCommand,
    commandForDirection,
    directionForCommand,
    commandForKey,
    play,
    modeName,
  };
};
