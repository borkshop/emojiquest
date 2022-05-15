// @ts-check

import { assert } from './assert.js';

import { scale, matrixStyle } from './matrix2d.js';

export const createDialogBox = () => {
  const element = document.createComment('');

  /** @type {HTMLElement?} */
  let showing = null;
  /** @type {HTMLElement?} */
  let waning = null;
  /** @type {HTMLElement?} */
  let waxing = null;

  const logElement = () => {
    const { parentNode } = element;
    assert(parentNode !== null);

    if (waxing !== null) {
      console.warn(
        'Log dropped because multiple logs in a single turn:',
        waxing.innerHTML,
      );
      parentNode.removeChild(waxing);
      waxing = null;
    }

    const dialogElement = document.createElement('div');
    dialogElement.className = 'dialog panel';
    dialogElement.style.transform = 'scale(0)';
    parentNode.insertBefore(dialogElement, element);

    waxing = dialogElement;
    return dialogElement;
  };

  /**
   * @param {string} html
   */
  const logHTML = html => {
    logElement().innerHTML = html;
  };

  /** @param {string} message */
  const log = message => {
    const dialogElement = logElement();
    dialogElement.innerText = message;
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

  const tock = () => {
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
      waxing.style.transformOrigin = 'bottom center';
    }
    if (showing !== null) {
      showing.style.transform = '';
    }
    if (waning !== null) {
      waning.style.transform = matrixStyle(scale(1 - progress.sinusoidal));
      waning.style.transformOrigin = 'top center';
    }
  };

  const controller = { logHTML, log, animate, close, tock };

  return { element, controller };
};

/** @typedef {ReturnType<createDialogBox>['controller']} DialogController */
