// @ts-check

import { mat4 } from 'gl-matrix';
import { vec2 } from 'gl-matrix';

import {
  compileProgram,
  makeUniformBlock,
  makeDataFrame,
} from './glkit.js';
/** @typedef {import('./glkit.js').ArraySpecMap} ArraySpecMap */
/** @template {ArraySpecMap} T @typedef {import('./glkit.js').arrayProps<T>} arrayProps */

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
  const animParamsBlock = makeUniformBlock(gl, prog, 'AnimParams', 1);
  const layerParamsBlock = makeUniformBlock(gl, prog, 'LayerParams', 2);

  viewParamsBlock.link(prog);
  animParamsBlock.link(prog);
  layerParamsBlock.link(prog);

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

  const indexSpec = {
    ArrayType: Uint16Array, // TODO bring back varying type
    size: 1,
    clear: null, // implemented directly using delElement
    gl: {
      elements: true,
    },
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
    size: 2,
    gl: {
      attrib: mustGetAttr('layerID'), // int
      asInt: true,
    },
  };

  // TODO better to combine posTo / anim into a struct array?
  const attrPosToSpec = {
    ArrayType: Float32Array,
    size: 4,
    gl: {
      attrib: mustGetAttr('posTo'), // vec4: xy=offset, z=spin, w=scale
    },
  };

  const attrAnimSpec = {
    ArrayType: Float32Array,
    size: 3,
    gl: {
      attrib: mustGetAttr('anim'), // vec3: x=start_time, y=duration, z=mode
    },
  };

  const uniSheet = mustGetUniform('sheet'); // sampler2D

  const texCache = makeTextureUnitCache(gl, gl.TEXTURE_2D_ARRAY);

  const noAnim = animParamsBlock.makeBuffer();
  noAnim.send();

  const tileRend = {
    texCache, // TODO reconsider

    /**
     * @param {object} params
     * @param {number} params.cellSize
     * @param {AnimClock} [params.animClock]
     * @param {number} [params.defaultAnimDuration]
     */
    makeView(params) {
      const viewParams = viewParamsBlock.makeBuffer();
      const perspective = viewParams.getVar('perspective').asFloatArray();
      const nowhere = viewParams.getVar('nowhere').asFloatArray();
      const cellSize = viewParams.getVar('viewCellSize');
      cellSize.float = params.cellSize;
      const inverse = mat4.create();

      mat4.identity(perspective);

      // NOTE: this just needs to be set to any point outside of camera view, so
      // that the vertex shader can use it to cull points
      nowhere.set([-1, -1, -1, 0]);

      /** @typedef {object} Pan
       * @prop {vec2} from
       * @prop {vec2} to
       * @prop {number} start
       * @prop {number} duration
       */

      let
        {
          defaultAnimDuration = 200,
          animClock = null,
        } = params,

        left = 0,
        top = 0,
        clientWidth = gl.drawingBufferWidth,
        clientHeight = gl.drawingBufferHeight,
        dirty = true,

        /** @type {null|Pan} */
        pan = null;

      const update = () => {
        const
          right = left + clientWidth,
          bottom = top + clientHeight;
        mat4.ortho(perspective,
          left, right,
          bottom, top,
          0, Number.EPSILON);
        mat4.invert(inverse, perspective);
        dirty = true;
      };

      const animate = () => {
        if (!animClock) return;

        if (pan) {
          const
            { time } = animClock,
            { from, to, start, duration } = pan,
            p = (time - start) / duration;
          [left, top] = p >= 1 ? to : vec2.lerp([left, top], from, to, p);
          if (p >= 1) pan = null;
        }

        // TODO if (zoom)
      };

      const view = {
        get animClock() {
          if (!animClock) throw new Error('view has no AnimClock set');
          return animClock;
        },
        set animClock(ac) { animClock = ac },

        update() {
          clientWidth = gl.drawingBufferWidth;
          clientHeight = gl.drawingBufferHeight;
          animate();
          update();
        },

        /** @return {[x: number, y: number]} */
        get origin() { return [left, top] },
        set origin([x, y]) {
          if (left != x || top != y) {
            left = x, top = y;
            update();
          }
        },

        /** @return {[x: number, y: number]} */
        get cellOrigin() {
          const size = cellSize.float;
          return [left / size, top / size];
        },
        set cellOrigin([cellX, cellY]) {
          const size = cellSize.float,
            x = cellX * size, y = cellY * size;
          if (left != x || top != y) {
            left = x, top = y;
            update();
          }
        },

        /** @return {[x: number, y: number]} */
        get cellOriginTo() {
          const size = cellSize.float;
          const [x, y] = pan ? pan.to : [left, top];
          return [x / size, y / size];
        },

        /** @return {[w: number, h: number]} */
        get clientSize() { return [clientWidth, clientHeight] },
        set clientSize([w, h]) {
          if (clientWidth != w || clientHeight != h) {
            clientWidth = w, clientHeight = h;
            update();
          }
        },

        get cellSize() { return cellSize.float },
        set cellSize(size) {
          const origin = view.cellOrigin;
          cellSize.float = size;
          view.cellOrigin = origin;
        },

        /** @param {vec2} cellXY */
        containsCell([cx, cy]) {
          const
            size = cellSize.float,
            cellLeft = Math.ceil(left / size),
            cellTop = Math.ceil(top / size),
            cellWidth = Math.floor(clientWidth / size),
            cellHeight = Math.floor(clientHeight / size),
            cellRight = cellLeft + cellWidth,
            cellBottom = cellTop + cellHeight;
          return (
            cx >= cellLeft &&
            cx < cellRight &&
            cy >= cellTop &&
            cy < cellBottom
          );
        },

        /**
         * @param {vec2} by
         * @param {number} [duration]
         */
        panBy(by, duration = defaultAnimDuration) {
          const [dx, dy] = by, { origin: [x, y] } = view
          view.panTo([x + dx, y + dy], duration);
        },

        /**
         * @param {vec2} by
         * @param {number} [duration]
         */
        panByCell(by, duration = defaultAnimDuration) {
          const [dx, dy] = by, { origin: [x, y], cellSize: size } = view
          view.panTo([x + dx * size, y + dy * size], duration);
        },

        /**
         * @param {vec2} to
         * @param {number} [duration]
         */
        panTo(to, duration = defaultAnimDuration) {
          const [x, y] = to;

          if (!animClock) {
            if (left != x || top != y) {
              left = x, top = y;
              update();
            }
            return;
          }

          pan = {
            from: [left, top],
            to: [x, y],
            start: animClock.time,
            duration,
          };
        },

        /**
         * @param {vec2} point
         * @param {object} [params]
         * @param {vec2} [params.margin]
         * @param {vec2} [params.boundLower]
         * @param {vec2} [params.boundUpper]
         * @param {number} [params.duration]
         */
        panToInclude(point, {
          margin = [1, 1],
          boundLower,
          boundUpper,
          duration = defaultAnimDuration,
        } = {}) {
          const
            viewLeft = left,
            viewTop = top,

            size = cellSize.float,
            cellLeft = Math.ceil(viewLeft / size),
            cellTop = Math.ceil(viewTop / size),
            cellWidth = Math.floor(clientWidth / size),
            cellHeight = Math.floor(clientHeight / size),
            cellRight = cellLeft + cellWidth,
            cellBottom = cellTop + cellHeight,

            marginX = Math.max(1, Math.min(Math.floor(cellWidth / 2) - 1, margin[0])),
            marginY = Math.max(1, Math.min(Math.floor(cellHeight / 2) - 1, margin[1])),

            borderLeft = cellLeft + marginX,
            borderRight = cellRight - marginX,
            borderTop = cellTop + marginY,
            borderBottom = cellBottom - marginY,

            [x, y] = point;

          let dx = 0, dy = 0;

          if (x < borderLeft) dx = x - borderLeft;
          else if (x + 1 > borderRight) dx = x + 1 - borderRight;

          if (y < borderTop) dy = y - borderTop;
          else if (y + 1 > borderBottom) dy = y + 1 - borderBottom;

          if (boundLower) {
            dx = Math.max(dx, boundLower[0] - marginX + 1 - cellLeft);
            dy = Math.max(dy, boundLower[1] - marginX + 1 - cellTop);
          }

          if (boundUpper) {
            dx = Math.min(dx, boundUpper[0] - marginX + 1 - cellRight);
            dy = Math.min(dy, boundUpper[1] - marginX + 1 - cellBottom);
          }

          view.panTo([viewLeft + dx * size, viewTop + dy * size], duration);
        },

        // TODO zoomTo(size, duration)

        /** @param {() => void} fn */
        with(fn) {
          gl.useProgram(prog);
          if (dirty) {
            viewParams.send();
            dirty = false;
          }
          viewParams.bind();
          noAnim.bind();
          fn();
          gl.useProgram(null);
        },

        /** NOTE clientXY counts down from top, not up from bottom
         *
         * @param {number} cellX
         * @param {number} cellY
         * @returns {[clientX: number, clientY: number]}
         */
        project(cellX, cellY) {
          const
            size = cellSize.float,
            viewX = cellX * size,
            viewY = cellY * size,
            [clipX, clipY] = vec2.transformMat4([0, 0], [viewX, viewY], perspective),
            clientX = (clipX + 1.0) * clientWidth / 2.0,
            clientY = (1.0 - clipY) * clientHeight / 2.0;
          return [clientX, clientY];
        },

        /** NOTE clientXY counts down from top, not up from bottom
         *
         * @param {number} cellX
         * @param {number} cellY
         * @param {number} cellWidth
         * @param {number} cellHeight
         * @returns {[clientX: number, clientY: number, clientW: number, clientH: number]}
         */
        projectRect(cellX, cellY, cellWidth, cellHeight) {
          const
            size = cellSize.float,
            viewX = cellX * size,
            viewY = cellY * size,
            viewW = cellWidth * size,
            viewH = cellHeight * size,
            [clipX, clipY] = vec2.transformMat4([0, 0], [viewX, viewY], perspective),
            clientX = (clipX + 1.0) * clientWidth / 2.0,
            clientY = (1.0 - clipY) * clientHeight / 2.0;
          return [clientX, clientY, viewW, viewH];
        },

        /**
         * @param {number} clientX
         * @param {number} clientY
         * @returns {[cellX: number, cellY: number]}
         */
        reverseProject(clientX, clientY) {
          const
            size = cellSize.float,
            clipX = 2.0 * clientX / clientWidth - 1.0,
            clipY = 1.0 - 2.0 * clientY / clientHeight,
            [viewX, viewY] = vec2.transformMat4([0, 0], [clipX, clipY], inverse),
            cellX = viewX / size,
            cellY = viewY / size;
          return [cellX, cellY];
        },

      };

      return view;
    },

    makeAnimClock() {
      const animParams = animParamsBlock.makeBuffer();
      const animEnabled = animParams.getVar('anim_enabled');
      const animTime = animParams.getVar('anim_time');

      animEnabled.bool = true;
      let dirty = true;

      let lastExternalTime = NaN;

      /** @typedef {object} After
       * @prop {number} time
       * @prop {(now: number) => void} then
       */

      /** @type {After[]} */
      const afters = [];

      /** @param {number} dt */
      const advance = dt => {
        const now = animTime.float + dt;
        animTime.float = now;
        dirty = true;
        while (afters.length > 0 && now > afters[0].time)
          afters.shift()?.then(now);
      };

      /** @type {AnimClock} */
      const clock = {
        bind() {
          if (dirty) {
            animParams.send();
            dirty = false;
          }
          animParams.bind();
        },
        unbind() { noAnim.bind() },

        get enabled() { return animEnabled.bool },
        set enabled(b) { animEnabled.bool = b, dirty = true },

        get time() { return animTime.float },

        reset() {
          lastExternalTime = NaN;
          animTime.float = 0;
        },

        pause() { lastExternalTime = NaN },

        update(externalTime) {
          if (isNaN(lastExternalTime))
            lastExternalTime = externalTime;
          else if (externalTime > lastExternalTime) {
            advance(externalTime - lastExternalTime);
            lastExternalTime = externalTime;
          }
        },

        afterDuration(dt) {
          return clock.afterTime(animTime.float + dt);
        },

        afterTime(time) {
          const i = search(afters.length, i => afters[i].time > time);
          return new Promise(then => afters.splice(i, 0, { time, then }));
        },

      };
      return clock;
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

    /** Creates a minimal base tile layer.
     * Caller is fully responsible for sending data to the layer buffers.
     * Primarly intended to be used internally to implement specific layer data schemes.
     *
     * When stride is non-zero, each tile has an implicit x/y position relative to left/top.
     *
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} [params.cellSize]
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
          cellSize: size = 0,
          left = 0, top = 0,
        } = params;

        cellSize.float = size;
        mat4.fromTranslation(transform, [left, top, 0]);
      }

      let { texture } = params;

      return {
        deleteBuffers() {
          layerParams.delete();
        },

        get texture() { return texture },
        set texture(tex) { texture = tex },

        get cellSize() { return cellSize.float },
        set cellSize(size) {
          cellSize.float = size;
          paramsDirty = true;
        },

        get stride() { return stride.int },
        set stride(w) {
          if (w != stride.int) {
            stride.int = w;
            paramsDirty = true;
          }
        },

        /** @returns {[x: number, y: number]} */
        get origin() {
          return /** @type {[x: number, y: number]} */ (
            vec2.transformMat4([0, 0], [0, 0], transform));
        },
        set origin([x, y]) {
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

    // TODO would be nice to share code between layer variant implementations, especially record accessors

    /**
     * Creates a dense cellular tile layer,
     * where tiles are implicitly positioned along a dense grid from layer origin,
     * suppoting at most 1 tile per cell,
     * and fast constant time "tiles at location" query.
     * Does not support animation.
     *
     * @template {ArraySpecMap} UserData
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} [params.cellSize]
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} params.width
     * @param {number} params.height
     * @param {UserData} [params.userData]
     */
    makeStaticLayer({
      width, height,
      userData,
      ...params
    }) {
      if (userData)
        for (const dim of ['pos', 'tile', 'used', 'index'])
          if (dim in userData)
            throw new Error(`userData may not specify "${dim}"`);

      const layer = this.makeLayer({ stride: width, ...params });
      const data = makeDataFrame(gl, {
        ...userData,
        pos: attrPosSpec,
        tile: attrTileSpec,
      }, width * height);

      /** @param {number} index */
      const ref = index => ({
        get id() { return index + 1 },
        get index() { return index },

        /** @returns {[x: number, y: number]} */
        get xy() {
          const x = index % width, y = (index - x) / width;
          return [x, y];
        },

        /** Reset all tile data to 0 values */
        clear() {
          data.recordClear(index);
          data.dirty = true;
        },

        /** Tile XY offset from cell center
         * @returns {[x: number, y: number]} */
        get offset() {
          return [
            data.array.pos[4 * index + 0],
            data.array.pos[4 * index + 1],
          ];
        },
        set offset([ox, oy]) {
          data.array.pos[4 * index + 0] = ox;
          data.array.pos[4 * index + 1] = oy;
          data.dirty = true;
        },

        /** Tile rotation in units of full turns */
        get spin() { return data.array.pos[4 * index + 2] },
        set spin(turns) {
          data.array.pos[4 * index + 2] = turns;
          data.dirty = true;
        },

        /** Tile scale factor */
        get scale() { return data.array.pos[4 * index + 3] },
        set scale(factor) {
          data.array.pos[4 * index + 3] = factor;
          data.dirty = true;
        },

        /** Tile texture Z index.
         *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
        get layerID() { return data.array.tile[2 * index] },
        /** Setting a value of 0, the default, will cause this tile to not be drawn.
         * When initializing (setting to non-zero when prior value was 0),
         * a default 1.0 scale value will also be set if scale was 0. */
        set layerID(layerID) {
          const init = layerID != 0 && data.array.tile[2 * index] == 0;
          data.array.tile[2 * index] = layerID;
          if (init && data.array.pos[4 * index + 3] == 0) data.array.pos[4 * index + 3] = 1;
          data.dirty = true;
        },
      });

      const self = {
        deleteBuffers() {
          layer.deleteBuffers();
          data.deleteBuffers();
        },

        get width() { return width },
        get height() { return height },

        /** @param {number} w @param {number} h */
        resize(w, h) {
          data.resize(w * h, false);
          layer.stride = w;
          width = w, height = h;
        },

        /** @param {number} x @param {number} y */
        contains(x, y) {
          const [left, top] = layer.origin;
          if (x < left) return false;
          if (y < top) return false;
          if (x >= left + width) return false;
          if (y >= top + height) return false;
          return true;
        },

        /** Returns a cell reference given cell absolute x/y position,
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        absAt(x, y) {
          const [left, top] = layer.origin;
          return self.at(x - left, y - top)
        },

        /** Returns a cell reference given cell x/y offsets (relative to left/top),
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        at(x, y) {
          if (x < 0 || y < 0 || x >= width || y >= height) return null;
          const index = Math.floor(y) * width + Math.floor(x);
          return ref(index);
        },

        // TODO better to passProperties(self, data. 'clear') ?
        clear() { data.clear() },

        draw() {
          layer.bind();
          data.drawArrays(gl.POINTS);
        },

        get array() {
          return /** @type {typeof data["array"] & arrayProps<UserData>} */ (data.array)
        },

      };

      return passProperties(self,
        layer, 'texture', 'cellSize', 'origin',
      );
    },

    /**
     * Creates a dense cellular tile layer,
     * where tiles are implicitly positioned along a dense grid from layer origin,
     * suppoting at most 1 tile per cell,
     * and fast constant time "tiles at location" query.
     *
     * @template {ArraySpecMap} UserData
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {number} [params.cellSize]
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} params.width
     * @param {number} params.height
     * @param {UserData} [params.userData]
     */
    makeDenseLayer({
      width, height,
      userData,
      ...params
    }) {
      if (userData)
        for (const dim of ['pos', 'tile', 'used', 'index'])
          if (dim in userData)
            throw new Error(`userData may not specify "${dim}"`);

      const layer = this.makeLayer({ stride: width, ...params });
      const data = makeDataFrame(gl, {
        ...userData,
        index: indexSpec,
        pos: attrPosSpec,
        tile: attrTileSpec,
        anim: attrAnimSpec,
        posTo: attrPosToSpec,
      }, width * height);

      /** @param {number} index */
      const ref = index => ({
        get id() { return index + 1 },
        get index() { return index },

        /** @returns {[x: number, y: number]} */
        get xy() {
          const x = index % width, y = (index - x) / width;
          return [x, y];
        },

        /** Reset all tile data to 0 values */
        clear() {
          data.recordClear(index);
          data.delElement(index);
          data.dirty = true;
        },

        /** Tile XY offset from cell center
         * @returns {[x: number, y: number]} */
        get offset() {
          return [
            data.array.pos[4 * index + 0],
            data.array.pos[4 * index + 1],
          ];
        },
        set offset([ox, oy]) {
          data.array.pos[4 * index + 0] = ox;
          data.array.pos[4 * index + 1] = oy;
          data.dirty = true;
        },

        /** Tile rotation in units of full turns */
        get spin() { return data.array.pos[4 * index + 2] },
        set spin(turns) {
          data.array.pos[4 * index + 2] = turns;
          data.dirty = true;
        },

        /** Tile scale factor */
        get scale() { return data.array.pos[4 * index + 3] },
        set scale(factor) {
          data.array.pos[4 * index + 3] = factor;
          data.dirty = true;
        },

        /** Tile texture Z index.
         *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
        get layerID() { return data.array.tile[2 * index] },
        /** Setting a value of 0, the default, will cause this tile to not be drawn.
         * When initializing (setting to non-zero when prior value was 0),
         * a default 1.0 scale value will also be set if scale was 0. */
        set layerID(layerID) {
          const init = layerID != 0 && data.array.tile[2 * index] == 0;
          data.array.tile[2 * index] = layerID;
          if (init && data.array.pos[4 * index + 3] == 0) data.array.pos[4 * index + 3] = 1;
          if (layerID === 0) data.delElement(index); else data.addElement(index);
          data.dirty = true;
        },

        /** Tile animation start time under an AnimTimer */
        get animStart() { return data.array.anim[3 * index + 0] },
        set animStart(time) {
          data.array.anim[3 * index + 0] = time;
          data.dirty = true;
        },

        /** Tile animation duration under an AnimTimer */
        get animDuration() { return data.array.anim[3 * index + 1] },

        /** Setting to 0 disables this tile's animation,
         *  and resets animStart=0 and animMode='once'.
         *
         *  Setting to non-0 when previsouly 0 enables this tile's animation,
         *  and copies default offset/spin/scale-to data from normal offset/spin/scale.
         */
        set animDuration(duration) {
          const prior = data.array.anim[3 * index + 1];
          data.array.anim[3 * index + 1] = duration;
          if (duration == 0) {
            data.array.anim.set([0, 0, 0], 3 * index);
            data.array.posTo.set([0, 0, 0, 0], 4 * index);
            data.array.tile[2 * index + 1] = 0;
          } else if (prior == 0) {
            const pos = data.array.pos.subarray(4 * index, 4 * index + 4);
            data.array.posTo.set(pos, 4 * index);
            data.array.tile[2 * index + 1] = data.array.tile[2 * index];
          }
          data.dirty = true;
        },

        /** Tile animation mode, defaults to "once".
         *
         * Animation progress is:
         *     p = (time - animStart) / animDuration
         * In other words:
         * * starts after animStart time
         * * normalized by animDuration
         *
         * The "once" mode of animation stop after p=1.0,
         * while "loop" continues indefinitely,
         * repeating the same from -> to animation again and again.
         *
         * Simmilarly the "loopback" mode continues indefinetly, but swaps from/to data directionality each time like:
         * * [0.0, 1.0] from -> to
         * * [1.0, 2.0] to -> from
         * * [2.0, 3.0] from -> to
         * * ... and so on
         */
        get animMode() {
          const animCode = data.array.anim[3 * index + 2];
          switch (animCode) {
            case 0: return 'once';
            case 1: return 'loop';
            case 2: return 'loopback';
            default: return 'invalid';
          }
        },

        set animMode(mode) {
          switch (mode) {
            case 'once':
              data.array.anim[3 * index + 2] = 0;
              break;
            case 'loop':
              data.array.anim[3 * index + 2] = 1;
              break;
            case 'loopback':
              data.array.anim[3 * index + 2] = 2;
              break;
            default: throw new Error('invalid animMode');
          }
          data.dirty = true;
        },

        get offsetTo() {
          return [
            data.array.posTo[4 * index + 0],
            data.array.posTo[4 * index + 1],
          ];
        },
        set offsetTo([ox, oy]) {
          data.array.posTo[4 * index + 0] = ox;
          data.array.posTo[4 * index + 1] = oy;
          data.dirty = true;
        },

        get spinTo() { return data.array.posTo[4 * index + 2] },
        set spinTo(turns) {
          data.array.posTo[4 * index + 2] = turns;
          data.dirty = true;
        },

        get scaleTo() { return data.array.posTo[4 * index + 3] },
        set scaleTo(factor) {
          data.array.posTo[4 * index + 3] = factor;
          data.dirty = true;
        },

        get layerIDTo() { return data.array.tile[2 * index + 1] },
        set layerIDTo(layerID) {
          data.array.tile[2 * index + 1] = layerID;
          data.dirty = true;
        },
      });

      const self = {
        deleteBuffers() {
          layer.deleteBuffers();
          data.deleteBuffers();
        },

        get width() { return width },
        get height() { return height },

        /** @param {number} w @param {number} h */
        resize(w, h) {
          data.resize(w * h, false);
          layer.stride = w;
          width = w, height = h;
        },

        /** @param {number} x @param {number} y */
        contains(x, y) {
          const [left, top] = layer.origin;
          if (x < left) return false;
          if (y < top) return false;
          if (x >= left + width) return false;
          if (y >= top + height) return false;
          return true;
        },

        /** Returns a cell reference given cell absolute x/y position,
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        absAt(x, y) {
          const [left, top] = layer.origin;
          return self.at(x - left, y - top)
        },

        /** Returns a cell reference given cell x/y offsets (relative to left/top),
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        at(x, y) {
          if (x < 0 || y < 0 || x >= width || y >= height) return null;
          const index = Math.floor(y) * width + Math.floor(x);
          return ref(index);
        },

        // TODO better to passProperties(self, data. 'clear') ?
        clear() { data.clear() },

        draw() {
          layer.bind();
          data.drawElements(gl.POINTS);
        },

        get array() {
          return /** @type {typeof data["array"] & arrayProps<UserData>} */ (data.array)
        },

      };

      return passProperties(self,
        layer, 'texture', 'cellSize', 'origin',
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
     * @template {ArraySpecMap} UserData
     * @param {object} params
     * @param {WebGLTexture} params.texture
     * @param {AnimClock} [params.animClock]
     * @param {number} [params.cellSize]
     * @param {number} [params.left]
     * @param {number} [params.top]
     * @param {number} [params.capacity]
     * @param {UserData} [params.userData]
     */
    makeSparseLayer({
      capacity: initialCap = 64,
      animClock: layerAnimClock,
      userData,
      ...params
    }) {
      if (userData)
        for (const dim of ['pos', 'tile', 'used', 'index'])
          if (dim in userData)
            throw new Error(`userData may not specify "${dim}"`);

      const layer = this.makeLayer(params);
      const data = makeDataFrame(gl, {
        ...userData,
        index: indexSpec,
        pos: attrPosSpec,
        tile: attrTileSpec,
        anim: attrAnimSpec,
        posTo: attrPosToSpec,
        used: {
          ArrayType: Uint8Array,
          size: 1 / 8,
        },
      }, initialCap);

      // TODO support drawing sorted by Z order?

      let length = 0;

      /** @param {number} index */
      const isUsed = index => {
        const usedEl = Math.floor(index / 8);
        const usedBit = index % 8;
        const mask = 1 << usedBit;
        return (data.array.used[usedEl] & mask) == 0 ? false : true;
      };

      /** @param {number} index */
      const free = index => {
        data.delElement(index);

        const usedEl = Math.floor(index / 8);
        const usedBit = index % 8;
        const mask = 1 << usedBit;
        data.array.used[usedEl] &= 0xff & ~mask;

        data.recordClear(index);
      };

      const alloc = () => {
        for (let usedEl = 0; usedEl < data.array.used.length; usedEl++) {
          const usedVal = data.array.used[usedEl];
          if (usedVal == 0xff) continue;
          for (let usedBit = 0, index = usedEl * 8; usedBit < 8 && index < length; usedBit++, index++) {
            const mask = 1 << usedBit;
            if ((usedVal & mask) != 0) continue;
            data.array.used[usedEl] = usedVal | mask;
            return index;
          }
        }
        while (length >= data.capacity) data.grow();
        const index = length++;
        const usedEl = Math.floor(index / 8);
        data.array.used[usedEl] |= 1 << index % 8;
        return index;
      };

      /** @param {number} id */
      const validateID = id => {
        if (id < 1) return false;
        if (Math.floor(id) != id) return false;
        const index = id - 1;
        const alloced = index < length;
        return alloced && isUsed(index);
      };

      /** @param {number} index */
      const ref = index => {
        /** @type {null|AnimClock} */
        let animClock = layerAnimClock || null;

        /** @typedef {'once'|'loop'|'loopback'} AnimMode */

        /** @param {AnimMode} mode */
        const animModeToCode = mode => {
          switch (mode) {
            case 'once': return 0;
            case 'loop': return 1;
            case 'loopback': return 2;
            default: throw new Error('invalid animMode');
          }
        };

        const tile = {
          get id() { return index + 1 },
          get index() { return index },

          /** Reset all tile data to 0 values */
          clear() {
            data.recordClear(index);
            data.delElement(index);
            data.dirty = true;
          },

          free() { free(index) },

          /** @returns {[x: number, y: number]} */
          get xy() {
            return [data.array.pos[4 * index + 0], data.array.pos[4 * index + 1]]
          },
          set xy([x, y]) {
            data.array.pos[4 * index + 0] = x;
            data.array.pos[4 * index + 1] = y;
            data.dirty = true;
          },

          /** @returns {[x: number, y: number]} */
          get absXY() {
            const [left, top] = layer.origin;
            return [
              left + data.array.pos[4 * index + 0],
              top + data.array.pos[4 * index + 1],
            ];
          },
          set absXY([x, y]) {
            const [left, top] = layer.origin;
            data.array.pos[4 * index + 0] = x - left;
            data.array.pos[4 * index + 1] = y - top;
            data.dirty = true;
          },

          /** Tile rotation in units of full turns */
          get spin() { return data.array.pos[4 * index + 2] },
          set spin(turns) {
            data.array.pos[4 * index + 2] = turns;
            data.dirty = true;
          },

          /** Tile scale factor */
          get scale() { return data.array.pos[4 * index + 3] },
          set scale(factor) {
            data.array.pos[4 * index + 3] = factor;
            data.dirty = true;
          },

          /** Tile texture Z index.
           *  FIXME "layer" id is perhaps a bad name since we're inside a Layer object anyhow. */
          get layerID() { return data.array.tile[2 * index] },
          /** Setting a value of 0, the default, will cause this tile to not be drawn.
           * When initializing (setting to non-zero when prior value was 0),
           * a default 1.0 scale value will also be set if scale was 0. */
          set layerID(layerID) {
            const init = layerID != 0 && data.array.tile[2 * index] == 0;
            data.array.tile[2 * index] = layerID;
            if (init && data.array.pos[4 * index + 3] == 0) data.array.pos[4 * index + 3] = 1;
            if (layerID === 0) data.delElement(index); else data.addElement(index);
            data.dirty = true;
          },

          afterAnim(clock = animClock) {
            return tile.afterAnimRounds(clock, 1)
          },

          /** @param {number} rounds */
          afterAnimRounds(clock = animClock, rounds) {
            if (!clock) throw new Error('not bound to an AnimClock, most provide one to afterAnim');
            const
              animStart = data.array.anim[3 * index + 0],
              animDuration = data.array.anim[3 * index + 1];
            // TODO if we further indirect id -> index,
            // then we may need to revalidate that mapping after promise reolves
            return clock.afterTime(animStart + rounds * animDuration);
          },

          get animClock() { return animClock },
          set animClock(clock) { animClock = clock },

          /**
           * @param {number} delay
           * @param {number} duration
           * @param {'once'|'loop'|'loopback'} mode
           */
          startAnim(duration, delay = 0, mode = 'once') {
            if (duration <= 0) throw new Error('invalid duration');
            if (!animClock) throw new Error('not bound to an AnimClock');
            const time = animClock.time + delay;

            data.array.anim[3 * index + 0] = time;
            data.array.anim[3 * index + 1] = duration;
            data.array.anim[3 * index + 2] = animModeToCode(mode);

            const pos = data.array.pos.subarray(4 * index, 4 * index + 4);
            data.array.posTo.set(pos, 4 * index);
            data.array.tile[2 * index + 1] = data.array.tile[2 * index];
            data.dirty = true;
          },

          /** Tile animation start time under an AnimTimer */
          get animStart() { return data.array.anim[3 * index + 0] },
          set animStart(time) {
            data.array.anim[3 * index + 0] = time;
            data.dirty = true;
          },

          /** Tile animation duration under an AnimTimer */
          get animDuration() { return data.array.anim[3 * index + 1] },

          /** Setting to 0 disables this tile's animation,
           *  and resets animStart=0 and animMode='once'.
           *
           *  Setting to non-0 when previsouly 0 enables this tile's animation,
           *  and copies default offset/spin/scale-to data from normal offset/spin/scale.
           */
          set animDuration(duration) {
            const prior = data.array.anim[3 * index + 1];
            data.array.anim[3 * index + 1] = duration;
            if (duration == 0) {
              data.array.anim.set([0, 0, 0], 3 * index);
              data.array.posTo.set([0, 0, 0, 0], 4 * index);
            } else if (prior == 0) {
              const pos = data.array.pos.subarray(4 * index, 4 * index + 4);
              data.array.posTo.set(pos, 4 * index);
              data.array.tile[2 * index + 1] = data.array.tile[2 * index];
            }
            data.dirty = true;
          },

          /** Tile animation mode, defaults to "once".
           *
           * Animation progress is:
           *     p = (time - animStart) / animDuration
           * In other words:
           * * starts after animStart time
           * * normalized by animDuration
           *
           * The "once" mode of animation stop after p=1.0,
           * while "loop" continues indefinitely,
           * repeating the same from -> to animation again and again.
           *
           * Simmilarly the "loopback" mode continues indefinetly, but swaps from/to data directionality each time like:
           * * [0.0, 1.0] from -> to
           * * [1.0, 2.0] to -> from
           * * [2.0, 3.0] from -> to
           * * ... and so on
           */
          get animMode() {
            const animCode = data.array.anim[3 * index + 2];
            switch (animCode) {
              case 0: return 'once';
              case 1: return 'loop';
              case 2: return 'loopback';
              // @ts-ignore
              default: return 'invalid';
            }
          },

          /** @param {AnimMode} mode */
          set animMode(mode) {
            data.array.anim[3 * index + 2] = animModeToCode(mode);
            data.dirty = true;
          },

          /** @returns {[x: number, y: number]} */
          get xyTo() { return [data.array.posTo[4 * index + 0], data.array.posTo[4 * index + 1]] },
          set xyTo([ox, oy]) {
            data.array.posTo[4 * index + 0] = ox;
            data.array.posTo[4 * index + 1] = oy;
            data.dirty = true;
          },

          get spinTo() { return data.array.posTo[4 * index + 2] },
          set spinTo(turns) {
            data.array.posTo[4 * index + 2] = turns;
            data.dirty = true;
          },

          get scaleTo() { return data.array.posTo[4 * index + 3] },
          set scaleTo(factor) {
            data.array.posTo[4 * index + 3] = factor;
            data.dirty = true;
          },

          get layerIDTo() { return data.array.tile[2 * index + 1] },
          set layerIDTo(layerID) {
            data.array.tile[2 * index + 1] = layerID;
            data.dirty = true;
          },

        };
        return tile;
      };

      const self = {
        deleteBuffers() {
          layer.deleteBuffers();
          data.deleteBuffers();
        },

        clear() {
          data.clear();
          length = 0;
        },
        prune() {
          data.prune(length);
        },

        create() {
          const index = alloc();
          return index + 1;
        },

        createRef() {
          const index = alloc();
          return ref(index);
        },

        /** @param {number} id */
        free(id) {
          if (validateID(id)) free(id - 1);
        },

        get animClock() {
          if (!layerAnimClock) throw new Error('no AnimClock bound to SparseLayer');
          return layerAnimClock;
        },

        *all() {
          for (let index = 0; index < length; index++)
            if (isUsed(index)) yield ref(index);
        },

        /** @param {number} id @returns {[x: number, y: number]} */
        getXY(id) {
          if (!validateID(id)) return [NaN, NaN];
          const index = id - 1;
          return [
            data.array.pos[4 * index + 0],
            data.array.pos[4 * index + 1]
          ];
        },

        /** @param {number} id */
        ref(id) {
          if (!validateID(id)) return null;
          const index = id - 1;
          return ref(index);
        },

        draw() {
          layerAnimClock?.bind();
          layer.bind();
          data.drawElements(gl.POINTS);
          layerAnimClock?.unbind();
        },

        get array() {
          return /** @type {typeof data["array"] & arrayProps<UserData>} */ (data.array)
        },

      };

      return passProperties(self,
        layer, 'texture', 'cellSize', 'origin',
      );
    },
  };
  return tileRend;
}

/** @typedef {object} AnimClock
 * @prop {boolean} enabled
 * @prop {number} time
 * @prop {() => void} bind
 * @prop {() => void} unbind
 * @prop {() => void} reset
 * @prop {() => void} pause
 * @prop {(externalTime: number) => void} update
 * @prop {(dt: number) => Promise<number>} afterDuration
 * @prop {(t: number) => Promise<number>} afterTime
 */

/** @typedef {Awaited<ReturnType<makeTileRenderer>>} TileRenderer */
/** @typedef {ReturnType<TileRenderer["makeView"]>} View */
/** @typedef {ReturnType<TileRenderer["makeLayer"]>} BaseLayer */
/** @typedef {ReturnType<TileRenderer["makeStaticLayer"]>} StaticLayer */
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

/**
 * @param {number} n
 * @param {(i: number) => boolean} where
 */
function search(n, where) {
  let i = 0, j = n;
  for (; i < j;) {
    const h = Math.floor((i + j) / 2);
    if (!where(h)) i = h + 1;
    else j = h;
  }
  return i;
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

// /**
//  * @param {object} img
//  * @param {number} img.width
//  * @param {number} img.height
//  * @param {Parameters<typeof URL.createObjectURL>[0]} img.src
//  * @param {any[]} mess
//  */
// const logImage = ({ width, height, src }, ...mess) => {
//   const url = URL.createObjectURL(src);
//   console.group(...mess);
//   console.log("%c+", [
//     `font-size: 1px`,
//     `color: transparent`,
//     `padding: ${Math.floor(height / 2)}px ${Math.floor(width / 2)}px`,
//     `line-height: ${height}px`,
//     `background: url(${url})`,
//     `background-size: ${width}px ${height}px`,
//   ].join('; '));
//   console.groupEnd();
// };
