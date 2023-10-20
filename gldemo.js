// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

import * as xorbig from './xorbig.js';

import makeTileRenderer from './gltiles.js';
/** @template T @typedef {import("./gltiles.js").tileable<T>} tileable */
/** @template T @typedef {import("./gltiles.js").TileSheet<T>} TileSheet */
/** @typedef {import("./gltiles.js").DenseLayer} DenseLayer */

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
} from './tilegen.js';
/** @typedef {import("./tilegen.js").SimpleTile} SimpleTile */

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.$world
 * @param {number} [opts.tileSize]
 * @param {number} [opts.cellSize]
 * @param {number} [opts.worldWidth]
 * @param {number} [opts.worldHeight]
 * @param {boolean|(() => boolean)} [opts.showCurvyTiles]
 * @param {boolean|(() => boolean)} [opts.clipCurvyTiles]
 * @param {SimpleTile[]} [opts.foreTiles]
 * @param {Parameters<xorbig.generateRandoms>[0]} [opts.seed]
 */
export default async function runDemo(opts) {
  let {
    $world,
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
  const shouldShowCurvyTiles = typeof showCurvyTiles == 'boolean' ? () => showCurvyTiles : showCurvyTiles;
  const shouldClipCurvyTiles = typeof clipCurvyTiles == 'boolean' ? () => clipCurvyTiles : clipCurvyTiles;

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  const tiles = await makeTileRenderer(gl);
  const view = tiles.makeView({
    cellSize,
  });

  const landCurveTiles = tiles.makeSheet(generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = tiles.makeSheet(generateSimpleTiles(...foreTileSpecs), { tileSize });

  const bg = tiles.makeDenseLayer({
    texture: landCurveTiles.texture,
    width: worldWidth,
    height: worldHeight,
  });

  const fg = tiles.makeSparseLayer({
    texture: foreTiles.texture,
  });
  const bgCurved = tiles.makeDenseLayer(curvedLayerParams(bg));

  let lastCurveClip = shouldClipCurvyTiles();

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
    for await (const _/*t*/ of frames) {
      // TODO animate things via const dt = lastT - t;

      sizeToClient($world);
      view.update();

      const nowCurveClip = shouldClipCurvyTiles();
      if (lastCurveClip != nowCurveClip) {
        lastCurveClip = nowCurveClip;
        updateCurvedLayer(bgCurved, landCurveTiles,
          shouldClipCurvyTiles()
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

        if (shouldShowCurvyTiles()) {
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

        fg.draw();
      });
    }
  }();
  return {
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
    done,
  };
}
