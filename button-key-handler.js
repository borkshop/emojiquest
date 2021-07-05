// @ts-check

// 7 8 9
// 4 5 6
// 1 2 3

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
      case 'q': // asdf
        command(7);
        break;

      case 'ArrowUp':
      case '8': // numpad
      case 'k': // hjkl
      case 'w': // wasd
        command(8);
        break;

      case '9': // numpad
      case 'i': // hjkl
      case 'e': // wasd
        command(9);
        break;

      case 'ArrowLeft':
      case '4': // numpad
      case 'h': // hjkl
      case 'a': // wasd
        command(4);
        break;

      case '5': // numpad
      case '.': // hjkl
      case 'f': // wasd
        command(5);
        break;

      case 'ArrowRight':
      case '6': // numpad
      case 'l': // hjkl
      case 'd': // wasd
        command(6);
        break;

      case '1': // numpad
      case 'm': // hjkl
      case 'x': // wasd
        command(1);
        break;

      case 'ArrowDown':
      case '2': // numpad
      case 'j': // hjkl
      case 's': // wasd
        command(2);
        break;

      case '3': // numpad
      case ',': // hjkl
      case 'c': // wasd
        command(3);
        break;

      default:
        console.log(key);
    }
  };
  return handler;
}

