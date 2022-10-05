import { makeElementWatcher } from './element-watcher.js';

const commandCount = 10;

/**
 * @param {SVGElement} $controls
 * @param {SVGElement} $hamburger
 * @param {Object} args
 * @param {import('./world.js').CreateEntityFn} args.createEntity
 */
export const makeControllerElementWatchers = (
  $controls,
  $hamburger,
  { createEntity },
) => {
  const nineKeyWatcher = makeElementWatcher($controls, null, createEntity);
  const oneKeyWatcher = makeElementWatcher($hamburger, null, createEntity);

  return {
    nineKeyWatcher,
    oneKeyWatcher,
  };
};

/**
 * Indicates that a key or gesture has been pressed down or up.
 * @callback HolderFn
 * @param {string} holder - the holder vocabulary is specific to the input
 * modality, but in a web page, holders are either the names of keys in keyup
 * and keydown events, or the holder may be specifically 'Mouse' or 'Touch'.
 * @param {number} [command] - some commands are implied by the holder in the
 * context of the controller's mode, but gestures are bound more specifically
 * to command numbers.
 * @returns {boolean}
 */

/**
 * Indicates that the user has navigated away and that all held commands are
 * implicitly lifted, bearing in mind they may be actually lifted when the user
 * returns.
 * @callback CancelFn
 */

/**
 * @typedef {object} Driver
 * @prop {HolderFn} up - indicates that a key or gesture has begun indicating a
 * command.
 * @prop {HolderFn} down - indicates that a key or gesture has stopped
 * indicating a command.
 * @prop {CancelFn} cancel - invalidates all held commands, as occurs when the
 * user navigates away from the game.
 */

/**
 * @param {typeof window} $window
 * @param {Element} $controls
 * @param {Element} $hamburger
 * @param {Driver} driver
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
export const watchControllerCommands = (
  $window,
  $controls,
  $hamburger,
  driver,
  { tileSizePx },
) => {
  const { up, down, cancel } = driver;

  let previousCommand = -1;

  /**
   * @param {Object} offset
   * @param {number} offset.offsetX
   * @param {number} offset.offsetY
   */
  const controlEventToCommand = ({ offsetX, offsetY }) => {
    const coord = {
      x: Math.floor(offsetX / tileSizePx),
      y: Math.floor(offsetY / tileSizePx),
    };
    const { x, y } = coord;
    if (x >= 3 || y >= 3 || x < 0 || y < 0) return -1;
    return x + (2 - y) * 3 + 1;
  };

  /**
   * @param {number} command
   * @param {boolean} pressed
   */
  const onControlMouseStateChange = (command, pressed) => {
    const touchIdentifiers = commandToTouchIdentifiers.get(command);
    if (touchIdentifiers !== undefined) {
      pressed = pressed || touchIdentifiers.size > 0;
    } else {
      return;
    }
    if (pressed) {
      if (previousCommand === -1) {
        // unpressed to pressed
        previousCommand = command;
        down('Mouse', previousCommand);
      } else {
        // steadily down, maybe relocated
        if (previousCommand !== command) {
          up('Mouse', previousCommand);
          previousCommand = command;
          down('Mouse', previousCommand);
        }
      }
    } else {
      // to unpressed
      if (previousCommand !== -1) {
        // pressed to unpressed
        up('Mouse', previousCommand);
        previousCommand = -1;
      } /* else { // steadily unpressed
      } */
    }
  };

  /**
   * @param {Event} event
   */
  const onControlsMouseChange = event => {
    const mouseEvent = /** @type {MouseEvent} */ (event);
    const command = controlEventToCommand(mouseEvent);
    onControlMouseStateChange(command, (mouseEvent.buttons & 1) !== 0);
  };

  /**
   * @param {Event} event
   */
  const onControlsMouseEnter = event => {
    const mouseEvent = /** @type {MouseEvent} */ (event);
    const command = controlEventToCommand(mouseEvent);
    onControlMouseStateChange(command, (mouseEvent.buttons & 1) !== 0);
    $controls.addEventListener('mousemove', onControlsMouseChange);
  };

  const onControlsMouseLeave = () => {
    onControlMouseStateChange(-1, false);
    $controls.removeEventListener('mousemove', onControlsMouseChange);
  };

  const touchIdentifierToCommand = new Map();
  const commandToTouchIdentifiers = new Map(
    new Array(commandCount).fill(0).map((_, n) => [n, new Set()]),
  );

  /**
   * @param {Event} touchEvent
   */
  const onControlsTouchStart = touchEvent => {
    const event = /** @type {TouchEvent} */ (touchEvent);
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const { top, left } = $controls.getBoundingClientRect();
      const command = controlEventToCommand({
        offsetX: touch.pageX - left,
        offsetY: touch.pageY - top,
      });
      touchIdentifierToCommand.set(touch.identifier, command);
      const touchIdentifiers = commandToTouchIdentifiers.get(command);
      if (touchIdentifiers !== undefined) {
        touchIdentifiers.add(touch.identifier);
      }
      onControlMouseStateChange(command, true);
    }
  };

  /**
   * @param {Event} touchEvent
   */
  const onControlsTouchEnd = touchEvent => {
    const event = /** @type {TouchEvent} */ (touchEvent);
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const command = touchIdentifierToCommand.get(touch.identifier);
      touchIdentifierToCommand.delete(touch.identifier);
      const touchIdentifiers = commandToTouchIdentifiers.get(command);
      if (touchIdentifiers !== undefined) {
        touchIdentifiers.delete(touch.identifier);
      }
      onControlMouseStateChange(command, false);
    }
  };

  $controls.addEventListener('mouseenter', onControlsMouseEnter);
  $controls.addEventListener('mouseleave', onControlsMouseLeave);
  $controls.addEventListener('mouseup', onControlsMouseChange);
  $controls.addEventListener('mousedown', onControlsMouseChange);
  $controls.addEventListener('touchstart', onControlsTouchStart);
  $controls.addEventListener('touchend', onControlsTouchEnd);

  /**
   * @param {KeyboardEvent} event
   */
  const onKeyDown = event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    if (down(key)) {
      event.stopPropagation();
    }
  };

  /**
   * @param {KeyboardEvent} event
   */
  const onKeyUp = event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    if (up(key)) {
      event.stopPropagation();
    }
  };

  $window.addEventListener('keydown', onKeyDown);
  $window.addEventListener('keyup', onKeyUp);
  $window.addEventListener('blur', cancel);

  const onHamburgerMouseDown = () => {
    down('Mouse', 0);
  };

  const onHamburgerMouseUp = () => {
    up('Mouse', 0);
  };

  $hamburger.addEventListener('mousedown', onHamburgerMouseDown);
  $hamburger.addEventListener('mouseup', onHamburgerMouseUp);
};
