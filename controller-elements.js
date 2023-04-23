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
 * @param {typeof window} $window
 * @param {Element} $controls
 * @param {Element} $hamburger
 * @param {import('./types.js').Driver} driver
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

  // TODO third argument for whether the state change indicates cancellation,
  // propagate through "up". Requires us to answer a question about
  // cancellation if the command is held by multiple buttons.
  /**
   * @param {number} command
   * @param {boolean} pressed
   */
  const onControlMouseStateChange = (command, pressed) => {
    const touchIdentifiers = commandToTouchIdentifiers.get(command);
    if (touchIdentifiers === undefined) {
      return;
    }
    if (pressed || touchIdentifiers.size > 0) {
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

  const touchIdentifierToCommand = new Map();
  const commandToTouchIdentifiers = new Map(
    new Array(commandCount).fill(0).map((_, n) => [n, new Set()]),
  );

  $controls.addEventListener('pointerdown', pointerEvent => {
    const event = /** @type {PointerEvent} */ (pointerEvent);
    event.preventDefault();
    const identifier = event.pointerId;
    const { top, left } = $controls.getBoundingClientRect();
    const command = controlEventToCommand({
      offsetX: event.pageX - left,
      offsetY: event.pageY - top,
    });
    touchIdentifierToCommand.set(identifier, command);
    const touchIdentifiers = commandToTouchIdentifiers.get(command);
    if (touchIdentifiers !== undefined) {
      touchIdentifiers.add(identifier);
    }
    onControlMouseStateChange(command, true);
  });

  /**
   * @param {Event} pointerEvent
   */
  const pointerRelease = pointerEvent => {
    const event = /** @type {PointerEvent} */ (pointerEvent);

    event.preventDefault();
    const identifier = event.pointerId;

    const command = touchIdentifierToCommand.get(identifier);
    if (command === undefined) {
      return;
    }
    const touchIdentifiers = commandToTouchIdentifiers.get(command);
    if (touchIdentifiers === undefined) {
      return;
    }
    touchIdentifierToCommand.delete(identifier);
    touchIdentifiers.delete(identifier);
    if (touchIdentifiers.size !== 0) {
      return undefined;
    }
    return command;
  };

  $controls.addEventListener('pointerup', event => {
    const command = pointerRelease(event);
    if (command !== undefined) {
      onControlMouseStateChange(command, false);
    }
  });

  $controls.addEventListener('pointercancel', event => {
    pointerRelease(event);
  });

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

  $hamburger.addEventListener('pointerdown', event => {
    event.preventDefault();
    down('Mouse', 0);
  });
  $hamburger.addEventListener('pointerup', event => {
    event.preventDefault();
    up('Mouse', 0);
  });
  $hamburger.addEventListener('pointercancel', event => {
    event.preventDefault();
    up('Mouse', 0);
  });
};
