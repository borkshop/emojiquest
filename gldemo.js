// @ts-check

/* TODO
 * - structify webgl data aspects
 * - finish flattening the prior demo:
 *   - subsume tilegen module ; simplify
 *   - subsume procgen module ; simplify
 * - continue separating out reusable sections:
 *   - factor out glkit texture unit cache deal
 *   - use dataframe for touch handling, split out something in/around CellUI into a module
 * - publish xorbig module
 * - publish mortish module
 * - publish adat module rename of "tilore"
 * - publish layer rendering / ui module
 */

import { vec2, mat4 } from 'gl-matrix';

import makeMortonMap from './mortish.js';
/** @template ID @typedef {import("./mortish.js").MortonMap<ID>} MortonMap */

import * as xorbig from './xorbig.js';

import {
  makeDataFrame,
  makeSparseDataFrame,
  makeDurableIDIndex,
  makeXYIndex,
} from './tilore/dataframe.js';

import {
  frameLoop,
  compileProgram,
  makeProgram,
  makeWebGLAspects,
  fieldGLType,
} from './tilore/glkit.js';

/** @typedef {import('./tilore/dataframe.js').AspectCoreRO} AspectCoreRO */
/** @typedef {import('./tilore/dataframe.js').AspectMap} AspectMap */

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
  generateCurvedTiles,
  curvedLayerParams,
  updateCurvedLayer,
  clippedBaseCellQuery,
  extendedBaseCellQuery,

  drawSimpleTile,
} from './tilegen.js';
/** @typedef {import("./tilegen.js").SimpleTile} SimpleTile */

import {
  makeBSP,
  dla,
} from './procgen.js';

/** @typedef {(
 * | {turn: number}
 * | {halt: string}
 * )} GameState */

const actorTypes = {
  deer: {
    tile: { text: '🦌' },
    move: {
      land: true,
      water: [false, false, false, false],
    },
  },
  bear: {
    tile: { text: '🐻' },
    move: {
      land: true,
      water: [true, false, false, false],
    },
  },
  teapot: {
    tile: { text: '🫖' },
    move: {
      land: true,
      water: [true, true, false, false],
    },
  },
  canoe: {
    tile: { text: '🛶' },
    move: {
      land: false,
      water: [true, true, true, false],
    },
  },
  boat: {
    tile: { text: '⛵' },
    move: {
      land: false,
      water: [false, true, true, true],
    },
  },
  fairy: {
    tile: { text: '🧚' },
    move: {
      land: true,
      water: [true, true, true, true],
    },
  },
  // 🗻 ⛰️ 🏔️
  // 🌲 🌳 🎄 🎋
};

