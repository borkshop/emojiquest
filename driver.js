/**
 * The driver is an adapter that converts keyboard input into animated turns of
 * the game engine.
 * The driver receives input from button-key-handler.js (or eventually
 * something more sophisticated that fuses input from other sources like DOM
 * button presses or game controllers) and drives controller.js.
 * This is the only component that observes the passage of time.
 * All others receive pre-computed progress and see time as transitions between
 * turns.
 *
 * The driver is also responsible for pacing repeated commands, which occur
 * when a key is held for the duration of an entire turn or beyond.
 */

// @ts-check

/**
 * @template T
 * @typedef {import('./cell.js').Cell<T>} Cell
 */

import { frameDeltas } from './animation.js';
import { assert } from './assert.js';
import { makeProgress } from './animation.js';
import { delay, defer } from './async.js';
import { north, east, south, west, fullQuarturn } from './geometry2d.js';

/**
 * @template T
 * @typedef {import('./async.js').Deferred<T>} Deferred
 */

/** @type {Record<number, number>} */
export const commandDirection = {
  8: north,
  4: west,
  6: east,
  2: south,
};

/** @type {Record<number, number>} */
export const directionCommand = Object.fromEntries(
  Object.entries(commandDirection).map(([command, direction]) => [
    +direction,
    +command,
  ]),
);

/**
 * @typedef {import('./animation.js').Progress} Progress
 */

/**
 * @callback CommandFn
 * @param {number} command
 * @param {boolean} repeat
 */

/**
 * @callback KeysFn
 * @returns {{[key: string]: number}}
 */

/**
 * The delegate is an object that the driver will drive input, animation, turn
 * reset, and command key up and down events.
 *
 * @typedef {Object} Delegate
 * @property {CommandFn} command
 * @property {KeysFn} keys
 * @property {(command: number) => () => void} down
 * @property {(progress: Progress) => void} animate
 */

/**
 * @param {Delegate} delegate
 * @param {Object} options
 * @param {number} options.animatedTransitionDuration
 * @param {Cell<number>} options.moment
 */
export const makeDriver = (delegate, options) => {
  const { animatedTransitionDuration, moment } = options;

  /** @type {Deferred<void>} */
  let sync = defer();
  /** @type {Deferred<void>} */
  let abort = defer();
  /** @type {Array<number>} directions */
  const queue = [];
  /** @type {Map<number, {start: number, up: () => void}>} direction to timestamp */
  const held = new Map();
  // TODO const vector = {x: 0, y: 0};

  // Time elapsed since tick.
  let timeSinceTransitionStart = animatedTransitionDuration;

  /**
   * @param {number} command
   * @param {boolean} repeat
   */
  async function tickTock(command, repeat) {
    // Pre-animated transition reset.
    timeSinceTransitionStart = 0;

    delegate.command(command, repeat);

    await Promise.race([abort.promise, delay(animatedTransitionDuration)]);

    // Ensure that the animation gets all the way to 100%, regardless of
    // animation frame timing.
    const progress = makeProgress(animatedTransitionDuration, 1.0);
    delegate.animate(progress);
  }

  /**
   * @param {number} command
   * @param {boolean} repeat
   */
  async function issue(command, repeat) {
    const direction = commandDirection[command];
    if (direction === undefined) {
      await tickTock(command, repeat);
    } else {
      const momentumAdjustedDirection =
        (direction + moment.get()) % fullQuarturn;
      await tickTock(directionCommand[momentumAdjustedDirection], repeat);
    }
  }

  async function run() {
    for (;;) {
      sync = defer();
      await sync.promise;

      // The user can plan some number of moves ahead by tapping the command
      // keys sequentially, as opposed to holding them down.
      let command;
      while (((command = queue.shift()), command !== undefined)) {
        await issue(command, false);
      }

      // Repeat
      while (held.size) {
        const now = performance.now();
        for (const [heldCommand, { start }] of held.entries()) {
          const duration = now - start;
          if (duration > animatedTransitionDuration) {
            command = heldCommand;
          }
        }
        if (command !== undefined) {
          await issue(command, true);
        }
      }
    }
  }

  async function animate() {
    for await (const elapsed of frameDeltas()) {
      timeSinceTransitionStart += elapsed;
      const progress = makeProgress(
        elapsed,
        timeSinceTransitionStart / animatedTransitionDuration,
      );
      delegate.animate(progress);
    }
  }

  /**
   * @param {number} command
   */
  function down(command) {
    assert(!held.has(command));
    const up = delegate.down(command);
    held.set(command, { start: performance.now(), up });

    // If a command key goes down during an animated transition for a prior
    // command, we abort that animation so the next move advances immediately
    // to the beginning of the next animation.
    if (held.size === 0) {
      abort.resolve();
      abort = defer();
      queue.length = 0;
    }
    queue.push(command);
    // Kick the command processor into gear if it hasn't been provoked
    // already.
    sync.resolve();
    sync = defer();
  }

  /**
   * @param {number} command
   */
  function up(command) {
    const descriptor = held.get(command);
    if (descriptor === undefined) {
      return;
    }
    const { up } = descriptor;
    up();
    held.delete(command);
    // Clear the momentum heading if the player releases all keys.
    if (held.size === 0) {
      moment.set(0);
    }
  }

  /**
   * @param {string} key
   * @returns {number | undefined} command
   */
  function commandForKey(key) {
    return delegate.keys()[key];
  }

  run();
  animate();

  return { down, up, commandForKey };
};
