// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

import * as xorbig from './xorbig.js';

import makeTileRenderer from './gltiles.js';
/** @typedef {import("./gltiles.js").TileRenderer} TileRenderer */
/** @typedef {import("./gltiles.js").View} TileView */
/** @template T @typedef {import("./gltiles.js").tileable<T>} tileable */
/** @template T @typedef {import("./gltiles.js").TileSheet<T>} TileSheet */

/** @typedef {import("./gltiles.js").SparseLayer} SparseLayer */
/** @typedef {Exclude<ReturnType<SparseLayer["ref"]>, null>} SparseTile */

/** @callback layback
 * @param {TileSheet<number>} tileSheet
 * @param {Layer} layer
 * @returns {void}
 */

/** @template [T = any]
 * @callback tileMaker
 * @param {tileable<T>} tiles
 * @return TileSheet<T>
 */

import {
  generateSimpleTiles,

  generateCurvedTiles,
  curvedLayerParams,
  updateCurvedLayer,
  clippedBaseCellQuery,
  extendedBaseCellQuery,

  drawSimpleTile,
} from './tilegen.js';
/** @typedef {import("./tilegen.js").SimpleTile} SimpleTile */

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.$world
 * @param {() => HTMLElement} [opts.makeDialog]
 * @param {number} [opts.tileSize]
 * @param {number} [opts.cellSize]
 * @param {number} [opts.worldWidth]
 * @param {number} [opts.worldHeight]
 * @param {boolean} [opts.showCurvyTiles]
 * @param {boolean} [opts.clipCurvyTiles]
 * @param {SimpleTile[]} [opts.foreTiles]
 * @param {Parameters<xorbig.generateRandoms>[0]} [opts.seed]
 */
