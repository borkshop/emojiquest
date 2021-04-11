// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {delay, defer} from './async.js';
import {linear} from './easing.js';
import {north, south, east, west} from './geometry2d.js';
import {scale, matrix3dStyle} from './matrix3d.js';
import {faceColors} from './brand.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeFacetView} from './facet-view.js';
import {makeViewModel} from './view-model.js';
import {makeModel} from './model.js';

/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

const $context = mustFind('#context');

const radius = 10;
const tileSize = 100;
const facetSize = 9;
const faceSize = 9 * facetSize;

const animatedTransitionDuration = 300;
const slowCameraTransitionDuration = 900;
const fastCameraTransitionDuration = 300;

const position = 0;

let cursor = {position, direction: north};

const world = makeDaia({
  tileSize,
  faceSize,
});

const facets = makeDaia({
  tileSize: tileSize * faceSize / facetSize,
  faceSize: facetSize,
});

const foundation = makeDaia({
  tileSize,
  faceSize: 1,
  transform: scale(faceSize*0.9999),
});

const atmosquare = makeDaia({
  tileSize: tileSize,
  faceSize: 3,
  transform: scale(faceSize*2/3),
});

const firmament = makeDaia({
  tileSize: 100,
  faceSize: 3,
  transform: scale(faceSize*3/3),
});

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

/**
 * @param {number} _t
 * @returns {HTMLElement}
 */
function createAtmosquare(_t) {
  const $tile = document.createElement('div');
  $tile.className = 'atmosquare';
  $tile.innerText = Math.random() < 0.25 ? `☁️` : '';
  return $tile;
}

/**
 * @param {number} _t
 * @returns {HTMLElement}
 */
function createFirmamentTile(_t) {
  const $tile = document.createElement('div');
  $tile.className = 'firmament';
  $tile.innerText = Math.random() < 0.75 ? `⭐️` : '';
  return $tile;
}

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
createAllTiles3d($context, firmament, createFirmamentTile);
createAllTiles3d($context, atmosquare, createAtmosquare);

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
 * @param {number} e - entity number
 * @returns {SVGElement}
 */
function createEntity(e) {
  const $entity = document.createElementNS(svgNS, 'text');
  const type = viewModel.type(e);
  $entity.setAttributeNS(null, 'class', 'moji');
  if (type === 0) { // agent
    $entity.appendChild(document.createTextNode('🙂'));
  } else if (type === 1) { // tree
    $entity.appendChild(document.createTextNode('🌲'));
  }
  return $entity;
}

const viewModel = makeViewModel(animatedTransitionDuration);

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
  watchEntities: viewModel.watch,
  unwatchEntities: viewModel.unwatch,
});

const {keepTilesAround} = makeTileKeeper({
  enter: facetView.enter,
  exit: facetView.exit,
  advance: world.advance
});

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
    viewModel.animate(now);
  }
}

/**
 * @param {number} animatedTransitionDuration - the delay in miliseconds between the
 * submission of a turn and the time the next turn can begin.
 */
function makeController(animatedTransitionDuration) {
  /** @type {Deferred<number>} */
  let sync = defer();
  let stop = () => {};
  /** @type {Set<number>} */
  const directions = new Set();
  // TODO const vector = {x: 0, y: 0};

  /**
   * @param {number} direction
   */
  async function tickTock(direction) {
    viewModel.reset(Date.now());
    // TODO: better
    model.intend(agent, direction);
    model.tick();
    // TODO cancel on stop to skip animation
    await delay(animatedTransitionDuration);
    viewModel.reset(Date.now());
    model.tock();
    draw();
  }

  async function run() {
    for (;;) {
      let stopped = false;
      stop = () => { stopped = true; };
      sync = defer();
      await tickTock(await sync.promise);
      while (!stopped) {
        await tickTock([...directions.values()].pop() || 0);
      }
    }
  }

  /**
   * @param {number} direction
   */
  function down(direction) {
    directions.add(direction);
    console.log('down', ...directions);
    sync.resolve(direction);
  }

  /**
   * @param {number} direction
   */
  function up(direction) {
    directions.delete(direction);
    if (directions.size === 0) {
      stop();
    }
  }

  run();

  return {down, up};
}

const controller = makeController(animatedTransitionDuration);

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @callback FollowFn
 * @param {number} e - entity that moved
 * @param {CursorChange} change
 */

/** @type {FollowFn} */
function follow(e, change) {
  if (e === agent) {
    cameraController.go(change);
    cursor = change;
  }
}

const model = makeModel({
  size: world.worldArea,
  advance: world.advance,
  create: viewModel.create,
  transition: viewModel.transition,
  move: viewModel.move,
  put: viewModel.put,
  follow,
});

const agent = model.init();

function draw() {
  keepTilesAround(cursor.position, radius);
}

animate();
draw();

/**
 * @param {(direction: number) => void} direct
 */
function director(direct) {
  /**
   * @param {KeyboardEvent} event
   */
  const handler = event => {
    const {key} = event;
    switch (key) {
      case 'ArrowUp':
      case 'k':
        direct(north);
        break;
      case 'ArrowRight':
      case 'l': // east
        direct(east);
        break;
      case 'ArrowDown':
      case 'j':
        direct(south);
        break;
      case 'ArrowLeft':
      case 'h': // west
        direct(west);
        break;
    }
  };
  return handler;
}

window.addEventListener('keydown', director(controller.down));
window.addEventListener('keyup', director(controller.up));
