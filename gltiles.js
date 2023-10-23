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
 * @prop {(id: number) => TileID|undefined} getTileID
 */

/**
 * @template TileID
 * @typedef {Iterable<{id: TileID, draw: drawback}|[id: TileID, draw: drawback]>} tileable
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
  const { prog } = await compileProgram(gl, './gltiles.vert', './gltiles.frag');

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
      /** @type {Map<number, TileID>} */
      const revIndex = new Map();

      /** @type {drawback[]} */
      const draws = [];

      const tilesIter = tiles[Symbol.iterator]();
      let fin = false;
      while (index.size < maxLayers) {
        const res = tilesIter.next();
        if (res.done) {
          fin = true;
          break;
        }
        const { value } = res;
        const [id, draw] = Array.isArray(value) ? value : [value.id, value.draw];

        if (index.has(id))
          throw new Error(`duplicate tile id ${id}`);

        const layer = index.size;
        index.set(id, layer);
        revIndex.set(layer, id);
        draws.push(draw);
      }
      if (!fin && !tilesIter.next().done)
        throw new Error(`tileset larger than maximum ${maxLayers}`);

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
          gl.RGBA, gl.UNSIGNED_BYTE,
          // NOTE safari on ios 16 does not support directly ripping from a canvas... ios 17 does tho...
          canvas.transferToImageBitmap(),
          // canvas,
        );
      });

      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);

      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      return {
        get texture() { return texture },
        get size() { return size },

        getLayerID(tileID) {
          const layerIndex = index.get(tileID);
          return layerIndex === undefined ? 0 : layerIndex + 1;
        },

        getTileID(layerID) {
          if (layerID == 0) return undefined;
          const layerIndex = layerID - 1;
          return revIndex.get(layerIndex);
        },

      };
    },

    /**
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} params.cellSize
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} params.width
     * @param {number} params.height
     */
    makeLayer({
      texture,
      cellSize: givenCellSize,
      left: givenLeft = 0, top: givenTop = 0,
      width, height,
    }) {
      const layerParams = layerParamsBlock.makeBuffer();
      const transform = layerParams.getVar('transform').asFloatArray();
      const cellSize = layerParams.getVar('cellSize');
      const stride = layerParams.getVar('stride');

      cellSize.float = givenCellSize;
      stride.int = width;

      mat4.fromTranslation(transform, [givenCellSize * givenLeft, givenCellSize * givenTop, 0]);

      // TODO do we complect within or without?
      //   1. makeSparseLayer vs makeDenseLayer
      //   2. sans/with spin
      //   3. sans/with scale
      //   4. sans/with animation (for each of loc, spin, scale, id)

      // TODO further indirection between layer and gpu buffers allowing:
      // - N chunks of the same logical layer to be packed into M < N buffers
      // - N layer(s) to be fragmented into M > N buffers
      // - sub-region invalidation to avoid recopying old data / only copy new data

      // NOTE: we can also choose to interleave/pack data into a single buffer if desired
      const spinBuffer = gl.createBuffer();
      const tileBuffer = gl.createBuffer();

      let cap = width * height;
      let dirty = true, paramsDirty = true;
      let spinData = new Float32Array(cap);
      let tileData = new Uint16Array(cap);
      const index = makeElementIndex(gl, cap);

      const self = {
        get texture() { return texture },
        set texture(tex) { texture = tex },

        get cellSize() { return cellSize.float },
        set cellSize(size) {
          const factor = size / cellSize.float;
          transform[12] *= factor, transform[13] *= factor;
          cellSize.float = size;
          paramsDirty = true;
        },

        /** @returns {[x: number, y: number]} */
        get origin() {
          const [x, y] = vec2.transformMat4([0, 0], [0, 0], transform);
          const size = cellSize.float;
          return [x / size, y / size];
        },
        set origin([left, top]) {
          const size = cellSize.float;
          const x = left * size;
          const y = top * size;
          mat4.fromTranslation(transform, [x, y, 0]);
          paramsDirty = true;
        },

        get width() { return width },
        get height() { return height },

        /** @param {number} w @param {number} h */
        resize(w, h) {
          stride.int = w;
          paramsDirty = true;
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

        /**
         * @param {number} x
         * @param {number} y
         * @param {{layerID: number, spin?: number}} data
         */
        set(x, y, { layerID, spin = 0 }) {
          if (x < 0 || y < 0 || x >= width || y >= height)
            throw new Error(`point: ${JSON.stringify({ x, y })} outside of layer bounds: ${JSON.stringify({ width, height })}`);
          const id = Math.floor(y) * width + Math.floor(x);
          tileData[id] = layerID;
          spinData[id] = spin;
          if (layerID === 0) index.delete(id);
          else index.add(id);
          dirty = true;
        },

        /**
         * @param {number} x
         * @param {number} y
         */
        get(x, y) {
          if (x < 0 || y < 0 || x >= width || y >= height)
            throw new Error(`point: ${JSON.stringify({ x, y })} outside of layer bounds: ${JSON.stringify({ width, height })}`);
          const id = Math.floor(y) * width + Math.floor(x);
          const layerID = tileData[id];
          const spin = spinData[id];
          return { layerID, spin };
        },

        send() {
          gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, spinData, gl.STATIC_DRAW);

          gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.STATIC_DRAW);

          gl.bindBuffer(gl.ARRAY_BUFFER, null);

          index.send();
          dirty = false;
        },

        bind() {
          if (dirty) this.send();
          if (paramsDirty) {
            layerParams.send();
            paramsDirty = false;
          }
          viewParams.bind();
          layerParams.bind();

          const texUnit = texCache.get(texture);
          gl.uniform1i(uniSheet, texUnit);

          // TODO spin optional
          gl.enableVertexAttribArray(attrSpin);
          gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
          gl.vertexAttribPointer(attrSpin, 1, gl.FLOAT, false, 0, 0);

          gl.enableVertexAttribArray(attrLayerID);
          gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
          gl.vertexAttribIPointer(attrLayerID, 1, gl.UNSIGNED_SHORT, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        },

        draw() {
          gl.useProgram(prog);

          this.bind();

          index.draw();

          gl.useProgram(null);
        },

      };
      return self;
    },

    // TODO more variants:
    // - probably worth to make animation attributes optional;
    //   e.g. unanimated dense layer for static backgrounds
    // - not sure if worth to provie spinless / scaleless / offsetless variants

  };
}

/** @typedef {Awaited<ReturnType<makeTileRenderer>>} TileRenderer */
/** @typedef {ReturnType<TileRenderer["makeLayer"]>} Layer */

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

  const self = {
    *[Symbol.iterator]() {
      for (let i = 0; i < length; i++) yield elements[i];
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

    send() {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elements.buffer, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    },

    draw() {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.drawElements(gl.POINTS, length, self.glType, 0);
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
  return self;
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
