// @ts-check

import { fullQuarturn } from './geometry2d.js';
import { makeDaia } from './daia.js';
import { cell } from './cell.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeModel } from './model.js';
import { makeController } from './controls.js';
import {
  makeControllerElementWatchers,
  watchControllerCommands,
} from './control-elements.js';
import { makeDriver } from './driver.js';
import { makeCommandDispatcher } from './commands.js';
import { makeMechanics } from './mechanics.js';
import {
  recipes,
  actions,
  tileTypes,
  validAgentTypes,
  validItemTypes,
  validEffectTypes,
} from './data.js';

import { createDialogBox } from './dialog.js';
import { createMenuBlade } from './menu.js';
import { makeMap } from './map.js';
import { writeHealthBar } from './health.js';
import { writeStaminaBar } from './stamina.js';

const svgNS = 'http://www.w3.org/2000/svg';

/** @typedef {import('./animation2d.js').Coord} Coord */

/**
 * @callback CreateEntityFn
 * @param {number} entity
 * @param {number} type
 * @returns {SVGElement}
 */

/**
 * @param {import('./mechanics.js').Mechanics} mechanics
 */
export const makeEntityCreator = mechanics => {
  /** @type {CreateEntityFn} */
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
      $text.appendChild(document.createTextNode(mechanics.viewText[type]));
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
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSizePx}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSizePx}`);
  $controls.setAttributeNS(null, 'class', 'panel controlPanel');
  return $controls;
};

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
const createHamburger = ({ tileSizePx }) => {
  const $hamburger = document.createElementNS(svgNS, 'svg');
  $hamburger.setAttributeNS(null, 'viewBox', `0 0 1 1`);
  $hamburger.setAttributeNS(null, 'height', `${1 * tileSizePx}`);
  $hamburger.setAttributeNS(null, 'width', `${1 * tileSizePx}`);
  $hamburger.setAttributeNS(null, 'class', 'panel hamburgerPanel');
  return $hamburger;
};

const main = async () => {
  const tileSizePx = 130; // the height and width of a tile in pixels
  const facetSize = 9; // the height and width of a facet in units of tiles
  const facetsPerFaceSize = 9; // the height and width of a face in units of facets
  const faceSize = facetsPerFaceSize * facetSize; // the height and width of a face in tiles
  const facetSizePx = facetSize * tileSizePx;
  const frustumRadius = 10;
  const animatedTransitionDuration = 300;

  // Model

  const faceWorld = makeDaia({
    tileSizePx, // presumed irrelevant
    faceSize: 1,
  });

  const facetWorld = makeDaia({
    tileSizePx, // presumed irrelevant
    faceSize: facetsPerFaceSize,
  });

  const world = makeDaia({
    tileSizePx,
    faceSize,
  });

  const mechanics = makeMechanics({
    recipes,
    actions,
    tileTypes,
    validAgentTypes,
    validItemTypes,
    validEffectTypes,
  });

  // View

  const worldViewModel = makeViewModel();
  const worldMacroViewModel = makeMacroViewModel(worldViewModel, {
    name: 'world',
  });

  const worldModel = makeModel({
    size: world.worldArea,
    advance: world.advance,
    macroViewModel: worldMacroViewModel,
    mechanics,
  });

  const createEntity = makeEntityCreator(mechanics);

  const documentElement = document.documentElement;
  const parentElement = document.body;
  const nextSibling = null;

  documentElement.style.setProperty('--tileSizePx', `${tileSizePx}`);
  documentElement.style.setProperty('--faceSize', `${faceSize}`);
  documentElement.style.setProperty('--facetSize', `${facetSize}`);

  const { $map, cameraController } = makeMap({
    faceSize,
    facetSize,
    facetsPerFaceSize,
    tileSizePx,
    facetSizePx,
    frustumRadius,
    createEntity,

    faceSizePx: world.faceSizePx,
    tileNumber: world.tileNumber,
    tileCoordinate: world.tileCoordinate,
    tileCoordinateOnFace: world.tileCoordinateOnFace,
    advance: world.advance,

    facetNumber: facetWorld.tileNumber,
    facetCoordinate: facetWorld.tileCoordinate,

    faceTileCoordinate: faceWorld.tileCoordinate,
    faceAdvance: faceWorld.advance,

    watchTerrain: worldModel.watchTerrain,
    unwatchTerrain: worldModel.unwatchTerrain,
    getTerrainFlags: worldModel.getTerrainFlags,

    watchEntities: worldViewModel.watchEntities,
    unwatchEntities: worldViewModel.unwatchEntities,
  });

  parentElement.insertBefore($map, nextSibling);

  const { element: $dialogBox, controller: dialogController } =
    createDialogBox();
  parentElement.insertBefore($dialogBox, nextSibling);

  const { element: $staminaBar, controller: staminaController } =
    writeStaminaBar({
      tileSizePx,
      staminaTileType: mechanics.tileTypesByName.stamina,
      createElement: createEntity,
    });
  parentElement.insertBefore($staminaBar, nextSibling);

  const { element: $healthBar, controller: healthController } = writeHealthBar({
    tileSizePx,
    healthTileType: mechanics.tileTypesByName.health,
    createElement: createEntity,
  });
  parentElement.insertBefore($healthBar, nextSibling);

  const { $menuBlade, menuController } = createMenuBlade({
    tileSizePx,
    pointerTileType: mechanics.tileTypesByName.east,
    createElement: createEntity,
  });
  parentElement.appendChild($menuBlade);

  const $controls = createControls({ tileSizePx });
  parentElement.insertBefore($controls, nextSibling);

  const $hamburger = createHamburger({ tileSizePx });
  parentElement.insertBefore($hamburger, nextSibling);

  /**
   * @param {number} _destination
   * @param {import('./daia.js').CursorChange} change
   */
  const followCursor = (_destination, change) => {
    moment.set((moment.get() + change.turn + fullQuarturn) % fullQuarturn);
  };

  const { viewText } = mechanics;

  const { nineKeyWatcher, oneKeyWatcher } = makeControllerElementWatchers(
    $controls,
    $hamburger,
    { viewText },
  );

  const controls = makeController({
    nineKeyWatcher,
    oneKeyWatcher,
    worldModel,
    worldMacroViewModel,
    toponym: world.toponym,
    advance: world.advance,
    followCursor,
    mechanics,
    menuController,
    cameraController,
    dialogController,
    healthController,
    staminaController,
  });

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

  const response = await fetch(new URL('daia.json', import.meta.url).href);
  const worldData = await response.json();
  const player = worldModel.restore(worldData);
  if (typeof player === 'number' || player === undefined) {
    controls.play(player);
    controls.tock();
  }

  const driver = makeDriver(controls, {
    moment,
    animatedTransitionDuration,
  });

  const dispatcher = makeCommandDispatcher(window, driver);

  watchControllerCommands($controls, $hamburger, dispatcher, { tileSizePx });

  // TODO properly integrate water and magma in an editor mode
  window.addEventListener('keypress', event => {
    if (controls.etcCommand(event.key)) {
      event.stopPropagation();
    }
  });
};

main();
