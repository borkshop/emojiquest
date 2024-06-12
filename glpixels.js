// @ts-check

import { mat4 } from 'gl-matrix';
import { vec2 } from 'gl-matrix';

import {
  compileProgram,
  makeUniformBlock,
  makeFrame,
} from './glkit.js';

/**
 * @typedef {object} Viewport
 * @prop {number} left
 * @prop {number} top
 * @prop {number} width
 * @prop {number} height
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {object} [options]
 * @param {string} [options.vertShader]
 * @param {string} [options.fragShader]
 */
export default async function makeRenderer(gl, options = {}) {
  const {
    vertShader = './glpixels.vert',
    fragShader = './glpixels.frag',
  } = options;

  const prog = await compileProgram(gl, vertShader, fragShader);

  const viewParamsBlock = makeUniformBlock(gl, prog, 'ViewParams', 0);
  const layerParamsBlock = makeUniformBlock(gl, prog, 'LayerParams', 1);

  viewParamsBlock.link(prog);
  layerParamsBlock.link(prog);

  /** @param {string} name */
  const mustGetAttr = name => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) throw new Error(`no such attribute ${name}`);
    return loc;
  };

  return {
    /** @param {number} cellSize */
    makeViewport(cellSize) {
      const params = viewParamsBlock.makeBuffer();

      const perspectiveUniform = params.getVar('perspective');
      const perspective = perspectiveUniform.asFloatArray();

      mat4.identity(perspective);
      params.send();

      let atX = 0, atY = 0, width = 0, height = 0, preferWidth = true, aspect = 0;

      const update = () => {
        if (width == 0 || height == 0) return;

        if (aspect != 0) {
          const a = width / height;
          if (a != aspect) {
            if (preferWidth) height = width / aspect;
            else width = aspect * height;
          }
        }

        const left = atX - width / 2;
        const top = atY - height / 2;

        mat4.ortho(perspective,
          cellSize * left,
          cellSize * width,
          cellSize * height,
          cellSize * top,
          0, Number.EPSILON);

        perspectiveUniform.send();
      };

      return {
        /** @param {() => void} fn */
        with(fn) {
          gl.useProgram(prog);
          params.bind();
          fn();
          gl.useProgram(null);
        },

        get cellSize() { return cellSize },
        // TODO set cellSize() ?

        /** @returns {[x: number, y: number]} */
        get at() { return [atX, atY] },
        set at([x, y]) {
          if (atX != x || atY != y) {
            atX = x, atY = y;
            update();
          }
        },

        /** @returns {[w: number, h: number]} */
        get size() { return [width, height] },
        set size([w, h]) {
          if (width != w || height != h) {
            width = w, height = h;
            update();
          }
        },

        get aspect() { return aspect },
        set aspect(ratio) {
          if (aspect != ratio) {
            aspect = ratio;
            update();
          }
        },

        get width() { return width },
        set width(w) {
          if (width != w) {
            width = w;
            preferWidth = true;
            update();
          }
        },

        get height() { return height },
        set height(h) {
          if (height != h) {
            height = h;
            preferWidth = false;
            update();
          }
        },

        /** @param {number} dx @param {number} dy */
        pan(dx, dy) {
          mat4.translate(perspective, perspective, [
            cellSize * dx,
            cellSize * dy,
            0,
          ]);
          perspectiveUniform.send();
        },

        /** @param {number} factor */
        zoom(factor) {
          mat4.scale(perspective, perspective, [factor, factor, 0]);
          perspectiveUniform.send();
        },

      };
    },

    /** Creates a minimal base tile layer.
     * Caller is fully responsible for sending data to the layer buffers.
     * Primarly intended to be used internally to implement specific layer data schemes.
     *
     * When stride is non-zero, each tile has an implicit x/y position relative to left/top.
     *
     * @param {object} params
     * @param {number} params.cellSize
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} [params.stride]
     */
    makeLayer(params) {
      const layerParams = layerParamsBlock.makeBuffer();
      const transform = layerParams.getVar('transform').asFloatArray();
      const cellSize = layerParams.getVar('cellSize');
      const stride = layerParams.getVar('stride');
      let paramsDirty = true;
      if (params.stride !== undefined)
        stride.int = params.stride;

      {
        const {
          cellSize: size,
          left = 0, top = 0,
        } = params;

        cellSize.float = size;
        const x = size * left;
        const y = size * top;
        mat4.fromTranslation(transform, [x, y, 0]);
      }

      return {
        get cellSize() { return cellSize.float },
        set cellSize(size) {
          const factor = size / cellSize.float;
          transform[12] *= factor, transform[13] *= factor;
          cellSize.float = size;
          paramsDirty = true;
        },

        get left() {
          const [x, _] = vec2.transformMat4([0, 0], [0, 0], transform);
          return x / cellSize.float;
        },
        get top() {
          const [_, y] = vec2.transformMat4([0, 0], [0, 0], transform);
          return y / cellSize.float;
        },

        get stride() { return stride.int },
        set stride(w) {
          if (w != stride.int) {
            stride.int = w;
            paramsDirty = true;
          }
        },

        /** @param {number} left @param {number} top */
        moveTo(left, top) {
          const size = cellSize.float;
          const x = left * size;
          const y = top * size;
          mat4.fromTranslation(transform, [x, y, 0]);
          paramsDirty = true;
        },

        bind() {
          if (paramsDirty) {
            layerParams.send();
            paramsDirty = false;
          }
          layerParams.bind();
        },
      };
    },

    /**
     * Creates a dense cellular tile layer,
     * where tiles are implicitly positioned along a dense grid from layer origin,
     * suppoting at most 1 tile per cell,
     * and fast constant time "tiles at location" query.
     *
     * @param {object} params
     * @param {number} params.cellSize
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} params.width
     * @param {number} params.height
     */
    makeDenseLayer({ width, height, ...params }) {
      const layer = this.makeLayer({ stride: width, ...params });
      const data = makeFrame(gl, {
        color: {

          ArrayType: Uint8ClampedArray,
          size: 4,
          gl: {
            attrib: mustGetAttr('vertColor'), // vec4 xyzw = rgba
            normalized: true,
          },

        },
      }, width * height);

      const self = {
        get width() { return width },
        get height() { return height },

        /** @param {number} w @param {number} h */
        resize(w, h) {
          data.resize(w * h, false);
          layer.stride = w;
          width = w, height = h;
        },

        getImageData( /* TODO x, y, w, h for sub-image support */) {
          return new ImageData(data.color, width);
        },

        /**
         * @param {ImageData} img
         */
        putImageData(img/* TODO x, y for sub-image support */) {
          data.color.set(img.data);
        },

        /** Returns a cell reference given cell absolute x/y position,
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        absAt(x, y) { return this.at(x - layer.left, y - layer.top) },

        /** Returns a cell reference given cell x/y offsets (relative to left/top),
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        at(x, y) {
          if (x < 0 || y < 0 || x >= width || y >= height) return null;
          const id = Math.floor(y) * width + Math.floor(x);
          return {
            get id() { return id },
            get x() { return x },
            get y() { return y },

            /** Reset all tile data to 0 values */
            clear() {
              data.color[4 * id + 0] = 0;
              data.color[4 * id + 1] = 0;
              data.color[4 * id + 2] = 0;
              data.color[4 * id + 3] = 0;
              data.dirty = true;
            },

            get rgba() {
              return /** @type {r: number, g: number, b: number, a: number} */[
                data.color[4 * id + 0],
                data.color[4 * id + 1],
                data.color[4 * id + 2],
                data.color[4 * id + 3],
              ];
            },
            set rgba([r, g, b, a]) {
              data.color[4 * id + 0] = r;
              data.color[4 * id + 1] = g;
              data.color[4 * id + 2] = b;
              data.color[4 * id + 3] = a;
              data.dirty = true;
            },

            get rgbaf() {
              return /** @type {r: number, g: number, b: number, a: number} */[
                data.color[4 * id + 0] / 255,
                data.color[4 * id + 1] / 255,
                data.color[4 * id + 2] / 255,
                data.color[4 * id + 3] / 255,
              ];
            },
            set rgbaf([r, g, b, a]) {
              data.color[4 * id + 0] = Math.max(0, Math.min(255, r * 256));
              data.color[4 * id + 1] = Math.max(0, Math.min(255, g * 256));
              data.color[4 * id + 2] = Math.max(0, Math.min(255, b * 256));
              data.color[4 * id + 3] = Math.max(0, Math.min(255, a * 256));
              data.dirty = true;
            },

          };
        },

        clear() { data.clear() },

        draw() {
          layer.bind();
          data.bind();
          gl.drawArrays(gl.POINTS, 0, data.capacity);
        },
      };

      return passProperties(self, layer,
        'cellSize',
        'left', 'top', 'moveTo',
      );
    },

  };
}

/** @typedef {Awaited<ReturnType<makeRenderer>>} Renderer */
/** @typedef {ReturnType<Renderer["makeLayer"]>} BaseLayer */
/** @typedef {ReturnType<Renderer["makeDenseLayer"]>} DenseLayer */

/**
 * @template B, O
 * @template {keyof B} BK
 * @param {O} o
 * @param {B} b
 * @param {Array<BK>} propNames
 */
function passProperties(o, b, ...propNames) {
  const bPropDescs = Object.entries(Object.getOwnPropertyDescriptors(b));
  const passPropDescs = bPropDescs.filter(([name]) => propNames.includes(/** @type {BK}*/(name)));
  const passPropMap = /** @type {{[k in BK]: PropertyDescriptor}} */ (Object.fromEntries(passPropDescs));
  return /** @type {O & Pick<B, BK>} */ (Object.defineProperties(o, passPropMap));
}
