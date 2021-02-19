// @ts-check

/** @typedef {import('./matrix3d.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint} from './easing.js';
import {matrix3dStyle} from './matrix3d.js';
import {north, south, east, west} from './geometry2d.js';
import {makeDaia} from './daia.js';
import {circle} from './topology.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';

/** @typedef {import('./daia.js').TileTransformFn} TileTransformFn */

/**
 * @callback TileEntersFn
 * @param {number} tile
 */

/**
 * @callback TileExitsFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileRenderer
 * @prop {TileEntersFn} tileEnters
 * @prop {TileExitsFn} tileExits
 */

/**
 * @param {HTMLElement} $context
 * @param {TileTransformFn} tileTransform
 * @param {(tile: number) => HTMLElement} createElement
 * @return {TileRenderer}
 */
function makeTileRenderer($context, tileTransform, createElement) {
  const $tiles = new Map()

  /**
   * @param {number} t
   */
  function tileEnters(t) {
    const transform = tileTransform(t);
    const $tile = createElement(t);
    $tile.style.transform = matrix3dStyle(transform);
    $context.appendChild($tile);
    $tiles.set(t, $tile);
  }

  /**
   * @param {number} t
   */
  function tileExits(t) {
    const $tile = $tiles.get(t);
    if ($tile == null) throw new Error(`Assertion failed: cannot remove absent tile ${t}`);
    $context.removeChild($tile);
  }

  return {tileEnters, tileExits};
}

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    camera.animate(now);
  }
}

/**
 * @template T
 * @param {Set<T>} a
 * @param {Set<T>} b
 * @returns {Iterable<T>}
 */
function *setDifference(a, b) {
  for (const v of a) {
    if (!b.has(v)) {
      yield v;
    }
  }
}

/**
 * @callback RenderAroundFn
 * @param {number} tile
 */

/**
 * @typedef {Object} TileKeeper
 * @prop {RenderAroundFn} renderAround
 */

/**
 * @param {TileRenderer} renderer
 * @param {number} radius
 * @returns {TileKeeper}
 */
function makeTileKeeper(renderer, radius) {
  let nextTiles = new Set();
  let prevTiles = new Set();

  /**
   * @param {number} at
   */
  function renderAround(at) {
    nextTiles.clear();
    for (const t of circle(at, advance, radius)) {
      nextTiles.add(t);
    }
    for (const t of setDifference(prevTiles, nextTiles)) {
      renderer.tileExits(t);
    }
    for (const t of setDifference(nextTiles, prevTiles)) {
      renderer.tileEnters(t);
    }
    [nextTiles, prevTiles] = [prevTiles, nextTiles];
  }

  return {renderAround}
}

const radius = 10;
let at = 731;

const $context = mustFind('#context');

const {
  tileSize,
  neighbor,
  advance,
  tileCoordinate,
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

const overworld = makeDaia({
  tileSize: 100,
  faceSize: 3,
  magnify: 72,
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
function createOverworldTile(_t) {
  const $tile = document.createElement('div');
  $tile.className = 'tile overworld';
  $tile.innerText = `⭐️`;
  return $tile;
}

const underworldRenderer = makeTileRenderer($context, underworld.tileTransform, createUnderworldTile);
const overworldRenderer = makeTileRenderer($context, overworld.tileTransform, createOverworldTile);

for (let t = 0; t < underworld.worldArea; t++) {
  underworldRenderer.tileEnters(t);
}
for (let t = 0; t < overworld.worldArea; t++) {
  overworldRenderer.tileEnters(t);
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

const camera = makeCamera($context, cameraTransform(at));

const {go} = makeCameraController({
  camera,
  neighbor,
  tileSize,
  tileCoordinate,
  ease: easeInOutQuint,
});

const gridKeeper = makeTileKeeper(gridRenderer, radius);

animate();

function draw() {
  gridKeeper.renderAround(at);
}

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'ArrowUp':
    case 'k':
      at = go(at, north);
      draw();
      break;
    case 'ArrowRight':
    case 'l': // east
      at = go(at, east);
      draw();
      break;
    case 'ArrowDown':
    case 'j':
      at = go(at, south);
      draw();
      break;
    case 'ArrowLeft':
    case 'h': // west
      at = go(at, west);
      draw();
      break;
    default:
      console.log(key);
  }
});

draw();
