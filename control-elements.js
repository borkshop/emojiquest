import { makeElementWatcher } from './element-watcher.js';

const svgNS = 'http://www.w3.org/2000/svg';
const commandCount = 10;

/**
 * @param {SVGElement} $controls
 * @param {SVGElement} $hamburger
 * @param {Object} args
 * @param {Array<string>} args.viewText
 */
export const makeControllerElementWatchers = (
  $controls,
  $hamburger,
  { viewText },
) => {
  /**
   * @param {number} _entity
   * @param {number} type
   */
  const createElement = (_entity, type) => {
    if (type === -1) {
      const element = document.createElementNS(svgNS, 'circle');
      element.setAttributeNS(null, 'class', 'reticle');
      element.setAttributeNS(null, 'r', '0.75');
      return element;
    } else {
      const text = viewText[type];
      const $element = document.createElementNS(svgNS, 'g');
      const $text = document.createElementNS(svgNS, 'text');
      $text.setAttributeNS(null, 'class', 'moji');
      $text.appendChild(document.createTextNode(text));
      $element.appendChild($text);
      return $element;
    }
  };

  const nineKeyWatcher = makeElementWatcher($controls, null, createElement);
  const oneKeyWatcher = makeElementWatcher($hamburger, null, createElement);

  return {
    nineKeyWatcher,
    oneKeyWatcher,
  };
};

/**
 * @param {typeof window} $window
 * @param {Element} $controls
 * @param {Element} $hamburger
 * @param {import('./driver.js').Driver} dispatcher
 * @param {Object} args
 * @param {number} args.tileSizePx
 */
export const watchControllerCommands = (
  $window,
  $controls,
  $hamburger,
  dispatcher,
  { tileSizePx },
) => {
  const { up, down, press, commandForKey, cancel } = dispatcher;

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

  // Account for how the key to command mapping changes due to mode switching.
  // Each keyup will cancel whatever command it innitiated.
  // TODO push command for key tracking down a layer, into the driver.
  const lastCommandForKey = new Map();

  /**
   * @param {KeyboardEvent} event
   */
  const onKeyDown = event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = commandForKey(key);
    event.stopPropagation();
    if (command === undefined) {
      press(key);
    } else {
      lastCommandForKey.set(key, command);
      down(key, command);
    }
  };

  /**
   * @param {KeyboardEvent} event
   */
  const onKeyUp = event => {
    const { key, repeat, metaKey } = event;
    if (repeat || metaKey) return;
    const command = lastCommandForKey.get(key);
    if (command === undefined) return;
    event.stopPropagation();
    up(key, command);
  };

  const onBlur = () => {
    for (const [key, command] of lastCommandForKey.entries()) {
      up(key, command);
    }
    lastCommandForKey.clear();
    cancel();
  };

  $window.addEventListener('keydown', onKeyDown);
  $window.addEventListener('keyup', onKeyUp);
  $window.addEventListener('blur', onBlur);

  const onHamburgerMouseDown = () => {
    down('Mouse', 0);
  };

  const onHamburgerMouseUp = () => {
    up('Mouse', 0);
  };

  $hamburger.addEventListener('mousedown', onHamburgerMouseDown);
  $hamburger.addEventListener('mouseup', onHamburgerMouseUp);
};
