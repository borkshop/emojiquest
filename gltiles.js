// @ts-check

import { mat4 } from 'gl-matrix';
import { vec2 } from 'gl-matrix';

import {
  compileProgram,
  makeUniformBlock,
} from './glkit.js';

// TODO per-tile scale support
// TODO animation support (probably at least per-tile displacement driven externally)
// TODO how to afford customization for things like fragment shader effects?

/** @callback drawback
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @returns {void}
 */

/**
 * @template TileID
 * @typedef {object} TileSheet
 * @prop {WebGLTexture} texture
 * @prop {number} size
 * @prop {(id: TileID) => number} getLayerID
 */

/**
 * @template TileID
 * @typedef {Iterator<{id: TileID, draw: drawback}|[id: TileID, draw: drawback]>} tileable
 */

/**
 * @typedef {object} Viewport
 * @prop {number} left
 * @prop {number} top
 * @prop {number} width
 * @prop {number} height
 */

/** @param {WebGL2RenderingContext} gl */
export default async function makeTileRenderer(gl) {
  const prog = await compileProgram(gl, './gltiles.vert', './gltiles.frag');

  const viewParamsBlock = makeUniformBlock(gl, prog, 'ViewParams', 0);
  const layerParamsBlock = makeUniformBlock(gl, prog, 'LayerParams', 1);

  viewParamsBlock.link(prog);
  layerParamsBlock.link(prog);

  const viewParams = viewParamsBlock.makeBuffer();

  /** @param {string} name */
  const mustGetUniform = name => {
    const loc = gl.getUniformLocation(prog, name);
    if (loc == null) throw new Error(`no such uniform ${name}`);
    return loc;
  };

  /** @param {string} name */
  const mustGetAttr = name => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) throw new Error(`no such attribute ${name}`);
    return loc;
  };

  const uniSheet = mustGetUniform('sheet'); // sampler2D

  const attrSpin = mustGetAttr('spin'); // float
  const attrLayerID = mustGetAttr('layerID'); // int

  const perspectiveUniform = viewParams.getVar('perspective');
  const perspective = perspectiveUniform.asFloatArray();
  const nowhere = viewParams.getVar('nowhere').asFloatArray();

  const texCache = makeTextureUnitCache(gl, gl.TEXTURE_2D_ARRAY);

  mat4.identity(perspective);

  // NOTE: this just needs to be set to any point outside of camera view, so
  // that the vertex shader can use it to cull points
  nowhere.set([-1, -1, -1, 0]);

  viewParams.send();

  return {
    texCache, // TODO reconsider

    /** @param {Partial<Viewport>} [viewport] */
    setViewport({
      left = 0,
      top = 0,
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight
    } = {}) {
      mat4.ortho(perspective, left, width, height, top, 0, Number.EPSILON);
      perspectiveUniform.send();
    },

    /**
     * @template TileID
     * @param {tileable<TileID>} tiles
     * @param {object} [params]
     * @param {number} [params.tileSize]
     * @param {number} [params.mipLevels]
     * @returns {TileSheet<TileID>}
     */
    makeSheet(tiles, {
      tileSize = 256,
      mipLevels,
    } = {}) {
      const pot = Math.log(tileSize) / Math.log(2);
      if (pot !== Math.floor(pot))
        throw new Error(`tileSize must be a power-of-two, got: ${tileSize}`);
      const levels = mipLevels || pot - 1;

      const maxTileSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (tileSize > maxTileSize)
        throw new Error(`tileSize:${tileSize} exceeds maximum supported texture size: ${maxTileSize}`);

      const maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);

      /** @type {Map<TileID, number>} */
      const index = new Map();

      /** @type {drawback[]} */
      const draws = [];

      while (index.size < maxLayers) {
        const res = tiles.next();
        if (res.done) break;
        const { value } = res;
        const [id, draw] = Array.isArray(value) ? value : [value.id, value.draw];

        if (index.has(id))
          throw new Error(`duplicate tile id ${id}`);

        const layer = index.size;
        index.set(id, layer);
        draws.push(draw);
      }

      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

      const texture = gl.createTexture();
      if (!texture) throw new Error('unable to create gl texture');

      gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);

      const size = draws.length;
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, tileSize, tileSize, size);

      draws.forEach((draw, layer) => {
        const canvas = new OffscreenCanvas(tileSize, tileSize);

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('unable to get offscreen canvas 2d context');

        ctx.clearRect(0, 0, tileSize, tileSize);
        draw(ctx);
        gl.texSubImage3D(
          gl.TEXTURE_2D_ARRAY, 0,
          0, 0, layer,
          tileSize, tileSize, 1,
          gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      });

      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);

      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      return {
        get texture() { return texture },
        get size() { return size },
        getLayerID(id) {
          const i = index.get(id);
          return i === undefined ? 0 : i + 1;
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
     * @param {WebGLTexture} params.texture
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

      const spinBuffer = gl.createBuffer();
      if (!spinBuffer)
        throw new Error('must create layer spin buffer');

      const tileBuffer = gl.createBuffer();
      if (!tileBuffer)
        throw new Error('must create layer tile buffer');

      let { texture } = params;

      return {
        get texture() { return texture },
        set texture(tex) { texture = tex },

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
        // TODO set left()

        get top() {
          const [_, y] = vec2.transformMat4([0, 0], [0, 0], transform);
          return y / cellSize.float;
        },
        // TODO set top()

        get stride() { return stride.int },
        set stride(w) {
          if (w != stride.int) {
            stride.int = w;
            paramsDirty = true;
          }
        },

        // TODO moveTo(left, top)

        get spinBuffer() { return spinBuffer },
        get tileBuffer() { return tileBuffer },

        bind() {
          if (paramsDirty) {
            layerParams.send();
            paramsDirty = false;
          }
          layerParams.bind();

          gl.uniform1i(uniSheet, texCache.get(texture));
        },
      };
    },

    // TODO more variants:
    // - probably worth to make animation attributes optional;
    //   e.g. unanimated dense layer for static backgrounds
    // - not sure if worth to provie spinless / scaleless / offsetless variants

    /**
     * Creates a dense cellular tile layer,
     * where tiles are implicitly positioned along a dense grid from layer origin,
     * suppoting at most 1 tile per cell,
     * and fast constant time "tiles at location" query.
     *
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} params.cellSize
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} params.width
     * @param {number} params.height
     */
    makeDenseLayer({ width, height, ...params }) {
      const layer = this.makeLayer({ stride: width, ...params });

      let dirty = true;
      let cap = width * height;
      let spinData = new Float32Array(cap);
      let tileData = new Uint16Array(cap);
      const index = makeElementIndex(gl, cap);

      return passProperties({
        get width() { return width },
        get height() { return height },

        /** @param {number} w @param {number} h */
        resize(w, h) {
          layer.stride = w;
          if (w != width || h != height) {
            width = w, height = h, cap = w * h;
            spinData = new Float32Array(cap);
            tileData = new Uint16Array(cap);
            index.resize(cap, false);
          } else {
            spinData.fill(0);
            tileData.fill(0);
            index.clear();
          }
          dirty = true;
        },

        clear() {
          spinData.fill(0);
          tileData.fill(0);
          index.clear();
          dirty = true;
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

            /** Reset all tile data to default (0 values) */
            clear() {
              spinData[id] = 0;
              tileData[id] = 0;
              index.delete(id);
              dirty = true;
            },

            /** Tile rotation in units of full turns */
            get spin() { return spinData[id] },
            set spin(turns) {
              spinData[id] = turns;
              dirty = true;
            },

            /** Tile texture Z index.
             *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
            get layerID() { return tileData[id] },
            /** Setting a value of 0, the default, will cause this tile to not be drawn. */
            set layerID(layerID) {
              tileData[id] = layerID;
              if (layerID === 0) index.delete(id); else index.add(id);
              dirty = true;
            },
          };
        },

        send() {
          gl.bindBuffer(gl.ARRAY_BUFFER, layer.spinBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, spinData, gl.STATIC_DRAW);

          gl.bindBuffer(gl.ARRAY_BUFFER, layer.tileBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.STATIC_DRAW);

          gl.bindBuffer(gl.ARRAY_BUFFER, null);

          index.send();
          dirty = false;
        },

        bind() {
          if (dirty) this.send();
          viewParams.bind();
          layer.bind();

          // TODO spin optional
          gl.enableVertexAttribArray(attrSpin);
          gl.bindBuffer(gl.ARRAY_BUFFER, layer.spinBuffer);
          gl.vertexAttribPointer(attrSpin, 1, gl.FLOAT, false, 0, 0);

          gl.enableVertexAttribArray(attrLayerID);
          gl.bindBuffer(gl.ARRAY_BUFFER, layer.tileBuffer);
          gl.vertexAttribIPointer(attrLayerID, 1, gl.UNSIGNED_SHORT, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        },

        draw() {
          gl.useProgram(prog);

          this.bind();

          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index.buffer);
          gl.drawElements(gl.POINTS, index.length, index.glType, 0);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

          gl.useProgram(null);
        },
      }, layer, 'texture', 'cellSize', 'left', 'top');
    },

  };
}

