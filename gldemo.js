// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

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
/** @typedef {import("./tilegen.js").tileSpec} TileSpec */

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.$world
 * @param {number} [opts.tileSize]
 * @param {number} [opts.cellSize]
 * @param {number} [opts.worldWidth]
 * @param {number} [opts.worldHeight]
 * @param {boolean|(() => boolean)} [opts.showCurvyTiles]
 * @param {boolean|(() => boolean)} [opts.clipCurvyTiles]
 * @param {TileSpec[]} [opts.foreTiles]
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

    foreTiles: foreTileSpecs = [
      { glyph: '1️⃣' }, // buttons 1-4
      { glyph: '2️⃣' },
      { glyph: '3️⃣' },
      { glyph: '4️⃣' },
    ],
  } = opts;
  const shouldShowCurvyTiles = typeof showCurvyTiles == 'boolean' ? () => showCurvyTiles : showCurvyTiles;
  const shouldClipCurvyTiles = typeof clipCurvyTiles == 'boolean' ? () => clipCurvyTiles : clipCurvyTiles;

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  const tiles = await makeTileRenderer(gl);

  const landCurveTiles = tiles.makeSheet(generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = tiles.makeSheet(generateSimpleTiles(...foreTileSpecs), { tileSize });

  const bg = tiles.makeDenseLayer({
    texture: landCurveTiles.texture,
    cellSize,
    width: worldWidth,
    height: worldHeight,
  });

  const fg = tiles.makeDenseLayer({
    texture: foreTiles.texture,
    cellSize,
    width: worldWidth,
    height: worldHeight,
  });
  const bgCurved = tiles.makeDenseLayer(curvedLayerParams(bg));

  let lastCurveClip = shouldClipCurvyTiles();

  const generateWorld = () => {
    const { rand: seeder } = makeRandom();

    // generate terrain
    const { random: randWater } = makeRandom(seeder());
    const isWater = new Uint8Array(bg.width * bg.height);
    for (let i = 0; i < isWater.length; i++)
      isWater[i] = randWater() > 0.5 ? 1 : 0;

    const land = landCurveTiles.getLayerID(0b0000);
    const water = landCurveTiles.getLayerID(0b1111);
    for (let y = 0; y < bg.height; y++) {
      for (let x = 0; x < bg.width; x++) {
        const cell = bg.at(x, y);
        if (!cell) continue;
        cell.layerID = isWater[y * bg.width + x] ? water : land;
      }
    }

    // place fore objects
    const { randn: randTile } = makeRandom(seeder());
    const { random: randSpin } = makeRandom(seeder());
    for (let y = 0; y < fg.height; y++) {
      for (let x = 0; x < fg.width; x++) {
        const cell = fg.at(x, y);
        if (!cell) continue;
        const tileID = Number(randTile(2n * BigInt(foreTiles.size)));
        if (tileID < foreTiles.size) {
          cell.layerID = foreTiles.getLayerID(tileID);
          cell.spin = randSpin();
        } else {
          cell.clear();
        }
      }
    }

    updateCurvedLayer(bgCurved, landCurveTiles,
      lastCurveClip
        ? clippedBaseCellQuery(bg, landCurveTiles)
        : extendedBaseCellQuery(bg, landCurveTiles));
  };
  generateWorld();

  const { stop, frames } = frameLoop();
  const done = async function() {
    for await (const _/*t*/ of frames) {
      // TODO animate things via const dt = lastT - t;

      sizeToClient($world);

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
      tiles.setViewport();

      gl.clear(gl.COLOR_BUFFER_BIT);

      // TODO: why can't this persist across frames?
      tiles.texCache.clear();

      // TODO at some point, it'll be worth it to cull layers that don't
      // intersect perspective, but for now we just use leave GL's vertex culling

      if (shouldShowCurvyTiles()) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(
          // NOTE: lower left corner, with 0 counting up from bottom edge of viewport
          bg.left * cellSize,
          gl.canvas.height - (bg.top + bg.height) * cellSize,
          bg.width * cellSize,
          bg.height * cellSize
        );
        bgCurved.draw();
        gl.disable(gl.SCISSOR_TEST);
      } else {
        bg.draw();
      }

      fg.draw();
    }
  }();
  return {
    get cellSize() { return cellSize },
    set cellSize(size) {
      cellSize = size;
      bg.cellSize = size;
      fg.cellSize = size;
      bgCurved.cellSize = size;
    },

    /** @param {number} w @param {number} h */
    resizeWorld(w, h) {
      worldWidth = w;
      worldHeight = h;
      bg.resize(w, h);
      fg.resize(w, h);
      bgCurved.resize(w + 1, h + 1);
      generateWorld();
    },

    /** @param {number} dx @param {number} dy */
    moveWorldBy(dx, dy) {
      this.moveWorldTo(bg.left + dx, bg.top + dy);
    },

    /** @param {number} x @param {number} y */
    moveWorldTo(x, y) {
      bg.moveTo(x, y);
      fg.moveTo(x, y);
      bgCurved.moveTo(x - 0.5, y - 0.5);
    },

    stop,
    done,
  };
}

function makeRandom(seed = 0xdead_beefn) {
  let randState = seed;
  const rand = () => (randState = randState * 6364136223846793005n + 1442695040888963407n) >> 17n & 0xffff_ffffn;
  /** @param {bigint} n */
  const randn = n => rand() % n;
  const random = () => Number(rand()) / 0x1_0000_0000;
  return { rand, randn, random };
}
