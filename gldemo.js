// @ts-check

import { mat4 } from 'gl-matrix';

const shaderSources = [
  './gldemo.vert.glsl',
  './gldemo.frag.glsl',
].map(sourceName => ({
  sourceName,
  source: fetch(sourceName)
    .then(res => res.text())
    .catch(error => ({ error }))
    .then(text => typeof text == 'string' ? { text } : text),
}));

/** @typedef {object} tileSpec
 * @prop {string} [glyph]
 * @prop {string} [glyphStyle]
 * @prop {number} [param.glyphHeight]
 * @prop {string} [param.glyphFont]
 * @prop {string} [fill]
 * @prop {{size: number, style: string}} [border]
 */

/** @callback layback
 * @param {TileSheet<number>} tileSheet
 * @param {Layer} layer
 * @returns {void}
 */

/** @template [T = any] @callback tileMaker @param {tileable<T>} tiles @return TileSheet<T> */

/** @typedef {object} TileWorld
 * @prop {tileMaker} makeTileSheet
 * @prop {(dims: FacetDims) => Facet} makeFacet
 */

/** @typedef {object} FacetDims
 * @prop {number} x
 * @prop {number} y
 * @prop {number} width
 * @prop {number} height
 */

/** @typedef {object} Facet
 * @prop {(sheet: TileSheet<unknown>, offset?: {x: number, y: number}) => Layer} makeLayer
 */

/**
 * @param {object} param
 * @param {HTMLCanvasElement} param.$world
 * @param {number} [param.tileSize]
 * @param {number} [param.cellSize]
 * @param {(world: TileWorld) => void} param.build
 */
