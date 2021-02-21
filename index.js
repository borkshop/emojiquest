// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint} from './easing.js';
import {north, south, east, west} from './geometry2d.js';
import {scale} from './matrix3d.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileRenderer} from './tile-renderer.js';
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

const underworld = makeDaia({
  tileSize,
  faceSize: 1,
  transform: scale(faceSize*0.999),
});

const sky = makeDaia({
  tileSize: tileSize,
  faceSize: 3,
  transform: scale(faceSize*2/3),
});

const overworld = makeDaia({
  tileSize: 100,
  faceSize: 3,
  transform: scale(faceSize*3/3),
});

/**
 * @param {number} t
 * @returns {HTMLElement}
 */
function createUnderworldTile(t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile underworld';
  $tile.innerText = `${t}`;
  return $tile;
}

/**
 * @param {number} _t
 * @returns {HTMLElement}
 */
function createSkyTile(_t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile sky';
  $tile.innerText = Math.random() < 0.25 ? `☁️` : '';
  return $tile;
}

/**
 * @param {number} _t
 * @returns {HTMLElement}
 */
function createOverworldTile(_t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile overworld';
  $tile.innerText = Math.random() < 0.75 ? `⭐️` : '';
  return $tile;
}

/**
 * @param {number} t
 * @returns {HTMLElement}
 */
function createFacet(t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile facet';
  $tile.innerText = `${t}`;
  return $tile;
}

const underworldRenderer = makeTileRenderer($context, underworld.tileTransform, createUnderworldTile);
const overworldRenderer = makeTileRenderer($context, overworld.tileTransform, createOverworldTile);
const skyRenderer = makeTileRenderer($context, sky.tileTransform, createSkyTile);

for (let t = 0; t < underworld.worldArea; t++) {
  underworldRenderer.tileEnters(t);
}
for (let t = 0; t < overworld.worldArea; t++) {
  overworldRenderer.tileEnters(t);
}
for (let t = 0; t < sky.worldArea; t++) {
  skyRenderer.tileEnters(t);
}

// /**
//  * @param {number} t
//  * @returns {HTMLElement}
//  */
// function createGridTile(t) {
//   const $tile = document.createElement('div');
//   $tile.className = 'tile world';
//   $tile.innerText = `${t}`;
//   return $tile;
// }

// const gridRenderer = makeTileRenderer($context, tileTransform, createGridTile);

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
  ratio: world.faceSize / facets.faceSize,
  facetTransform: facets.tileTransform,
  facetNumber: facets.tileNumber,
  tileCoordinate: world.tileCoordinate,
});

const gridKeeper = makeTileKeeper(facetRenderer, world.advance, radius);

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
  }
}

function draw() {
  gridKeeper.renderAround(cursor.position);
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
