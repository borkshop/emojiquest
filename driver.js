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
 * @typedef {import('./lib/cell.js').Cell<T>} Cell
 */

import { frameDeltas } from './lib/animation.js';
import { assert } from './lib/assert.js';
import { makeProgress } from './progress.js';
import { delay, defer } from './lib/async.js';
import { fullQuarturn } from './lib/geometry2d.js';

/**
 * @template T
 * @typedef {import('./lib/async.js').Deferred<T>} Deferred
 */

/**
 * @typedef {import('./progress.js').Progress} Progress
 */

/**
 * @callback HandleCommandFn
 * @param {number} command
 * @param {boolean} repeat
 * @returns {AsyncIterator<void, void>}
 */

/**
 * @callback CommandForKeyFn
 * @param {string} key
 * @returns {number | undefined}
 */

/**
 * The controller is an object that the driver will drive input, animation, turn
 * reset, and command key up and down events.
 *
 * @typedef {object} Controller
 * @property {HandleCommandFn} handleCommand
 * @property {CommandForKeyFn} commandForKey
 * @property {(key: string) => boolean} handleMiscKeyPress
 * @property {(command: number) => () => void} down
 * @property {() => void} tick
 * @property {() => void} tock
 * @property {(progress: Progress) => void} animate
 * @property {(direction: number) => number} commandForDirection
 * @property {(command: number) => number | undefined} directionForCommand
 */

/**
 * @param {Controller} controller
 * @param {Object} options
 * @param {number} options.animatedTransitionDuration
 * @param {Cell<number>} options.moment
 */
export const makeDriver = (controller, options) => {
  const { animatedTransitionDuration, moment } = options;

  /** @type {Array<Set<string>>} */
  const commandHolders = new Array(10).fill(undefined).map(() => new Set());
  /**
   * Account for how the key to command mapping changes due to mode switching.
   * Each keyup will cancel whatever command it innitiated.
   * @type {Map<string, number>}
   */
  const lastCommandForKey = new Map();

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
    const turnGenerator = controller.handleCommand(command, repeat);

    for (;;) {
      // Ensure that the animation gets all the way to 100%, regardless of
      // animation frame timing.
      controller.animate(makeProgress(timeSinceTransitionStart, 1));

      timeSinceTransitionStart = 0;
      controller.tock();

      const turnCompleted = turnGenerator.next();
      controller.tick();

      await Promise.race([abort.promise, delay(animatedTransitionDuration)]);

      const { done } = await turnCompleted;
      if (done) {
        return;
      }
    }
  }

  /**
   * @param {number} command
   * @param {boolean} repeat
   */
  async function issue(command, repeat) {
    const direction = controller.directionForCommand(command);
    if (direction === undefined) {
      await tickTock(command, repeat);
    } else {
      const momentumAdjustedDirection =
        (direction + moment.get()) % fullQuarturn;
      await tickTock(
        controller.commandForDirection(momentumAdjustedDirection),
        repeat,
      );
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
      controller.animate(progress);
    }
  }

  /**
   * @param {string} holder
   * @param {number} [command]
   * @returns {boolean}
   */
  function down(holder, command) {
    if (command === undefined) {
      // The command for each key is mode-dependent.
      command = controller.commandForKey(holder);
      if (command === undefined) {
        return controller.handleMiscKeyPress(holder);
      }
      lastCommandForKey.set(holder, command);
    }

    // Commands can be held by multiple holders (keys, mouse
    // events, touch events).
    // This paragraph ensures that we only proceed for the
    // first holder, and track the holder so we don't release
    // until it and all others are up.
    const holders = commandHolders[command];
    const alreadyHeld = holders.size !== 0;
    holders.add(holder);
    if (alreadyHeld) {
      return true;
    }

    // If a command key goes down during an animated transition for a prior
    // command, we abort that animation so the next move advances immediately
    // to the beginning of the next animation.
    if (held.size <= 1) {
      abort.resolve();
      abort = defer();
      queue.length = 0;
    }

    assert(!held.has(command));
    const up = controller.down(command);
    held.set(command, { start: performance.now(), up });

    queue.push(command);
    // Kick the command processor into gear if it hasn't been provoked
    // already.
    sync.resolve();
    sync = defer();

    return true;
  }

  /**
   * @param {string} holder
   * @param {number} [command]
   * @returns {boolean}
   */
  function up(holder, command) {
    if (command === undefined) {
      command = lastCommandForKey.get(holder);
      if (command === undefined) {
        return false;
      }
      lastCommandForKey.delete(holder);
    }

    // Multiple holders can hold down a command button.
    // This paragraph ensures we only proceed when the last
    // holder on the command gets released.
    const holders = commandHolders[command];
    holders.delete(holder);
    if (holders.size !== 0) {
      return true;
    }

    const descriptor = held.get(command);
    if (descriptor === undefined) {
      return true;
    }
    const { up } = descriptor;
    up();
    held.delete(command);
    // Clear the momentum heading if the player releases all keys.
    if (held.size === 0) {
      moment.set(0);
    }

    return true;
  }

  const cancel = () => {
    for (const [command, holders] of commandHolders.entries()) {
      for (const holder of holders) {
        up(holder, command);
      }
    }
  };

  run();
  animate();

  return { down, up, cancel };
};