export default async function demo({
  $world,
  tileSize = 256,
  cellSize = 64,
  build,
}) {
  sizeToParent($world);

  const gl = (() => {
    const gl = $world.getContext('webgl2');
    if (!gl) throw new Error('No GL For You!');
    return gl;
  })();

  // start all of our shaders to compiling ; it's purportedly best practice to
  // not check them for failure until link time as we do here
  //   -- inspired by note in example on
  //      https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile
  const shaders = shaderSources.map(async ({ sourceName, source }) => {
    const res = await source;
    if ('error' in res)
      throw new Error(
        `unable to load shader source ${sourceName}: ${res.error}`,
        // TODO how to typescript { cause: res.error }
      );
    const { text } = res;

    const type =
      sourceName.endsWith('.vert.glsl') ? gl.VERTEX_SHADER
        : sourceName.endsWith('.frag.glsl') ? gl.FRAGMENT_SHADER
          : null
    if (type == null)
      throw new Error(`unknown shader type for ${sourceName}`);

    const shader = gl.createShader(type);
    if (!shader)
      throw new Error(`unable to create type:${type} gl shader for ${sourceName}`);

    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    return shader;
  });

  // link our singular demo program ; as things progress, we could potentially
  // have multiple programs to do things like:
  // - change out the fragment shader for one that adds more/different effects
  //   (lighting, distortion, scan lines, whatever)
  // - change out the vertex shader if there's drastically different data
  //   shaping needs (e.g. implicit location based on array index, rather than
  //   x/y data explicitly encoded)
  // - or even more broadly, if we end up with other modes of drawing for
  //   things that aren't tiles, like to grid lines, line art, or other
  //   geometric shapes
  const prog = await (async () => {
    const shadersNow = await Promise.all(shaders);

    const prog = gl.createProgram();
    if (!prog) throw new Error('unable to create gl program');

    for (const shader of shadersNow)
      gl.attachShader(prog, shader);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error([
      `GL program link error: ${gl.getProgramInfoLog(prog)}`,
      ...shadersNow
        .filter(shader => !gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        .map((shader, i) => {
          const log = gl.getShaderInfoLog(shader) || '';
          const source = gl.getShaderSource(shader)
          if (source) {
            const { sourceName } = shaderSources[i];
            const mess = annotateCompileError(source, log);
            return `compile error in ${sourceName}:\n${mess}`;
          } else return log;
        })
    ].join('\n'));

    return prog;
  })();
  gl.useProgram(prog);

  // NOTE: somewhere around here is where most frameworks reify something
  // around a program and its uniform/attribute location

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

  const uni = {
    sheet: mustGetUniform('sheet'), // sampler2D
    transform: mustGetUniform('transform'), // mat4
    perspective: mustGetUniform('perspective'), // mat4
    nowhere: mustGetUniform('nowhere'), // vec4
    stride: mustGetUniform('stride'), // uint
  };

  const attr = {
    spin: mustGetAttr('spin'), // float
    size: mustGetAttr('size'), // float
    layerID: mustGetAttr('layerID'), // int
  };

  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  /** @type {TileSheet<unknown>[]} */
  const sheets = [];

  /** @type {{dims: FacetDims, layers: Layer[]}[]} */
  const facets = [];

  build({
    makeTileSheet(tiles) {
      const tileSheet = makeTileSheet(gl, tiles, { tileSize });
      sheets.push(tileSheet);
      return tileSheet;
    },

    makeFacet(dims) {
      /** @type {Layer[]} */
      const layers = [];
      facets.push({ dims, layers });
      return {
        makeLayer({ texture }, offset = { x: 0, y: 0 }) {
          const { x, y, width, height } = dims;
          const layer = makeLayer(gl, {
            texture,
            left: x + offset.x,
            top: y + offset.y,
            width, height
          });
          layers.push(layer);
          return layer;
        },
      };
    },
  });

  const perspective = mat4.identity(new Float32Array(16));

  /** @returns {Promise<number>} */
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(t => resolve(t)))
  for (
    let t = await nextFrame(), lastT = t; ;
    lastT = t, t = await nextFrame()
  ) {
    // @ts-ignore
    const dt = lastT - t; // TODO animate things and un-ignore

    /** @type {WeakMap<object, number>} */
    let textureUnits = new WeakMap();
    let nextTextureUnit = 0;

    /** @param {Layer} layer */
    const textureUnitFor = layer => {
      let unit = textureUnits.get(layer.texture);
      if (unit === undefined) {
        unit = nextTextureUnit++;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, layer.texture);
      }
      return unit;
    };

    /// update global uniforms
    const { width, height } = $world;
    const perspLeft = 0, perspTop = 0, perspRight = width, perspBottom = height;
    mat4.ortho(perspective,
      perspLeft,
      perspRight,
      perspBottom,
      perspTop,
      0, Number.EPSILON);

    gl.uniformMatrix4fv(uni.perspective, false, perspective);

    // NOTE: this just needs to be set to any point outside of camera view, so
    // that the vertex shader can use it to cull points
    gl.uniform4f(uni.nowhere, -1, -1, -1, 0);

    gl.viewport(0, 0, width, height);

    /// per frame drawing pass
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.vertexAttrib1f(attr.size, cellSize);

    // TODO at some point, it'll be worth it to cull layers that don't
    // intersect perspective, but for now we just use leave GL's vertex culling

    const transform = new Float32Array(16);
    for (const { layers } of facets) {
      for (const layer of layers) {
        if (!layer.visible) continue;

        const { top, left, width, length, indexType } = layer;
        const tex = textureUnitFor(layer);

        mat4.fromTranslation(transform, [cellSize * left, cellSize * top, 0]);
        gl.uniformMatrix4fv(uni.transform, false, transform);

        gl.uniform1i(uni.sheet, tex);
        gl.uniform1i(uni.stride, width);

        layer.bindVertexAttribs(attr);
        gl.drawElements(gl.POINTS, length, indexType, 0);
      }
    }
  }

}

