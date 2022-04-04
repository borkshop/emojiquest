// @ts-check

import { assert } from './assert.js';

import {scale, matrixStyle} from './matrix2d.js';

export const createDialogBox = () => {
  const element = document.createComment('');

  /** @type {HTMLElement?} */
  let showing = null;
  /** @type {HTMLElement?} */
  let waning = null;
  /** @type {HTMLElement?} */
  let waxing = null;

  /** @param {string} message */
  const log = message => {
    close();

    const dialogElement = document.createElement('div');
    dialogElement.className = 'dialog panel';
    dialogElement.innerText = message;
    dialogElement.style.transform = 'scale(0)';
    const { parentNode } = element;
    assert(parentNode !== null);
    parentNode.insertBefore(dialogElement, element);

    waxing = dialogElement;
  };

  const close = () => {
    if (waning !== null) {
      const { parentNode } = waning;
      assert(parentNode !== null);
      parentNode.removeChild(waning);
      waning = null;
    }
    if (showing !== null) {
      waning = showing;
      showing = null;
    }
  };

  const reset = () => {
    if (waning !== null) {
      const { parentNode } = element;
      assert(parentNode !== null);
      parentNode.removeChild(waning);
      waning = null;
    }
    if (waxing !== null) {
      if (showing !== null) {
        waning = showing;
        showing = null;
      }
      showing = waxing;
      waxing = null;
    }
  };

  /** @param {import('./animation').Progress} progress */
  const animate = progress => {
    if (progress.linear >= 1) return;

    if (waxing !== null) {
      waxing.style.transform = matrixStyle(scale(progress.sinusoidal));
      waxing.style.transformOrigin = 'top left';
    }
    if (showing !== null) {
      showing.style.transform = '';
    }
    if (waning !== null) {
      waning.style.transform = matrixStyle(scale(1 - progress.sinusoidal));
      waning.style.transformOrigin = 'top right';
    }
  };

  const controller = {log, animate, close, reset};

  return {element, controller};
};

/** @typedef {ReturnType<createDialogBox>['controller']} DialogController */

