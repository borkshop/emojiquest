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

import { assert, assertDefined, assertNonZero } from './lib/assert.js';
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

/**
 * @param {Object} object
 * @param {string | number | symbol} key
 */
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** @type {Record<number, number>} */
export const commandDirection = {
  8: north,
  4: west,
  6: east,
  2: south,
};

/** @type {Record<number, number>} */
export const directionCommand = Object.fromEntries(
  Object.entries(commandDirection).map(([command, direction]) => [
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

/** @typedef {import('./progress.js').AnimateFn} AnimateFn */
/** @typedef {import('./progress.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */

const noop = () => {};

/**
 * @callback FollowCursorFn
 * @param {number} destination
 * @param {import('./topology.js').CursorChange} change
 */

/**
 * @callback HandleCommandFn
 * @param {number} command
 * @param {boolean} repeat
 * @returns {void}
 */

/**
 * @callback PressFn
 * @param {number} command
 * @param {boolean} repeat
 * @returns {Mode}
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
 * @param {import('./model.js').Recipe} recipe
 */

/**
 * @callback PlayFn
 * @param {World} world
 * @param {number | undefined} player
 * @returns {Mode}
 */

/**
 * @callback MoveFn
 * @param {import('./topology.js').CursorChange} change
 * @param {number} destination
 */

/**
 * @callback JumpFn
 * @param {number} destination
 */

/**
 * @typedef {object} Mode
 * @prop {string} name
 * @prop {PressFn} handleCommand
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

const itemGridIndexes = [0, 1, 2, 3, 5, 6, 7, 8];

const agentOffsets = [-4, -1, 2, -3, 3, -2, 1, 4];

const agentOffsetForGridIndex = [-4, -1, 2, -3, 0, 3, -2, 1, 4];

// itemIndex to vector to or from that item index
const directionToForPackIndex = [sw, ss, se, ww, ee, nw, nn, ne];
const directionFromForPackIndex = directionToForPackIndex.map(
  direction => (direction + halfOcturn) % fullOcturn,
);

/**
 * @typedef {Object} CameraController
 * @prop {(location: number) => void} jump
 * @prop {(destination: number, change: import('./topology.js').CursorChange) => void} move
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
 * @typedef {object} World
 * @prop {import('./model.js').Model} worldModel
 * @prop {import('./topology.js').AdvanceFn} advance,
 * @prop {import('./topology.js').ToponymFn} toponym
 * @prop {import('./macro-view-model.js').MacroViewModel} worldMacroViewModel
 * @prop {(player: number | undefined) => unknown} capture
 * @prop {CameraController} cameraController
 */

/**
 * @param {Object} args
 * @param {import('./mechanics.js').Mechanics} args.mechanics
 * @param {import('./view-model.js').Watcher} args.nineKeyWatcher
 * @param {import('./view-model.js').Watcher} args.oneKeyWatcher
 * @param {import('./menu.js').MenuController} args.menuController
 * @param {import('./dialog.js').DialogController} args.dialogController
 * @param {import('./health.js').HealthController} args.healthController
 * @param {import('./stamina.js').StaminaController} args.staminaController
 * @param {() => Promise<void>} args.loadWorld
 * @param {(worldData: unknown) => Promise<void>} args.saveWorld
 * @param {FollowCursorFn} args.followCursor
 */
export const makeController = ({
  nineKeyWatcher,
  oneKeyWatcher,
  menuController,
  dialogController,
  healthController,
  staminaController,
  followCursor,
  mechanics,
  loadWorld,
  saveWorld,
}) => {
  const {
    agentTypes,
    itemTypes,
    tileTypes,
    // effectTypes,
    tileTypesByName,
    agentTypesByName,
    itemTypesByName,
    // effectTypesByName,
    defaultTileTypeForAgentType,
    tileTypeForItemType,
    describeSlot,
    // tileTypeForEffectType,
    // craft,
    // bump,
  } = mechanics;

  // const emptyTile = tileTypesByName.empty;
  const emptyItem = itemTypesByName.empty;

  /**
   * @param {number} itemType
   */
  const isEmptyItem = itemType => {
    assert(itemType !== 0, `Invalid item type ${itemType}`);
    return itemType === emptyItem;
  };

  /**
   * @param {number} itemType
   */
  const isNotEmptyItem = itemType => {
    assert(itemType !== 0, `Invalid item type ${itemType}`);
    return itemType !== emptyItem;
  };

  // State:

  const oneKeyViewModel = makeViewModel();
  const oneTileMap = makeBoxTileMap();
  oneKeyViewModel.watchEntities(oneTileMap, oneKeyWatcher);
  const oneKeyView = makeMacroViewModel(oneKeyViewModel, {
    name: 'hamburger',
  });
  oneKeyView.put(0, 0, tileTypesByName.hamburger);

  const nineKeyViewModel = makeViewModel();
  const nineKeyMacroViewModel = makeMacroViewModel(nineKeyViewModel, {
    name: 'controls',
  });
  const nineKeyView = makeNineKeyView(nineKeyMacroViewModel);

  nineKeyViewModel.watchEntities(tileMap, nineKeyWatcher);

  /** @type {import('./model.js').Follower} */
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
  let packTileType = tileTypesByName.backpack;

  /** @type {number} */
  let reticleEntity = 0;

  /** @type {number} */
  let editType = 0;

  // Modes:

  /**
   * @param {World} world
   */
  const makeWorldModes = world => {
    const {
      worldModel,
      worldMacroViewModel,
      cameraController,
      toponym,
      advance,
      capture,
    } = world;

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
        nineKeyView.spawn(4, tileTypesByName.watch);
      };

      const openLeftHand = () => {
        nineKeyView.spawn(0, tileTypesByName.left);
      };

      const openRightHand = () => {
        nineKeyView.spawn(2, tileTypesByName.right);
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
        nineKeyView.spawnInward(tileTypesByName.left, sw);
      };

      const restoreRightHand = () => {
        nineKeyView.spawnInward(tileTypesByName.right, se);
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
        let recepticleTileType = tileTypesByName.trash;
        if (comestible) {
          recepticleTileType = tileTypesByName.mouth;
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
        handleCommand(command, repeat) {
          repeat = repeat && worldModel.entityHealth(player) === 5;
          const direction = commandDirection[command];
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
            return playToMenuMode(cursor.position, player);
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
            const handTileType = tileTypesByName.left;
            if (isEmptyItem(itemType)) {
              nineKeyView.replace(gridIndex, handTileType);
            } else {
              const tileType = tileTypeForItemType[itemType];
              nineKeyView.replace(gridIndex, tileType);
            }
          }
          if (slot === 1) {
            const gridIndex = 2;
            const handTileType = tileTypesByName.right;
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
          handleCommand(command, repeat) {
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
          handleCommand(command, repeat) {
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
      const playToMenuMode = (position, player) => {
        const handoff = {
          north: true,
          south: true,
        };
        exitPlayMode(player, handoff);
        oneKeyView.replace(0, tileTypesByName.thumbUp);
        return enterMenuMode(position, player, handoff);
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

      return playMode;
    };

    /**
     * @param {number} position - position of edit or play mode before menu, to
     * which we may return.
     * @param {number | undefined} player - entity of the player from play mode, to which
     * we may return if we do nothing in the menu or edit modes before returning.
     * Without a defined player, we cannot go to play mode.
     * @param {Object} handoff
     * @param {boolean} [handoff.north]
     * @param {boolean} [handoff.south]
     */
    const enterMenuMode = (position, player, handoff) => {
      /** @type {Mode} */
      const menuMode = {
        name: 'menu',
        commandKeys: {
          ...numberKeys,
          ...arrowKeys,
          Enter: 0,
          Escape: 5,
        },
        handleCommand(command, repeat) {
          if (repeat) return mode;
          if (command === 8) {
            menuController.goNorth();
          } else if (command === 2) {
            menuController.goSouth();
          } else if (command === 5) {
            if (player === undefined) {
              return menuToEditMode(position, player);
            } else {
              return menuToPlayMode(player);
            }
          } else if (command === 0) {
            const state = menuController.getState();
            if (state === 'play') {
              if (player !== undefined) {
                return menuToPlayMode(player);
              } else {
                // TODO nineKeyView.shake(5);
                dialogController.logHTML(
                  'Add a <b>😊player</b> to the world with the editor.',
                );
                return menuMode;
              }
            } else if (state === 'edit') {
              return menuToEditMode(position, player);
            } else if (state === 'load') {
              // TODO this call to tock() bypasses the driver.
              // Perhaps this should be appealing to the driver instead.
              tock();
              loadWorld();
              exitMenuMode({});
              return limboMode;
            } else if (state === 'save') {
              saveWorld(capture(player)).finally(() => {
                mode = menuMode;
              });
              return limboMode;
            }
          }
          return menuMode;
        },
      };

      restoreDpad({
        ...handoff,
        east: true,
        west: true,
      });

      menuController.show();
      dialogController.logHTML('🍔  <b>Hamburger Menu</b>');

      return menuMode;
    };

    /**
     * @param {Object} handoff
     * @param {boolean} [handoff.north]
     * @param {boolean} [handoff.south]
     */
    const exitMenuMode = handoff => {
      if (!handoff.north) {
        nineKeyView.despawnOutward(nn);
      }
      if (!handoff.south) {
        nineKeyView.despawnOutward(ss);
      }

      dialogController.close();
      menuController.hide();
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
          const agentName = agentTypes[agentType].name;
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
        },
        handleCommand(command, repeat) {
          const direction = commandDirection[command];
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
            return enterChooseAgentMode(position);
          } else if (command === 0 && !repeat) {
            return editToMenuMode(position, player);
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

      const firstEligibleEntityType = 3;
      const eligibleEntityCount = agentTypes.length - firstEligibleEntityType;

      /**
       * @param {number} offset
       */
      const agentTypeForOffset = offset => {
        assertNonZero(editType);
        return (
          ((eligibleEntityCount + editType - firstEligibleEntityType + offset) %
            eligibleEntityCount) +
          firstEligibleEntityType
        );
      };

      /**
       * @param {number} position
       */
      const enterChooseAgentMode = position => {
        /** @type {Mode} */
        const chooseAgentMode = {
          name: 'chooseAgent',
          commandKeys: {
            ...numberKeys,
            ...arrowKeys,
            Escape: 5,
            Enter: 5,
          },
          handleCommand(command, repeat) {
            if (repeat) return mode;
            if (command === 8) {
              assertNonZero(editType);
              editType = agentTypeForOffset(1);
              logAgentChoice();
              shiftAgentsSouth();
            } else if (command === 2) {
              assertNonZero(editType);
              editType = agentTypeForOffset(-1);
              logAgentChoice();
              shiftAgentsNorth();
            } else if (command === 6) {
              assertNonZero(editType);
              editType = agentTypeForOffset(3);
              logAgentChoice();
              shiftAgentsWest();
            } else if (command === 4) {
              assertNonZero(editType);
              editType = agentTypeForOffset(-3);
              logAgentChoice();
              shiftAgentsEast();
            } else if (command === 5) {
              return exitChooseAgentMode(position);
            }
            return chooseAgentMode;
          },
        };

        dismissEditorReticle();
        dismissEditorBezel();
        dismissDpad({});

        if (editType === 0) {
          editType = 4;
          nineKeyView.spawn(4, defaultTileTypeForAgentType[editType]);
        }

        // Initialize board with agent type neighborhood around current edit type.
        for (let index = 0; index < agentOffsets.length; index += 1) {
          const offset = agentOffsets[index];
          const gridIndex = itemGridIndexes[index];
          const agentType = agentTypeForOffset(offset);
          const tileType = defaultTileTypeForAgentType[agentType];
          nineKeyView.spawn(gridIndex, tileType);
        }

        logAgentChoice();

        restoreControllerReticle();
        return chooseAgentMode;
      };

      /**
       * @param {number} position
       */
      const exitChooseAgentMode = position => {
        dismissControllerReticle();

        for (let direction = 0; direction < fullOcturn; direction += 1) {
          nineKeyView.despawnOutward(direction);
        }

        restoreEditorReticle(position);
        restoreEditorBezel();
        restoreDpad({});

        return editMode;
      };

      const logAgentChoice = () => {
        const { name, tile } = agentTypes[editType];
        const tileType = tile ? tileTypesByName[tile] : tileTypesByName[name];
        const { text } = tileTypes[tileType];
        dialogController.close();
        dialogController.log(`${text} ${name}`);
      };

      /**
       * @param {number} gridIndex
       * @param {number} directionOcturns
       */
      const enterAgent = (gridIndex, directionOcturns) => {
        const agentOffset = agentOffsetForGridIndex[gridIndex];
        const agentType = agentTypeForOffset(agentOffset);
        const tileType = defaultTileTypeForAgentType[agentType];
        nineKeyView.give(gridIndex, tileType, directionOcturns);
      };

      const shiftAgentsWest = () => {
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
      };

      const shiftAgentsEast = () => {
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
      };

      const shiftAgentsNorth = () => {
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
      };

      const shiftAgentsSouth = () => {
        for (let start = 0; start < 3; start += 1) {
          nineKeyView.take(start, sw);
        }
        for (let start = 0; start < 6; start += 1) {
          nineKeyView.move(start + 3, start, ss, 0);
        }
        for (let start = 0; start < 3; start += 1) {
          enterAgent(start + 6, sw);
        }
      };

      restoreDpad(handoff);

      restoreEditorBezel();

      if (editType !== 0) {
        nineKeyView.spawn(4, defaultTileTypeForAgentType[editType]);
      }

      updateEditorDialog();

      restoreEditorReticle(position);

      return editMode;
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

      menuController.show();

      dialogController.close();
    };

    /** @param {number} position */
    const limboToEditMode = position => {
      return enterEditMode(position, undefined, {});
    };

    /**
     * @param {number} position
     * @param {number | undefined} player
     */
    const menuToEditMode = (position, player) => {
      const handoff = {
        north: true,
        south: true,
      };
      exitMenuMode(handoff);
      oneKeyView.replace(0, tileTypesByName.hamburger);
      return enterEditMode(position, player, handoff);
    };

    /**
     * @param {number} player
     */
    const menuToPlayMode = player => {
      const handoff = {
        north: true,
        south: true,
      };
      exitMenuMode(handoff);
      oneKeyView.replace(0, tileTypesByName.hamburger);
      return enterPlayMode(player, handoff);
    };

    /**
     * @param {number} player
     */
    const limboToPlayMode = player => {
      const handoff = {};
      return enterPlayMode(player, handoff);
    };

    /**
     * @param {number} position
     * @param {number | undefined} player
     */
    const editToMenuMode = (position, player) => {
      const handoff = {
        north: true,
        south: true,
      };
      exitEditMode(handoff);
      oneKeyView.replace(0, tileTypesByName.thumbUp);
      return enterMenuMode(position, player, handoff);
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
  const limboMode = {
    name: 'limbo',
    commandKeys: {},
    handleCommand(_command, _repeat) {
      return limboMode;
    },
    play(world, player) {
      const { limboToPlayMode, limboToEditMode, ...clock } =
        makeWorldModes(world);
      worldClock = clock;
      if (player !== undefined) {
        return limboToPlayMode(player);
      } else {
        return limboToEditMode(0);
      }
    },
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
      nineKeyView.spawnInward(tileTypesByName.north, nn);
    }
    if (!handoff.east) {
      nineKeyView.spawnInward(tileTypesByName.east, ee);
    }
    if (!handoff.south) {
      nineKeyView.spawnInward(tileTypesByName.south, ss);
    }
    if (!handoff.west) {
      nineKeyView.spawnInward(tileTypesByName.west, ww);
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
    nineKeyView.spawnInward(tileTypesByName.scissors, ne);
    nineKeyView.spawnInward(tileTypesByName.twin, nw);
    nineKeyView.spawnInward(tileTypesByName.paint, sw);
    nineKeyView.spawnInward(tileTypesByName.spoon, se);
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
    menuController.tick();
    dialogController.close();
    nineKeyMacroViewModel.tick();
    oneKeyView.tick();
    healthController.tick();
    staminaController.tick();
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
    menuController.animate(progress);
    dialogController.animate(progress);
    healthController.animate(progress);
    staminaController.animate(progress);
  };

  const tock = () => {
    if (worldClock) {
      worldClock.tock();
    }
    menuController.tock();
    dialogController.tock();
    nineKeyMacroViewModel.tock();
    oneKeyView.tock();
    healthController.tock();
    staminaController.tock();
  };

  let mode = limboMode;

  /** @type {HandleCommandFn} */
  const handleCommand = (command, repeat) => {
    tock();
    mode = mode.handleCommand(command, repeat);
    tick();
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
   * @param {number | undefined} player
   */
  const play = (world, player) => {
    if (mode.play) {
      tock();
      mode = mode.play(world, player);
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
    assert(hasOwn(directionCommand, direction));
    return directionCommand[direction];
  };

  /**
   * @param {number} command
   */
  const directionForCommand = command => {
    assert(hasOwn(commandDirection, command));
    return commandDirection[command];
  };

  /**
   * @param {string} key
   */
  const commandForKey = key => {
    assert(hasOwn(mode.commandKeys, key));
    return mode.commandKeys[key];
  };

  return {
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