/** @typedef {Awaited<ReturnType<makeTileRenderer>>} TileRenderer */
/** @typedef {ReturnType<TileRenderer["makeLayer"]>} BaseLayer */
/** @typedef {ReturnType<TileRenderer["makeDenseLayer"]>} DenseLayer */

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

// TODO candidates for move into glkit.js

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} cap
 */
export function makeElementIndex(gl, cap) {
  /** @param {number} cap */
  function makeElementArray(cap) {
    if (cap <= 256)
      return new Uint8Array(cap);
    if (cap <= 256 * 256)
      return new Uint16Array(cap);
    if (cap <= 256 * 256 * 256 * 256)
      return new Uint32Array(cap);
    throw new Error(`unsupported element index capacity: ${cap}`);
  }

  let elements = makeElementArray(cap);
  let length = 0;
  const buffer = gl.createBuffer();
  if (!buffer)
    throw new Error('failed to create element index buffer');

  /** @param {number} id */
  const find = id => {
    let lo = 0, hi = length;
    let sanity = elements.length;
    while (lo < hi) {
      if (--sanity < 0) throw new Error('find loop exeeded iteration budget');
      const mid = Math.floor(lo / 2 + hi / 2);
      const q = elements[mid];
      if (q === id) return mid;
      else if (q < id) lo = mid + 1;
      else if (q > id) hi = mid;
    }
    return lo;
  }

  return {
    *[Symbol.iterator]() {
      for (let i = 0; i < length; i++) yield elements[i];
    },

    /** @param {number} n */
    resize(n, copy = true) {
      cap = n;
      if (copy) {
        const oldElements = elements;
        elements = makeElementArray(n);
        elements.set(oldElements);
      } else {
        elements = makeElementArray(n);
        length = 0;
      }
    },

    get glType() {
      switch (elements.BYTES_PER_ELEMENT) {
        case 1: return gl.UNSIGNED_BYTE;
        case 2: return gl.UNSIGNED_SHORT;
        case 4:
          if (!gl.getExtension('OES_element_index_uint'))
            throw new Error('uint element indices are unavailable');
          return gl.UNSIGNED_INT;
        default:
          throw new Error(`unsupported index element byte size: ${elements.BYTES_PER_ELEMENT}`);
      }
    },
    get length() { return length },
    get buffer() { return buffer },

    send() {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elements, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    },

    clear() {
      elements.fill(0);
      length = 0;
    },

    // TODO has(id)

    /** @param {number} id */
    add(id) {
      const eli = find(id);
      if (eli < length && elements[eli] === id) return;
      if (length === elements.length) throw new Error('element index full');
      if (eli > length + 1) throw new Error('inconceivable find result index');
      if (eli < length)
        elements.copyWithin(eli + 1, eli, length);
      length++;
      elements[eli] = id;
    },

    /** @param {number} id */
    delete(id) {
      const eli = find(id);
      if (eli < length && elements[eli] === id) {
        elements.copyWithin(eli, eli + 1);
        length--;
      }
    },

  };
}

/** @typedef {ReturnType<makeElementIndex>} ElementIndex */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} kind
 */
function makeTextureUnitCache(gl, kind) {
  /** @type {WeakMap<WebGLTexture, number>} */
  let cache = new WeakMap();
  let next = 0;

  return {
    clear() {
      for (let i = 0; i < next; ++i)
        cache.delete(i);
      next = 0;
    },

    /** @param {WebGLTexture} texture */
    get(texture) {
      let unit = cache.get(texture);
      if (unit === undefined) {
        // TODO reuse lower numbers from prior cache holes
        unit = next++;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(kind, texture);
      }
      return unit;
    }
  };
}

/** @typedef {ReturnType<makeTextureUnitCache>} TextureUnitCache */