/** @param {tileSpec[]} tiles */
export function* generateSimpleTiles(...tiles) {
  // TODO hoist this out and spread over multiple sheets if necessary

  let id = 0;
  for (const {
    glyph,
    glyphStyle = 'black',
    glyphHeight = 0.9,
    glyphFont = 'sans',
    fill,
    border,
  } of tiles) yield {
    id: id++,
    /** @param {OffscreenCanvasRenderingContext2D} ctx */
    draw(ctx) {
      const tileSize = ctx.canvas.width;

      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, tileSize, tileSize);
      }

      if (border) {
        const { size, style } = border;
        ctx.lineWidth = size;
        ctx.strokeStyle = style;
        ctx.strokeRect(size / 2, size / 2, tileSize - size, tileSize - size);
      }

      if (glyph) {
        ctx.textBaseline = 'bottom';

        const fontSize = tileSize * glyphHeight;
        for (let adjust = 0; adjust <= fontSize; adjust++) {
          if (adjust == fontSize)
            throw new Error(`unable to find a usable font adjustment for fontSize:${fontSize}`);
          ctx.font = `${fontSize - adjust}px ${glyphFont}`;

          const {
            actualBoundingBoxLeft,
            actualBoundingBoxRight,
            actualBoundingBoxDescent,
            actualBoundingBoxAscent,
          } = ctx.measureText(glyph),
            actualWidth = Math.abs(actualBoundingBoxLeft) + Math.abs(actualBoundingBoxRight),
            actualHeight = Math.abs(actualBoundingBoxAscent) + Math.abs(actualBoundingBoxDescent);

          if (actualHeight < fontSize && actualWidth < fontSize) break;
        }

        const {
          actualBoundingBoxLeft,
          actualBoundingBoxRight,
          actualBoundingBoxDescent,
          actualBoundingBoxAscent,
        } = ctx.measureText(glyph),
          actualWidth = Math.abs(actualBoundingBoxLeft) + Math.abs(actualBoundingBoxRight),
          actualHeight = Math.abs(actualBoundingBoxAscent) + Math.abs(actualBoundingBoxDescent),
          widthRem = tileSize - actualWidth,
          heightRem = tileSize - actualHeight;

        ctx.fillStyle = glyphStyle;
        ctx.fillText(glyph, Math.floor(widthRem / 2), tileSize - Math.floor(heightRem / 2));
      }

    }
  };
}

