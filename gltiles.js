// @ts-check

import { mat4 } from 'gl-matrix';
import { vec2 } from 'gl-matrix';

import {
  compileProgram,
  makeUniformBlock,
  arrayElementType as glArrayElementType,
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

  const attrPosSpec = {
    ArrayType: Float32Array,
    size: 4,
    gl: {
      attrib: mustGetAttr('pos'), // vec4: xy=offset, z=spin, w=scale
    },
  };

  const attrTileSpec = {
    ArrayType: Uint16Array,
    size: 1,
    gl: {
      attrib: mustGetAttr('layerID'), // int
      asInt: true,
    },
  };

  const uniSheet = mustGetUniform('sheet'); // sampler2D

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
      const data = makeGLArrays(gl, {
        pos: attrPosSpec,
        tile: attrTileSpec,
        index: {
          ArrayType: Uint16Array, // TODO bring back varyign type
          size: 1,
          gl: {
            elements: true,
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
              data.pos[4 * id + 0] = 0;
              data.pos[4 * id + 1] = 0;
              data.pos[4 * id + 2] = 0;
              data.pos[4 * id + 3] = 0;
              data.tile[id] = 0;
              data.delElement(id);
              data.dirty = true;
            },

            /** Tile X offset from cell center */
            get offsetX() { return data.pos[4 * id + 0] },
            set offsetX(cellX) {
              data.pos[4 * id + 0] = cellX;
              data.dirty = true;
            },

            /** Tile Y offset from cell center */
            get offsetY() { return data.pos[4 * id + 1] },
            set offsetY(cellY) {
              data.pos[4 * id + 1] = cellY;
              data.dirty = true;
            },

            /** Tile rotation in units of full turns */
            get spin() { return data.pos[4 * id + 2] },
            set spin(turns) {
              data.pos[4 * id + 2] = turns;
              data.dirty = true;
            },

            /** Tile scale factor */
            get scale() { return data.pos[4 * id + 3] },
            set scale(factor) {
              data.pos[4 * id + 3] = factor;
              data.dirty = true;
            },

            /** Tile texture Z index.
             *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
            get layerID() { return data.tile[id] },
            /** Setting a value of 0, the default, will cause this tile to not be drawn.
             * When initializing (setting to non-zero when prior value was 0),
             * a default 1.0 scale value will also be set if scale was 0. */
            set layerID(layerID) {
              const init = layerID != 0 && data.tile[id] == 0;
              data.tile[id] = layerID;
              if (init && data.pos[4 * id + 3] == 0) data.pos[4 * id + 3] = 1;
              if (layerID === 0) data.delElement(id); else data.addElement(id);
              data.dirty = true;
            },
          };
        },

        clear() { data.clear() },

        draw() {
          gl.useProgram(prog);
          viewParams.bind();
          layer.bind();
          data.drawElements(gl.POINTS);
          gl.useProgram(null);
        },
      };

      return passProperties(self, layer,
        'texture',
        'cellSize',
        'left', 'top', 'moveTo',
      );
    },

    /**
     * Creates a sparse tile layer,
     * where each tile is positioned explicitly from layer origin,
     * and allowing for any number of overlapping tiles.
     *
     * There is now (explicit) limit to tile count,
     * as the underlying data arrays will be grown as necessary.
     *
     * TODO provide a spatial index (optional?); for now point queries are not supported
     *
     * TODO explicit Z order: for now overlapping tiles stack in creation order
     *
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} params.cellSize
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} [params.capacity]
     */
    makeSparseLayer({ capacity: initialCap = 64, ...params }) {
      const layer = this.makeLayer(params);
      const data = makeGLArrays(gl, {
        pos: attrPosSpec,
        tile: attrTileSpec,
        used: {
          ArrayType: Uint8Array,
          size: 1 / 8,
        },
        index: {
          ArrayType: Uint16Array, // TODO bring back varyign type
          size: 1,
          gl: {
            elements: true,
          },
        },
      }, initialCap);

      // TODO support drawing sorted by Z order?

      let length = 0;

      /** @param {number} id */
      const isUsed = id =>
        (data.used[Math.floor(id / 8)] & (1 << (id % 8))) == 0 ? false : true;

      /** @param {number} id */
      const free = id =>
        data.used[Math.floor(id / 8)] &= 0xff & (0 << (id % 8));

      const alloc = () => {
        for (let usedEl = 0; usedEl < data.used.length; usedEl++) {
          const usedVal = data.used[usedEl];
          if (usedVal == 0xff) continue;
          for (let usedBit = 0, id = usedEl * 8; usedBit < 8 && id < length; usedBit++, id++) {
            const mask = 1 << usedBit;
            if ((usedVal & mask) != 0) continue;
            data.used[usedEl] = usedVal | mask;
            return id;
          }
        }
        while (length >= data.capacity) data.grow();
        const id = length++;
        const usedEl = Math.floor(id / 8);
        data.used[usedEl] |= 1 << id % 8;
        return id;
      };

      const self = {
        clear() {
          data.clear();
          length = 0;
        },
        prune() {
          data.prune(length);
        },

        create: alloc,

        createRef() {
          const id = alloc();
          const ref = self.ref(id);
          if (!ref)
            throw new Error(`inconceivable: must have created ref id:${id}`);
          return ref;
        },

        /** @param {number} id */
        ref(id) {
          if (id >= length || !isUsed(id)) return null;

          return {
            get id() { return id },

            /** Reset all tile data to 0 values */
            clear() {
              data.pos[4 * id + 0] = 0;
              data.pos[4 * id + 1] = 0;
              data.pos[4 * id + 2] = 0;
              data.pos[4 * id + 3] = 0;
              data.tile[id] = 0;
              data.delElement(id);
              data.dirty = true;
            },

            free() {
              this.clear();
              free(id);
            },

            /** Tile X offset from layer origin */
            get x() { return data.pos[4 * id + 0] },
            set x(x) {
              data.pos[4 * id + 0] = x;
              data.dirty = true;
            },

            /** Tile Y offset from layer origin */
            get y() { return data.pos[4 * id + 1] },
            set y(y) {
              data.pos[4 * id + 1] = y;
              data.dirty = true;
            },

            get xy() {
              return /** @type {[x: number, y: number]} */ (
                [data.pos[4 * id + 0], data.pos[4 * id + 1]])
            },
            set xy([x, y]) {
              data.pos[4 * id + 0] = x;
              data.pos[4 * id + 1] = y;
              data.dirty = true;

            },

            /** Tile rotation in units of full turns */
            get spin() { return data.pos[4 * id + 2] },
            set spin(turns) {
              data.pos[4 * id + 2] = turns;
              data.dirty = true;
            },

            /** Tile scale factor */
            get scale() { return data.pos[4 * id + 3] },
            set scale(factor) {
              data.pos[4 * id + 3] = factor;
              data.dirty = true;
            },

            /** Tile texture Z index.
             *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
            get layerID() { return data.tile[id] },
            /** Setting a value of 0, the default, will cause this tile to not be drawn.
             * When initializing (setting to non-zero when prior value was 0),
             * a default 1.0 scale value will also be set if scale was 0. */
            set layerID(layerID) {
              const init = layerID != 0 && data.tile[id] == 0;
              data.tile[id] = layerID;
              if (init && data.pos[4 * id + 3] == 0) data.pos[4 * id + 3] = 1;
              if (layerID === 0) data.delElement(id); else data.addElement(id);
              data.dirty = true;
            },
          };
        },

        draw() {
          gl.useProgram(prog);
          viewParams.bind();
          layer.bind();
          data.drawElements(gl.POINTS);
          gl.useProgram(null);
        },
      };

      return passProperties(self, layer,
        'texture',
        'cellSize',
        'left', 'top', 'moveTo',
      );
    },
  };
}

