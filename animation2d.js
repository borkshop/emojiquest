// @ts-check
//
import {turnVectors} from './geometry2d.js';
import {compose, translate, rotate, scale, matrixStyle} from './matrix2d.js';

/** @typedef {import('./animation.js').Progress} Progress */

/**
 * @typedef {Object} Coord
 * @prop {number} x - integer in the coordinate space of tiles.
 * @prop {number} y - integer in the coordinate space of tiles.
 * @prop {number} a - angle, in increments of 90 degrees clockwise from due
 * north.
 */

/**
 * @typedef {Object} Transition
 * @prop {number} [direction] - in quarter turns clockwise from north.
 * @prop {number} [rotation] - in quarter turns clockwise, positive or negative.
 * @prop {boolean} [bump] - whether the entity makes an aborted attempt in the
 * direction.
 * @prop {'exit' | 'enter' | 'stay'} [stage] - whether to pop in or pop out.
 */

/** @type {Transition} */
const noTransition = {
  direction: 0,
  rotation: 0,
  bump: false,
  stage: 'stay',
}

/** @type {Progress} */
const noProgress = {
  linear: 0,
  sinusoidal: 0,
  sinusoidalQuarterTurn: 0,
  bounce: 0,
}

/**
 * @param {Element} $entity
 * @param {Coord} coord
 * @param {Progress=} [progress]
 * @param {Transition=} [transition]
 */
export function placeEntity($entity, coord, progress = noProgress, transition = noTransition) {
  const {
    direction = 0,
    rotation = 0,
    bump = false,
    stage = 'stay'
  } = transition;
  const { sinusoidal, sinusoidalQuarterTurn, bounce } = progress;
  const {x: dx, y: dy} = turnVectors[(direction + 4 - coord.a) % 4];
  const shiftProgress = bump ? bounce : sinusoidal;
  const scaleProgress = stage === 'stay' ? 1 : stage === 'exit' ? 1 - sinusoidal : sinusoidal;
  const transform = compose(
    scale(scaleProgress),
    rotate(sinusoidalQuarterTurn * rotation),
    rotate(-Math.PI/2 * coord.a),
    translate(coord),
    translate({x: dx * shiftProgress, y: dy * shiftProgress}),
    translate({x: 0.5, y: 0.5}),
  );
  $entity.setAttributeNS(null, 'transform', matrixStyle(transform));
}