export default async function runDemo(opts) {
  let {
    $world,
    makeDialog = () => {
      const $el = $world.ownerDocument.createElement('div');
      $world.parentNode?.appendChild($el);
      return $el;
    },

    tileSize = 256,
    cellSize = 64,

    worldWidth = 5,
    worldHeight = 5,
    showCurvyTiles = true,
    clipCurvyTiles = false,

    seed = 0xdead_beefn,

    foreTiles: foreTileSpecs = [
      { text: '1️⃣' }, // buttons 1-4
      { text: '2️⃣' },
      { text: '3️⃣' },
      { text: '4️⃣' },
    ],
  } = opts;

  const showLayer = {
    bgCurved: showCurvyTiles ? (clipCurvyTiles ? 2 : 1) : 0,
    fg: true,
  };

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  const userAnimTime = 400;

  const tiles = await makeTileRenderer(gl);
  const view = tiles.makeView({
    cellSize,
    defaultAnimDuration: userAnimTime,
  });

  /** @returns {Generator<[id: string, spec: SimpleTile]>} */
  function* generateCursorTiles() {

    /** @param {string} text */
    const glyphTile = (text, color = '#555') => ({
      text,
      color,
      font: 'monospace',
      height: { prop: 0.8 },
    });

    yield ['hover', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'blue' }];
    yield ['active', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'red' }];

    yield ['start', { arc: { radius: { prop: 1 / 9 } }, stroke: 'red', lineWidth: { prop: 0.05 } }];
    yield ['part', { arc: { radius: { prop: 1 / 9 } }, stroke: 'yellow', lineWidth: { prop: 0.025 } }];

    for (let n = 1; n <= 9; n++)
      yield [`note${n}`, glyphTile(`${n}`)];

  }
  const cursorTiles = tiles.makeSheet(
    Array.from(generateCursorTiles()).map(([id, spec]) => ({
      id,
      draw: ctx => drawSimpleTile(spec, ctx),
    })),
    { tileSize }
  );

  const landCurveTiles = tiles.makeSheet(generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = tiles.makeSheet(generateSimpleTiles(...foreTileSpecs), { tileSize });

  const bg = tiles.makeStaticLayer({
    texture: landCurveTiles.texture,
    width: worldWidth,
    height: worldHeight,
  });

  const fg = tiles.makeSparseLayer({
    texture: foreTiles.texture,
  });
  const bgCurved = tiles.makeStaticLayer(curvedLayerParams(bg));

  /** @param {number} x @param {number} y */
  const worldAt = (x, y) => {
    x = Math.floor(x), y = Math.floor(y);
    const bgTile = bg.absAt(x, y);
    if (bgTile == null) return null;
    return {
      get back() { return bgTile },
      *fore() {
        for (const tile of fg.all()) {
          const { layerID, absXY: [foreX, foreY] } = tile;
          if (foreX == x && foreY == y) {
            yield Object.assign(tile, {
              tileID: foreTiles.getTileID(layerID),
            });
          }
        }
      },
    };
  };

  const inspectorDialog = makeSingletonDialog({
    id: 'demo_inspector',
    makeDialog,
    query: selector => $world.ownerDocument.querySelector(selector),
    createThen($dialog) {
      // TODO hacking against index.css's full-width opinions
      $dialog.style.left = 'initial';
      console.log($dialog);
    },
    closeThen: () => {
      $world.focus();
      cellUI.cursorMode = '';
    },
  });

  /** @param {[x: number, y: number]} cellXY */
  const updateInspector = ([cellX, cellY]) => {
    const cell = worldAt(cellX, cellY);
    inspectorDialog.main.innerHTML = cell
      ? objectTable(cell.back, ...cell.fore())
      : `@${Math.floor(cellX)}, ${Math.floor(cellY)}`;
  };

  /** @type {Partial<CellUIHandler>} */
  const uiHandler = {
    keyEvent({ type, key }) {
      switch (type) {
        case 'keyup':
          switch (key) {
            case 'c':
            case 'C':
              showLayer.bgCurved = (showLayer.bgCurved + 1) % 3;
              if (showLayer.bgCurved)
                clipCurvyTiles = (showLayer.bgCurved - 1) ? true : false;
              break;

            case 'f':
            case 'F':
              showLayer.fg = !showLayer.fg;
              break;

          }
          break;
      }
    },

    mouseEvent({ type, clientX, clientY }) {
      const
        [cellX, cellY] = view.reverseProject(clientX, clientY),
        fx = Math.floor(cellX),
        fy = Math.floor(cellY),
        {
          cursorMode: priorMode,
          cursorAt: priorAt,
        } = cellUI;
      switch (type) {
        case 'click':
          cellUI.cursorMode = priorMode == 'active' ? 'hover' : 'active';
          if (priorAt[0] != fx || priorAt[1] != fy) {
            cellUI.cursorAt = [fx, fy];
            updateInspector([cellX, cellY]);
          }
          break;
        case 'mousemove':
          if (priorMode == 'active') return;
          if (priorAt[0] != fx || priorAt[1] != fy) {
            cellUI.cursorAt = [fx, fy];
            cellUI.cursorMode = 'hover';
            updateInspector([cellX, cellY]);
          }
          break;
      }
    },
  };

  const cellUI = makeCellUI({
    tileRend: tiles,
    view,
    tiles: cursorTiles,
    handle: uiHandler,
  });
  cellUI.addEventListeners($world);
  view.animClock = cellUI.animClock;

  let lastCurveClip = clipCurvyTiles;

  /** @param {Parameters<xorbig.generateRandoms>[0]} seed */
  const generateWorld = seed => {
    const
      randoms = xorbig.generateRandoms(seed),
      makeRandom = () => {
        const res = randoms.next();
        if (res.done) throw new Error('inconceivable: exhausted xorbig stream');
        return res.value;
      },

      { width, height } = bg,
      land = landCurveTiles.getLayerID(0b0000),
      water = landCurveTiles.getLayerID(0b1111);

    // generate terrain
    const genTerrain = ( /** @returns {(x: number, y: number) => number} */ () => {

      // pure random scatter ; TODO better procgen
      const { random: randWater } = makeRandom();
      const isWater = new Uint8Array(width * height);
      for (let i = 0; i < isWater.length; i++)
        isWater[i] = randWater() > 0.5 ? 1 : 0;

      return (x, y) => isWater[y * width + x] ? water : land;
    })();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = bg.at(x, y);
        if (!cell) continue;
        cell.layerID = genTerrain(x, y);
      }
    }

    // place fore objects
    const { randomInt: randTile } = makeRandom();
    const { random: randSpin } = makeRandom();
    /** @type {Set<number>} */
    const newIDs = new Set();
    let lastID = -1;
    fg.clear();
    genFG: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileID = randTile() % (2 * foreTiles.size);
        if (tileID < foreTiles.size) {
          const tile = fg.createRef();
          if (newIDs.has(tile.id)) {
            console.warn(`fg dupe tile id last:${lastID} new:${tile.id}`, { ...tile });
            break genFG;
          }
          newIDs.add(tile.id);
          tile.xy = [x, y];
          tile.spin = randSpin();
          tile.layerID = foreTiles.getLayerID(tileID);
          lastID = tile.id;
        }
      }
    }
    fg.prune();

    updateCurvedLayer(bgCurved, landCurveTiles,
      lastCurveClip
        ? clippedBaseCellQuery(bg, landCurveTiles)
        : extendedBaseCellQuery(bg, landCurveTiles));

  };
  generateWorld(seed);

  const { stop, frames } = frameLoop(gl);
  const done = async function() {
    for await (const t of frames) {
      cellUI.animClock.update(t);

      sizeToClient($world);
      view.update();

      const nowCurveClip = clipCurvyTiles;
      if (lastCurveClip != nowCurveClip) {
        lastCurveClip = nowCurveClip;
        updateCurvedLayer(bgCurved, landCurveTiles,
          nowCurveClip
            ? clippedBaseCellQuery(bg, landCurveTiles)
            : extendedBaseCellQuery(bg, landCurveTiles));
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // TODO: allow viewport zoom/pan?
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

      gl.clear(gl.COLOR_BUFFER_BIT);

      // TODO: why can't this persist across frames?
      tiles.texCache.clear();

      view.with(() => {
        // TODO at some point, it'll be worth it to cull layers that don't
        // intersect perspective, but for now we just use leave GL's vertex culling

        if (showLayer.bgCurved) {
          const
            { origin: [left, top], width, height } = bg,
            [viewLeft, viewTop, viewWidth, viewHeight] = view.projectRect(left, top, width, height),
            // convert to bottom-up gl screen space, view client space counts down from top
            glTop = gl.drawingBufferHeight - (viewTop + viewHeight);
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(viewLeft, glTop, viewWidth, viewHeight);
          bgCurved.draw();
          gl.disable(gl.SCISSOR_TEST);
        } else {
          bg.draw();
        }

        if (showLayer.fg) fg.draw();

        cellUI.draw();
      });
    }
  }();
  const self = {
    get view() { return view },

    get cellSize() { return view.cellSize },
    set cellSize(size) { view.cellSize = size },

    /** @param {number} w @param {number} h */
    resizeWorld(w, h) {
      worldWidth = w;
      worldHeight = h;
      bg.resize(w, h);
      bgCurved.resize(w + 1, h + 1);
      generateWorld(seed);
    },

    /** @param {number} dx @param {number} dy */
    moveWorldBy(dx, dy) {
      const [left, top] = bg.origin;
      this.moveWorldTo(left + dx, top + dy);
    },

    /** @param {number} x @param {number} y */
    moveWorldTo(x, y) {
      bg.origin = [x, y];
      fg.origin = [x, y];
      bgCurved.origin = [x - 0.5, y - 0.5];
    },

    stop,
    done: done.finally(() =>
      cellUI.removeEventListeners($world)),
  };

  if ($world.tabIndex < 0) $world.tabIndex = 0;
  $world.focus();

  return self;
}

