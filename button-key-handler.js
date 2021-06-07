// @ts-check

import {north, south, east, west, same} from './geometry2d.js';

/**
 * @param {(direction: number) => void} direct
 */
export function makeButtonKeyHandler(direct) {
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