/** @typedef {Awaited<ReturnType<makeTileRenderer>>} TileRenderer */
/** @typedef {ReturnType<TileRenderer["makeLayer"]>} BaseLayer */
/** @typedef {ReturnType<TileRenderer["makeDenseLayer"]>} DenseLayer */
/** @typedef {ReturnType<TileRenderer["makeSparseLayer"]>} SparseLayer */

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

/** @typedef {object} GLAttribSpec
 * @prop {number} attrib
 * @prop {number} [type]
 * @prop {WebGLBuffer} [buffer]
 * @prop {number} [usage]
 * @prop {boolean} [normalized]
 * @prop {boolean} [asInt]
 */

/** @typedef {object} GLElementsSpec
 * @prop {true} elements
 * @prop {number} [type]
 * @prop {WebGLBuffer} [buffer]
 * @prop {number} [usage]
 */

/** @typedef {object} ArraySpec
 * @prop {(
 * | Float32ArrayConstructor
 * | Uint32ArrayConstructor
 * | Uint16ArrayConstructor
 * | Uint8ArrayConstructor
 * | Int32ArrayConstructor
 * | Int16ArrayConstructor
 * | Int8ArrayConstructor
 * )} ArrayType
 * @prop {number} size
 * @prop {GLAttribSpec|GLElementsSpec} [gl]
 */

