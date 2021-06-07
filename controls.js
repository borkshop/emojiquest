// @ts-check

import {north, east, south, west, same} from './geometry2d.js';
import {placeEntity} from './animation2d.js';
import {makeTileView} from './tile-view.js';
import {makeViewModel} from './view-model.js';
import {viewText, viewTypesByName} from './data.js';

/** @typedef {import('./animation.js').AnimateFn} AnimateFn */
/** @typedef {import('./animation.js').Progress} Progress */
/** @typedef {import('./animation2d.js').Coord} Coord */
/** @typedef {import('./animation2d.js').Transition} Transition */
/** @typedef {import('./view-model.js').Watcher} Watcher */
/** @typedef {import('./view-model.js').PlaceFn} PlaceFn */
/** @typedef {import('./view-model.js').EntityWatchFn} EntityWatchFn */

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
 */
export function makeControlsController($parent) {
  const $controls = createControls();
  $parent.appendChild($controls);

  const elements = new Map();
  const types = new Map();

  /**
   * @param {number} entity
   */
  function createElement(entity) {
    const type = types.get(entity);
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
    placeEntity(element, coord, pressure, progress, transition);
  }

  const viewModel = makeViewModel();

  viewModel.watch(tileMap, {enter, exit, place});

  let next = 0;
  /**
   * @param {number} location
   * @param {number} type
   */
  function create(location, type) {
    const entity = next;
    next += 1;

    types.set(entity, type);
    viewModel.put(entity, location);
    return entity;
  }

  const northEntity = create(1, viewTypesByName.north);
  const westEntity = create(3, viewTypesByName.west);
  const watchEntity = create(4, viewTypesByName.watch);
  const eastEntity = create(5, viewTypesByName.east);
  const southEntity = create(7, viewTypesByName.south);
  const leftEntity = create(6, viewTypesByName.left);
  const rightEntity = create(8, viewTypesByName.right);

  // TODO remove this and actually use entities.
  /** @type {any} */
  const {} = {
    northEntity,
    southEntity,
    westEntity,
    eastEntity,
    leftEntity,
    rightEntity,
    watchEntity,
  };

  const commandEntity = {
    [north]: northEntity,
    [south]: southEntity,
    [east]: eastEntity,
    [west]: westEntity,
    [same]: watchEntity,
  };

  /**
   * @param {number} command
   */
  function up(command) {
    viewModel.up(commandEntity[command]);
  }

  /**
   * @param {number} command
   */
  function down(command) {
    viewModel.down(commandEntity[command]);
  }

  const {reset, animate} = viewModel;

  return {
    reset,
    animate,
    up,
    down
  }
}
