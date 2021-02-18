// @ts-check

/** @typedef {import('./matrix3d.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint, easeInOutQuad} from './easing.js';
import {multiply, translate, rotateX, rotateY, rotateZ, matrix3dStyle} from './matrix3d.js';
import {north, south, east, west, turnVectors} from './geometry2d.js';
import {makeDaia, faceRotations} from './daia.js';
import {circle} from './topology.js';

const {
  tileSize,
  faceOrigins,
  neighbor,
  tileCoordinate,
  tileTransform
} = makeDaia({
  tileSize: 100,
  faceSize: 72,
});

const {min, max} = Math;

/**
 * @param {number} lo
 * @param {number} hi
 * @param {number} value
 * @returns {number}
 */
function clamp(lo, hi, value) {
  return max(lo, min(hi, value));
}

const $context = mustFind('#context');

/**
 * @typedef {{
 *   start: number,
 *   end: number,
 *   matrix(progress: number): Matrix,
 * }} Transition
 */

let cameraTransform = faceOrigins[0];
/** @type {Array<Transition>} */
let transitions = [];

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();
    let current = cameraTransform;
    transitions = transitions.filter(({start, end, matrix}) => {
      const progress = clamp(0, 1, (now - start) / (end - start));
      current = multiply(matrix(progress), current);
      if (progress >= 1) {
        cameraTransform = multiply(matrix(1), cameraTransform);
        return false;
      }
      return true;
    });
    $context.style.transform = matrix3dStyle(current);
  }
}

animate();

/**
 * @param {number} duration
 * @param {(progress: number) => Matrix} matrix
 */
function transition(duration, matrix) {
  const now = Date.now();
  transitions.push({
    start: now,
    end: now + duration,
    matrix,
  })
}

const radius = 10;

const $tiles = new Map();
let nextTiles = new Set();
let prevTiles = new Set();

/**
 * @param {number} t
 */
function tileEnters(t) {
  const transform = tileTransform(t);
  const $tile = document.createElement('div');
  $tile.className = 'tile';
  $tile.style.transform = matrix3dStyle(transform);
  $tile.innerText = `${t}`;
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
 * @param {number} at
 */
function renderAround(at) {
  nextTiles.clear();
  for (const t of circle(at, neighbor, radius)) {
    nextTiles.add(t);
  }
  for (const t of setDifference(prevTiles, nextTiles)) {
    tileExits(t);
  }
  for (const t of setDifference(nextTiles, prevTiles)) {
    tileEnters(t);
  }
  [nextTiles, prevTiles] = [prevTiles, nextTiles];
}

let at = 0;

/**
 * @param {number} direction
 */
function go(direction) {
  const to = neighbor(at, direction);
  const atCoord = tileCoordinate(at);
  const toCoord = tileCoordinate(to);
  if (atCoord.f !== toCoord.f) {

    // rotations
    if (direction === west) {
      transition(500, p => rotateY(Math.PI/2 * ease(p)));
    } else if (direction === east) {
      transition(500, p => rotateY(-Math.PI/2 * ease(p)));
    } else if (direction === south) {
      transition(500, p => rotateX(Math.PI/2 * ease(p)));
    } else if (direction === north) {
      transition(500, p => rotateX(-Math.PI/2 * ease(p)));
    }

    // translations
    const angle = faceRotations[atCoord.f][direction];
    transition(500, p => rotateZ(angle * easeInOutQuad(p)));

  } else {
    const {x: dx, y: dy} = turnVectors[direction];
    transition(500, p => {
      const e = ease(p);
      return translate({
        x: -dx * tileSize * e,
        y: -dy * tileSize * e,
        z: 0,
      })
    });
  }

  at = to;
  renderAround(at);
}

const ease = easeInOutQuint;

window.addEventListener('keyup', event => {
  const {key} = event;
  switch (key) {
    case 'ArrowUp':
    case 'k':
      go(north);
      break;
    case 'ArrowRight':
    case 'l': // east
      go(east);
      break;
    case 'ArrowDown':
    case 'j':
      go(south);
      break;
    case 'ArrowLeft':
    case 'h': // west
      go(west);
      break;
    default:
      console.log(key);
  }
  $context.style.transform = matrix3dStyle(cameraTransform);
});

renderAround(at);
$context.style.transform = matrix3dStyle(cameraTransform);
