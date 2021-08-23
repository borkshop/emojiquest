/**
 * The button-key-handler module provides a factory for keyup and keydown DOM
 * keyboard event handlers in a style consistent with the command vocabulary
 * of Emoji Quest, which equates all styles of input to buttons on a 10-key
 * calculator keyboard.
 *
 *   7 8 9
 *   4 5 6
 *   1 2 3
 */

// TODO mux-demux equivalent commands so command sequences like [7-up, 7-up,
// 7-down, 7-down] are not possible.

// @ts-check

/**
 * @param {(command: number) => void} command
 */
export function makeButtonKeyHandler(command) {
  /**
   * @param {KeyboardEvent} event
   */
  const handler = event => {
    const {key, repeat, metaKey} = event;
    if (repeat || metaKey) return;

    switch (key) {
      case '7': // numpad
      case 'u': // hjkl
        command(7);
        break;

      case 'ArrowUp':
      case '8': // numpad
      case 'k': // hjkl
      case 'i': // hjkl
        command(8);
        break;

      case '9': // numpad
      case 'o':
        command(9);
        break;

      case 'ArrowLeft':
      case '4': // numpad
      case 'h': // hjkl
        command(4);
        break;

      case '5': // numpad
      case ' ':
        command(5);
        break;

      case 'ArrowRight':
      case '6': // numpad
      case 'l': // hjkl
        command(6);
        break;

      case '1': // numpad
      case 'm': // hjkl
      case 'f':
        command(1);
        break;

      case 'ArrowDown':
      case '2': // numpad
      case 'j': // hjkl
      case ',':
        command(2);
        break;

      case '3': // numpad
      case '.': // hjkl
      case 'd':
        command(3);
        break;

      case '0':
        command(0);
        break;

      default:
        console.log(key);
    }
  };
  return handler;
}

