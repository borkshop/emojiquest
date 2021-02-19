// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint} from './easing.js';
import {north, south, east, west} from './geometry2d.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileRenderer} from './tile-renderer.js';
import {makeTileKeeper} from './tile-keeper.js';

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
  }
}

const radius = 10;
let cursor = {position: 731, direction: north};

const $context = mustFind('#context');

const {
  tileSize,
  advance,
  tileTransform,
  cameraTransform,
} = makeDaia({
  tileSize: 100,
  faceSize: 72,
});

const underworld = makeDaia({
  tileSize: 100,
  faceSize: 3,
  magnify: 23.99,
});

const sky = makeDaia({
  tileSize: 100,
  faceSize: 9,
  magnify: 12,
});

const overworld = makeDaia({
  tileSize: 100,
  faceSize: 9,
  magnify: 24,
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

/**
 * @param {number} t
 * @returns {HTMLElement}
 */
function createGridTile(t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile';
  $tile.innerText = `${t}`;
  return $tile;
}

const gridRenderer = makeTileRenderer($context, tileTransform, createGridTile);

const camera = makeCamera($context, cameraTransform(cursor.position));

const {go} = makeCameraController({
  camera,
  advance,
  tileSize,
  ease: easeInOutQuint,
});

const gridKeeper = makeTileKeeper(gridRenderer, advance, radius);

animate();

function draw() {
  gridKeeper.renderAround(cursor.position);
}

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

draw();
