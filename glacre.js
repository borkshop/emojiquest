// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

import makePixelRenderer from './glpixels.js';

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.$world
 * @param {number} [opts.tileSize]
 * @param {number} [opts.cellSize]
 * @param {number} [opts.worldWidth]
 * @param {number} [opts.worldHeight]
 */
export default async function runDemo(opts) {
  let {
    $world,
    cellSize = 16, // TODO obsolete?

    worldWidth = 256,
    worldHeight = 256,

  } = opts;

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  const pixRend = await makePixelRenderer(gl);

  // TODO use multipe layer patches to scale
  const space = pixRend.makeDenseLayer({
    cellSize,
    width: worldWidth,
    height: worldHeight,
  });

  const view = pixRend.makeViewport(cellSize);
  view.setRect({
    left: 0,
    top: 0,
    width: worldWidth,
    height: worldHeight,
  });

  const { stop, frames } = frameLoop();
  const done = async function() {
    for await (const _/*t*/ of frames) {
      sizeToClient($world);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

      gl.clear(gl.COLOR_BUFFER_BIT);

      view.with(() =>
        space.draw());
    }
  }();
  return {
    /**
     * @param {(ctx: OffscreenCanvas) => void} fn
     * TODO x, y, w, h to scribble in a subset of a larger world
     */
    scribble(fn) {
      const scratch = new OffscreenCanvas(space.width, space.height);
      const ctx = scratch.getContext('2d');
      if (!ctx) throw new Error('must have 2d context');

      ctx.putImageData(space.getImageData(), 0, 0);
      fn(scratch);
      space.putImageData(ctx.getImageData(0, 0, space.width, space.height));
    },

    get width() { return space.width },
    get height() { return space.height },

    get view() { return view },

    /** @param {number} x @param {number} y */
    at(x, y) {
      return space.at(x, y);
    },

    // TODO ability to map client coords to cell space for mouse interaction

    // TODO viewport() accessor in cell space

    // TODO zoom factor access

    // TODO easy pan/translation access

    stop,
    done,
  };
}
