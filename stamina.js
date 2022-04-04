// @ts-check

import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {makeTileView} from './tile-view.js';
import {makeElementTracker} from './element-tracker.js';
import {makeBoxTileMap} from './tile-map-box.js';

const svgNS = "http://www.w3.org/2000/svg";

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 * @param {number} args.staminaTileType
 * @param {(tile: number, type: number) => Element} args.createElement
 * @param {(tile: number) => void} [args.collectElement]
 */
export function writeStaminaBar({
  tileSizePx,
  staminaTileType,
  createElement,
  collectElement,
}) {
  const element = document.createElementNS(svgNS, 'svg');
  element.setAttributeNS(null, 'viewBox', `0 0 5 1`);
  element.setAttributeNS(null, 'height', `${1 * tileSizePx / 2}`);
  element.setAttributeNS(null, 'width', `${5 * tileSizePx / 2}`);
  element.setAttributeNS(null, 'class', 'staminaBar');

  const {create, collect, place} = makeElementTracker({ createElement, collectElement });
  const tileView = makeTileView(element, null, create, collect);
  const {enter, exit} = tileView;
  const viewModel = makeViewModel();
  const tileMap = makeBoxTileMap({ x: 5, y: 1 });
  viewModel.watchEntities(tileMap, {enter, exit, place});
  const macroViewModel = makeMacroViewModel(viewModel, {name: 'staminaBar'});

  // @ts-ignore
  let stamina = 0;

  macroViewModel.put(0, 0, staminaTileType);
  macroViewModel.put(1, 1, staminaTileType);
  macroViewModel.put(2, 2, staminaTileType);
  macroViewModel.put(3, 3, staminaTileType);
  macroViewModel.put(4, 4, staminaTileType);

  const { animate, reset } = macroViewModel;

  const controller = {
    animate,
    reset
  };

  return {element, controller};
}

/** @typedef {ReturnType<writeStaminaBar>['controller']} StaminaController */
