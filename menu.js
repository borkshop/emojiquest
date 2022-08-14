// @ts-check

import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { rotate, matrixStyle } from './matrix2d.js';
import { makeElementWatcher } from './element-watcher.js';
import { makeBoxTileMap } from './tile-map-box.js';
import { ss, nn } from './lib/geometry2d.js';

const svgNS = 'http://www.w3.org/2000/svg';

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 * @param {number} args.pointerTileType
 * @param {(tile: number, type: number) => Element} args.createElement
 * @param {(tile: number) => void} [args.collectElement]
 */
export function createMenuBlade({
  tileSizePx,
  pointerTileType,
  createElement,
  collectElement,
}) {
  let state = 0;
  let entity = 0;
  let prev = false;
  let next = false;

  const $menuBlade = document.createElement('div');
  $menuBlade.setAttribute('class', 'blade menuBlade');
  $menuBlade.style.transform = matrixStyle(rotate(-Math.PI / 2));

  const $menu = document.createElement('div');
  $menu.setAttribute('class', 'menu panel');
  $menuBlade.appendChild($menu);

  const $curb = document.createElementNS(svgNS, 'svg');
  $curb.setAttribute('class', 'menuCurb');
  $curb.setAttributeNS(null, 'viewBox', `0 0 1 4`);
  $curb.setAttributeNS(null, 'height', `${4 * tileSizePx}`);
  $curb.setAttributeNS(null, 'width', `${1 * tileSizePx}`);
  $menu.appendChild($curb);

  /**
   * @param {string} label
   */
  function appendLabel(label) {
    const $label = document.createElement('div');
    $label.innerText = label;
    $label.setAttribute('class', 'menuLabel');
    $menu.appendChild($label);
  }

  appendLabel('🎭 Play');
  appendLabel('🏦 Save');
  appendLabel('🚚 Load');
  appendLabel('🚧 Edit');

  const watcher = makeElementWatcher(
    $curb,
    null,
    createElement,
    collectElement,
  );
  const viewModel = makeViewModel();
  const tileMap = makeBoxTileMap({ x: 1, y: 4 });
  viewModel.watchEntities(tileMap, watcher);
  const macroViewModel = makeMacroViewModel(viewModel, {
    name: 'menu-pointer-curb',
  });

  macroViewModel.put(entity, state, pointerTileType);

  /** @type {import('./animation.js').AnimateFn} */
  function animate(progress) {
    macroViewModel.animate(progress);

    // animate rotation of menu
    if (prev !== next) {
      if (next) {
        // showing
        $menuBlade.style.transform = matrixStyle(
          rotate((-Math.PI / 2) * (1 - progress.sinusoidal)),
        );
      } else {
        // hiding
        $menuBlade.style.transform = matrixStyle(
          rotate((-Math.PI / 2) * progress.sinusoidal),
        );
      }
    } else {
      if (next) {
        // shown
        $menuBlade.style.transform = matrixStyle(rotate(0));
      } else {
        // hidden
        $menuBlade.style.transform = matrixStyle(rotate(-Math.PI / 2));
      }
    }
  }

  function tick() {
    macroViewModel.tick();
  }

  function tock() {
    macroViewModel.tock();
    prev = next;
  }

  function goNorth() {
    state -= 1;
    if (state >= 0) {
      macroViewModel.move(entity, state, nn, 0);
    } else {
      macroViewModel.exit(entity);
      entity += 1;
      state = 3;
      macroViewModel.put(entity, state, pointerTileType);
      macroViewModel.enter(entity);
    }
  }

  function goSouth() {
    state += 1;
    if (state < 4) {
      macroViewModel.move(entity, state, ss, 0);
    } else {
      macroViewModel.exit(entity);
      entity += 1;
      state = 0;
      macroViewModel.put(entity, state, pointerTileType);
      macroViewModel.enter(entity);
    }
  }

  function getState() {
    return ['play', 'save', 'load', 'edit'][state];
  }

  function show() {
    next = true;
  }

  function hide() {
    next = false;
  }

  const menuController = {
    show,
    hide,
    goNorth,
    goSouth,
    getState,
    animate,
    tick,
    tock,
  };

  return { $menuBlade, menuController };
}

/**
 * @typedef {ReturnType<createMenuBlade>['menuController']} MenuController
 */
