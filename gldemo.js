// @ts-check

import {
  frameLoop,
  sizeToClient,
} from './glkit.js';

import {
  compileTileProgram,
  makeTileRenderer,
  makeTileSheet,
  makeLayer,
} from './gltiles.js';
/** @template T @typedef {import("./gltiles.js").tileable<T>} tileable */
/** @template T @typedef {import("./gltiles.js").TileSheet<T>} TileSheet */
/** @typedef {import("./gltiles.js").Layer} Layer */

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
  makeCurvedLayer,
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
export default async function demo(opts) {
  const {
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

  const tileRend = makeTileRenderer(gl, await compileTileProgram(gl));

  const landCurveTiles = makeTileSheet(gl, generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = makeTileSheet(gl,
    generateSimpleTiles(...foreTileSpecs),
    { tileSize });

  const bg = makeLayer(gl, {
    texture: landCurveTiles.texture,
    cellSize,
    width: worldWidth,
    height: worldHeight,
  });

  const fg = makeLayer(gl, {
    texture: foreTiles.texture,
    cellSize,
    width: worldWidth,
    height: worldHeight,
  });

  {
    const { rand: seeder } = makeRandom();

    // generate terrain
    const { random: randWater } = makeRandom(seeder());
    const isWater = new Uint8Array(bg.width * bg.height);
    for (let i = 0; i < isWater.length; i++)
      isWater[i] = randWater() > 0.5 ? 1 : 0;

    const land = landCurveTiles.getLayerID(0b0000);
    const water = landCurveTiles.getLayerID(0b1111);
    for (let y = 0; y < bg.height; y++)
      for (let x = 0; x < bg.width; x++)
        bg.set(x, y, {
          layerID: isWater[y * bg.width + x] ? water : land
        });

    // place fore objects
    const { randn: randTile } = makeRandom(seeder());
    const { random: randSpin } = makeRandom(seeder());
    for (let y = 0; y < fg.height; y++) {
      for (let x = 0; x < fg.width; x++) {
        const tileID = Number(randTile(2n * BigInt(foreTiles.size)));
        if (tileID < foreTiles.size)
          fg.set(x, y, {
            layerID: foreTiles.getLayerID(tileID),
            spin: randSpin(),
          });
      }
    }

  }

  // send layer data to gpu; NOTE this needs to be called going forward after any update
  bg.send();
  fg.send();

  let lastCurveClip = shouldClipCurvyTiles();

  const bgCurved = makeCurvedLayer(gl, bg);
  updateCurvedLayer(bgCurved, landCurveTiles,
    lastCurveClip
      ? clippedBaseCellQuery(bg, landCurveTiles)
      : extendedBaseCellQuery(bg, landCurveTiles));
  bgCurved.send();

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
        bgCurved.send();
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // TODO: allow viewport zoom/pan?
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      tileRend.setViewport();

      gl.clear(gl.COLOR_BUFFER_BIT);

      tileRend.draw(function*() {
        if (shouldShowCurvyTiles()) {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(
            // NOTE: lower left corner, with 0 counting up from bottom edge of viewport
            bg.left * cellSize,
            gl.canvas.height - (bg.top + bg.height) * cellSize,
            bg.width * cellSize,
            bg.height * cellSize
          );
          yield bgCurved;
          gl.disable(gl.SCISSOR_TEST);
        } else {
          yield bg;
        }
        yield fg;
      }());

    }
  }();
  return { stop, done };
}

function makeRandom(seed = 0xdead_beefn) {
  let randState = seed;
  const rand = () => (randState = randState * 6364136223846793005n + 1442695040888963407n) >> 17n & 0xffff_ffffn;
  /** @param {bigint} n */
  const randn = n => rand() % n;
  const random = () => Number(rand()) / 0x1_0000_0000;
  return { rand, randn, random };
}
