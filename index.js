// @ts-check

import {mustFind} from 'domkit/wiring';
import {cell} from './cell.js';
import {linear, easeInOutQuart} from './easing.js';
import {north, fullQuarturn} from './geometry2d.js';
import {rotate, matrixStyle} from './matrix2d.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeFacetView} from './facet-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {makeModel} from './model.js';
import {makeController, watchControllerCommands} from './controls.js';
import {makeDriver} from './driver.js';
import {makeCommandDispatcher} from './commands.js';
import {makeMechanics} from './mechanics.js';
import {recipes, actions, tileTypes, agentTypes, itemTypes, effectTypes} from './data.js';
import {makeFacetCreator} from './facet-creator.js';
import {createMenuBlade} from './menu.js';

/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

/** @typedef {import('./animation2d.js').Coord} Coord */

const $context = mustFind('#context');

const radius = 15; // the player's frustum radius in tiles
const tileSize = 75; // the height and width of a tile in pixels
const facetSize = 9; // the height and width of a facet in units of tiles
const faceSize = 9 * facetSize; // the height and width of a face in tiles

document.documentElement.style.setProperty('--tileSize', `${tileSize}`);
document.documentElement.style.setProperty('--faceSize', `${faceSize}`);
document.documentElement.style.setProperty('--facetSize', `${facetSize}`);

const animatedTransitionDuration = 300;
const slowCameraTransitionDuration = 900;
const fastCameraTransitionDuration = 300;

const position = (81 * 81 * 5.5) | 0;

const cursor = {position, direction: north};

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

const facets = makeDaia({
  tileSize: tileSize * faceSize / facetSize,
  faceSize: facetSize,
});

const svgNS = "http://www.w3.org/2000/svg";

/**
 * @typedef {import('./matrix3d.js').Matrix} Matrix
 */

/**
 * @typedef Cube
 * @prop {number} worldArea
 * @prop {(tile: number) => Matrix} tileTransform
 */

function createControls() {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'id', 'controls');
  $controls.setAttributeNS(null, 'class', 'panel');
  return $controls;
}

function createCoordBlade() {
  const $coordBlade = document.createElement('div');
  $coordBlade.setAttribute('id', 'coordBlade');
  $coordBlade.setAttribute('class', 'blade');
  // TODO Animate rotation of blades.
  $coordBlade.style.transform = matrixStyle(rotate(0));
  const $coord = document.createElement('div');
  $coord.setAttribute('id', 'coord');
  $coord.setAttribute('class', 'panel');
  $coordBlade.appendChild($coord);
  return {$coordBlade, $coord};
}

function createHamburger() {
  const $hamburger = document.createElementNS(svgNS, 'svg');
  $hamburger.setAttributeNS(null, 'viewBox', `0 0 1 1`);
  $hamburger.setAttributeNS(null, 'height', `${1 * tileSize}`);
  $hamburger.setAttributeNS(null, 'width', `${1 * tileSize}`);
  $hamburger.setAttributeNS(null, 'id', 'hamburger');
  $hamburger.setAttributeNS(null, 'class', 'panel');
  return $hamburger;
}

const mechanics = makeMechanics({
  recipes,
  actions,
  tileTypes,
  agentTypes,
  itemTypes,
  effectTypes,
});


const $controls = createControls();
document.body.appendChild($controls);

const {$coordBlade, $coord} = createCoordBlade();
document.body.appendChild($coordBlade);

const {$menuBlade, menuController} = createMenuBlade({
  tileSize,
  pointerTileType: mechanics.tileTypesByName.east,
  createElement: createEntity,
});
document.body.appendChild($menuBlade);

const $hamburger = createHamburger();
document.body.appendChild($hamburger);

$coord.innerText = world.toponym(position);

const camera = makeCamera($context, world.cameraTransform(cursor.position));

const cameraController = makeCameraController({
  camera,
  advance: world.advance,
  tileSize,
  ease: linear,
  easeRoll: easeInOutQuart,
  slow: slowCameraTransitionDuration,
  fast: fastCameraTransitionDuration,
});

/**
 * @param {number} _entity
 * @param {number} type
 * @returns {SVGElement}
 */
function createEntity(_entity, type) {
  if (type === -1) {
    const $entity = document.createElementNS(svgNS, 'circle');
    $entity.setAttributeNS(null, 'class', 'reticle');
    $entity.setAttributeNS(null, 'r', '0.75');
    return $entity;
  } else {
    const $entity = document.createElementNS(svgNS, 'text');
    $entity.setAttributeNS(null, 'class', 'moji');
    $entity.appendChild(document.createTextNode(mechanics.viewText[type]));
    return $entity;
  }
}

const worldViewModel = makeViewModel();
const worldMacroViewModel = makeMacroViewModel(worldViewModel, {name: 'world'});

const worldModel = makeModel({
  size: world.worldArea,
  advance: world.advance,
  macroViewModel: worldMacroViewModel,
  mechanics,
});

const agent = worldModel.init(position);

const {watchTerrain, unwatchTerrain, getTerrainFlags} = worldModel;

const {createFacet, animateFacets} = makeFacetCreator({
  watchTerrain,
  unwatchTerrain,
  getTerrainFlags,
  facetSize,
  tileSize,
});

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

/**
 * @param {number} destination
 * @param {import('./camera-controller.js').CursorChange} change
 */
function followCursor(destination, change) {
  cameraController.go(change);
  moment.set((moment.get() + change.turn + fullQuarturn) % fullQuarturn);
  $coord.innerText = world.toponym(destination);
}

const controls = makeController($controls, $hamburger, {
  agent,
  worldModel,
  worldViewModel,
  worldMacroViewModel,
  frustumRadius: radius,
  cursor,
  facetView,
  advance: world.advance,
  cameraTransform: world.cameraTransform,
  camera,
  followCursor,
  mechanics,
  animateAux: animateFacets,
  menuController,
});

const driver = makeDriver(controls, {
  moment,
  animatedTransitionDuration,
});

// TODO properly integrate water and magma in an editor mode
window.addEventListener('keypress', event => {
  if (event.key === 'w') {
    event.stopPropagation();
    const location = worldModel.locate(agent);
    worldModel.setTerrainFlags(location, 0b1);
  }
  if (event.key === 'm') {
    event.stopPropagation();
    const location = worldModel.locate(agent);
    worldModel.setTerrainFlags(location, 0b10);
  }
});

const dispatcher = makeCommandDispatcher(window, driver);

console.log($hamburger);
watchControllerCommands($controls, $hamburger, dispatcher, {tileSize});
