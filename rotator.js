// @ts-check

import { rotate, matrixStyle } from './lib/matrix2d.js';

/**
 * @param {SVGElement} $element
 * @param {number} direction - (1 for clockwise, -1 for widdershins)
 */
export const makeRotatingElementController = ($element, direction) => {
  // visibility
  let prev = true;
  let next = true;

  const tick = () => {};

  const tock = () => {};

  /** @type {import('./progress.js').AnimateFn} */
  const animate = progress => {
    // TODO unclear why tick and tock aren't detecting these transitions
    // properly.
    if (progress.linear === 1) {
      prev = next;
      return;
    }
    // animate rotation
    if (prev !== next) {
      if (next) {
        // showing
        $element.style.transform = matrixStyle(
          rotate(direction * (Math.PI / 2) * (1 - progress.sinusoidal)),
        );
      } else {
        // hiding
        $element.style.transform = matrixStyle(
          rotate(direction * (Math.PI / 2) * progress.sinusoidal),
        );
      }
    } else {
      if (next) {
        // shown
        $element.style.transform = matrixStyle(rotate(0));
      } else {
        // hidden
        $element.style.transform = matrixStyle(
          rotate((direction * Math.PI) / 2),
        );
      }
    }
  };

  const show = () => {
    next = true;
  };

  const hide = () => {
    next = false;
  };

  const controller = {
    show,
    hide,
    tick,
    tock,
    animate,
  };

  return controller;
};
