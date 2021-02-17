// @ts-check

/** @typedef {import('./matrix3d.js').Matrix} Matrix */

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {easeInOutQuint, easeInOutQuad} from './easing.js';
import {multiply, translate, rotateX, rotateY, rotateZ, matrix3dStyle} from './matrix3d.js';
import {tileSize, faceRotations, faceOrigins, north, south, east, west, directionVectors, neighbor, tileCoordinate, tileTransform} from './daia.js';

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

/**
 * @param {Element} $context
 * @param {number} capacity
 */
function prepareContext($context, capacity = 512) {
  let age = 0;
  const elements = new Map();
  const stamps = new Map();

  // TODO use a more mindful datastructure and algorithm
  // for FoV collection.

  /**
   * @param {number} t
   */
  function touch(t) {
    age++;
    if (elements.has(t)) {
      stamps.set(t, age);
      return;
    }
    while (elements.size >= capacity) {
      let eldestTile = null;
      let eldestStamp = Infinity;
      for (const [tile, stamp] of stamps.entries()) {
        if (stamp < eldestStamp) {
          eldestTile = tile;
          eldestStamp = stamp;
        }
      }
      console.log({eldestTile});
      const element = elements.get(eldestTile);
      $context.removeChild(element);
      stamps.delete(eldestTile);
      elements.delete(eldestTile);
    }
    const transform = tileTransform(t);
    const $tile = document.createElement('div');
    $tile.className = 'tile';
    $tile.style.transform = matrix3dStyle(transform);
    $tile.innerText = `${t}`;
    $context.appendChild($tile);
    elements.set(t, $tile);
    stamps.set(t, age);
  }

  return {touch};
}

const {touch} = prepareContext($context);

/**
 * @param {number} t
 * @param {number} major
 * @param {number} minor
 * @param {number} r
 */
function touchQuadrant(t, major, minor, r) {
  let u = neighbor(t, minor);
  const r2 = r * r;
  for (let x = 0; x < r; x++) {
    const x2 = x*x;
    let v = u;
    for (let y = 0; x2 + (y+1)*(y+1) < r2; y++) {
      touch(v);
      v = neighbor(v, minor);
    }
    u = neighbor(u, major);
  }
}

const radius = 10;

/**
 * @param {number} t
 */
function touchArea(t) {
  touch(t);
  touchQuadrant(t, north, east, radius);
  touchQuadrant(t, east, south, radius);
  touchQuadrant(t, south, west, radius);
  touchQuadrant(t, west, north, radius);
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
    const {x: dx, y: dy} = directionVectors[direction];
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
  touchArea(at);
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

touchArea(at);
$context.style.transform = matrix3dStyle(cameraTransform);
