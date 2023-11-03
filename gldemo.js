// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

import makeMortonMap from './mortish.js';
/** @typedef {import("./mortish.js").MortonMap} MortonMap */

import * as xorbig from './xorbig.js';

import makeTileRenderer from './gltiles.js';
/** @typedef {import("./gltiles.js").AnimClock} AnimClock */
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
};

// 🗻
// ⛰️
// 🏔️
// 🌲
// 🌳
// 🎄
// 🎋

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

      if ('id' in rest) {
        let id;
        ({ id, ...rest } = rest);
        desc += `#${id}`;
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
  if (!gl) throw new Error('No GL For You!');

  const userAnimTime = 400;

  const tiles = await makeTileRenderer(gl);
  const view = tiles.makeView({
    cellSize,
    defaultAnimDuration: userAnimTime,
  });
  const initCellSize = view.cellSize;

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
    // fg layer userData.kind constants

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

  const bg = tiles.makeStaticLayer({
    texture: landCurveTiles.texture,
    width: worldWidth,
    height: worldHeight,
  });

  const fg = tiles.makeSparseLayer({
    texture: foreTiles.texture,
    animClock: gameAnim,
    userData: {
      kind: {
        ArrayType: Uint8Array,
        size: 1,
      },
      move: {
        ArrayType: Int8Array,
        size: 3,
      },
      goal: {
        ArrayType: Uint16Array,
        size: 3,
      },
    },
  });
  const bgCurved = tiles.makeStaticLayer(curvedLayerParams(bg));

  /** @param {number} id */
  const gameLogFGRef = id => {
    const ref = fg.ref(id);
    if (!ref) return { id };
    const { xy: [x, y], layerID } = ref;
    const tile = foreTiles.getTileID(layerID);
    return { id, tile, x, y, };
  };

  /** @param {number} x @param {number} y */
  /** @param {number} x @param {number} y */
  const worldAt = (x, y) => {
    x = Math.floor(x), y = Math.floor(y);
    const bgTile = bg.absAt(x, y);
    if (bgTile == null) return null;
    return {
      get back() { return bgTile },
      *fore() {
        for (const tile of fg.all()) {
          const { index, layerID, absXY: [foreX, foreY] } = tile;
          if (foreX == x && foreY == y) {
            const kind = [...fg.array.kind.subarray(1 * index, 1 * index + 1)];
            const move = [...fg.array.move.subarray(3 * index, 3 * index + 3)];
            const goal = [...fg.array.goal.subarray(3 * index, 3 * index + 3)];
            const [moveFlags, ...moveXY] = move;
            const [goalFlags, ...goalXY] = goal;
            yield Object.assign(tile, {
              tileID: foreTiles.getTileID(layerID),
              kind: kind.map(x => toHex(x)),
              user: kind[0] & Kind.User ? true : false,
              moveFlags: toHex(moveFlags),
              move: moveFlags & Move.Defined ? moveXY : null,
              goalFlags: toHex(goalFlags, 4),
              goal: goalFlags & Goal.Defined ? goalXY : null,
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
        const { xy, move, goal } = fore;
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
   * @prop {number} id
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
        { animDuration } = tile,
        xy = animDuration > 0 ? tile.xyTo : tile.xy,
        [x, y] = xy;
      if (x != wantX || y != wantY) tile.xy = [wantX, wantY];
    }
  };

  {
    const helpButton = cellUI.createTile('help', Action.Help);
    helpButton.actionKey = '?';
    // TODO option to show help initially?
    buttonSpecs.push({ id: helpButton.id, viewX: 0, viewY: -1 });
  }

  /** @type {SparseLayer[]} */
  const notes = [];

  const makeNoteLayer = () => {
    const layer = tiles.makeSparseLayer({
      texture: cursorTiles.texture,
    });
    notes.push(layer);

    /**
     * @param {number} x
     * @param {number} y
     * @param {string} tileID
     */
    const note = (x, y, tileID) => {
      const layerID = cursorTiles.getLayerID(tileID);
      if (!layerID) throw new Error(`invalid note tile "${tileID}"`);
      const tile = layer.createRef();
      tile.xy = [x, y];
      tile.layerID = layerID;
    };

    return { layer, note };
  };

  let lastCurveClip = clipCurvyTiles;

  const landDepth = 4;
  const depth = makeWeightMap(bg.width, bg.height);

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

  /** @param {Parameters<xorbig.generateRandoms>[0]} seed */
  const generateWorld = seed => {
    for (const layer of notes) layer.deleteBuffers();
    notes.length = 0;

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
      const { width, height } = bg;

      const isLand = new Uint8Array(width * height);

      const regionDescendUnder = 0.9;
      const skipAreaUnder = 0.3;
      const goalLandRatio = 0.2;
      const regionDensity = 0.25;

      // BSP -> (maybe) DLA

      const goalLandCount = goalLandRatio * width * height;
      let haveLandCount = 0;

      const { note: dlaNote } = makeNoteLayer();

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

        haveLandCount = isLand.reduce((a, b) => a + b);
      }

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
      const { note } = makeNoteLayer();
      for (const { x, y, depth } of iterDepth())
        note(x, y, `note${depth}`);
    }

    // TODO depth based water color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = bg.at(x, y);
        if (!cell) continue;
        cell.layerID = genTerrain(x, y);
      }
    }

    // place fore objects
    fg.clear();

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
            const atTileID = foreTiles.getTileID(fg.ref(atID)?.layerID || NaN);
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
        const tile = fg.createRef();
        tile.xy = [x, y];
        tile.layerID = layerID;
        occ.at(x, y).add(tile.id);
        yield tile.id;
      }
    };

    {
      // NOTE this is mostly an obsolete test/debug audit
      /** @type {Set<number>} */
      const newIDs = new Set();
      let lastID = -1;
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

    fg.prune();

    // TODO general curved tile set support for more terrain types like colored water depth
    updateCurvedLayer(bgCurved, landCurveTiles,
      lastCurveClip
        ? clippedBaseCellQuery(bg, landCurveTiles)
        : extendedBaseCellQuery(bg, landCurveTiles));
  };

  /** @param {MortonMap} mm */
  const ensurePlayer = mm => {
    let playerID = -1, playerIndex = -1, playerScore = -1;
    for (const { id, index, xy } of fg.all()) {
      if (fg.array.kind[1 * index] & Kind.User) return id;

      let free = 0;
      for (const [atx, aty] of iterMoves(...xy))
        if (mm.at(atx, aty).count == 0) free++;

      if (free > playerScore) {
        playerID = id;
        playerIndex = index;
        playerScore = free;
      }
    }

    fg.array.kind[1 * playerIndex] = Kind.User;
    gameLog('player is %o', gameLogFGRef(playerID));

    return playerID;
  };

  const resetMoves = () => {
    const { array: { move: moveData, goal: goalData } } = fg;
    for (const { index } of fg.all()) {
      const
        moveEl = moveData.subarray(3 * index, 3 * index + 3),
        goalEl = goalData.subarray(3 * index, 3 * index + 3);
      moveEl.fill(0);
      goalEl.fill(0);
    }
  };

  const chooseMoves = async function*() {
    const
      { width, height } = bg,
      { array: {
        kind: kindData,
        move: moveData,
        goal: goalData,
      } } = fg,
      amp = Math.floor(Math.min(width, height) / 2),
      scratch = makeWeightMap(width, height);

    for (const tile of fg.all()) {
      const
        { id, index, xy } = tile,
        kind = kindData[1 * index],
        moveEl = moveData.subarray(3 * index, 3 * index + 3),
        goalEl = goalData.subarray(3 * index, 3 * index + 3),
        moveFlags = moveEl[0],
        state = moveFlags & Move.StateMask;
      if (state != 0) continue;

      if ((kind & Kind.User) != 0) {
        await promptMove(tile, moveEl);
      } else {
        const { layerID } = tile;
        const subjectID = foreTiles.getTileID(layerID);
        if (subjectID === undefined) continue;

        scratch.update(function*() {
          for (const { id: candID, xy: [x, y], layerID } of fg.all()) {
            if (candID == id) continue;
            const objectID = foreTiles.getTileID(layerID);
            if (objectID === undefined) continue;
            if (objectID === subjectID) continue;

            yield [x, y, amp];
          }
        }());

        const move = scratch.choose(...xy);
        if (move) {
          const goal = scratch.chase(move.x, move.y);
          moveEl.set([Move.Defined, move.dx, move.dy]);
          goalEl.set([Goal.Defined, ...goal]);
        }
      }

      yield { id, tile, moveEl, goalEl };
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

  /** @param {[x: number, y: number]} at @returns {Promise<MoveInput>} */
  const moveInput = ([atX, atY]) => {
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
   * @param {SparseTile} tile
   * @param {Int8Array} moveEl
   */
  const promptMove = async (tile, moveEl) => {
    ensureViewContains(tile.id);
    const [dx, dy] = await moveInput(tile.xy);
    moveEl[0] = Move.Defined;
    moveEl[1] = dx;
    moveEl[2] = dy;
  };

  /**
   * @param {object} params
   * @param {MortonMap} params.mm
   * @param {number} params.id
   * @param {SparseTile} [params.tile]
   * @param {Int8Array} [params.moveEl]
   */
  const procMove = params => {
    const { id, tile = fg.ref(id) } = params;
    if (!tile) throw new Error('must have tile');

    const
      { array: { move: moveData } } = fg,
      { index, xy: [x, y] } = tile,
      {
        mm,
        moveEl = moveData.subarray(3 * index, 3 * index + 3),
      } = params,
      [moveFlags, mx, my] = moveEl,
      state = moveFlags & Move.StateMask;

    if (state != Move.Defined) return false;

    if (mx == 0 && my == 0) {
      moveEl[0] = Move.Stay | Move.Proced;
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

    const subjectID = foreTiles.getTileID(tile.layerID);
    if (subjectID == undefined) throw new Error(`no tile for actor tile id ${id} @<${x}, ${y}>`);

    if (!targ) {
      const targDepth = depth.at(tx, ty);
      if (targDepth === undefined || !depthActors[targDepth].has(subjectID)) {
        moveEl[0] = Move.Nope | Move.Proced;
        return true;
      }

      moveEl[0] = Move.Move | Move.Proced;
      mm.at(tx, ty).add(id);
      mm.at(x, y).del(id);
      return true;
    }

    let canBoop = true;
    const
      { id: tid, index: targIndex, layerID: targLayerID } = targ,
      targMove = moveData.subarray(3 * targIndex, 3 * targIndex + 3),
      tMoveFlags = targMove[0],
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
      moveEl[0] = Move.Nope | Move.Proced;
      return true;
    }

    const objectID = foreTiles.getTileID(targLayerID);
    if (objectID == undefined)
      throw new Error(`missing target tile for id ${tid} @<${tx}, ${ty}>`);

    // TODO other interaction outcomes than "death to all others"
    if (subjectID !== objectID) {
      if (fg.array.kind[index] & Kind.User && fg.array.kind[targIndex] & Kind.User) {
        moveEl[0] = Move.Nope | Move.Proced;
      } else {
        const canSee = view.containsCell([x, y]) || view.containsCell([tx, ty]);
        if (canSee)
          gameLog('%o kills %o', gameLogFGRef(id), gameLogFGRef(tid));
        moveEl[0] = Move.Boop | Move.Proced;
        targMove[0] = Move.Dead | Move.Proced;
      }
    } else {
      if (fg.array.kind[index] & Kind.User) {
        if (fg.array.kind[targIndex] & Kind.User) {
          moveEl[0] = Move.Nope | Move.Proced;
        } else {
          fg.array.kind[targIndex] |= Kind.User;
          gameLog('user takes control of %o', gameLogFGRef(tid));
          moveEl[0] = Move.Boop | Move.Proced;
        }
      } else {
        moveEl[0] = Move.Nope | Move.Proced;
      }
    }
    return true;
  };

  /** @param {number} animTime */
  const animateMoves = async animTime => {
    const { array: { move: moveData } } = fg;
    let any = false;
    for (const tile of fg.all()) {
      const
        { index, xy: [x, y] } = tile,
        [moveFlags, mx, my] = moveData.subarray(3 * index, 3 * index + 3),
        state = moveFlags & Move.StateMask,
        action = moveFlags & Move.ActionMask;
      if (state != Move.Proced) continue;

      if (action == Move.Stay) {
        // stay by shrinking 10%
        tile.startAnim(animTime);
        tile.scaleTo = tile.scale * 0.9;
      }

      else if (action == Move.Nope) {
        // nope by trible shaking: there and back thrice, but only 1/8th of the way
        tile.startAnim(animTime / 6, 0, 'loopback');
        tile.xyTo = [x + mx / 8, y + my / 8];
      }

      else if (action == Move.Move) {
        // just lol move there, nothing to see here
        tile.startAnim(animTime);
        tile.xyTo = [x + mx, my + y];
      }

      else if (action == Move.Boop) {
        // boop by moving half way there and back
        tile.startAnim(animTime / 2, 0, 'loopback');
        tile.xyTo = [x + mx / 2, y + my / 2];
      }

      else if (action == Move.Dead) {
        // die by shrinking away, but only take half move time, and coordinated to start at boop apex
        tile.startAnim(animTime / 2, animTime / 2, 'once');
        tile.scaleTo = 0;
        // TODO fade tile to null ( or skull? )
        // TODO would be nice to have option to anmiate mirror flip
      }

      else continue;

      any = true;
    }
    return any
      ? fg.animClock.afterDuration(animTime)
      : fg.animClock.time;
  };

  /** @param {MortonMap} mm */
  const finishMoves = (mm) => {
    const { array: { move: moveData } } = fg;

    for (const tile of fg.all()) {
      const
        { id, index, xy: [x, y] } = tile,
        [moveFlags, mx, my] = moveData.subarray(3 * index, 3 * index + 3),
        state = moveFlags & Move.StateMask,
        action = moveFlags & Move.ActionMask;
      if (state != Move.Proced) continue;

      const isUser = !!(fg.array.kind[1 * index] & Kind.User);

      moveData[3 * index] = action | Move.Done;

      if (action == Move.Stay) {
        tile.animDuration = 0;
      }

      else if (action == Move.Nope) {
        tile.animDuration = 0;
      }

      else if (action == Move.Move) {
        tile.xy = [x + mx, my + y];
        tile.animDuration = 0;
      }

      else if (action == Move.Boop) {
        tile.animDuration = 0;
      }

      else if (action == Move.Dead) {
        if (isUser) gameLog('RIP user %o', gameLogFGRef(id));
        mm.at(x, y).del(id);
        tile.free();
      }

      else
        console.warn('unsure how to finish move', { id, loc: [x, y], action });
    }
  };

  let playing = false;
  let playButtonID = NaN;
  {
    const playButton = cellUI.createTile('play', Action.PlayPause);
    playButtonID = playButton.id;
    playButton.actionKey = ' ';

    if (startPlaying)
      afterNextFrame().then(() =>
        self.invokeCursorAction(Action.PlayPause, 'mouse' /** TODO isDesktop ? 'mouse' : 'touch' */, null));
    buttonSpecs.push({ id: playButton.id, viewX: -1, viewY: -1 });
  }

  /** @type {number[]} */
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
      xy, tileID, action,
      actionKey = ActionKeys.get(action),
    } of actions) {
      const priorID = i < myActionIDs.length ? myActionIDs[i] : NaN;
      if (!isNaN(priorID)) {
        const act = cellUI.refTile(priorID);
        if (act) {
          act.layerID = cursorTiles.getLayerID(tileID);
          act.action = action;
          act.actionKey = actionKey || '';
          act.xy = xy;
          continue;
        }
      }
      const act = cellUI.createTile(tileID, action);
      act.xy = xy;
      act.actionKey = actionKey || '';
      if (i < myActionIDs.length) myActionIDs[i] = act.id;
      else myActionIDs.push(act.id);
      i++;
    }
    while (i < myActionIDs.length) {
      const dedID = myActionIDs.pop();
      if (dedID != undefined) cellUI.refTile(dedID)?.free();
    }
  };

  const clearMyActions = () => {
    for (const dedID of myActionIDs)
      cellUI.refTile(dedID)?.free();
  };

  /** @param {number} id */
  const ensureViewContains = id => {
    const tile = fg.ref(id);
    if (!tile) return;
    const {
      origin: [worldLeft, worldTop],
      width: worldWidth,
      height: worldHeight,
    } = bg;
    view.panToInclude(tile.xy, {
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
      for (const { id, xy: [x, y] } of fg.all())
        mm.at(x, y).add(id);
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
      for await (const move of chooseMoves()) {
        const
          { tile: { index, xy } } = move,
          isUser = !!(fg.array.kind[1 * index] & Kind.User);
        if (!procMove({ mm, ...move })) continue;
        if (view.containsCell(xy))
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

      sizeToClient($world);
      view.update();
      ensureButtonsInView();

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
        if (showLayer.notes) {
          const i = showLayer.notes - 1;
          const layer = notes[i];
          layer?.draw();
        }
      });
    }
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
      if (tile) tile.layerID = cursorTiles.getLayerID(playing ? 'pause' : 'play');
    },

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
    uiLayer = tileRend.makeSparseLayer({
      animClock: tileRend.makeAnimClock(),
      texture: cursorTiles.texture,
      userData: {
        action: {
          ArrayType: Uint8Array,
          size: 1,
        },
        stashXY: {
          ArrayType: Float32Array,
          size: 3,
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
    cursorHoverID = null,

    showTouchNotes = false,

    // bare touch point data, collected since first touchstart
    // TODO this could be an even more lightweight core dataframe like glkit.DataFrame
    /** @type {number[]} */
    touchIDs = [],
    /** @type {number[]} */
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
      while (touchCursorIDs.length < alloc) touchCursorIDs.push(0);
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

      if (window.TouchEvent !== undefined) {
        $el.addEventListener('touchstart', cellUI.handleTouchEvent);
        $el.addEventListener('touchend', cellUI.handleTouchEvent);
        $el.addEventListener('touchmove', cellUI.handleTouchEvent);
        $el.addEventListener('touchcancel', cellUI.handleTouchEvent);
      }

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
              uiTile = uiLayer.createRef();
              touch.cursorID = uiTile.id;
              uiTile.layerID = cursorTiles.getLayerID(`note${index}`);
              uiTile.xy = [cellX - 0.5, cellY - 0.5];
            }
            startTouchPoint(index, now, clientX, clientY);
            break;

          case 'touchmove':
            if (uiTile) {
              const [cellX, cellY] = view.reverseProject(clientX, clientY);
              uiTile.xy = [cellX - 0.5, cellY - 0.5];
            }
            updateTouchPoint(index, now, clientX, clientY);
            break;

          case 'touchend':
          case 'touchcancel':
            if (uiTile) {
              const [cellX, cellY] = view.reverseProject(clientX, clientY);
              uiTile.xy = [cellX - 0.5, cellY - 0.5];
            }
            updateTouchPoint(index, now, clientX, clientY);
            if (showTouchNotes && uiTile) {
              uiTile.startAnim(200);
              uiTile.scaleTo = 0;
              uiTile.afterAnim().then(() => {
                if (uiTile) {
                  uiTile.animDuration = 0;
                  uiTile.scale = 0;
                  uiTile.free();
                }
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
            const stashEl = uiLayer.array.stashXY.subarray(3 * cur.index, 3 * cur.index + 3);
            if (!stashEl[2]) {
              const { xy } = cur;
              stashEl[0] = xy[0], stashEl[1] = xy[1], stashEl[2] = 1;
            }
            switch (gestureEventType) {

              case 'touchmove':
                const { cellSize } = view;
                const touch = touches[0];
                const xy = cur.xy;
                const [dx, dy] = touch.dxy;
                xy[0] += dx / cellSize, xy[1] += dy / cellSize;
                cur.xy = cur.xyTo = xy;
                xy[0] = Math.floor(xy[0] + 0.5), xy[1] = Math.floor(xy[1] + 0.5);
                let any = false;
                for (const tile of actionsAt(...xy)) {
                  cellUI.cursorHover = tile.id;
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
                if (stashEl[2]) {
                  cur.animDuration = 0;
                  cur.startAnim(100);
                  cur.xyTo = [stashEl[0], stashEl[1]]; // XXX fix type noise
                  cur.afterAnim().then(() => {
                    cur.xy = cur.xyTo;
                    applyCursorPulse(cur);
                  });

                  stashEl[2] = 0;
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
function choose(items, { random = Math.random, weight = () => 1 }) {
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