/** @param {HTMLCanvasElement} $canvas */
function sizeToParent($canvas, update = () => { }) {
  const $cont = $canvas.parentElement;
  if ($cont) {
    const resize = () => {
      const { clientWidth, clientHeight, } = $cont;
      $canvas.width = clientWidth;
      $canvas.height = clientHeight;
      update();
    };
    $cont.ownerDocument.defaultView?.addEventListener('resize', () => resize());
    resize();
  }
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
function makeTileSheet(gl, tiles, {
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

/** Generates 16 curved-tile drawback with 4-bit numeric ids from 0b0000 to 0b1111.
 *
 * These tile are suitable to be centered on the corner vertices of a binary
 * square grid (e.g. land and water tiles).
 *
 * Each bit encodes whether a B tile is present or an A tile is present at the
 * corner of the corresponding curved tile, proceeding clockwise from NW from
 * the high bit e.g.:
 * - 0b0000 is solid A tiles ; 0b1111 is solid B tiles
 * - 0b1000 is a NW B corner tile
 * - 0b0110 is a half tile with B East and A West
 *
 * @param {object} params
 * @param {string} params.aFill
 * @param {string} params.bFill
 * @param {string} [params.gridLineStyle]
 */
export function* generateCurvedTiles({
  aFill,
  bFill,
  gridLineStyle = '',
}) {
  /** @typedef {{x: number, y: number}} point */

  /** @type {drawback} */
  const border = ctx => {
    if (gridLineStyle) {
      const tileSize = ctx.canvas.width;
      ctx.lineWidth = 2;
      ctx.strokeStyle = gridLineStyle;
      ctx.strokeRect(0, 0, tileSize, tileSize);
    }
  };

  /** @param {string} fill @returns {drawback} */
  const full = fill => ctx => {
    const tileSize = ctx.canvas.width;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, tileSize, tileSize);
    border(ctx);
  };

  /** @param {string} fillA @param {string} fillB
   * @returns {drawback} */
  const hSplit = (fillA, fillB) => ctx => {
    const tileSize = ctx.canvas.width;
    ctx.fillStyle = fillA;
    ctx.fillRect(0, 0, tileSize, tileSize / 2);
    ctx.fillStyle = fillB;
    ctx.fillRect(0, tileSize / 2, tileSize, tileSize / 2);
    border(ctx);
  };

  /** @param {string} fillA @param {string} fillB
   * @returns {drawback} */
  const vSplit = (fillA, fillB) => ctx => {
    const tileSize = ctx.canvas.width;
    ctx.fillStyle = fillA;
    ctx.fillRect(0, 0, tileSize / 2, tileSize);
    ctx.fillStyle = fillB;
    ctx.fillRect(tileSize / 2, 0, tileSize / 2, tileSize);
    border(ctx);
  };

  /** @param {string} fillA @param {string} fillB @param {point[]} coords
   * @returns {drawback} */
  const corner = (fillA, fillB, ...coords) => ctx => {
    const tileSize = ctx.canvas.width;
    ctx.fillStyle = fillA;
    ctx.fillRect(0, 0, tileSize, tileSize);
    ctx.fillStyle = fillB;
    for (const { x, y } of coords)
      ctx.ellipse(x * tileSize, y * tileSize, tileSize / 2, tileSize / 2, 0, 0, 2 * Math.PI);
    ctx.fill();
    border(ctx);
  };

  // /** @param {string} fillA @param {string} fillB @param {point[]} coords
  //  * @returns {drawback} */
  // const notCorner = (fillA, fillB, ...coords) => ctx => {
  //   const tileSize = ctx.canvas.width;
  //   ctx.fillStyle = fillA;
  //   ctx.fillRect(0, 0, tileSize, tileSize);
  //   ctx.fillStyle = fillB;
  //   ctx.ellipse(tileSize / 2, tileSize / 2, tileSize / 2, tileSize / 2, 0, 0, 2 * Math.PI);
  //   for (const { x, y } of coords)
  //     ctx.rect((x - 0.5) * tileSize, (y - 0.5) * tileSize, tileSize, tileSize);
  //   ctx.fill();
  //   border(ctx);
  // };

  // solid cases
  yield { id: 0b0000, draw: full(aFill) };
  yield { id: 0b1111, draw: full(bFill) };

  // horizontal - split
  yield { id: 0b1100, draw: hSplit(bFill, aFill) };
  yield { id: 0b0011, draw: hSplit(aFill, bFill) };

  // vertical | split
  yield { id: 0b0110, draw: vSplit(aFill, bFill) };
  yield { id: 0b1001, draw: vSplit(bFill, aFill) };

  // sw corner
  // yield {id: 0b0001, draw: notCorner(water, land, {x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: 1})};
  yield { id: 0b0001, draw: corner(aFill, bFill, { x: 0, y: 1 }) };
  yield { id: 0b1110, draw: corner(bFill, aFill, { x: 0, y: 1 }) };

  // se corner
  // yield {id: 0b0010, draw: notCorner(water, land, {x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 0})};
  yield { id: 0b0010, draw: corner(aFill, bFill, { x: 1, y: 1 }) };
  yield { id: 0b1101, draw: corner(bFill, aFill, { x: 1, y: 1 }) };

  // ne corner
  // yield {id: 0b0100, draw: notCorner(water, land, {x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1})};
  yield { id: 0b0100, draw: corner(aFill, bFill, { x: 1, y: 0 }) };
  yield { id: 0b1011, draw: corner(bFill, aFill, { x: 1, y: 0 }) };

  // nw corner
  // yield {id: 0b1000, draw: notCorner(water, land, {x: 0, y: 1}, {x: 1, y: 0}, {x: 1, y: 1})};
  yield { id: 0b1000, draw: corner(aFill, bFill, { x: 0, y: 0 }) };
  yield { id: 0b0111, draw: corner(bFill, aFill, { x: 0, y: 0 }) };

  // sw / ne diagonal
  // yield {id: 0b0101, draw: notCorner(water, land, {x: 0, y: 0}, {x: 1, y: 1})};
  yield { id: 0b0101, draw: corner(aFill, bFill, { x: 0, y: 1 }, { x: 1, y: 0 }) };

  // se \ nw diagonal
  // yield {id: 0b1010, draw: notCorner(water, land, {x: 0, y: 1}, {x: 1, y: 0})};
  yield { id: 0b1010, draw: corner(aFill, bFill, { x: 0, y: 0 }, { x: 1, y: 1 }) };
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {object} params
 * @param {WebGLTexture} params.texture
 * @param {number} [params.left]
 * @param {number} [params.top]
 * @param {number} params.width
 * @param {number} params.height
 */
function makeLayer(gl, {
  texture,
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
  const indexBuffer = gl.createBuffer();
  const spinBuffer = gl.createBuffer();
  const tileBuffer = gl.createBuffer();

  const cap = width * height;
  const spinData = new Float32Array(cap);
  const tileData = new Uint16Array(cap);
  const index = makeElementIndex(cap <= 256 ? new Uint8Array(cap) : new Uint16Array(cap));

  return {
    visible: true,

    get texture() { return texture },

    get left() { return left },
    get top() { return top },
    get width() { return width },
    get height() { return height },

    get length() { return index.length },

    get indexType() {
      const bytes = index.elementByteSize;
      if (bytes == 1)
        return gl.UNSIGNED_BYTE;
      if (bytes == 2)
        return gl.UNSIGNED_SHORT;
      if (bytes == 4 && gl.getExtension('OES_element_index_uint'))
        return gl.UNSIGNED_INT;
      throw new Error(`unsupported index.elementByteSize: ${bytes}`);
    },

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

    send() {
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, spinData, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index.buffer, gl.STATIC_DRAW);
    },

    /** @param {object} attr
     * @param {number} attr.spin
     * @param {number} attr.layerID
     */
    bindVertexAttribs(attr) {
      gl.enableVertexAttribArray(attr.spin);
      gl.bindBuffer(gl.ARRAY_BUFFER, spinBuffer);
      gl.vertexAttribPointer(attr.spin, 1, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(attr.layerID);
      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.vertexAttribIPointer(attr.layerID, 1, gl.UNSIGNED_SHORT, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    },

  };
}

/** @param {Uint8Array | Uint16Array | Uint32Array} elements */
export function makeElementIndex(elements) {
  let length = 0;

  /** @param {number} id */
  function find(id) {
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

    get elementByteSize() { return elements.BYTES_PER_ELEMENT },
    get buffer() { return elements.buffer },
    get length() { return length },

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

/** @typedef {ReturnType<makeLayer>} Layer */

/**
 * @param {string} src
 * @param {string} mess
 */
function annotateCompileError(src, mess) {
  var match = /^ERROR: \d+:(\d+):/.exec(mess);
  if (!match) {
    return mess;
  }
  const lineNo = parseInt(match[1] || '');
  const contextCount = 3;

  const lines = src.split(/\n/);
  const numLines = lines.length;
  const w = numLines.toString().length;

  return [...annotateLine(
    numberLines(w, lines),
    lineNo, contextCount,
    `${' '.repeat(w)} ^ --${mess} `
  )].join('\n');
}

/**
 * @param {number} w
 * @param {Iterable<string>} lines
 */
function* numberLines(w, lines) {
  let n = 0;
  for (const line of lines) {
    n++;
    yield `${n.toString().padStart(w)}: ${line} `;
  }
}

/**
 * @param {Iterable<string>} lines
 * @param {number} lineNo
 * @param {number} contextCount
 * @param {string} mess
 */
function* annotateLine(lines, lineNo, contextCount, mess) {
  let n = 0;
  for (const line of lines) {
    n++;
    if (Math.abs(lineNo - n) <= contextCount) {
      yield line;
    }
    if (n === lineNo) {
      yield mess;
    }
  }
}
