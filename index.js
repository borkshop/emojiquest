// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {delay, defer} from './async.js';
import {easeInOutQuint} from './easing.js';
import {north, south, east, west} from './geometry2d.js';
import {scale, matrix3dStyle} from './matrix3d.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeFacetRenderer} from './facet-renderer.js';
import {makeEntities} from './entities.js';

/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

const $context = mustFind('#context');

const radius = 10;
const tileSize = 100;
const facetSize = 9;
const faceSize = 9 * facetSize;

const animatedTransitionDuration = 400;
const slowCameraTransitionDuration = 800;
const fastCameraTransitionDuration = 400;
const simulationInterval = 400;

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
  $tile.innerText = `${t}`;
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

/**
 * @param {number} _f
 * @returns {HTMLElement}
 */
function createFacet(_f) {
  const $tile = document.createElement('div');
  $tile.className = 'facet';
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
  ease: easeInOutQuint,
  slow: slowCameraTransitionDuration,
  fast: fastCameraTransitionDuration,
});

/**
 * @param {number} _e - entity number
 * @returns {HTMLElement}
 */
function createEntity(_e) {
  const $entity = document.createElement('div');
  $entity.className = 'agent';
  $entity.innerText = '😊';
  return $entity;
}

const entities = makeEntities(animatedTransitionDuration);

const agent = entities.create(0);
entities.put(agent, 0);

const facetRenderer = makeFacetRenderer({
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
  watchEntities: entities.watch,
  unwatchEntities: entities.unwatch,
  tileSize,
});

const tileKeeper = makeTileKeeper(facetRenderer, world.advance);

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
    entities.animate(now);
  }
}

function makeSimulation() {
  /** @type {Deferred<void>} */
  let sync = defer();
  /** @type {Array<number>} */
  const commands = [];

  async function flush() {
    sync = defer();
    for (
      let direction = commands.shift();
      direction !== undefined;
      direction = commands.shift()
    ) {
      const cursorChange = cameraController.go({position: cursor.position, direction});
      cursor = cursorChange;
      entities.reset(Date.now());
      entities.transition(agent, direction, cursorChange.turn);
      await delay(simulationInterval);
      entities.reset(Date.now());
      entities.move(agent, cursor.position);
      draw();
    }
    sync.promise.then(flush);
  }

  /**
   * @param {number} direction
   */
  function go(direction) {
    commands.push(direction);
    sync.resolve();
  }

  sync.promise.then(flush);

  return {go};
}

const simulation = makeSimulation();

function draw() {
  tileKeeper.renderAround(cursor.position, radius);
}

animate();
draw();

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'ArrowUp':
    case 'k':
      simulation.go(north);
      break;
    case 'ArrowRight':
    case 'l': // east
      simulation.go(east);
      break;
    case 'ArrowDown':
    case 'j':
      simulation.go(south);
      break;
    case 'ArrowLeft':
    case 'h': // west
      simulation.go(west);
      break;
    default:
      console.log(key);
  }
});
