// @ts-check

import { assumeDefined } from './lib/assert.js';
import { makeViewModel } from './view-model.js';
import { makeMacroViewModel } from './macro-view-model.js';
import { makeElementWatcher } from './element-watcher.js';
import { makeBoxTileMap } from './tile-map-box.js';

const svgNS = 'http://www.w3.org/2000/svg';

/**
 * @param {Object} args
 * @param {number} args.tileSizePx
 * @param {number} args.healthTileType
 * @param {(tile: number, type: number) => Element} args.createElement
 * @param {(tile: number) => void} [args.collectElement]
 */
export function writeHealthBar({
  tileSizePx,
  healthTileType,
  createElement,
  collectElement,
}) {
  const element = document.createElementNS(svgNS, 'svg');
  element.setAttributeNS(null, 'viewBox', `0 0 5 1`);
  element.setAttributeNS(null, 'height', `${(1 * tileSizePx) / 2}`);
  element.setAttributeNS(null, 'width', `${(5 * tileSizePx) / 2}`);
  element.setAttributeNS(null, 'class', 'healthBar');

  const watcher = makeElementWatcher(
    element,
    null,
    createElement,
    collectElement,
  );
  const viewModel = makeViewModel();
  const tileMap = makeBoxTileMap({ x: 5, y: 1 });
  viewModel.watchEntities(tileMap, watcher);
  const macroViewModel = makeMacroViewModel(viewModel, { name: 'healthBar' });

  let health = 0;
  let next = 0;
  /** @type {Array<number>} */
  const entities = [];

  /** @param {number} newHealth */
  const set = newHealth => {
    while (health < newHealth) {
      const entity = next;
      entities.push(entity);
      macroViewModel.put(entity, health, healthTileType);
      macroViewModel.enter(entity);
      next += 1;
      health += 1;
    }
    while (newHealth < health) {
      const entity = assumeDefined(entities.pop());
      macroViewModel.exit(entity);
      health -= 1;
    }
  };

  const { animate, tick, tock } = macroViewModel;

  const controller = {
    set,
    animate,
    tick,
    tock,
  };

  return { element, controller };
}

/** @typedef {ReturnType<writeHealthBar>['controller']} HealthController */