/** @returns {Generator<[id: string, spec: SimpleTile]>} */
function* generateCursorTiles() {
  /** @param {string} text */
  const glyphTile = (text, color = '#555') => ({
    text,
    color,
    font: 'monospace',
    height: { prop: 0.8 },
  });

  /** @param {string} color */
  const targetTile = color => [
    // like ◎ but more control
    { arc: { radius: { prop: 1 / 5 } }, stroke: color, lineWidth: { prop: 0.05 } },
    { arc: { radius: { prop: 1 / 3 } }, stroke: color, lineWidth: { prop: 0.05 } },
  ];

  yield ['hover', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'blue' }];
  yield ['active', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'red' }];
  yield ['move', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'yellow' }];
  yield ['goal', { rect: 'border', lineWidth: { prop: 0.05 }, stroke: 'green' }];

  for (const { suffix, color } of [
    { suffix: '', color: '#555' },
    { suffix: 'Hover', color: '#55a' },
    { suffix: 'HoverPulse', color: '#5af' },
  ])
    yield [`moveMe${suffix}`, [
      { arc: { radius: { prop: 2 / 5 } }, stroke: color, lineWidth: { prop: 0.05 } },
    ]];

  yield ['target', targetTile('#555')];
  yield ['targetHover', targetTile('#55a')];
  yield ['targetHoverPulse', targetTile('#5af')];
  yield ['targetActive', targetTile('#f55')];
  yield ['targetActivePulse', targetTile('#fa5')];

  for (const { action, text } of [
    { action: 'play', text: '▶' },
    { action: 'pause', text: '⏸' },
  ]) for (const { suffix, color } of [
    { suffix: '', color: '#555' },
    { suffix: 'Pulse', color: '#5a5' },
    { suffix: 'Hover', color: '#55a' },
    { suffix: 'HoverPulse', color: '#5af' },
  ]) yield [`${action}${suffix}`, glyphTile(text, color)];

  for (const { action, text } of [
    { action: 'moveLeft', text: '⇦' },
    { action: 'moveUp', text: '⇧' },
    { action: 'moveRight', text: '⇨' },
    { action: 'moveDown', text: '⇩' },
  ]) for (const { suffix, color } of [
    { suffix: '', color: '#555' },
    { suffix: 'Pulse', color: '#a55' },
    { suffix: 'Hover', color: '#a5a' },
    { suffix: 'HoverPulse', color: '#f5f' },
  ]) yield [`${action}${suffix}`, [
    { text, color: `${color}4`, font: 'monospace', height: { prop: 1.0 } },
  ]];
  // TODO restore key tiles
  // { text: key, color, font: 'bolder monospace', height: { prop: 0.4 } },

  for (const { action, text } of [
    { action: 'help', text: '?' },
  ]) for (const { suffix, color } of [
    { suffix: '', color: '#555' },
    { suffix: 'Pulse', color: '#5a5' },
    { suffix: 'Hover', color: '#55a' },
    { suffix: 'HoverPulse', color: '#5af' },
  ]) yield [`${action}${suffix}`, glyphTile(text, color)];

  yield ['start', { arc: { radius: { prop: 1 / 9 } }, stroke: 'red', lineWidth: { prop: 0.05 } }];
  yield ['part', { arc: { radius: { prop: 1 / 9 } }, stroke: 'yellow', lineWidth: { prop: 0.025 } }];

  for (let n = 0; n <= 9; n++)
    yield [`note${n}`, glyphTile(`${n}`)];
}

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
 * @param {(state: GameState) => void} [opts.onState]
 * @param {boolean} [opts.startPlaying]
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

    startPlaying = false,
    seed = 0xdead_beefn,

    onState = () => { },
  } = opts;

  const helpDialog = makeSingletonDialog({
    id: 'demo_help_dialog',
    makeDialog,
    query: selector => $world.ownerDocument.querySelector(selector),
    closeThen: () => $world.focus(),
  });

  const showLayer = {
    bgCurved: showCurvyTiles ? (clipCurvyTiles ? 2 : 1) : 0,
    fg: true,
    notes: 0,
  };

  const gameLogDialog = makeSingletonDialog({
    id: 'demo_game_log',
    makeDialog,
    query: selector => $world.ownerDocument.querySelector(selector),
    closeThen: () => $world.focus(),
  });

  const gameFormat = makeFormatter(obj => {
    if ('tile' in obj) {
      let { tile: desc, ...rest } = obj;

      if ('$id' in rest) {
        let $id;
        ({ $id, ...rest } = rest);
        desc += `#${$id}`;
      }

      if ('x' in rest && 'y' in rest) {
        let x, y;
        ({ x, y, ...rest } = rest);
        desc += ` @<${x},${y}>`;
      }

      const trail = JSON.stringify(rest);
      if (trail != '{}') {
        desc += ` ${trail}`;
      }

      return desc;
    }
    return JSON.stringify(obj);
  });

  const gameLogLimit = 5;

  /** @param {number} turn @param {string} mess @param {any[]} refs */
  const gameLogSink = (turn, mess, ...refs) => {
    console.log(`[Turn_${turn}] ${mess}`, ...refs);

    const $entries = gameLogDialog.main;
    const $entry = $entries.appendChild($entries.ownerDocument.createElement('div'));
    $entry.innerText = gameFormat(mess, ...refs);
    while ($entries.childNodes.length > gameLogLimit) {
      const { firstChild } = $entries;
      if (!firstChild) break;
      $entries.removeChild(firstChild);
    }
  };

  /** @param {string} mess @param {any[]} refs */
  let gameLog = (mess, ...refs) => gameLogSink(NaN, mess, ...refs);

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No WebGL2 For You!');

  const userAnimTime = 400;

  const tiles = await makeTileRenderer(gl);
  const view = tiles.makeView({
    cellSize,
    defaultAnimDuration: userAnimTime,
  });
  const initCellSize = view.cellSize;

  const cursorTiles = tiles.makeSheet(
    Array.from(generateCursorTiles()).map(([id, spec]) => ({
      id,
      draw: ctx => drawSimpleTile(spec, ctx),
    })),
    { tileSize }
  );

  const Action = {
    Help: 1,
    PlayPause: 2,

    MoveUp: 20,
    MoveRight: 21,
    MoveDown: 22,
    MoveLeft: 23,
    MoveStay: 24,
  };

  /** @type {Map<number, string>} */
  const ActionKeys = new Map([
    [Action.MoveUp, 'w'],
    [Action.MoveLeft, 'a'],
    [Action.MoveDown, 's'],
    [Action.MoveRight, 'd'],
    // TODO multi keys? case insensitive.
  ]);

  const Kind = {
    // fg layer kind constants

    /// element 0 is a bitfield
    // User controlled
    User: 0x01,

    // TODO could add other kind element fields for enumerated types and such
  };

  const Move = {
    StateMask: 0x30,
    Defined: 0x10,
    Proced: 0x20,
    Done: 0x30,

    ActionMask: 0x0f,
    Stay: 0x00,
    Nope: 0x01,
    Move: 0x02,
    Boop: 0x03,
    Dead: 0x04,
  };

  const Goal = {
    Defined: 0x01,
  };

  const gameAnim = tiles.makeAnimClock();

  const landCurveTiles = tiles.makeSheet(generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = tiles.makeSheet(
    // TODO other fore tiles like items?
    Object.entries(actorTypes).map(([id, { tile }]) => ({
      id,
      draw(ctx) { drawSimpleTile(tile, ctx) },
    })),
    { tileSize });

  const bg = tiles.makeXYLayer({
    texture: landCurveTiles.texture,
    width: worldWidth,
    height: worldHeight,
    dataScheme: {
      tile: 'uint16',
    }
  });
  bg.name = 'bg';

  const bgCurved = tiles.makeXYLayer({
    ...curvedLayerParams(bg),
    dataScheme: {
      tile: 'uint16',
    }
  });
  bgCurved.name = 'bgCurved';

  const fg = tiles.makeIDLayer({
    texture: foreTiles.texture,
    animClock: gameAnim,
    dataScheme: {
      // tile rendering components
      drawOrder: { sparse: { order: 'self' } },

      // TODO structify
      offset: 'vec2',
      spin: 'float32',
      scale: { type: 'float32', init: 1 },
      tile: 'uint16',

      // TODO structify
      // ...tile animation components
      anim: 'vec3', // [start_time, duration, mode]
      offsetTo: 'vec2',
      spinTo: 'float32',
      scaleTo: { type: 'float32', init: 1 },
      tileTo: 'uint16',

      // game world components
      kind: 'uint8',
      move: 'ivec3',
      goal: 'uvec3',
    },
  });
  fg.name = 'fg';

  /** @typedef {NonNullable<ReturnType<typeof fg["ref"]>>} ForeTile */

  /** @param {string|ForeTile} id */
  const gameLogFGRef = id => {
    const ref = typeof id == 'string' ? fg.data.ref(id) : id;
    if (!ref) return { $id: id };
    const { $id } = ref;
    const { offset: [x, y], tile: layerID } = ref;
    const tile = foreTiles.getTileID(layerID);
    return { $id, tile, x, y, };
  };

  /** @param {number} x @param {number} y */
  const worldAt = (x, y) => {
    x = Math.floor(x), y = Math.floor(y);
    const bgTile = bg.absAt(x, y);
    return bgTile == null ? null : {
      get back() { return copyObj(bgTile) },
      *fore() {
        const [originX, originY] = fg.origin;
        const qx = x - originX, qy = originY;
        for (const tile of fg.data) {
          const { tile: layerID, offset: [px, py] } = tile;
          if (px == qx && py == qy) {
            const [moveFlags, ...moveXY] = tile.move;
            const [goalFlags, ...goalXY] = tile.goal;

            yield Object.assign(copyObj(tile), {
              tileID: foreTiles.getTileID(layerID),
              kind: toHex(tile.kind),
              user: tile.kind & Kind.User ? true : false,
              moveFlags: toHex(moveFlags),
              movePos: moveFlags & Move.Defined ? moveXY : null,
              goalFlags: toHex(goalFlags, 4),
              goalPos: goalFlags & Goal.Defined ? goalXY : null,
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

    for (const _ of cellUI.prune()) { }
    if (cell) {
      for (const fore of cell.fore()) {
        const { offset: xy, movePos: move, goalPos: goal } = fore;
        if (move) {
          const [x, y] = xy;
          const [mx, my] = move;
          cellUI.mark(x + mx, y + my, {
            tileID: 'move',
            animDuration: 300,
          });
        }
        if (goal) {
          const [gx, gy] = goal;
          cellUI.mark(gx, gy, {
            tileID: 'goal',
            animDuration: 500,
          });
        }
      }
    }
  };

  /** @type {Partial<CellUIHandler>} */
  const pauseUIHandler = {
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

            case 'n':
            case 'N':
              showLayer.notes = (showLayer.notes + 1) % (notes.length + 1);
              break;

            case '0':
              if (view.cellSize < initCellSize) {
                view.cellSize = initCellSize
                view.panToInclude(pendingMoveAt);
              } else {
                const [clientWidth, clientHeight] = view.clientSize;
                view.cellSize = Math.max(2,
                  Math.floor(clientWidth / worldWidth),
                  Math.floor(clientHeight / worldHeight));
                view.panTo([0, 0]);
              }
              break;
            case '-':
              view.cellSize = Math.max(2, view.cellSize - 2);
              break;
            case '+':
              view.cellSize = Math.min(256, view.cellSize + 2);
              break;

            case 'h':
              view.panByCell([-1, 0]);
              break;
            case 'j':
              view.panByCell([0, 1]);
              break;
            case 'k':
              view.panByCell([0, -1]);
              break;
            case 'l':
              view.panByCell([1, 0]);
              break;

          }
          break;
      }
    },

    mouseEvent({ type, clientX, clientY }) {
      if (helpDialog.isOpen) return;
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

  /** @type {Partial<CellUIHandler>} */
  const playUIHandler = {
    /* TODO for longer term goal setting / path finding
    mouseEvent({ type, clientX, clientY }) {
      switch (type) {
        case 'click':
          if (priorMode != 'targetActive') {
            cellUI.cursorMode = 'targetActive';
            cellUI.cursorAt = [fx, fy];
          } else if (priorAt[0] == fx && priorAt[1] == fy) {
            console.log('TODO move to', priorAt);
            cellUI.cursorMode = '';
          } else {
            cellUI.cursorAt = [fx, fy];
          }
          break;

        case 'mousemove':
          if (!priorMode || cellUI.cursorMode == 'targetHover') {
            cellUI.cursorMode = 'targetHover';
            cellUI.cursorAt = [fx, fy];
          }
          // TODO evaluate and indicated move feasibility
          break;
      }
    }, */
  };

  /** @type {null|((t: number) => void)} */
  let pendingFrame = null;

  const afterNextFrame = () => {
    return new Promise(resolve => {
      const prior = pendingFrame;
      pendingFrame = t => {
        if (prior) prior(t);
        resolve(t);
      };
    });
  };

  const logDialog = makeSingletonDialog({
    id: 'demo_debug_log',
    makeDialog,
    query(selector) { return $world.ownerDocument.querySelector(selector) },
  });
  const cellUI = makeCellUI({
    tileRend: tiles,
    view,
    tiles: cursorTiles,
    handle: pauseUIHandler,
    invoke: (action, mode, tile) => self.invokeCursorAction(action, mode, tile),
    log: (...stuff) => logDialog.main.innerText = stuff.map(x => typeof x == 'string' ? x : JSON.stringify(x)).join(' '),
  });
  cellUI.addEventListeners($world);
  view.animClock = cellUI.animClock;

  /** @typedef {object} ButtonSpec
   * @prop {string} id
   * @prop {number} viewX
   * @prop {number} viewY
   */

  /** @type {ButtonSpec[]} */
  const buttonSpecs = [];

  const ensureButtonsInView = () => {
    const {
      cellSize,
      clientSize: [clientWidth, clientHeight],
      cellOriginTo: [cellLeft, cellTop]
    } = view,
      cellWidth = Math.floor(clientWidth / cellSize),
      cellHeight = Math.floor(clientHeight / cellSize),
      left = Math.round(cellLeft * 1000) / 1000,
      top = Math.round(cellTop * 1000) / 1000;

    for (const { id, viewX, viewY } of buttonSpecs) {
      const tile = cellUI.refTile(id);
      if (!tile) continue;

      const
        wantX = left + (viewX < 0 ? cellWidth + viewX : viewX),
        wantY = top + (viewY < 0 ? cellHeight + viewY : viewY),
        animDuration = tile.anim[1],
        [x, y] = animDuration > 0 ? tile.offsetTo : tile.offset;
      if (x != wantX || y != wantY)
        tile.offset[0] = wantX, tile.offset[1] = wantY;
    }
  };

  {
    const helpButton = cellUI.createTile('help', Action.Help);
    cellUI.setActionKey(helpButton, '?');
    // TODO option to show help initially?
    buttonSpecs.push({ id: helpButton.$id, viewX: 0, viewY: -1 });
  }

  /** @type {ReturnType<makeNoteLayer>[]} */
  const notes = [];

  const makeNoteLayer = () => tiles.makeIDLayer({
    texture: cursorTiles.texture,
    dataScheme: {
      drawOrder: { sparse: { order: 'self' } },
      offset: 'vec2',
      tile: 'uint16',
    }
  });

  const makeNotes = () => {
    const layer = makeNoteLayer();
    layer.name = `notes[${notes.length}]`
    notes.push(layer);
    return {
      layer,
      /**
       * @param {number} x
       * @param {number} y
       * @param {string} tileID
       */
      note(x, y, tileID) {
        const layerID = cursorTiles.getLayerID(tileID);
        if (!layerID) throw new Error(`invalid note tile "${tileID}"`);
        const tile = layer.data.alloc();
        tile.drawOrder = Infinity;
        tile.offset[0] = x, tile.offset[1] = y;
        tile.tile = layerID;
      },
    };
  };

  let lastCurveClip = clipCurvyTiles;

  const landDepth = 4;
  const depth = makeWeightMap(bg.size[0], bg.size[1]);

  /** @type {Array<Set<string>>} */
  const depthActors = new Array(landDepth + 1);
  for (let i = 0; i < depthActors.length; i++) depthActors[i] = new Set();
  for (const [actorID, { move: { land, water } }] of Object.entries(actorTypes)) {
    if (land) depthActors[landDepth].add(actorID);
    for (let i = 0; i < water.length; i++)
      if (water[i]) depthActors[landDepth - 1 - i].add(actorID);
  }

  /** @param {number} x @param {number} y */
  const iterMoves = function*(x, y) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const
          td = Math.abs(dx) + Math.abs(dy),
          atx = x + dx,
          aty = y + dy;
        if (td == 1 && bg.contains(atx, aty))
          yield /** @type {[x: number, y: number]} */ ([atx, aty]);
      }
    }
  };

  const updatedBGCurved = () => {
    updateCurvedLayer(bgCurved , landCurveTiles,
      lastCurveClip
        ? clippedBaseCellQuery(bg, landCurveTiles)
        : extendedBaseCellQuery(bg, landCurveTiles));
  };

  /** @param {Parameters<xorbig.generateRandoms>[0]} seed */
  const generateWorld = seed => {
    for (const layer of notes) layer.delete();
    notes.length = 0;

    const
      randoms = xorbig.generateRandoms(seed),
      makeRandom = () => {
        const res = randoms.next();
        if (res.done) throw new Error('inconceivable: exhausted xorbig stream');
        return res.value;
      },

      { size: [width, height] } = bg,
      land = landCurveTiles.getLayerID(0b0000),
      water = landCurveTiles.getLayerID(0b1111);

    // generate terrain
    const genTerrain = ( /** @returns {(x: number, y: number) => number} */ () => {
      const { size: [width, height] } = bg;

      const isLand = new Uint8Array(width * height);

      const regionDescendUnder = 0.9;
      const skipAreaUnder = 0.3;
      const goalLandRatio = 0.2;
      const regionDensity = 0.25;

      // BSP -> (maybe) DLA

      const goalLandCount = goalLandRatio * width * height;
      let haveLandCount = 0;

      const { note: dlaNote } = makeNotes();

      const { random: randDescend } = makeRandom();
      const { random: randSplit } = makeRandom();
      for (const region of makeBSP({
        width, height,
        random: randSplit,
        minSize: 4,
      })) {
        if (haveLandCount > goalLandCount) break;

        const {
          left: regionLeft, top: regionTop,
          right: regionRight, bottom: regionBottom,
          width: regionWidth, height: regionHeight,
        } = region;

        const regionArea = region.width * region.height;
        const goalRemain = goalLandCount - haveLandCount;
        const areaRatio = regionArea / goalRemain;

        if (!region.isLeaf) {
          const regionRand = randDescend();
          const areaScore = Math.abs(areaRatio - 1.0);
          const regionScore = Math.pow(regionRand, areaScore / region.depth);
          if (regionScore < regionDescendUnder) {
            region.descend();
            continue;
          }
        } else if (region.depth > 1) {
          const areaRand = randDescend();
          const areaScore = Math.pow(areaRand, 1 / areaRatio);
          if (areaScore < skipAreaUnder) continue;
        }

        const { random: dlaRandom, randomBigint: dlaRand } = makeRandom()

        // seed
        // TODO this probably would simplify using mat2/vec2 maths
        const seedRange = [
          0.25, 0.75, // X range
          0.25, 0.75, // Y range
        ];
        const
          sx = regionLeft + Math.floor(regionWidth * (seedRange[0] + (seedRange[1] - seedRange[0]) * dlaRandom())),
          sy = regionTop + Math.floor(regionHeight * (seedRange[2] + (seedRange[3] - seedRange[2]) * dlaRandom()));
        isLand[width * sy + sx] = 1;

        dla({
          left: regionLeft, top: regionTop,
          width: regionWidth, height: regionHeight,
          hitLimit: Math.min(
            goalLandCount - haveLandCount,
            regionDensity * regionWidth * regionHeight,
          ),
          random: dlaRandom,
          rand: dlaRand,
          *all() {
            for (let i = 0; i < isLand.length; i++) {
              if (isLand[i]) {
                const x = i % width, y = Math.floor(i / width);
                if (x < regionLeft) continue;
                if (y < regionTop) continue;
                if (x >= regionRight) continue;
                if (y >= regionBottom) continue;
                yield { x, y };
              }
            }
          },
          test: (x, y) => isLand[y * width + x] ? true : false,
          set: (x, y) => isLand[y * width + x] = 1,
          note: dlaNote,
        });

        // TODO fiil swiss cheese holes
        // for (let x = regionLeft + 1; x < regionRight - 1; x++) {
        //   for (let y = regionTop + 1; y < regionBottom - 1; y++) {
        //     const i = width * y + x;
        //
        //     if (isLand[i]) continue;
        //
        //     // console.log(x, y,
        //     //   isLand[i],
        //     //   isLand[width * y + (x - 1)],
        //     //   isLand[width * y + (x + 1)],
        //     //   isLand[width * (y - 1) + x],
        //     //   isLand[width * (y + 1) + x],
        //     // );
        //
        //     // if (!isLand[width * y + (x - 1)]) continue;
        //     // if (!isLand[width * y + (x + 1)]) continue;
        //     // if (!isLand[width * (y - 1) + x]) continue;
        //     // if (!isLand[width * (y + 1) + x]) continue;
        //
        //     // isLand[i] = 1;
        //
        //   }
        // }

        haveLandCount = isLand.reduce((a, b) => a + b);
      }

      // console.log(
      //   haveLandCount,
      //   goalLandCount,
      //   haveLandCount / goalLandCount,
      //   haveLandCount / (width * height),
      // );

      return (x, y) => isLand[y * width + x] ? land : water;
    })();

    // compute height/depth map ; TODO land is flat for now
    depth.update(function*() {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const layerID = genTerrain(x, y);
          switch (layerID) {
            case land:
              yield [x, y, landDepth]
              break;

            case water:
              break;

            default:
              console.warn('unknown terrain depth', { x, y, tile: landCurveTiles.getTileID(layerID) });
              break;
          }
        }
      }
    }());

    const iterDepth = function*() {
      const W = depth.weight;
      let x = 0, y = 0, i = 0;
      while (i < W.length) {
        const depth = W[i];
        yield { x, y, i, depth };
        i++, x++;
        if (x >= width) x -= width, y++;
      }
    };

    {
      const { note } = makeNotes();
      for (const { x, y, depth } of iterDepth())
        note(x, y, `note${depth}`);
    }

    // TODO depth based water color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = bg.at(x, y);
        if (!cell) continue;
        cell.tile = genTerrain(x, y);
      }
    }

    // place fore objects
    fg.data.clear();

    /** @type {MortonMap<string>} */
    const occ = makeMortonMap();

    const generateActors = function*() {
      const { random: randTile } = makeRandom();
      for (const { x, y, depth } of iterDepth()) {
        const actorIDs = depthActors[depth];
        const actorChoice = choose(actorIDs, { random: randTile });
        if (!actorChoice) continue;

        const {
          item: actorID,
          score: actorScore,
          count: actorChoiceCount,
        } = actorChoice;

        // avoid placing any tiles next to each other
        let neighbors = 0;
        for (const [atx, aty] of iterMoves(x, y)) {
          const at = occ.at(atx, aty);
          if (at.count == 0) continue;
          for (const atID of at) {
            const atTileID = foreTiles.getTileID(fg.ref(atID)?.tile || NaN);
            if (atTileID !== undefined && atTileID != actorID) {
              neighbors++;
              break;
            }
          }
        }
        if (neighbors > 0) continue;

        // for every candidate tile that may be placed here,
        // there's an equal chance to just not place anything
        if (Math.pow(randTile(), 1 / actorChoiceCount) > actorScore) continue;

        const layerID = foreTiles.getLayerID(actorID);
        if (!layerID) throw new Error(`missing actor #${actorID} fore tile`);
        const tile = fg.data.alloc();
        tile.offset[0] = x, tile.offset[1] = y;
        tile.tile = layerID;
        tile.drawOrder = Infinity;
        occ.at(x, y).add(tile.$id);
        yield tile.$id;
      }
    };

    {
      // NOTE this is mostly an obsolete test/debug audit
      /** @type {Set<string>} */
      const newIDs = new Set();
      let lastID = '';
      for (const id of generateActors()) {
        if (newIDs.has(id)) {
          console.warn(`fg dupe id:${id} lastID:${lastID}`);
          break;
        }
        newIDs.add(id);
        lastID = id;

        const ref = fg.ref(id);
        if (!ref) throw new Error(`refless new actor id:${id}`);
      }
    }

    // XXX wat was fg.prune() doing here

    // TODO general curved tile set support for more terrain types like colored water depth
    updatedBGCurved();
  };

  /** @param {MortonMap<string>} mm */
  const ensurePlayer = mm => {
    // scan for active currently user
    // TODO a secondary index over kind could be useful here
    for (const { $index, value } of fg.data.aspects.kind)
      if (value & Kind.User) return fg.data.get($index);

    // no active user, so spawn one at the most move-free cell
    let bestIndex = -1, bestScore = -1;
    for (const { $index, value: [x, y] } of fg.data.aspects.offset) {
      let free = 0;
      for (const [atx, aty] of iterMoves(x, y))
        if (mm.at(atx, aty).count == 0) free++;
      if (free > bestScore) {
        bestIndex = $index;
        bestScore = free;
        // NOTE we probably can stop once we find a candidate past a certain freedom threshold,
        // since you can't do better than "all moves free"...
        // or we could just randomly sample instead, merely weight by freedom score
      }
    }

    const player = fg.data.get(bestIndex);
    player.kind = Kind.User;
    gameLog('player is %o', gameLogFGRef(player));
    return player;
  };

  const resetMoves = () => {
    for (const tile of fg.data) {
      tile.move.fill(0);
      tile.goal.fill(0);
    }
  };

  const chooseMoves = async function*() {
    const
      { size: [width, height] } = bg,
      amp = Math.floor(Math.min(width, height) / 2),
      scratch = makeWeightMap(width, height);

    for (const tile of fg.data) {
      const
        { $id, offset: [x, y], tile: layerID, kind, move, goal } = tile,
        moveFlags = move[0],
        state = moveFlags & Move.StateMask;
      if (state != 0) continue;

      if ((kind & Kind.User) != 0) {
        await promptMove(tile, move);
      } else {
        const subjectID = foreTiles.getTileID(layerID);
        if (subjectID === undefined) continue;

        scratch.update(function*() {
          for (const { $id: candID, offset: [x, y], tile: layerID } of fg.data) {
            if (candID == $id) continue;
            const objectID = foreTiles.getTileID(layerID);
            if (objectID === undefined) continue;
            if (objectID === subjectID) continue;

            yield [x, y, amp];
          }
        }());

        const moveChoice = scratch.choose(x, y);
        if (moveChoice) {
          const { x: mx, y: my, dx, dy } = moveChoice;
          const [gx, gy] = scratch.chase(mx, my);
          move[0] = Move.Defined, move[1] = dx, move[2] = dy;
          goal[0] = Goal.Defined, goal[1] = gx, goal[2] = gy;
        }
      }

      yield { $id, tile, move, goal };
    }
  };

  /** @typedef {[dx: number, dy: number]} MoveInput */

  /** @type {null|((moveIn: MoveInput) => void)} */
  let pendingMoveInput = null;

  /** @type {[x: number, y: number]} */
  const pendingMoveAt = [0, 0];

  /** @param {MoveInput} moveIn @param {string} mode */
  const resolveMoveInput = (moveIn, mode) => {
    if (pendingMoveInput == null) return false;
    pendingMoveInput(moveIn);
    pendingMoveInput = null;
    cellUI.cursorMode = '';
    lastPromptMode = mode;
    clearMyActions();
    return true;
  };

  /**
   * @param {number} atX
   * @param {number} atY
   * @returns {Promise<MoveInput>}
   */
  const moveInput = (atX, atY) => {
    pendingMoveAt[0] = atX, pendingMoveAt[1] = atY;
    showMePrompt();
    return new Promise(resolve => pendingMoveInput = resolve);
  };

  let lastPromptMode = 'mouse';

  const showMePrompt = () => {
    cellUI.cursorMode = 'moveMe';
    cellUI.cursorAt = pendingMoveAt;
    const [x, y] = pendingMoveAt;
    updateMyActions([
      // TODO adapt tiles based on lastPromptMode-ality
      { xy: [x, y - 1], action: Action.MoveUp, tileID: 'moveUp' },
      { xy: [x + 1, y], action: Action.MoveRight, tileID: 'moveRight' },
      { xy: [x, y + 1], action: Action.MoveDown, tileID: 'moveDown' },
      { xy: [x - 1, y], action: Action.MoveLeft, tileID: 'moveLeft' },
    ]);
  };

  /**
   * @param {ForeTile} tile
   * @param {[flags: number, x: number, y: number]} move
   */
  const promptMove = async (tile, move) => {
    ensureViewContains(tile);
    const [x, y] = tile.offset;
    const [dx, dy] = await moveInput(x, y);
    move[0] = Move.Defined, move[1] = dx, move[2] = dy;
  };

  /**
   * @param {object} params
   * @param {MortonMap<string>} params.mm
   * @param {string} params.$id
   * @param {ForeTile} [params.tile]
   */
  const procMove = params => {
    const { mm, $id, tile = fg.ref($id) } = params;
    if (!tile) throw new Error('must have tile');

    const
      { offset: [x, y], move, kind } = tile,
      [moveFlags, mx, my] = move,
      state = moveFlags & Move.StateMask;

    if (state != Move.Defined) return false;

    if (mx == 0 && my == 0) {
      move[0] = Move.Stay | Move.Proced;
      return true;
    }

    const tx = x + mx, ty = my + y;
    /** @type {null|ReturnType<fg["ref"]>} */
    let targ = null;
    for (const tid of mm.at(tx, ty)) {
      targ = fg.ref(tid);
      if (!targ) throw new Error(`missing target id ${tid} @<${tx}, ${ty}>`);
      break;
    }

    const subjectID = foreTiles.getTileID(tile.tile);
    if (subjectID == undefined) throw new Error(`no tile for actor tile id ${$id} @<${x}, ${y}>`);

    if (!targ) {
      const targDepth = depth.at(tx, ty);
      if (targDepth === undefined || !depthActors[targDepth].has(subjectID)) {
        move[0] = Move.Nope | Move.Proced;
        return true;
      }

      move[0] = Move.Move | Move.Proced;
      mm.at(tx, ty).add($id);
      mm.at(x, y).del($id);
      return true;
    }

    let canBoop = true;
    const
      { $id: tid, tile: targTile, move: targMove, kind: targKind } = targ,
      [tMoveFlags] = targMove,
      tState = tMoveFlags & Move.StateMask;
    switch (tMoveFlags & Move.ActionMask) {
      case Move.Move:
        canBoop = tState != Move.Proced; // concurrent move glances
        break;

      case Move.Boop:
        canBoop = tState != Move.Proced; // concurrent boop glances
        break;

      case Move.Dead: // lost to another booper
        canBoop = false;
        break;

      case Move.Stay:
      case Move.Nope:
      default:
    }

    if (!canBoop) {
      move[0] = Move.Nope | Move.Proced;
      return true;
    }

    const objectID = foreTiles.getTileID(targTile);
    if (objectID == undefined)
      throw new Error(`missing target tile for id ${tid} @<${tx}, ${ty}>`);

    // TODO other interaction outcomes than "death to all others"
    if (subjectID !== objectID) {
      if (kind & Kind.User && targKind & Kind.User) {
        move[0] = Move.Nope | Move.Proced;
      } else {
        const canSee = view.containsCell(x, y) || view.containsCell(tx, ty);
        if (canSee)
          gameLog('%o kills %o', gameLogFGRef(tile), gameLogFGRef(targ));
        move[0] = Move.Boop | Move.Proced;
        targMove[0] = Move.Dead | Move.Proced;
      }
    } else {
      if (kind & Kind.User) {
        if (targKind & Kind.User) {
          move[0] = Move.Nope | Move.Proced;
        } else {
          targ.kind |= Kind.User;
          gameLog('user takes control of %o', gameLogFGRef(targ));
          move[0] = Move.Boop | Move.Proced;
        }
      } else {
        move[0] = Move.Nope | Move.Proced;
      }
    }
    return true;
  };

  /**
   * @param {ForeTile} tile
   * @param {number} duration
   * @param {AnimMode} mode
   */
  const startAnim = (tile, duration, delay = 0, mode = 'once') => {
    tile.anim = initAnim(fg.animClock, duration, delay, mode);
    tile.offsetTo = tile.offset;
    tile.tileTo = tile.tile;
  };

  /**
   * @param {ForeTile} tile
   */
  const finAnim = tile => {
    tile.anim.fill(0);
    tile.offsetTo.fill(0);
    tile.tileTo = 0;
  };

  /** @param {number} animTime */
  const animateMoves = async animTime => {
    let any = false;
    for (const tile of fg.data) {
      const
        { offset: [x, y], move: [moveFlags, mx, my] } = tile,
        state = moveFlags & Move.StateMask,
        action = moveFlags & Move.ActionMask;
      if (state != Move.Proced) continue;

      if (action == Move.Stay) {
        // stay by shrinking 10%
        startAnim(tile, animTime);
        tile.scaleTo *= 0.9;
      }

      else if (action == Move.Nope) {
        // nope by trible shaking: there and back thrice, but only 1/8th of the way
        startAnim(tile, animTime / 6, 0, 'loopback');
        tile.offsetTo[0] = x + mx / 8, tile.offsetTo[1] = y + my / 8;
      }

      else if (action == Move.Move) {
        // just lol move there, nothing to see here
        startAnim(tile, animTime);
        tile.offsetTo[0] = x + mx, tile.offsetTo[1] = my + y;
      }

      else if (action == Move.Boop) {
        // boop by moving half way there and back
        startAnim(tile, animTime / 2, 0, 'loopback');
        tile.offsetTo[0] = x + mx / 2, tile.offsetTo[1] = y + my / 2;
      }

      else if (action == Move.Dead) {
        // die by shrinking away, but only take half move time, and coordinated to start at boop apex
        startAnim(tile, animTime / 2, animTime / 2, 'once');
        tile.scaleTo = 0;
        // TODO fade tile to null ( or skull? )
        // TODO would be nice to have option to animate mirror flip
      }

      else continue;

      any = true;
    }
    return any
      ? fg.animClock.afterDuration(animTime)
      : fg.animClock.time;
  };

  /** @param {MortonMap<string>} mm */
  const finishMoves = (mm) => {
    for (const tile of fg.data) {
      const
        { $id, $index, offset: [x, y], move, kind } = tile,
        [moveFlags, mx, my] = move,
        state = moveFlags & Move.StateMask,
        action = moveFlags & Move.ActionMask;
      if (state != Move.Proced) continue;

      const isUser = !!(kind & Kind.User);

      move[0] = action | Move.Done;

      if (action == Move.Stay) {
        finAnim(tile);
      }

      else if (action == Move.Nope) {
        finAnim(tile);
      }

      else if (action == Move.Move) {
        tile.offset[0] = x + mx, tile.offset[1] = my + y;
        finAnim(tile);
      }

      else if (action == Move.Boop) {
        finAnim(tile);
      }

      else if (action == Move.Dead) {
        if (isUser) gameLog('RIP user %o', gameLogFGRef(tile));
        mm.at(x, y).del($id);
        fg.data.free($index); // TODO clear drawOrder
      }

      else
        console.warn('unsure how to finish move', { $id, loc: [x, y], action });
    }
  };

  let playing = false;
  let playButtonID = '';
  {
    const playButton = cellUI.createTile('play', Action.PlayPause);
    playButtonID = playButton.$id;
    cellUI.setActionKey(playButton, ' ');

    if (startPlaying)
      afterNextFrame().then(() =>
        self.invokeCursorAction(Action.PlayPause, 'mouse' /** TODO isDesktop ? 'mouse' : 'touch' */, null));
    buttonSpecs.push({ id: playButtonID, viewX: -1, viewY: -1 });
  }

  /** @type {string[]} */
  const myActionIDs = [];

  /** @typedef {object} MyAction
   * @prop {[x: number, y: number]} xy
   * @prop {number} action
   * @prop {string} [actionKey]
   * @prop {string} tileID
   */

  /** @param {Iterable<MyAction>} actions */
  const updateMyActions = actions => {
    let i = 0;
    for (const {
      xy: [x, y], tileID, action,
      actionKey = ActionKeys.get(action),
    } of actions) {
      const priorID = i < myActionIDs.length ? myActionIDs[i] : '';
      if (priorID !== '') {
        const act = cellUI.refTile(priorID);
        if (act) {
          act.tile = cursorTiles.getLayerID(tileID);
          act.action = action;
          act.offset[0] = x, act.offset[1] = y;
          cellUI.setActionKey(act, actionKey || '');
          continue;
        }
      }
      const act = cellUI.createTile(tileID, action);
      act.offset[0] = x, act.offset[1] = y;
      cellUI.setActionKey(act, actionKey || '');
      if (i < myActionIDs.length) myActionIDs[i] = act.$id;
      else myActionIDs.push(act.$id);
      i++;
    }
    while (i < myActionIDs.length) {
      const dedID = myActionIDs.pop();
      if (dedID != undefined)
        cellUI.freeTile(dedID);
    }
  };

  const clearMyActions = () => {
    for (const dedID of myActionIDs)
      cellUI.freeTile(dedID);
  };

  /** @param {string|ForeTile} id */
  const ensureViewContains = id => {
    const tile = typeof id == 'string' ? fg.ref(id) : id;
    if (!tile) return;
    const {
      origin: [worldLeft, worldTop],
      size: [worldWidth, worldHeight],
    } = bg;
    const { offset: [x, y] } = tile;
    view.panToInclude([x, y], {
      margin: [3, 3],
      boundLower: [worldLeft, worldTop],
      boundUpper: [worldLeft + worldWidth, worldTop + worldHeight],
    });
  };

  /** @param {AnimClock} gameAnim */
  const gameLoop = async gameAnim => {
    const userAnimTime = 400;

    await afterNextFrame();

    gameAnim.reset();

    let turn = 0;
    gameLog = (mess, ...refs) => gameLogSink(turn, mess, ...refs);

    const mm = makeMortonMap();
    const updateMM = () => {
      mm.clear();
      for (const { $id, offset: [x, y] } of fg.data)
        mm.at(x, y).add($id);
    };

    generateWorld(seed);

    updateMM();
    ensureViewContains(ensurePlayer(mm));

    let moveAnimTime = userAnimTime;
    let spin = 0;
    while (true /** TODO game halt condition check */) {
      if (spin > 0) {
        const backoff = Math.pow(2, spin);
        if (backoff >= userAnimTime) {
          onState({ halt: 'idle' });
          return true;
        }
        await gameAnim.afterDuration(backoff);
      } else await gameAnim.afterDuration(1);

      const turnStart = gameAnim.time;

      turn++;
      onState({ turn });

      updateMM(); // TODO this probably doesn't need cleared between turns, but caution...
      ensureViewContains(ensurePlayer(mm));

      resetMoves();
      for await (const choice of chooseMoves()) {
        const
          { tile: { offset: [x, y], kind } } = choice,
          isUser = !!(kind & Kind.User);
        if (!procMove({ mm, ...choice })) continue;
        if (view.containsCell(x, y))
          await animateMoves(
            moveAnimTime = isUser
              ? userAnimTime
              : Math.max(10, moveAnimTime * 0.8)
          );
        finishMoves(mm);
      }

      const turnEnd = gameAnim.time;
      const turnTime = turnEnd - turnStart;

      if (turnTime < moveAnimTime) spin++;
      else spin = 0;
    }
  };

  const { stop: stopFrameLoop, frames } = frameLoop(gl);

  const drawLoop = async () => {
    for await (const t of frames) {
      cellUI.animClock.update(t);
      if (playing) gameAnim.update(t);

      if (pendingFrame) {
        pendingFrame(t);
        pendingFrame = null;
      }

      if (playing && (
        !self.gameDone ||
        await Promise.race([
          self.gameDone,
          Promise.resolve(false),
        ]))) {
        self.playing = false;
        self.gameDone = null;
      }

      {
        const { clientWidth, clientHeight } = $world;
        if ($world.width != clientWidth ||
          $world.height != clientHeight) {
          $world.width = clientWidth;
          $world.height = clientHeight;
        }
      }
      view.update();
      ensureButtonsInView();

      const nowCurveClip = clipCurvyTiles;
      if (lastCurveClip != nowCurveClip) {
        lastCurveClip = nowCurveClip;
        updatedBGCurved();
      }

      drawFrame();
    }
  };

  const drawFrame = () => {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // TODO: allow viewport zoom/pan?
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);

    // TODO: why can't this persist across frames?
    tiles.texCache.clear();

    tiles.bind();
    view.bind();

    // TODO at some point, it'll be worth it to cull layers that don't
    // intersect perspective, but for now we just use leave GL's vertex culling

    if (showLayer.bgCurved) {
      // TODO curved draw wrapper?
      const
        { origin: [left, top], size: [width, height] } = bg,
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

    if (showLayer.notes) {
      const i = showLayer.notes - 1;
      const layer = notes[i];
      layer.draw();
    }

    cellUI.draw();

    view.unbind();
    tiles.unbind();
  };

  const helpContent = () => self.playing ? `
    <p>
      Play proceeds one entity at a time.
      Input for player player controlled entities may be provided by:
      <tt>W A S D</tt> movement keys, clicking adjacent arrow action tiles, or with (TODO) touch input.
    </p>

    <p>Press <tt>?</tt> to open/close this help screen.</p>

    <p>Press <tt>&lt;Space&gt;</tt> to pause the game.
      While paused, various game aspects may be inspected or changed.
      See its <tt>?</tt> help screen for details.
    </p>
    ` :
    `<table>
      <thead>
        <tr><th colspan="2" align="center">Keymap</th></tr>
        <tr><th>Key</th><th>Description</th></tr>
      </thead>
      <tbody>

        <tr><td><tt>&lt;Space&gt;</tt></td><td>
          Play / pause game simulation; when paused, mouse may be used to inspect tiles.</td></tr>

        <tr><td><tt>C</tt></td><td>
          Toggle curved layer mode: off, on with edge extendion, on sans edge extension.</td></tr>

        <tr><td><tt>F</tt></td><td>
          Toggle foreground layer visibility.</td></tr>

        <tr><td><tt>N</tt></td><td>
          Cycle through note layer visibility; note layers may be used for things like terrain depth/height or procgen feedback.</td></tr>

        <tr><td>
          <tt>-</tt>
          <tt>+</tt>
        </td><td>
          Decrease / increase view cell size.</td></tr>

        <tr><td><tt>0</tt></td><td>
          Zoom viewport out to fit entire world, or back in to initial size.</td></tr>

        <tr><td>
          <tt>H</tt>
          <tt>J</tt>
          <tt>K</tt>
          <tt>L</tt>
        </td><td>
          Vi-style arrows to pan viewport.</td></tr>

        <tr><td><tt>?</tt></td><td>
          Open/close (this) help dialog.</td></tr>

      </tbody>
    </table>

    <br />
    <p>
    May also use the mosue to inspect cells: hover and click to pin; disabled when help screen is shown.
    </p>
`;

  const self = {
    get playing() { return playing },
    set playing(p) {
      playing = p;

      if (playing && !self.gameDone)
        self.gameDone = gameLoop(gameAnim);
      if (!playing) gameAnim.pause();

      cellUI.handle = playing ? playUIHandler : pauseUIHandler;
      if (playing) inspectorDialog.close();
      if (playing && pendingMoveInput) showMePrompt();

      const tile = cellUI.refTile(playButtonID);
      if (tile) tile.tile = cursorTiles.getLayerID(playing ? 'pause' : 'play');
    },

    get view() { return view },

    get cellSize() { return view.cellSize },
    set cellSize(size) { view.cellSize = size },

    /** @param {number} w @param {number} h */
    resizeWorld(w, h) {
      worldWidth = w;
      worldHeight = h;
      bg.size = [w, h];
      bgCurved.size = [w + 1, h + 1];
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

    /**
     * @param {number} action
     * @param {string} mode
     * @param {UITile|null} _tile
     */
    async invokeCursorAction(action, mode, _tile) {
      switch (action) {

        case Action.Help:
          if (helpDialog.isOpen) helpDialog.close();
          else {
            cellUI.cursorMode = '';
            inspectorDialog.close();
            helpDialog.main.innerHTML = helpContent();
          }
          break;

        case Action.PlayPause:
          self.playing = !self.playing;
          if (helpDialog.isOpen) helpDialog.main.innerHTML = helpContent();
          break;

        case Action.MoveUp:
          resolveMoveInput([0, -1], mode);
          break;

        case Action.MoveRight:
          resolveMoveInput([1, 0], mode);
          break;

        case Action.MoveDown:
          resolveMoveInput([0, 1], mode);
          break;

        case Action.MoveLeft:
          resolveMoveInput([-1, 0], mode);
          break;

        case Action.MoveStay:
          resolveMoveInput([0, 0], mode);
          break;

        default:
          console.warn('unknown cursor action', action);
      }
    },

    /** @type {null|Promise<boolean>} */
    gameDone: playing ? gameLoop(gameAnim) : null,

    stop: stopFrameLoop,
    done: drawLoop().finally(() =>
      cellUI.removeEventListeners($world)),

    restart() {
      self.gameDone = gameLoop(gameAnim);
      self.playing = true;
    },

    at: worldAt,
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

/**
 * @param {TileRenderer} tileRend
 * @param {TileSheet<string>} tiles
 */
const makeUILayer = (tileRend, tiles) => tileRend.makeIDLayer({
  animClock: tileRend.makeAnimClock(),
  texture: tiles.texture,
  dataScheme: {
    // tile rendering components
    drawOrder: { sparse: { order: 'self' } },

    // TODO structify
    offset: 'vec2',
    spin: 'float32',
    scale: { type: 'float32', init: 1 },
    tile: 'uint16',

    // TODO structify
    // ...tile animation components
    anim: 'vec3', // XXX struct: {start_time, duration, mode}
    offsetTo: 'vec2',
    spinTo: 'float32',
    scaleTo: { type: 'float32', init: 1 },
    tileTo: 'uint16',

    // UI action handling components
    action: 'uint8',
    stashXY: 'vec3',
  },
});


/** @typedef {ReturnType<typeof makeUILayer>} UILayer */
/** @typedef {NonNullable<ReturnType<UILayer["ref"]>>} UITile */

/** @typedef {object} CellUIHandler
 * @prop {(e: MouseEvent) => void} mouseEvent
 * @prop {(e: KeyboardEvent) => void} keyEvent
 */

/**
 * @param {object} params
 * @param {TileRenderer} params.tileRend
 * @param {View} params.view
 * @param {TileSheet<string>} params.tiles
 * @param {(action: number, mode: 'mouse'|'key'|'touch', tile: UITile|null) => void} [params.invoke]
 * @param {Partial<CellUIHandler>} [params.handle]
 * @param {(...stuff: any[]) => void} [params.log]
 */
function makeCellUI({
  tileRend,
  view,
  tiles: cursorTiles, // TODO provide default / maybe only accept spec? or if dynamci sheet, just setend given...
  invoke = () => { },
  log: _log = () => { },
  handle: {
    mouseEvent: handleMouseEvent = () => { },
    keyEvent: handleKeyEvent = () => { },
  } = {},
}) {
  const
    uiLayer = makeUILayer(tileRend, cursorTiles),

    // TODO in an ideal world, DataFrame would support this as a MapType aspect with reverse lookup
    /** @type {Map<number, string>} */
    uiActionKey = new Map(),
    /** @type {Map<string, number>} */
    uiKeyAction = new Map();

  uiLayer.name = 'cellUI';

  let
    /** @type {null|string} */
    cursorID = null,

    /** @type {[x: number, y: number]} */
    cursorAt = [0, 0],

    /** @type {null|string} */
    cursorHoverID = null,

    showTouchNotes = false,

    // bare touch point data, collected since first touchstart
    // TODO use a SparseDataFrame here
    /** @type {number[]} */
    touchIDs = [],
    /** @type {string[]} */
    touchCursorIDs = [],
    touchTimes = new Uint32Array(0), // stride 3, 3 times per touch
    touchPoints = new Float32Array(0), // stride 6, 3 xy points per touch
    touchRange = new Float32Array(0), // stride 4, 2 xy points per touch

    // gesture recognition data, resets after handling (...in final touchend?)
    touchCount = 0,
    touchCountMax = 0,
    touchAnyMove = false
    ;

  /** @param {number} touchID */
  const findTouch = touchID => {
    for (let i = 0; i < touchIDs.length; i++)
      if (touchIDs[i] === touchID) return i;
    return -1;
  };

  const reuseTouch = () => {
    for (let i = 0; i < touchIDs.length; i++)
      if (touchIDs[i] === 0) return i;
    return -1;
  };

  const allocTouch = () => {
    const i = touchIDs.length;
    let alloc = touchIDs.length ? touchIDs.length : 2;
    while (alloc <= i) alloc *= 2;
    if (alloc > touchIDs.length) {
      // TODO better way to grow native array?
      while (touchIDs.length < alloc) touchIDs.push(0);
      while (touchCursorIDs.length < alloc) touchCursorIDs.push('');
      const newTimes = new Uint32Array(3 * alloc);
      const newPoints = new Float32Array(6 * alloc);
      const newRange = new Float32Array(4 * alloc);
      newTimes.set(touchTimes);
      newPoints.set(touchPoints);
      newRange.set(touchRange);
      touchTimes = newTimes;
      touchPoints = newPoints;
      touchRange = newRange;
    }
    return i;
  };

  /** @param {number} touchID */
  const getTouch = touchID => {
    let i = findTouch(touchID);
    if (i < 0) {
      i = reuseTouch();
      if (i < 0) i = allocTouch();
      touchIDs[i] = touchID;
      touchCountMax = Math.max(touchCountMax, ++touchCount);
    }
    return i;
  };

  /** @param {number} i */
  const freeTouch = i => {
    touchIDs[i] = 0;
    --touchCount;
  };

  const resetGesture = () => {
    touchIDs.fill(0);
    touchTimes.fill(0);
    touchPoints.fill(0);
    touchRange.fill(0);
    touchCount = 0;
    touchCountMax = 0;
    touchAnyMove = false;
  };

  const gestureType = () => {
    if (touchCountMax <= 3)
      return `${touchAnyMove ? 'swipe' : 'tap'}-${touchCountMax}`;

    // TODO should tap recognition be loosened to "range stayed inside one action"?
    //      i.e. start *move end all inside one cell

    // TODO fancier things like twist/pinch/...

    return 'unknown';
  };

  /** @param {number} i @param {number} t @param {number} x @param {number} y */
  const startTouchPoint = (i, t, x, y) => {
    const ti = 3 * i;
    const pi = 6 * i;
    const ri = 4 * i;
    touchTimes[ti + 0] = t;
    touchTimes[ti + 1] = t;
    touchTimes[ti + 2] = t;
    touchPoints[pi + 0] = x, touchPoints[pi + 1] = y;
    touchPoints[pi + 2] = x, touchPoints[pi + 3] = y;
    touchPoints[pi + 4] = x, touchPoints[pi + 5] = y;
    touchRange[ri + 0] = x, touchRange[ri + 1] = y;
    touchRange[ri + 2] = x, touchRange[ri + 3] = y;
  };

  /** @param {number} i @param {number} t @param {number} x @param {number} y */
  const updateTouchPoint = (i, t, x, y) => {
    const ti = 3 * i;
    const pi = 6 * i;
    const ri = 4 * i;
    touchTimes[ti + 1] = touchTimes[ti + 2];
    touchTimes[ti + 2] = t;
    touchPoints[pi + 2] = touchPoints[pi + 4], touchPoints[pi + 3] = touchPoints[pi + 5];
    touchPoints[pi + 4] = x, touchPoints[pi + 5] = y;
    touchRange[ri + 0] = Math.min(x, touchRange[ri + 0]), touchRange[ri + 1] = Math.min(y, touchRange[ri + 1]);
    touchRange[ri + 2] = Math.max(x, touchRange[ri + 2]), touchRange[ri + 3] = Math.max(y, touchRange[ri + 3]);
    if (!touchAnyMove) {
      // TODO tolerance, based on underlying event radiusXY?
      if (touchPoints[pi + 0] != x || touchPoints[pi + 1] != y) touchAnyMove = true;
    }
  };

  /** @param {number} i */
  const refTouch = i => ({
    get index() { return i },

    get duration() {
      const ti = 3 * i;
      return touchTimes[ti + 2] - touchTimes[ti + 0];
    },

    /** @returns {[x: number, y: number]} */
    get at() {
      const pi = 6 * i;
      return [touchPoints[pi + 4], touchPoints[pi + 5]];
    },

    /** @returns {[x: number, y: number]} */
    get startAt() {
      const pi = 6 * i;
      return [touchPoints[pi + 0], touchPoints[pi + 1]];
    },

    get dt() {
      const ti = 3 * i;
      return touchTimes[ti + 2] - touchTimes[ti + 1];
    },

    /** @returns {[x: number, y: number]} */
    get dxy() {
      const pi = 6 * i;
      return [
        touchPoints[pi + 4] - touchPoints[pi + 2],
        touchPoints[pi + 5] - touchPoints[pi + 3]
      ];
    },

    /** @returns {[x1: number, y1: number, x2: number, y2: number]} */
    get range() {
      const ri = 4 * i;
      return [
        touchRange[ri + 0], touchRange[ri + 1], // min
        touchRange[ri + 2], touchRange[ri + 3], // max
      ];
    },

    get cursorID() { return touchCursorIDs[i]; },
    set cursorID(id) { touchCursorIDs[i] = id },

  });
  /** @typedef {ReturnType<refTouch>} Touch */

  /** @param {UITile} tile */
  const freeTile = tile => {
    uiLayer.data.free(tile.$index);
  };

  // TODO reconsider as a Map aspect or as a secondary Map-based index attached to a DataFrame
  /** @param {UITile} tile */
  const freeAction = (tile) => {
    const { action } = tile;
    const old = uiActionKey.get(action);
    uiActionKey.delete(action);
    if (old) uiKeyAction.delete(old);
    freeTile(tile);
  };

  /** @param {UITile} tile */
  const getActionKey = (tile) => {
    const { action } = tile;
    return action && uiActionKey.get(action) || '';
  };

  /** @param {UITile} tile @param {string} key */
  const setActionKey = (tile, key) => {
    const { action } = tile;
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
  };

  /** @param {number} cellX @param {number} cellY */
  const actionsAt = function*(cellX, cellY) {
    const
      fx = Math.floor(cellX),
      fy = Math.floor(cellY);
    for (const tile of uiLayer.data) {
      const { offset: [x, y], action } = tile;
      if (action && x == fx && y == fy)
        yield tile;
    }
  };

  /**
   * @param {UITile} tile
   * @param {number} duration
   * @param {AnimMode} mode
   */
  const startAnim = (tile, duration, delay = 0, mode = 'once') => {
    tile.anim = initAnim(uiLayer.animClock, duration, delay, mode);
    tile.offsetTo = tile.offset;
    tile.tileTo = tile.tile;
  };

  /**
   * @param {UITile} tile
   */
  const finAnim = tile => {
    tile.anim.fill(0);
    tile.offsetTo.fill(0);
    tile.tileTo = 0;
  };


  /** @param {UITile} tile */
  const afterAnim = (tile, rounds = 1) => new Promise(resolve => {
    const { $id, anim: [animStart, animDuration] } = tile;
    uiLayer.animClock
      .afterTime(animStart + rounds * animDuration)
      .then(time => {
        const tile = uiLayer.ref($id);
        if (tile) resolve({ time, tile });
      });
  });

  const applyCursorPulse = (tile = cursorID && uiLayer.ref(cursorID)) => {
    if (!tile) return;
    startAnim(tile, 200, 0, 'loopback');
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
      if (tile) {
        tile.offset[0] = tile.offsetTo[0] = cursorAt[0];
        tile.offset[1] = tile.offsetTo[1] = cursorAt[1];
      }
    },

    get cursorMode() {
      if (cursorID == null) return '';
      const tile = uiLayer.ref(cursorID);
      return tile && cursorTiles.getTileID(tile.tile) || '';
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
            const cur = uiLayer.data.alloc();
            cur.drawOrder = Infinity;
            cursorID = cur.$id;
          }

          const tile = uiLayer.ref(cursorID);
          if (!tile) throw new Error(`lost cursor tile ${cursorID}`);
          tile.offset[0] = tile.offsetTo[0] = cursorAt[0];
          tile.offset[1] = tile.offsetTo[1] = cursorAt[1];
          tile.tile = tile.tileTo = layerID;
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
        tile.tile = 0;
      cellUI.cursorHover = null;
    },

    *prune() {
      for (const tile of uiLayer.data) {
        const { $id, action } = tile;
        if ($id == cursorID) yield tile;
        else if (!action) freeTile(tile);
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
      const tile = uiLayer.data.alloc();
      tile.drawOrder = Infinity;
      tile.offset[0] = x;
      tile.offset[1] = y;
      tile.tile = layerID;
      startAnim(tile, animDuration, 0, 'loopback');
      if (!cellUI.applyPulse(tile)) {
        tile.scale = 1.0;
        tile.scaleTo = 0.9;
      }
    },

    /**
     * @param {UITile} tile
     * @param {string} suffix
     */
    addSuffix(tile, suffix) {
      const tileID = cursorTiles.getTileID(tile.tile);
      if (!tileID) return;
      const layerID = cursorTiles.getLayerID(`${tileID}${suffix}`);
      if (layerID) tile.tile = layerID;
    },

    /**
     * @param {UITile} tile
     * @param {'once'|'loop'|'loopback'} [mode]
     */
    applyPulse(tile, duration = 500, mode = 'loopback') {
      const tileID = cursorTiles.getTileID(tile.tile);
      if (!tileID) return false;
      const layerID = cursorTiles.getLayerID(`${tileID}Pulse`);
      if (!layerID) return false;
      if (tile.anim[1] == 0) startAnim(tile, duration, 0, mode);
      tile.tile = layerID;
      return true;
    },

    /** @param {UITile} tile */
    clearPulse(tile) {
      const tileID = cursorTiles.getTileID(tile.tileTo);
      if (tileID?.endsWith('Pulse')) finAnim(tile);
    },

    /**
     * @param {UITile} tile
     * @param {string} suffix
     */
    removeSuffix(tile, suffix) {
      const tileID = cursorTiles.getTileID(tile.tile);
      if (tileID?.endsWith(suffix)) {
        const normalLayerID = cursorTiles.getLayerID(tileID.slice(0, -suffix.length));
        if (normalLayerID) {
          tile.tile = normalLayerID;
          finAnim(tile);
        }
      }
    },

    /** @param {string} tileID @param {number} action */
    createTile(tileID, action = 0) {
      const layerID = cursorTiles.getLayerID(tileID);
      if (!layerID) throw new Error(`no such tile #${tileID}`);
      const tile = uiLayer.data.alloc();
      tile.drawOrder = Infinity;
      tile.tile = layerID;
      tile.action = action;
      return tile;
    },

    /** @param {string} id */
    refTile(id) {
      return uiLayer.ref(id);
    },

    /** @param {string|UITile} id */
    freeTile(id) {
      const tile = typeof id == 'string' ? uiLayer.ref(id) : id;
      if (tile) freeTile(tile);
    },

    /** @param {HTMLElement} $el */
    addEventListeners($el) {
      $el.addEventListener('keydown', cellUI.handleKeyEvent);
      $el.addEventListener('keyup', cellUI.handleKeyEvent);

      $el.addEventListener('click', cellUI.handleMouseEvent);
      $el.addEventListener('mousemove', cellUI.handleMouseEvent);

      if (window.TouchEvent !== undefined) {
        $el.addEventListener('touchstart', cellUI.handleTouchEvent);
        $el.addEventListener('touchend', cellUI.handleTouchEvent);
        $el.addEventListener('touchmove', cellUI.handleTouchEvent);
        $el.addEventListener('touchcancel', cellUI.handleTouchEvent);
      }

      // TODO wheel events
      // TODO pointer events
    },

    /** @param {HTMLElement} $el */
    removeEventListeners($el) {
      $el.removeEventListener('keydown', cellUI.handleKeyEvent);
      $el.removeEventListener('keyup', cellUI.handleKeyEvent);

      $el.removeEventListener('click', cellUI.handleMouseEvent);
      $el.removeEventListener('mousemove', cellUI.handleMouseEvent);

      if (window.TouchEvent !== undefined) {
        $el.removeEventListener('touchstart', cellUI.handleTouchEvent);
        $el.removeEventListener('touchend', cellUI.handleTouchEvent);
        $el.removeEventListener('touchmove', cellUI.handleTouchEvent);
        $el.removeEventListener('touchcancel', cellUI.handleTouchEvent);
      }
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

    /** @param {TouchEvent} e */
    handleTouchEvent(e) {
      const
        now = Date.now(),
        { type, changedTouches } = e;
      e.preventDefault(); // no mouse emulation

      /** @type {Touch[]}) */
      const touches = [];

      for (const { identifier, clientX, clientY } of changedTouches) {
        const touch = refTouch(getTouch(identifier));
        touches.push(touch);
        const { index } = touch;

        let uiTile = uiLayer.ref(touch.cursorID);

        switch (type) {
          case 'touchstart':
            if (showTouchNotes && !uiTile) {
              const [cellX, cellY] = view.reverseProject(clientX, clientY);
              uiTile = uiLayer.data.alloc();
              uiTile.drawOrder = Infinity;
              uiTile.tile = cursorTiles.getLayerID(`note${index}`);
              uiTile.offset[0] = cellX - 0.5, uiTile.offset[1] = cellY - 0.5;
              touch.cursorID = uiTile.$id;
            }
            startTouchPoint(index, now, clientX, clientY);
            break;

          case 'touchmove':
            if (uiTile) {
              const [cellX, cellY] = view.reverseProject(clientX, clientY);
              uiTile.offset[0] = cellX - 0.5, uiTile.offset[1] = cellY - 0.5;
            }
            updateTouchPoint(index, now, clientX, clientY);
            break;

          case 'touchend':
          case 'touchcancel':
            if (uiTile) {
              const [cellX, cellY] = view.reverseProject(clientX, clientY);
              uiTile.offset[0] = cellX - 0.5, uiTile.offset[1] = cellY - 0.5;
            }
            updateTouchPoint(index, now, clientX, clientY);
            if (showTouchNotes && uiTile) {
              startAnim(uiTile, 200);
              uiTile.scaleTo = 0;

              afterAnim(uiTile).then(({ tile: uiTile }) => {
                finAnim(uiTile);
                uiTile.scale = 0;
                freeAction(uiTile);
              });
            }
            break;
        }
      }

      let freeTouches = false;
      let gestureEventType = type;
      if (type == 'touchend' || type == 'touchcancel') {
        freeTouches = true;
        if (touchCount - touches.length < 1)
          gestureEventType = 'gestureend';
      }

      // TODO maybe split out a handler interface around this
      switch (gestureType()) {

        case 'tap-1':
          if (gestureEventType == 'gestureend') {
            const touch = touches[0];
            for (const tile of actionsAt(...view.reverseProject(...touch.startAt))) {
              invoke(tile.action, 'touch', tile);
              break;
            }
          }
          break;

        case 'swipe-1': {
          const cur = cursorID && uiLayer.ref(cursorID);
          if (cur && cellUI.cursorMode != '') {

            const { offset, stashXY } = cur;
            if (!stashXY[2]) {
              stashXY[0] = offset[0], stashXY[1] = offset[1], stashXY[2] = 1;
            }

            switch (gestureEventType) {

              case 'touchmove':
                const { cellSize } = view;
                const touch = touches[0];
                const [dx, dy] = touch.dxy;
                offset[0] += dx / cellSize, offset[1] += dy / cellSize;
                cur.offsetTo = offset;
                offset[0] = Math.floor(offset[0] + 0.5), offset[1] = Math.floor(offset[1] + 0.5);
                let any = false;
                for (const tile of actionsAt(offset[0], offset[1])) {
                  cellUI.cursorHover = tile.$id;
                  any = true;
                  break;
                }
                if (!any) cellUI.cursorHover = null;
                break;

              case 'gestureend':
                if (cursorHoverID) {
                  const tile = cellUI.refTile(cursorHoverID);
                  if (tile?.action) invoke(tile.action, 'touch', tile);
                  cellUI.cursorHover = null;
                }
                if (stashXY[2]) {
                  startAnim(cur, 100);
                  cur.offsetTo[0] = stashXY[0], cur.offsetTo[1] = stashXY[1];
                  afterAnim(cur).then(({ tile: cur }) => {
                    cur.offset = cur.offsetTo;
                    applyCursorPulse(cur);
                  });
                  stashXY[2] = 0;
                }
                break;

            }
          }
        } break;

      }

      if (freeTouches)
        for (const touch of touches) freeTouch(touch.index);
      if (touchCount < 1) resetGesture();
    },

    /** @param {MouseEvent} e */
    handleMouseEvent(e) {
      for (const tile of actionsAt(...view.reverseProject(e.clientX, e.clientY))) {
        switch (e.type) {
          case 'mousemove':
            cellUI.cursorHover = tile.$id;
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

    // TODO necessary because action key data isn't integral to DataFrame references (yet)
    getActionKey,
    setActionKey,
  };

  return cellUI;
}

/** @typedef {ReturnType<makeCellUI>} CellUI  */

/**
 * @param {number} width
 * @param {number} height
 */
function makeWeightMap(width, height) {
  const weight = new Int16Array(width * height);

  /** @type {Array<number>} */
  const q = [];

  const reset = () => {
    weight.fill(0);
    q.length = 0;
  };

  /** @param {number} x @param {number} y @param {number} v */
  const raise = (x, y, v) => {
    const i = width * y + x;
    if (Math.abs(v) > Math.abs(weight[i])) {
      weight[i] = v;
      if (Math.abs(v) > 1) q.unshift(i);
    }
  };

  const flood = () => {
    let sanity = width * height * q.length;
    while (q.length) {
      if (sanity-- < 0) throw new Error('flood ran out of sanity');

      const i = q.shift();
      if (i === undefined) continue;

      const u = weight[i], v = u - Math.sign(u);
      const x = i % width, y = Math.floor(i / width);

      for (const [x2, y2] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ])
        if (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height)
          raise(x2, y2, v);
    }
  };

  /** @param {number} x @param {number} y */
  const at = (x, y) => {
    const i = width * y + x;
    return i >= 0 && i < weight.length ? weight[i] : undefined;
  };

  /** @param {number} x @param {number} y */
  const moves = function*(x, y) {
    for (const [dx, dy] of [
      [-1, 0],
      [+1, 0],
      [0, -1],
      [0, +1],
    ]) {
      const x2 = x + dx;
      const y2 = y + dy;
      if (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height) {
        const weight = at(x2, y2);
        if (weight !== undefined) yield {
          dx, dy,
          x: x2, y: y2,
          weight,
        };
      }
    }
  };

  /** @param {number} x @param {number} y */
  const choose = (x, y, rand = () => 1.0) => {
    const current = at(x, y);
    if (current === undefined) return null;
    const it = moves(x, y);
    let res = it.next();
    if (res.done) return null;
    let choice = res.value, score = rand();
    while (true) {
      res = it.next();
      if (res.done) break;
      const alt = res.value;
      if (alt.weight > choice.weight) {
        choice = alt;
      } else if (alt.weight == choice.weight) {
        const altScore = rand();
        if (altScore > score)
          choice = alt, score = altScore;
      }
    }
    if (current >= choice.weight) return null;
    return choice;
  };

  return {
    get width() { return width },
    get height() { return height },
    get weight() { return weight },
    at,

    /** @param {IterableIterator<[x: number, y: number, v: number]>} pointValues */
    update(pointValues) {
      reset();
      for (const [x, y, v] of pointValues)
        raise(x, y, v);
      flood();
    },

    moves,
    choose,

    /** @param {number} x @param {number} y
     * @returns {[x: number, y: number]} */
    chase(x, y, rand = () => 1.0) {
      let move = choose(x, y, rand);
      let sanity = width * height;
      while (move) {
        if (--sanity < 0) throw new Error('chase ran out of sanity');
        ({ x, y } = move);
        move = choose(x, y, rand);
      }
      return [x, y];
    },

  };
}

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

/** @param {number} x */
function toHex(x, w = 2) {
  return `0x${x.toString(16).padStart(w, '0')}`;
}

/** @template T
 * @param {Iterable<T>} items
 * @param {object} [params]
 * @param {() => number} [params.random]
 * @param {(value: T, index: number) => number} [params.weight]
 */
function choose(items, { random = Math.random, weight = () => 1 } = {}) {
  /** @type {T|undefined} */
  let choice = undefined;
  let best = NaN;
  let count = 0;
  for (const item of items) {
    const score = Math.pow(random(), 1 / weight(item, count));
    if (choice === undefined || score > best)
      choice = item, best = score;
    count++;
  }
  return choice === undefined ? undefined
    : { score: best, item: choice, count };
}

/** @param {(obj: any) => string} formatObject */
function makeFormatter(formatObject = JSON.stringify) {
  /** @param {string} str @param {any[]} args */
  return (str, ...args) => {
    let i = 0;
    str = str.replace(/\%([soOdif])/g,
      (_match, code) => {
        // TODO precision and width padding support
        const arg = args[i++];
        if (arg === undefined) return '';
        switch (code) {
          case 's': return `${arg}`;

          case 'o':
          case 'O':
            return formatObject(arg);

          case 'f': {
            const n = Number(arg);
            return `${n}`;
          }

          case 'd':
          case 'i': {
            const n = Number(arg);
            return `${isNaN(n) ? 0 : Math.floor(n)}`;
          }

          default:
            i--;
            return '';
        }
      });

    if (i < args.length)
      str += args.slice(i).map(x => `${x}`).join(' ');

    return str;
  };
}

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

/** TODO reconcile with tilore/... defn
 * @typedef {object} GLBinder
 * @prop {() => void} bind
 * @prop {() => void} unbind
 * @prop {() => void} [delete]
 * @prop {() => void} [send]
 */

/** @param {WebGL2RenderingContext} gl */
async function makeTileRenderer(gl) {
  const prog = makeProgram(gl, await compileProgram(gl, './gltiles.vert', './gltiles.frag'));

  const viewParamsBlock = prog.mustGetUniformBlock('ViewParams');
  const animParamsBlock = prog.mustGetUniformBlock('AnimParams');
  const layerParamsBlock = prog.mustGetUniformBlock('LayerParams');
  const uniSheet = prog.mustGetUniform('sheet'); // sampler2D

  prog.linkUniformBlocks();

  const texCache = makeTextureUnitCache(gl, gl.TEXTURE_2D_ARRAY);

  const noView = viewParamsBlock.makeBuffer({ shouldSend: () => false });
  //noView.mustGet('viewCellSize').float = XXX;
  mat4.identity(noView.mustGet('perspective').asFloatArray());
  noView.mustGet('nowhere').asFloatArray().set([-1, -1, -1, 0]);
  noView.send();

  const noAnim = animParamsBlock.makeBuffer({ shouldSend: () => false });
  noAnim.send();

  const idRand = xorbig.makeRandom(Math.random());
  const idSeed = () => idRand.randomBigint();

  const tileRend = {
    texCache, // TODO reconsider

    bind() {
      prog.bind();
      noAnim.bind();
      noView.bind();
    },

    unbind() {
      prog.unbind();
    },

    /**
     * @param {object} params
     * @param {number} params.cellSize
     * @param {AnimClock} [params.animClock]
     * @param {number} [params.defaultAnimDuration]
     */
    makeView(params) {
      let dirty = true;
      const viewParams = viewParamsBlock.makeBuffer({
        shouldSend: () => dirty,
        sent() { dirty = false },
      });
      const perspective = viewParams.mustGet('perspective').asFloatArray();
      const nowhere = viewParams.mustGet('nowhere').asFloatArray();
      const cellSize = viewParams.mustGet('viewCellSize');
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
        bind() {
          viewParams.bind();
          animClock?.bind();
        },

        unbind() {
          animClock?.unbind();
          noView.bind();
        },

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

        /** @param {number} cx @param {number} cy */
        containsCell(cx, cy) {
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
      let dirty = true;
      const animParams = animParamsBlock.makeBuffer({
        shouldSend: () => dirty,
        sent() { dirty = false },
      });
      const animEnabled = animParams.mustGet('anim_enabled');
      const animTime = animParams.mustGet('anim_time');

      animEnabled.bool = true;

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
        bind() { animParams.bind() },
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

    /** @typedef {object} LayerData
     * @prop {number} length
     * @prop {() => void} compact
     * @prop {{[name: string]: AspectCoreRO }} aspects
     */

    /**
     * @param {object} options
     * @param {WebGLTexture} options.texture
     * @param {LayerData} options.data
     * @param {number} [options.cellSize]
     * @param {number} [options.left]
     * @param {number} [options.top]
     * @param {AnimClock} [options.animClock]
     * @param {Iterable<GLBinder>} [options.parts]
     */
    makeBaseLayer(options) {
      let {
        texture,
        animClock: layerAnimClock,
      } = options;

      let paramsDirty = true;
      const params = layerParamsBlock.makeBuffer({
        shouldSend: () => paramsDirty,
        sent() { paramsDirty = false },
      });
      const transform = params.mustGet('transform').asFloatArray();
      const cellSize = params.mustGet('cellSize');
      const stride = params.mustGet('stride');

      /** @type {GLBinder[]} */
      const parts = [...(options.parts || [])];
      if (layerAnimClock) parts.push(layerAnimClock);

      parts.push(
        params,
        // TODO indirect out thru cache/unit mapper?
        {
          bind() {
            gl.uniform1i(uniSheet.loc, texCache.get(texture));
          },
          unbind() {
            // TODO anything useful?
          },
        },
      );

      {
        const {
          cellSize: size = 0,
          left = 0, top = 0,
        } = options;

        cellSize.float = size;
        mat4.fromTranslation(transform, [left, top, 0]);
      }

      const {
        data,
        // TODO options for aspect mapper target/usage
      } = options;

      const orderNames =
        Object.entries(data.aspects)
          .filter(([_, { spec }]) => typeof spec == 'object' && 'order' in spec)
          .map(([name]) => name);

      // TODO provide option to choose other than first order aspect for draw order?
      const orderName = orderNames.length > 0 ? orderNames[0] : '';

      const mapper = makeWebGLAspects(gl, Object.values(data.aspects), {
        program: prog,
        // TODO rename shader attribs, or rename layer aspects
        attribMap: {
          tile: 'layerID',
          tileTo: 'layerIDTo',
        },
        target: orderName ? { [orderName]: gl.ELEMENT_ARRAY_BUFFER } : {},
        defaults: {
          scale: 1,
        }
      });

      if (mapper) parts.push(mapper);
      const elMapper = orderName && mapper?.get(orderName);
      if (orderName && !elMapper)
        throw new Error(`unable to get draw order mapper for aspect ${orderName}`);

      const drawLength = elMapper
        ? () => data.aspects[elMapper.name].length
        : () => data.length;

      const draw = elMapper ? () => {
        const ela = data.aspects[elMapper.name];
        const glType = (() => {
          for (const field of ela.fieldInfo)
            return fieldGLType(gl, field.type);
          throw new Error('no element field info');
        })();
        gl.drawElements(gl.POINTS, ela.length, glType, 0);
      } : () => {
        gl.drawArrays(gl.POINTS, 0, data.length);
      };

      let name = '<unnamed>';
      const self = {
        get name() { return name },
        set name(nom) { name = nom },

        get parts() { return parts },

        get texture() { return texture },
        set texture(tex) { texture = tex },

        get cellSize() { return cellSize.float },
        set cellSize(size) {
          cellSize.float = size;
          paramsDirty = true;
        },

        get stride() { return stride.int },
        set stride(n) {
          if (n !== stride.int) {
            stride.int = n;
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

        get animClock() {
          if (!layerAnimClock) throw new Error('no AnimClock bound to Layer');
          return layerAnimClock;
        },

        bind() { for (const part of parts) part.bind() },
        unbind() { for (const part of parts) part.unbind() },
        delete() { for (const part of parts) if (part.delete) part.delete() },
        send() { for (const part of parts) if (part.send) part.send() },

        draw() {
          data.compact();
          if (drawLength() < 1) return;
          self.bind();
          draw();
          self.unbind();
        },
      };
      return self;
    },

    /**
     * @template {AspectMap} DataScheme
     * @param {object} options
     * @param {WebGLTexture} options.texture
     * @param {DataScheme} options.dataScheme
     * @param {number} [options.cellSize]
     * @param {number} [options.left]
     * @param {number} [options.top]
     * @param {number} options.width
     * @param {number} options.height
     * @param {number} [options.capacity]
     * @param {AnimClock} [options.animClock]
     */
    makeXYLayer(options) {
      const { dataScheme } = options;

      let { width, height } = options;
      // TODO provide option for alternate topologies
      // ; e.g. makeXYIndex supports columnar layout when passed {height}, let alone fancier index implementations
      // ; however all of that would need matching shader support
      const data = makeDataFrame(makeXYIndex({ width }), dataScheme, [width, height]);

      const layer = this.makeBaseLayer({ ...options, data });
      layer.stride = width;

      const self = passProperties({
        get data() { return data },

        /** @returns {[x: number, y: number]} */
        get size() { return data.upto() },
        set size(sz) {
          data.resize(sz);
          layer.stride = sz[0]; // TODO topology sensitive if we change that per above
        },

        /** @param {number} x @param {number} y */
        contains(x, y) {
          const { origin: [left, top], size: [width, height] } = self;
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
          const { origin: [left, top] } = self;
          return self.at(x - left, y - top)
        },

        /** Returns a cell reference given cell x/y offsets (relative to left/top),
         * or null if out of bounds.
         *
         * @param {number} x
         * @param {number} y
         */
        at: (x, y) => data.ref([x, y]),

      }, layer,
        'name',
        'bind', 'unbind', 'delete', 'send',
        'animClock', 'cellSize', 'origin', 'texture',
        'draw',
      );

      return self;
    },

    /**
     * @template {AspectMap} DataScheme
     * @param {object} options
     * @param {WebGLTexture} options.texture
     * @param {DataScheme} options.dataScheme
     * @param {number} [options.cellSize]
     * @param {number} [options.left]
     * @param {number} [options.top]
     * @param {boolean} [options.sparse]
     * @param {number} [options.width]
     * @param {number} [options.height]
     * @param {number} [options.capacity]
     * @param {AnimClock} [options.animClock]
     */
    makeIDLayer(options) {
      const { dataScheme } = options;
      let {
        width = NaN,
        height = NaN,
        capacity = (isNaN(width) ? 1 : width) * (isNaN(height) ? 1 : height),
      } = options;
      const data = makeSparseDataFrame(makeDurableIDIndex({ idSeed }), dataScheme, capacity);
      const layer = this.makeBaseLayer({ ...options, data });
      return passProperties({
        get data() { return data },

        /** @param {string} id */
        ref: id => data.ref(id),
      }, layer,
        'name',
        'bind', 'unbind', 'delete', 'send',
        'animClock', 'cellSize', 'origin', 'texture',
        'draw',
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

/** @typedef {'once'|'loop'|'loopback'} AnimMode */

/** @param {AnimMode} mode */
const animCode = mode => {
  switch (mode) {
    case 'once': return 0;
    case 'loop': return 1;
    case 'loopback': return 2;
    default: throw new Error('invalid animMode');
  }
};

/**
 * @param {AnimClock} animClock
 * @param {number} duration
 * @param {AnimMode} mode
 * @returns {[start_time: number, duration: number, mode: number]}
 */
const initAnim = (animClock, duration, delay = 0, mode = 'once') => {
  if (duration <= 0) throw new Error('invalid duration');
  const time = animClock.time + delay;
  return [time, duration, animCode(mode)];
};

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

/** @param {object} val */
function copyObj(val) {
  return Object.fromEntries(Object.entries(val)
    .filter(([name]) => !name.startsWith('$') && !name.startsWith('_'))
    .map(([name, val]) => [name, isTypedArray(val) ? [...val] : val])
  );
}

/** @param {any} val */
function isTypedArray(val) {
  if (typeof val !== 'object') return;
  switch (val.constructor) {
    case Uint8Array:
    case Uint8ClampedArray:
    case Uint16Array:
    case Uint32Array:
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Float32Array:
    case Float64Array:
    case BigInt64Array:
    case BigUint64Array: return true;
    default: return false;
  }
}
