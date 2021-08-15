// @ts-check

import {mustFind} from 'cdom/wiring';
import {cell} from './cell.js';
import {linear} from './easing.js';
import {north, fullQuarturn} from './geometry2d.js';
import {scale, matrix3dStyle} from './matrix3d.js';
import {faceColors} from './brand.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeFacetView} from './facet-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {makeModel} from './model.js';
import {makeController} from './controls.js';
import {viewText} from './mechanics.js';
import {makeButtonKeyHandler} from './button-key-handler.js';
import {makeDriver} from './driver.js';


/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

const $context = mustFind('#context');
const $debug = mustFind('#debug');

const radius = 10;
const tileSize = 100;
const facetSize = 9;
const faceSize = 9 * facetSize;

const animatedTransitionDuration = 300;
const slowCameraTransitionDuration = 900;
const fastCameraTransitionDuration = 300;

const position = (81 * 81 * 5.5) | 0;

let cursor = {position, direction: north};

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
let moment = cell(0);

const world = makeDaia({
  tileSize,
  faceSize,
});

$debug.innerText = world.toponym(position);

const facets = makeDaia({
  tileSize: tileSize * faceSize / facetSize,
  faceSize: facetSize,
});

const foundation = makeDaia({
  tileSize,
  faceSize: 1,
  transform: scale(faceSize*0.9999),
});

// const atmosquare = makeDaia({
//   tileSize: tileSize,
//   faceSize: 3,
//   transform: scale(faceSize*2/3),
// });

// const firmament = makeDaia({
//   tileSize: 100,
//   faceSize: 3,
//   transform: scale(faceSize*3/3),
// });

/**
 * @param {number} t
 * @returns {HTMLElement}
 */
function createFoundationTile(t) {
  const $tile = document.createElement('div');
  $tile.className = 'foundation';
  $tile.style.backgroundColor = faceColors[t];
  return $tile;
}

// /**
//  * @param {number} _t
//  * @returns {HTMLElement}
//  */
// function createAtmosquare(_t) {
//   const $tile = document.createElement('div');
//   $tile.className = 'atmosquare';
//   $tile.innerText = Math.random() < 0.25 ? `☁️` : '';
//   return $tile;
// }

// /**
//  * @param {number} _t
//  * @returns {HTMLElement}
//  */
// function createFirmamentTile(_t) {
//   const $tile = document.createElement('div');
//   $tile.className = 'firmament';
//   $tile.innerText = Math.random() < 0.75 ? `⭐️` : '';
//   return $tile;
// }

const svgNS = "http://www.w3.org/2000/svg";

/**
 * @param {number} _f
 * @returns {SVGElement}
 */
function createFacet(_f) {
  const $tile = document.createElementNS(svgNS, 'svg');
  $tile.setAttributeNS(null, 'viewBox', `0 0 ${facetSize} ${facetSize}`);
  $tile.setAttributeNS(null, 'height', `${facetSize * tileSize}`);
  $tile.setAttributeNS(null, 'width', `${facetSize * tileSize}`);
  $tile.setAttributeNS(null, 'class', 'facet');
  return $tile;
}

/**
 * @typedef {import('./matrix3d.js').Matrix} Matrix
 */

/**
 * @typedef Cube
 * @prop {number} worldArea
 * @prop {(tile: number) => Matrix} tileTransform
 */

/**
 * @param {HTMLElement} context
 * @param {Cube} cube
 * @param {(tile: number) => HTMLElement} createTile
 */
function createAllTiles3d(context, cube, createTile) {
  for (let t = 0; t < cube.worldArea; t++) {
    const $tile = createTile(t);
    const transform = cube.tileTransform(t);
    $tile.style.transform = matrix3dStyle(transform);
    context.appendChild($tile);
  }
}

createAllTiles3d($context, foundation, createFoundationTile);
// createAllTiles3d($context, firmament, createFirmamentTile);
// createAllTiles3d($context, atmosquare, createAtmosquare);

export function createControls() {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'id', 'controls');
  $controls.setAttributeNS(null, 'class', 'panel');
  return $controls;
}

const $controls = createControls();
document.body.appendChild($controls);

const camera = makeCamera($context, world.cameraTransform(cursor.position));

const cameraController = makeCameraController({
  camera,
  advance: world.advance,
  tileSize,
  ease: linear,
  slow: slowCameraTransitionDuration,
  fast: fastCameraTransitionDuration,
});

/**
 * @param {number} _entity
 * @param {number} type
 * @returns {SVGElement}
 */
function createEntity(_entity, type) {
  const $entity = document.createElementNS(svgNS, 'text');
  $entity.setAttributeNS(null, 'class', 'moji');
  $entity.appendChild(document.createTextNode(viewText[type]));
  return $entity;
}

const worldViewModel = makeViewModel();
const worldMacroViewModel = makeMacroViewModel(worldViewModel, {name: 'world'});

const facetView = makeFacetView({
  context: $context,
  createFacet,
  createEntity,
  worldSize: world.faceSize,
  facetSize: facets.faceSize,
  facetTransform: facets.tileTransform,
  facetNumber: facets.tileNumber,
  tileNumber: world.tileNumber,
  tileCoordinate: world.tileCoordinate,
  advance: world.advance,
  facetCoordinate: facets.tileCoordinate,
  watchEntities: worldViewModel.watch,
  unwatchEntities: worldViewModel.unwatch,
});

const {keepTilesAround} = makeTileKeeper({
  enter: facetView.enter,
  exit: facetView.exit,
  advance: world.advance
});

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @callback FollowFn
 * @param {number} e - entity that moved
 * @param {CursorChange} change
 * @param {number} destination
 */

/** @type {FollowFn} */
function follow(e, change, destination) {
  if (e === agent) {
    cameraController.go(change);
    cursor = change;
    moment.set((moment.get() + change.turn + fullQuarturn) % fullQuarturn);
    $debug.innerText = world.toponym(destination);
  }
}

const worldModel = makeModel({
  size: world.worldArea,
  advance: world.advance,
  macroViewModel: worldMacroViewModel,
  follow,
});

const agent = worldModel.init(position);

const controls = makeController($controls, {
  commandWorld(direction, repeat, inventory) {
    worldModel.intend(agent, direction, repeat);
    worldModel.tick(inventory);
  },
  resetWorld() {
    worldModel.tock();
    worldViewModel.reset();
    keepTilesAround(cursor.position, radius);
  },
  /**
   * @param {import('./animation.js').Progress} progress
   */
  animateWorld(progress) {
    camera.animate(progress.now);
    worldViewModel.animate(progress);
  },
});

const driver = makeDriver(controls, {
  moment,
  animatedTransitionDuration,
});

window.addEventListener('keydown', makeButtonKeyHandler(driver.down));
window.addEventListener('keyup', makeButtonKeyHandler(driver.up));
