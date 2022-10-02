// @ts-check

import { moddivpoint } from '../../lib/geometry2d.js';

export const faceNames = ['Dysia', 'Oria', 'Infra', 'Borea', 'Occia', 'Euia'];

export const faceSymbols = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const arrows = [
  ['↘', '↓', '↙'],
  ['→', '⨯', '←'],
  ['↗', '↑', '↖'],
];

// Exported for unit testing.
/**
 * @param {number} scale
 * @param {number} x
 * @param {number} y
 * @param {Array<Array<string>>} arrows
 */
export function ternym(scale, x, y, arrows) {
  /** @type {Array<string>} */
  const terms = [];
  let qx, qy;
  while (scale) {
    const half = scale / 2;
    const third = scale / 3;
    if (Math.floor(half) === half) {
      scale = half;
      if (scale > 1) {
        ({
          q: { x: qx, y: qy },
          r: { x, y },
        } = moddivpoint({ x, y }, { x: scale, y: scale }));
      } else {
        (qx = x), (qy = y);
        scale = 0;
      }
      terms.push(arrows[qy * 2][qx * 2]);
    } else if (Math.floor(third) === third) {
      scale = third;
      if (scale > 1) {
        ({
          q: { x: qx, y: qy },
          r: { x, y },
        } = moddivpoint({ x, y }, { x: scale, y: scale }));
      } else {
        (qx = x), (qy = y);
        scale = 0;
      }
      terms.push(arrows[qy][qx]);
    } else {
      terms.push(`(${x}/${scale}, ${y}/${scale})`);
      scale = 0;
    }
  }
  return terms;
}

/**
 * @param {object} args
 * @param {number} args.faceSize
 * @param {import('../../topology.js').TileCoordinateFn} args.tileCoordinate
 * @param {number} [args.offset]
 */
export function makeToponym({ faceSize, tileCoordinate, offset = 0 }) {
  /**
   * @param {number} t
   */
  function toponym(t) {
    let { f, x, y } = tileCoordinate(t);
    return `${faceSymbols[f]} ${ternym(faceSize, x, y, arrows).join('')} @${t + offset}`;
  }

  return toponym;
}
