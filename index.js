// @ts-check

import {mustFind} from 'cdom/wiring';
import {cell} from './cell.js';
import {linear, easeInOutQuart} from './easing.js';
import {north, fullQuarturn} from './geometry2d.js';
import {faceColors} from './brand.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeFacetView} from './facet-view.js';
import {makeViewModel} from './view-model.js';
import {makeMacroViewModel} from './macro-view-model.js';
import {makeModel} from './model.js';
import {makeController} from './controls.js';
import {makeDriver} from './driver.js';
import {makeCommandDispatcher} from './commands.js';
import {makeMechanics} from './mechanics.js';
import {recipes, actions, tileTypes, agentTypes, itemTypes, effectTypes} from './data.js';


/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

/** @typedef {import('./animation2d.js').Coord} Coord */

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

$debug.innerText = world.toponym(position);

const facets = makeDaia({
  tileSize: tileSize * faceSize / facetSize,
  faceSize: facetSize,
});

const svgNS = "http://www.w3.org/2000/svg";

function makeFacetCreator() {
  /**
   * @param {number} _facetNumber
   * @param {number} faceNumber
   * @param {Map<number, Coord>} tiles
   * @returns {{$facet: SVGElement, $layer: SVGElement}}
   */
  function createFacet(_facetNumber, faceNumber, tiles) {
    const $facet = document.createElementNS(svgNS, 'svg');
    $facet.setAttributeNS(null, 'viewBox', `0 0 ${facetSize} ${facetSize}`);
    $facet.setAttributeNS(null, 'height', `${facetSize * tileSize}`);
    $facet.setAttributeNS(null, 'width', `${facetSize * tileSize}`);
    $facet.setAttributeNS(null, 'class', 'facet');

    const $back = document.createElementNS(svgNS, 'g');
    const $layer = document.createElementNS(svgNS, 'g');
    const $front = document.createElementNS(svgNS, 'g');

    for (const [_location, {x, y}] of tiles.entries()) {
      const $backTile = document.createElementNS(svgNS, 'rect');
      $backTile.setAttributeNS(null, 'height', `1`);
      $backTile.setAttributeNS(null, 'width', `1`);
      $backTile.setAttributeNS(null, 'x', `${x}`);
      $backTile.setAttributeNS(null, 'y', `${y}`);
      $backTile.setAttributeNS(null, 'style', `fill: ${faceColors[faceNumber]}`);
      $back.appendChild($backTile);
    }

    for (const [_location, {x, y}] of tiles.entries()) {
      const $frontTile = document.createElementNS(svgNS, 'rect');
      $frontTile.setAttributeNS(null, 'height', `1`);
      $frontTile.setAttributeNS(null, 'width', `1`);
      $frontTile.setAttributeNS(null, 'x', `${x}`);
      $frontTile.setAttributeNS(null, 'y', `${y}`);
      $frontTile.setAttributeNS(null, 'style', `fill: ${faceColors[faceNumber]}; filter: opacity(0)`);
      $front.appendChild($frontTile);
    }

    $facet.appendChild($back);
    $facet.appendChild($layer);
    $facet.appendChild($front);

    return {$facet, $layer};
  }

  return createFacet;
}

/**
 * @typedef {import('./matrix3d.js').Matrix} Matrix
 */

/**
 * @typedef Cube
 * @prop {number} worldArea
 * @prop {(tile: number) => Matrix} tileTransform
 */

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

const createFacet = makeFacetCreator();

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

const mechanics = makeMechanics({
  recipes,
  actions,
  tileTypes,
  agentTypes,
  itemTypes,
  effectTypes,
});

const worldModel = makeModel({
  size: world.worldArea,
  advance: world.advance,
  macroViewModel: worldMacroViewModel,
  mechanics,
});

const agent = worldModel.init(position);

/**
 * @param {number} destination
 * @param {import('./camera-controller.js').CursorChange} change
 */
function followCursor(destination, change) {
  cameraController.go(change);
  moment.set((moment.get() + change.turn + fullQuarturn) % fullQuarturn);
  $debug.innerText = world.toponym(destination);
}

const controls = makeController($controls, {
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
});

const driver = makeDriver(controls, {
  moment,
  animatedTransitionDuration,
});

makeCommandDispatcher(window, driver);
