// @ts-check

import {
  frameLoop,
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
  generateCurvedTiles,
  generateSimpleTiles,
} from './tilegen.js';

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.$world
 * @param {number} [opts.tileSize]
 * @param {number} [opts.cellSize]
 * @param {number} [opts.worldWidth]
 * @param {number} [opts.worldHeight]
 * @param {boolean} [opts.showCurvyTiles]
 */
export default async function demo(opts) {
  const {
    $world,
    tileSize = 256,
    cellSize = 64,

    // TODO fix curvy tile layer, needs to have dims N+1 but be scissored to cut outer ring in half
    worldWidth = 5,
    worldHeight = 5,
    showCurvyTiles = true,
  } = opts;

  const gl = $world.getContext('webgl2');
  if (!gl) throw new Error('No GL For You!');

  sizeToParent($world);

  const tileRend = makeTileRenderer(gl, await compileTileProgram(gl));

  /**
   * @param {TileSheet<number>} sheet
   * @param {{x: number, y: number}} [offset]
   * @returns {Layer}
   */
  const makeWorldLayer = ({ texture }, offset = { x: 0, y: 0 }) => {
    const layer = makeLayer(gl, {
      texture,
      cellSize,
      left: offset.x,
      top: offset.y,
      width: worldWidth,
      height: worldHeight,
    });
    return layer;
  };

  const landCurveTiles = makeTileSheet(gl, generateCurvedTiles({
    aFill: '#5c9e31', // land
    bFill: '#61b2e4', // water
    // gridLineStyle: 'red',
  }), { tileSize });

  const foreTiles = makeTileSheet(gl, generateSimpleTiles(
    { glyph: '🧚' },
    { glyph: '🍵' },
    { glyph: '🫖' },
    { glyph: '⛵' }
  ), { tileSize });

  const bgSQ = makeWorldLayer(landCurveTiles);
  const bg = makeWorldLayer(landCurveTiles, { x: -0.5, y: -0.5 });
  const fg = makeWorldLayer(foreTiles);

  {
    const { randn, random } = makeRandom();

    // generate terrain
    const land = landCurveTiles.getLayerID(0b0000);
    const water = landCurveTiles.getLayerID(0b1111);
    const isWater = new Uint8Array(bg.width * bg.height);
    for (let i = 0; i < isWater.length; i++)
      isWater[i] = random() > 0.5 ? 1 : 0;
    for (let y = 0; y < bg.height; y++)
      for (let x = 0; x < bg.width; x++)
        bgSQ.set(x, y, {
          layerID: isWater[y * bg.width + x] ? water : land
        });

    // place fore objects
    for (let y = 0; y < fg.height; y++) {
      for (let x = 0; x < fg.width; x++) {
        const tileID = Number(randn(2n * BigInt(foreTiles.size)));
        const layerID = foreTiles.getLayerID(tileID);
        const spin = random();
        fg.set(x, y, { layerID, spin });
      }
    }

    // generate curved terrain layer
    const stride = bg.width;
    for (let y = 0; y < bg.height; y++) {
      for (let x = 0; x < bg.width; x++) {
        const nw = isWater[(y + 0) * stride + x + 0];
        const ne = isWater[(y + 0) * stride + x + 1];
        const sw = isWater[(y + 1) * stride + x + 0];
        const se = isWater[(y + 1) * stride + x + 1];
        const tileID = ((nw << 1 | ne) << 1 | se) << 1 | sw;
        const layerID = landCurveTiles.getLayerID(tileID);
        bg.set(x, y, { layerID });
      }
    }
  }

  // send layer data to gpu; NOTE this needs to be called going forward after any update
  bg.send();
  bgSQ.send();
  fg.send();

  const { stop, frames } = frameLoop();
  const done = async function() {
    for await (const _/*t*/ of frames) {
      // TODO animate things via const dt = lastT - t;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      tileRend.draw(function*() {
        yield showCurvyTiles ? bg : bgSQ;
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
