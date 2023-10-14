// @ts-check

import { mat4 } from 'gl-matrix';

import { compileProgram } from './glkit.js';

// TODO per-tile scale support
// TODO animation support (probably at least per-tile displacement driven externally)

/** @param {WebGL2RenderingContext} gl */
export function compileTileProgram(gl) {
  // TODO how to afford customization for things like fragment shader effects?
  return compileProgram(gl, './gltiles.vert', './gltiles.frag');
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 */
export function makeTileRenderer(gl, prog) {
  /** @param {string} name */
  const mustGetUniform = name => {
    const loc = gl.getUniformLocation(prog, name);
    if (loc == null) throw new Error(`no such uniform ${name}`);
    return loc;
  };

  /** @param {string} name */
  const mustGetAttr = name => {
    const loc = gl.getAttribLocation(prog, name);
    if (loc == null) throw new Error(`no such attribute ${name}`);
    return loc;
  };

  const uni_sheet = mustGetUniform('sheet'); // sampler2D
  const uni_transform = mustGetUniform('transform'); // mat4
  const uni_perspective = mustGetUniform('perspective'); // mat4
  const uni_nowhere = mustGetUniform('nowhere'); // vec4
  const uni_stride = mustGetUniform('stride'); // uint

  const attr_spin = mustGetAttr('spin'); // float
  const attr_size = mustGetAttr('size'); // float
  const attr_layerID = mustGetAttr('layerID'); // int

  const perspective = mat4.identity(new Float32Array(16));
  const texCache = makeTextureUnitCache(gl, gl.TEXTURE_2D_ARRAY);

  return {
    /**
     * @param {IterableIterator<Layer>} layers
     * @param {object} [viewport]
     * @param {number} [viewport.left]
     * @param {number} [viewport.top]
     * @param {number} [viewport.width]
     * @param {number} [viewport.height]
     */
    draw(layers, {
      left = 0,
      top = 0,
      width = gl.canvas.width,
      height = gl.canvas.height,
    } = {}) {
      // TODO: why can't this persist across frames?
      texCache.clear();

      gl.useProgram(prog);

      // NOTE: this just needs to be set to any point outside of camera view, so
      // that the vertex shader can use it to cull points
      gl.uniform4f(uni_nowhere, -1, -1, -1, 0);

      mat4.ortho(perspective, left, width, height, top, 0, Number.EPSILON);
      gl.uniformMatrix4fv(uni_perspective, false, perspective);

      // TODO at some point, it'll be worth it to cull layers that don't
      // intersect perspective, but for now we just use leave GL's vertex culling
      for (const layer of layers)
        layer.draw({
          texCache,
          transform: uni_transform,
          sheet: uni_sheet,
          stride: uni_stride,
          size: attr_size,
          spin: attr_spin,
          layerID: attr_layerID,
        });

    },
  };
}

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
 * @template TileID
 * @param {WebGL2RenderingContext} gl
 * @param {tileable<TileID>} tiles
 * @param {object} [params]
 * @param {number} [params.tileSize]
 * @param {number} [params.mipLevels]
 * @returns {TileSheet<TileID>}
 */
export function makeTileSheet(gl, tiles, {
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
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {object} params
 * @param {WebGLTexture} params.texture
 * @param {number} params.cellSize
 * @param {number} [params.left]
 * @param {number} [params.top]
 * @param {number} params.width
 * @param {number} params.height
 */
export function makeLayer(gl, {
  texture,
  cellSize,
  left = 0, top = 0,
  width, height,
}) {

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

  const cap = width * height;
  const spinData = new Float32Array(cap);
  const tileData = new Uint16Array(cap);
  const index = makeElementIndex(gl, cap);

  return {
    get texture() { return texture },
    get cellSize() { return cellSize },
    get left() { return left },
    get top() { return top },
    get width() { return width },
    get height() { return height },

    clear() {
      spinData.fill(0);
      tileData.fill(0);
      index.clear();
    },

    /**
     * @param {number} x
     * @param {number} y
     * @param {{layerID: number, spin?: number}} data
     */
    set(x, y, { layerID, spin = 0 }) {
      if (x < 0 || y < 0 || x >= width || y >= height)
        throw new Error(`point: ${JSON.stringify({ x, y })} outside of layer bounds: ${JSON.stringify({ width, height })}`);
      const id = Math.floor(y - top) * width + Math.floor(x - left);
      tileData[id] = layerID;
      spinData[id] = spin;
      if (layerID === 0) index.delete(id);
      else index.add(id);
    },

    /**
     * @param {number} x
     * @param {number} y
     */
    get(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height)
        throw new Error(`point: ${JSON.stringify({ x, y })} outside of layer bounds: ${JSON.stringify({ width, height })}`);
      const id = Math.floor(y - top) * width + Math.floor(x - left);
      const layerID = tileData[id];
      const spin = spinData[id];
      return { layerID, spin };
    },

    send() {
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, spinData, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.STATIC_DRAW);

      index.send();
    },

    /**
     * @param {object} params
     * @param {TextureUnitCache} params.texCache
     * @param {WebGLUniformLocation} params.transform
     * @param {WebGLUniformLocation} params.sheet
     * @param {WebGLUniformLocation} params.stride
     * @param {number} params.size
     * @param {number} params.spin
     * @param {number} params.layerID
     */
    draw({
      texCache,
      transform,
      sheet,
      stride,
      size,
      spin,
      layerID,
    }) {
      const texUnit = texCache.get(texture);
      gl.uniform1i(sheet, texUnit);

      gl.uniform1i(stride, width);

      const xform = new Float32Array(16);
      mat4.fromTranslation(xform, [cellSize * left, cellSize * top, 0]);
      gl.uniformMatrix4fv(transform, false, xform);

      // TODO optional size buffer
      gl.vertexAttrib1f(size, cellSize);

      // TODO spin optional
      gl.enableVertexAttribArray(spin);
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.vertexAttribPointer(spin, 1, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(layerID);
      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.vertexAttribIPointer(layerID, 1, gl.UNSIGNED_SHORT, 0, 0);

      index.draw();
    },

  };
}

/** @typedef {ReturnType<makeLayer>} Layer */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} cap
 */
export function makeElementIndex(gl, cap) {
  const elements =
    cap <= 256
      ? new Uint8Array(cap)
      : cap <= 256 * 256
        ? new Uint16Array(cap)
        : cap <= 256 * 256 * 256 * 256
          ? new Uint32Array(cap)
          : null;
  if (elements == null)
    throw new Error(`unsupported element index capacity: ${cap}`);

  const glType =
    elements.BYTES_PER_ELEMENT == 1
      ? gl.UNSIGNED_BYTE
      : elements.BYTES_PER_ELEMENT == 2
        ? gl.UNSIGNED_SHORT
        : (elements.BYTES_PER_ELEMENT == 4 && gl.getExtension('OES_element_index_uint'))
          ? gl.UNSIGNED_INT
          : null;
  if (glType == null)
    throw new Error(`unsupported index element byte size: ${elements.BYTES_PER_ELEMENT}`);

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

  return {
    *[Symbol.iterator]() {
      for (let i = 0; i < length; i++) yield elements[i];
    },

    get length() { return length },

    send() {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elements.buffer, gl.STATIC_DRAW);
    },

    draw() {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.drawElements(gl.POINTS, length, glType, 0);
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
      if (eli > length + 1) throw new Error('inconeivable find result index');
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