/** @template T @typedef {(
 * T extends Float32ArrayConstructor ? Float32Array :
 * T extends Uint32ArrayConstructor ? Uint32Array :
 * T extends Uint16ArrayConstructor ? Uint16Array :
 * T extends Uint8ArrayConstructor ? Uint8Array :
 * T extends Int32ArrayConstructor ? Int32Array :
 * T extends Int16ArrayConstructor ? Int16Array :
 * T extends Int8ArrayConstructor ? Int8Array :
 * never
 * )} constructedArray
 */

/** @template {{[name: string]: ArraySpec}} T
 * @typedef {{
 *   [Name in keyof T]: constructedArray<T[Name]["ArrayType"]>
 * }} dataProps */

/** Creates a simple backing data store for an array,
 * where each attribute is mapped to a single array.
 *
 * @template {{[name: string]: ArraySpec}} T
 * @param {WebGL2RenderingContext} gl
 * @param {T} typeMap
 * @param {number} [initialCapacity]
 */
function makeGLArrays(gl, typeMap, initialCapacity = 8) {

  // TODO restore elements array varying type
  // /** @param {number} cap */
  // function makeElementArray(cap) {
  //   if (cap <= 256)
  //     return new Uint8Array(cap);
  //   if (cap <= 256 * 256)
  //     return new Uint16Array(cap);
  //   if (cap <= 256 * 256 * 256 * 256)
  //     return new Uint32Array(cap);
  //   throw new Error(`unsupported element index capacity: ${cap}`);
  // }

  // TODO support per-array dirty, ideeally with regions for subdata copy
  let dirty = true;

  let cap = initialCapacity;

  let elementsIndex = -1;
  let elementsLength = 0;

  const names = Object.keys(typeMap);
  const specs = Object.values(typeMap);
  const argl = specs.map(
    /** @returns {null|Required<Exclude<ArraySpec["gl"], undefined>>} */
    ({ ArrayType, size, gl: glSpec }, i) => {
      if (!glSpec) return null;

      // TODO support just-in-time buffer (re)creation and the ability to delete buffers

      if ('attrib' in glSpec) {
        const {
          attrib,
          type = glArrayElementType(gl, ArrayType),
          buffer = gl.createBuffer(),
          usage = gl.STATIC_DRAW,
          normalized = false,
          asInt = false,
        } = glSpec;
        if (!buffer) throw new Error(`must create vertex buffer for "${names[i]}"`);
        return {
          attrib,
          type,
          buffer,
          usage,
          normalized,
          asInt,
        };
      } else if (glSpec.elements) {
        if (size != 1)
          throw new Error(`elements size must be 1`);
        if (elementsIndex != -1)
          throw new Error('multiple element arrays are unsupported');
        elementsIndex = i;
        const {
          type = glArrayElementType(gl, ArrayType),
          buffer = gl.createBuffer(),
          usage = gl.STATIC_DRAW,
        } = glSpec;
        if (!buffer) throw new Error(`must create element buffer for "${names[i]}"`);
        return {
          elements: true,
          type,
          buffer,
          usage,
        };
      } else throw new Error(`invalid gl spec for "${names[i]}"`);
    });
  const data = specs.map(({ ArrayType, size }) =>
    new ArrayType(Math.ceil(cap * size)));

  const self = {
    get capacity() { return cap },

    get dirty() { return dirty },
    set dirty(d) { dirty = d },

    /** @param {number} n */
    resize(n, copy = true) {
      if (n != cap) {
        cap = n;
        for (let i = 0; i < data.length; i++) {
          const { ArrayType, size } = specs[i];
          const now = new ArrayType(Math.ceil(cap * size));
          if (copy) now.set(data[i].subarray(0, now.length));
          data[i] = now;
        }
        if (!copy) elementsLength = 0;
        dirty = true;
      } else if (!copy) {
        for (const ar of data) ar.fill(0);
        elementsLength = 0;
        dirty = true;
      }
    },

    // TODO compact() ?

    /** @param {number} needed */
    prune(needed) {
      let newCap = initialCapacity;
      // TODO clever maths to compute needed without a loop
      while (newCap < needed)
        newCap = newCap < 1024 ? 2 * newCap : newCap + newCap / 4;
      if (newCap < cap) self.resize(newCap);
    },

    grow(needed = cap + 1) {
      let newCap = cap;
      while (newCap < needed)
        newCap = newCap < 1024 ? 2 * newCap : newCap + newCap / 4;
      self.resize(newCap);
    },

    clear() {
      for (const ar of data) ar.fill(0);
      elementsLength = 0;
      dirty = true;
    },

    send() {
      for (let i = 0; i < data.length; i++) {
        const igl = argl[i];
        if (!igl) continue;
        const { buffer, usage } = igl;
        if ('attrib' in igl) {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, data[i], usage);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else if (igl.elements) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data[i], usage);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
      }
      dirty = false;
    },

    bind() {
      if (dirty) self.send();

      for (let i = 0; i < data.length; i++) {
        const igl = argl[i];
        if (!igl) continue;

        if ('attrib' in igl) {
          const { buffer, attrib, type, asInt, normalized } = igl;
          const { size } = specs[i];
          const stride = 0;
          const offset = 0;
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          if (asInt) {
            gl.vertexAttribIPointer(attrib, Math.ceil(size), type, stride, offset);
          } else {
            gl.vertexAttribPointer(attrib, Math.ceil(size), type, normalized, stride, offset);
          }
          gl.enableVertexAttribArray(attrib);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }
      }
    },

    /** @param {number} id */
    findElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      let lo = 0, hi = elementsLength;
      let sanity = cap;
      while (lo < hi) {
        if (--sanity < 0) throw new Error('find loop exeeded iteration budget');
        const mid = Math.floor(lo / 2 + hi / 2);
        const q = elements[mid];
        if (q === id) return mid;
        else if (q < id) lo = mid + 1;
        else if (q > id) hi = mid;
      }
      return lo;
    },

    /** @param {number} id */
    addElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      const eli = self.findElement(id);
      if (eli < elementsLength && elements[eli] === id) return;
      if (elementsLength === cap) throw new Error('element index full');
      if (eli > elementsLength + 1) throw new Error('inconceivable find result index');
      if (eli < elementsLength)
        elements.copyWithin(eli + 1, eli, elementsLength);
      elementsLength++;
      elements[eli] = id;
    },

    /** @param {number} id */
    delElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      const eli = self.findElement(id);
      if (eli < elementsLength && elements[eli] === id) {
        elements.copyWithin(eli, eli + 1);
        elementsLength--;
      }
    },

    // TODO hasElement(id)

    /** @param {number} mode */
    drawElements(mode) {
      const elGl = argl[elementsIndex];
      if (elementsIndex == -1 || !elGl)
        throw new Error('no elements index array defined');

      self.bind();

      const { buffer, type } = elGl;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.drawElements(mode, elementsLength, type, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    },

  };

  return /** @type {typeof self & dataProps<T>} */(
    Object.defineProperties(self, Object.fromEntries(
      names.map((name, i) => [name, { get: () => data[i] }])
    ))
  );
}
