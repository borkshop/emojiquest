// @ts-check

import {nextFrame} from 'cdom/anim';
import {mustFind} from 'cdom/wiring';
import {delay, defer} from './async.js';
import {linear} from './easing.js';
import {north, south, east, west, same} from './geometry2d.js';
import {scale, matrix3dStyle} from './matrix3d.js';
import {faceColors} from './brand.js';
import {makeDaia} from './daia.js';
import {makeCamera} from './camera.js';
import {makeCameraController} from './camera-controller.js';
import {makeTileKeeper} from './tile-keeper.js';
import {makeFacetView} from './facet-view.js';
import {makeViewModel} from './view-model.js';
import {makeModel} from './model.js';
import {createControls} from './controls.js';

/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

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

let cursor = {position, direction: north};
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
let moment = 0;

const world = makeDaia({
  tileSize,
  faceSize,
});

$debug.innerText = world.toponym(position);

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
  const type = model.type(e);
  $entity.setAttributeNS(null, 'class', 'moji');
  if (type === 0) { // agent
    $entity.appendChild(document.createTextNode('🙂'));
  } else if (type === 1) { // tree
    $entity.appendChild(document.createTextNode('🌲'));
  }
  return $entity;
}

const viewModel = makeViewModel();

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

let start = Date.now();

async function animate() {
  for (;;) {
    await nextFrame();
    const now = Date.now();

    const linear = clamp(0, 1, (now - start) / animatedTransitionDuration);
    const sinusoidal = (1 - Math.cos(Math.PI * linear)) / 2;
    const bounce = (1 - Math.cos(Math.PI * 2 * sinusoidal)) / 16;
    const sinusoidalQuarterTurn = -Math.PI/2 * sinusoidal;
    const progress = {
      linear,
      sinusoidal,
      sinusoidalQuarterTurn,
      bounce,
    };

    camera.animate(now);
    viewModel.animate(progress);
  }
}

/**
 * @param {number} animatedTransitionDuration - the delay in miliseconds between the
 * submission of a turn and the time the next turn can begin.
 */
function makeController(animatedTransitionDuration) {
  /** @type {Deferred<void>} */
  let sync = defer();
  /** @type {Deferred<void>} */
  let abort = defer();
  /** @type {Array<number>} */
  const queue = [];
  /** @type {Map<number, number>} */
  const held = new Map();
  // TODO const vector = {x: 0, y: 0};

  /**
   * @param {number} direction
   * @param {boolean} deliberate
   */
  async function tickTock(direction, deliberate) {
    start = Date.now();
    viewModel.reset();
    // TODO: better
    model.intend(agent, direction, deliberate);
    model.tick();
    await Promise.race([
      abort.promise,
      delay(animatedTransitionDuration),
    ]);
    start = Date.now();
    viewModel.reset();
    model.tock();
    draw();
  }

  async function run() {
    for (;;) {
      sync = defer();
      await sync.promise;

      // The user can plan some number of moves ahead by tapping the command
      // keys sequentially, as opposed to holding them down.
      let direction;
      while (direction = queue.shift(), direction !== undefined) {
        if (direction === same) {
          await tickTock(same, true);
        } else {
          await tickTock((direction + moment) % 4, true);
        }
      }

      while (held.size) {
        const now = Date.now();
        for (const [heldDirection, start] of held.entries()) {
          const duration = now - start;
          if (duration > animatedTransitionDuration) {
            direction = heldDirection;
          }
        }
        if (direction === same) {
          await tickTock(same, false);
        } else if (direction !== undefined) {
          await tickTock((direction + moment) % 4, false);
        } else {
          break;
        }
      }
    }
  }

  /**
   * @param {number} direction
   */
  function down(direction) {
    // If a command key goes down during an animated transition for a prior
    // command, we abort that animation so the next move advances immediately
    // to the beginning of the next animation.
    if (held.size === 0) {
      abort.resolve();
      abort = defer();
      queue.length = 0;
    }
    // We add the direction command to both the command queue and the held
    // commands. We keep the older command if redundant command keys are
    // pressed.
    if (!held.has(direction)) {
      held.set(direction, Date.now());
    }
    queue.push(direction);
    // Kick the command processor into gear if it hasn't been provoked already.
    sync.resolve();
    sync = defer();
  }

  /**
   * @param {number} direction
   */
  function up(direction) {
    held.delete(direction);
    // Clear the momentum heading if the player releases all keys.
    if (held.size === 0) {
      moment = 0;
    }
  }

  run();

  return {down, up};
}

const controller = makeController(animatedTransitionDuration);

document.body.appendChild(createControls());

/**
 * @typedef {import('./camera-controller.js').CursorChange} CursorChange
 */

/**
 * @callback FollowFn
 * @param {number} e - entity that moved
 * @param {CursorChange} change
 * @param {number} destination
 */

/** @type {FollowFn} */
function follow(e, change, destination) {
  if (e === agent) {
    cameraController.go(change);
    cursor = change;
    moment = (moment + change.turn + 4) % 4;
    $debug.innerText = world.toponym(destination);
  }
}

const model = makeModel({
  size: world.worldArea,
  advance: world.advance,
  transition: viewModel.transition,
  move: viewModel.move,
  remove: viewModel.remove,
  put: viewModel.put,
  follow,
});

const agent = model.init(position);

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
    const {key, repeat, metaKey} = event;
    if (repeat || metaKey) return;
    switch (key) {
      case '8':
      case 'ArrowUp':
      case 'k':
        direct(north);
        break;
      case '6':
      case 'ArrowRight':
      case 'l': // east
        direct(east);
        break;
      case '2':
      case 'ArrowDown':
      case 'j':
        direct(south);
        break;
      case '4':
      case 'ArrowLeft':
      case 'h': // west
        direct(west);
        break;
      case '5':
      case '.':
        direct(same);
        break;
      default:
        console.log(key);
    }
  };
  return handler;
}

window.addEventListener('keydown', director(controller.down));
window.addEventListener('keyup', director(controller.up));
