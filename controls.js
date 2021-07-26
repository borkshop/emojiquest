// @ts-check

import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {viewText, tileTypesByName} from './data.js';
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
 * @param {Coord} dimensions
 */
function makeTileMap({x: w, y: h, a}) {
  const map = new Map();
  for (let x = 0; x < w; x += 1) {
    for (let y = 0; y < h; y += 1) {
      map.set(y * 3 + x, {x, y, a});
    }
  }
  return map;
}

const tileMap = makeTileMap({x: 3, y: 3, a: 0});

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

  // Entity id corresponds to digit on numeric keypad.
  // Entity location is raster 3x3 offset.
  macroViewModel.put(7, 0, tileTypesByName.backpack);
  macroViewModel.put(8, 1, tileTypesByName.north);
  macroViewModel.put(9, 2, tileTypesByName.shield);
  macroViewModel.put(4, 3, tileTypesByName.west);
  macroViewModel.put(5, 4, tileTypesByName.watch);
  macroViewModel.put(6, 5, tileTypesByName.east);
  macroViewModel.put(1, 6, tileTypesByName.left);
  macroViewModel.put(2, 7, tileTypesByName.south);
  macroViewModel.put(3, 8, tileTypesByName.right);

  /**
   * @param {number} command
   */
  function up(command) {
    macroViewModel.up(command);
  }

  /**
   * @param {number} command
   */
  function down(command) {
    macroViewModel.down(command);
  }

  /**
   * @param {number} type
   */
  function left(type) {
    if (type === undefined) {
      macroViewModel.replace(1, tileTypesByName.left);
    } else {
      macroViewModel.replace(1, type);
    }
  }

  /**
   * @param {number} type
   */
  function right(type) {
    if (type === undefined) {
      macroViewModel.replace(3, tileTypesByName.right);
    } else {
      macroViewModel.replace(3, type);
    }
  }

  const inventory = {left, right};

  /**
   * @param {Progress} progress
   */
  function animate(progress) {
    animateWorld(progress);
    macroViewModel.animate(progress);
  }

  function reset() {
    macroViewModel.reset();
    resetWorld();
  }

  /**
   * @param {number} command
   * @param {boolean} repeat
   */
  function command(command, repeat) {
    const direction = commandDirection[command];
    if (direction !== undefined) {
      commandWorld(direction, repeat, inventory);
    }
  }

  return {
    reset,
    animate,
    up,
    down,
    command,
  }
}