/** @param {object} params
 * @param {string} params.id
 * @param {() => HTMLElement} params.makeDialog
 * @param {(selector: string) => HTMLElement|null} params.query
 * @param {($dialog: HTMLElement) => void} [params.createThen]
 * @param {() => void} [params.closeThen]
 */
function makeSingletonDialog({
  id,
  makeDialog,
  query,
  createThen = () => { },
  closeThen = () => { },
}) {
  const diag = {
    get isOpen() { return !!query(`#${id}`) },

    get dialog() {
      let $dialog = query(`#${id}`);
      if (!$dialog) {
        $dialog = makeDialog();
        $dialog.id = id;
        const $close = $dialog.appendChild($dialog.ownerDocument.createElement('button'));
        $close.style.float = 'right';
        $close.innerText = 'X';
        $close.addEventListener('click', () => diag.close());
        createThen($dialog);
      }
      return $dialog;
    },

    get main() {
      const $dialog = diag.dialog;
      let $main = $dialog.querySelector('main');
      if (!$main) {
        $main = $dialog.ownerDocument.createElement('main');
        $dialog.appendChild($main);
      }
      return $main;
    },

    close() {
      const $dialog = query(`#${id}`);
      if ($dialog) $dialog.parentNode?.removeChild($dialog);
      closeThen();
    },
  };
  return diag;
}

