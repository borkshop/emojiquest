// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint} from './easing.js';
import {north, south, east, west} from './geometry2d.js';
import {scale, matrix3dStyle} from './matrix3d.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeFacetRenderer} from './facet-renderer.js';

const $context = mustFind('#context');

const radius = 10;
const tileSize = 100;
const facetSize = 9;
const faceSize = 9 * facetSize;

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
  $tile.className = 'firmament-tile';
  $tile.innerText = Math.random() < 0.75 ? `⭐️` : '';
  return $tile;
}

/**
 * @param {number} f
 * @returns {HTMLElement}
 */
function createFacet(f) {
  const $tile = document.createElement('div');
  $tile.className = 'facile';
  $tile.innerText = `${f}`;
  return $tile;
}

/**
 * @param {number} t
 * @returns {HTMLElement}
 */
function createTile(t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile';
  $tile.innerText = `${t}`;
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

const {go} = makeCameraController({
  camera,
  advance: world.advance,
  tileSize,
  ease: easeInOutQuint,
});

const facetRenderer = makeFacetRenderer({
  context: $context,
  createFacet,
  createTile,
  worldSize: world.faceSize,
  facetSize: facets.faceSize,
  facetTransform: facets.tileTransform,
  tileNumber: world.tileNumber,
  facetNumber: facets.tileNumber,
  facetCoordinate: facets.tileCoordinate,
  tileCoordinate: world.tileCoordinate,
  tileSize: world.tileSize,
});

const tileKeeper = makeTileKeeper(facetRenderer, world.advance);

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
  }
}

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
      cursor = go({position: cursor.position, direction: north});
      draw();
      break;
    case 'ArrowRight':
    case 'l': // east
      cursor = go({position: cursor.position, direction: east});
      draw();
      break;
    case 'ArrowDown':
    case 'j':
      cursor = go({position: cursor.position, direction: south});
      draw();
      break;
    case 'ArrowLeft':
    case 'h': // west
      cursor = go({position: cursor.position, direction: west});
      draw();
      break;
    default:
      console.log(key);
  }
});
