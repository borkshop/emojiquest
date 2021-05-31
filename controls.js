
import {translate, matrixStyle} from './matrix2d.js';

const svgNS = "http://www.w3.org/2000/svg";
const tileSize = 75;

export function createControls() {
  const $controls = document.createElementNS(svgNS, 'svg');
  $controls.setAttributeNS(null, 'viewBox', `0 0 3 3`);
  $controls.setAttributeNS(null, 'height', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'width', `${3 * tileSize}`);
  $controls.setAttributeNS(null, 'id', 'controls');

  const icons = [
    ['', '👆', ''],
    ['👈', '⏱', '👉'],
    ['✋', '👇', '🤚'],
  ];
  for (let x = 0; x < 3; x += 1) {
    for (let y = 0; y < 3; y += 1) {
      $controls.appendChild(createEntity(x, y, icons[y][x]));
    }
  }

  return $controls;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {string} text
 */
function createEntity(x, y, text) {
  const $entity = document.createElementNS(svgNS, 'text');
  $entity.setAttributeNS(null, 'class', 'moji');
  $entity.appendChild(document.createTextNode(text));
  $entity.setAttributeNS(null, 'transform', matrixStyle(translate({
    x: x + 0.5,
    y: y + 0.5,
  })));
  return $entity;
}