/** @typedef {SparseTile & {
 *   action: number,
 *   actionKey: string,
 * }} UITile */

/** @typedef {object} CellUIHandler
 * @prop {(e: MouseEvent) => void} mouseEvent
 * @prop {(e: KeyboardEvent) => void} keyEvent
 */

/**
 * @param {object} params
 * @param {TileRenderer} params.tileRend
 * @param {TileView} params.view
 * @param {TileSheet<string>} params.tiles
 * @param {(action: number, mode: 'mouse'|'key'|'touch', tile: UITile|null) => void} [params.invoke]
 * @param {Partial<CellUIHandler>} [params.handle]
 */
function makeCellUI({
  tileRend,
  view,
  tiles: cursorTiles, // TODO provide default / maybe only accept spec? or if dynamci sheet, just setend given...
  invoke = () => { },
  handle: {
    mouseEvent: handleMouseEvent = () => { },
    keyEvent: handleKeyEvent = () => { },
  } = {},
}) {
  const
    uiLayer = tileRend.makeSparseLayer({
      animClock: tileRend.makeAnimClock(),
      texture: cursorTiles.texture,
      userData: {
        action: {
          ArrayType: Uint8Array,
          size: 1,
        },
      },
    }),

    // TODO in an ideal world, DataFrame would suppot this as a MapType aspect with reverse lookup
    /** @type {Map<number, string>} */
    uiActionKey = new Map(),
    /** @type {Map<string, number>} */
    uiKeyAction = new Map();

  let
    /** @type {null|number} */
    cursorID = null,

    /** @type {[x: number, y: number]} */
    cursorAt = [0, 0],

    /** @type {null|number} */
    cursorHoverID = null;

  /** @param {SparseTile} tile */
  const extendRef = tile => {
    const { free: freeTile } = tile;

    return /** @type {UITile} */(Object.defineProperties(tile, {
      free: {
        value() {
          const action = uiLayer.array.action[tile.index];
          const old = uiActionKey.get(action);
          uiActionKey.delete(action);
          if (old) uiKeyAction.delete(old);
          freeTile();
        },
      },

      action: {
        get() { return uiLayer.array.action[tile.index] },
        set(action) { uiLayer.array.action[tile.index] = action },
      },

      actionKey: {
        get() {
          const action = uiLayer.array.action[tile.index];
          if (!action) return '';
          const key = uiActionKey.get(action);
          return key || '';
        },
        set(key) {
          const action = uiLayer.array.action[tile.index];
          if (!action) {
            console.warn(`futile actionKey.set("${key}")`);
            return;
          }
          const old = uiActionKey.get(action);
          if (old) uiKeyAction.delete(old);
          if (key) {
            uiActionKey.set(action, key);
            uiKeyAction.set(key, action);
          } else uiActionKey.delete(action);
        },
      },
    }));
  };

  /** @param {number} cellX @param {number} cellY */
  const actionsAt = function*(cellX, cellY) {
    const
      fx = Math.floor(cellX),
      fy = Math.floor(cellY);
    for (const tile of uiLayer.all()) {
      const
        { index, xy: [x, y] } = tile,
        action = uiLayer.array.action[index];
      if (action && x == fx && y == fy)
        yield extendRef(tile);
    }
  };

  const applyCursorPulse = (tile = cursorID && uiLayer.ref(cursorID)) => {
    if (!tile) return;
    tile.animDuration = 0;
    tile.startAnim(200, 0, 'loopback');
    if (!cellUI.applyPulse(tile)) {
      tile.scale = 1.0;
      tile.scaleTo = 0.9;
    }
  };

  const cellUI = {
    get animClock() { return uiLayer.animClock },

    draw() {
      uiLayer.draw();
    },

    /** @returns {CellUIHandler} */
    get handle() {
      return {
        mouseEvent: handleMouseEvent,
        keyEvent: handleKeyEvent,
      };
    },

    /** @param {Partial<CellUIHandler>} h */
    set handle(h) {
      cellUI.cursorMode = '';
      handleMouseEvent = h.mouseEvent || (() => { });
      handleKeyEvent = h.keyEvent || (() => { });
    },

    /** @returns {typeof cursorAt} */
    get cursorAt() { return [...cursorAt] },
    set cursorAt([x, y]) {
      cursorAt[0] = x, cursorAt[1] = y;
      const tile = cursorID && uiLayer.ref(cursorID);
      if (tile) tile.xy = tile.xyTo = cursorAt;
    },

    get cursorMode() {
      if (cursorID == null) return '';
      const tile = uiLayer.ref(cursorID);
      if (!tile) return '';
      const { layerID } = tile;
      return cursorTiles.getTileID(layerID) || '';
    },
    set cursorMode(mode) {
      switch (mode) {

        case '':
          cellUI.clear();
          break;

        default:
          const layerID = cursorTiles.getLayerID(mode);
          if (!layerID) throw new Error(`invalid cursor mode "${mode}"`);

          if (cursorID == null) {
            const cur = uiLayer.createRef();
            cursorID = cur.id;
          }

          const tile = uiLayer.ref(cursorID);
          if (!tile) throw new Error(`lost cursor tile ${cursorID}`);
          tile.xy = tile.xyTo = cursorAt;
          tile.layerID = tile.layerIDTo = layerID;
          applyCursorPulse();
      }
    },

    get cursorHover() { return cursorHoverID },

    set cursorHover(id) {
      if (cursorHoverID !== id) {
        if (cursorHoverID !== null) {
          const tile = uiLayer.ref(cursorHoverID);
          if (tile) {
            cellUI.clearPulse(tile);
            cellUI.removeSuffix(tile, 'Hover');
          }
          cursorHoverID = null;
        }

        const tile = id && uiLayer.ref(id);
        if (tile) {
          cellUI.addSuffix(tile, 'Hover');
          cellUI.applyPulse(tile);
        }

        cursorHoverID = id;
      }
    },

    clear() {
      for (const tile of cellUI.prune())
        tile.layerID = 0;
      cellUI.cursorHover = null;
    },

    *prune() {
      for (const tile of uiLayer.all()) {
        const { id, index } = tile;
        if (id == cursorID) yield tile;
        else if (!uiLayer.array.action[index])
          uiLayer.free(id);
      }
    },

    /**
     * @param {number} x
     * @param {number} y
     * @param {object} params
     * @param {string} params.tileID
     * @param {number} [params.animDuration]
     */
    mark(x, y, { tileID, animDuration = 300 }) {
      const layerID = cursorTiles.getLayerID(tileID);
      if (!layerID) throw new Error(`invalid cursor mark tile "${tileID}"`);
      const tile = uiLayer.createRef();
      tile.xy = [x, y];
      tile.layerID = layerID;
      tile.startAnim(animDuration, 0, 'loopback');
      tile.xyTo = tile.xy;
      if (!cellUI.applyPulse(tile)) {
        tile.scale = 1.0;
        tile.scaleTo = 0.9;
      }
    },

    /**
     * @param {SparseTile} tile
     * @param {string} suffix
     */
    addSuffix(tile, suffix) {
      const tileID = cursorTiles.getTileID(tile.layerID);
      if (!tileID) return;
      const layerID = cursorTiles.getLayerID(`${tileID}${suffix}`);
      if (layerID) tile.layerID = layerID;
    },

    /**
     * @param {SparseTile} tile
     * @param {'once'|'loop'|'loopback'} [mode]
     */
    applyPulse(tile, duration = 500, mode = 'loopback') {
      const tileID = cursorTiles.getTileID(tile.layerID);
      if (!tileID) return false;
      const layerID = cursorTiles.getLayerID(`${tileID}Pulse`);
      if (!layerID) return false;
      if (tile.animDuration == 0) tile.startAnim(duration, 0, mode);
      tile.layerIDTo = layerID;
      return true;
    },

    /** @param {SparseTile} tile */
    clearPulse(tile) {
      const tileID = cursorTiles.getTileID(tile.layerIDTo);
      if (tileID?.endsWith('Pulse')) tile.animDuration = 0;
    },

    /**
     * @param {SparseTile} tile
     * @param {string} suffix
     */
    removeSuffix(tile, suffix) {
      const tileID = cursorTiles.getTileID(tile.layerID);
      if (tileID?.endsWith(suffix)) {
        const normalLayerID = cursorTiles.getLayerID(tileID.slice(0, -suffix.length));
        if (normalLayerID) {
          tile.layerID = normalLayerID;
          tile.animDuration = 0;
        }
      }
    },

    /** @param {string} tileID @param {number} action */
    createTile(tileID, action = 0) {
      const layerID = cursorTiles.getLayerID(tileID);
      if (!layerID) throw new Error(`no such tile #${tileID}`);
      const tile = uiLayer.createRef();
      tile.layerID = layerID;
      uiLayer.array.action[tile.index] = action;
      return extendRef(tile);
    },

    /** @param {number} id */
    refTile(id) {
      const tile = uiLayer.ref(id);
      if (!tile) return null;
      return extendRef(tile);
    },

    /** @param {HTMLElement} $el */
    addEventListeners($el) {
      $el.addEventListener('keydown', cellUI.handleKeyEvent);
      $el.addEventListener('keyup', cellUI.handleKeyEvent);

      $el.addEventListener('click', cellUI.handleMouseEvent);
      $el.addEventListener('mousemove', cellUI.handleMouseEvent);

      // TODO touch events
      // TODO pointer events
    },

    /** @param {HTMLElement} $el */
    removeEventListeners($el) {
      $el.removeEventListener('keydown', cellUI.handleKeyEvent);
      $el.removeEventListener('keyup', cellUI.handleKeyEvent);

      $el.removeEventListener('click', cellUI.handleMouseEvent);
      $el.removeEventListener('mousemove', cellUI.handleMouseEvent);
    },

    /** @param {KeyboardEvent} e */
    handleKeyEvent(e) {
      const { type, key } = e;
      switch (type) {
        case 'keydown':
          if (uiKeyAction.has(key)) e.preventDefault();
          else handleKeyEvent(e);
          break;

        case 'keyup':
          const action = uiKeyAction.get(key);
          if (action) {
            invoke(action, 'key', null);
            e.preventDefault();
          } else handleKeyEvent(e);
          break;
      }
    },

    /** @param {MouseEvent} e */
    handleMouseEvent(e) {
      for (const tile of actionsAt(...view.reverseProject(e.clientX, e.clientY))) {
        switch (e.type) {
          case 'mousemove':
            cellUI.cursorHover = tile.id;
            break;

          case 'click':
            invoke(tile.action, 'mouse', tile);
            break;
        }
        return;
      }

      cellUI.cursorHover = null;
      handleMouseEvent(e);
    },
  };

  return cellUI;
}

/** @typedef {ReturnType<makeCellUI>} CellUI  */

/** @param {{[key: string]: any}[]} os */
function objectTable(...os) {
  /** @type {Set<string>} */
  const keys = new Set();
  for (const o of os)
    for (const [key, value] of Object.entries(o))
      if (typeof value != 'function')
        keys.add(key);

  // TODO transpose wen?
  // return `<table>
  //   <thead><tr>${Array.from(keys).map(key =>
  //   `<th>${key}</th>`).join('')}</tr></thead>
  //   <tbody>${os.map(o =>
  //     `<tr>${Array.from(keys).map(key =>
  //       `<td>${JSON.stringify(o[key])}</td>`).join('')
  //     }</tr>`).join('\n')}</tbody>
  // </table>`;

  return `<table>${Array.from(keys).map(key =>
    `<tr><td>${key}</td>${os.map(o =>
      `<td>${JSON.stringify(o[key])}</td>`).join('\n')
    }</tr>`
  ).join('')}</table>`;
}
