// @ts-check

import drawSimpleTile from './simple_tiles.js';
/** @typedef {import("./simple_tiles.js").SimpleTile} SimpleTile */

export { default as drawSimpleTile } from './simple_tiles.js';

/** @callback drawback
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @returns {void}
 */

/** @template TileID @typedef {import("./gltiles.js").TileSheet<TileID>} TileSheet */

/**
 * @typedef {object} Layer
 * @prop {WebGLTexture} texture
 * @prop {number} cellSize
 * @prop {[x: number, y: number]} origin
 * @prop {number} width
 * @prop {number} height
 * @prop {(x: number, y: number) => LayerCell|null} at
 */

/**
 * @typedef {object} LayerCell
 * @prop {number} layerID
 */

/** @param {Layer} layer */
export function curvedLayerParams(layer) {
  const { texture, cellSize, origin: [left, top], width, height } = layer;
  return {
    texture,
    cellSize,
    left: left - 0.5,
    top: top - 0.5,
    width: width + 1,
    height: height + 1,
  };
}

/**
 * @param {Layer} layer
 * @param {TileSheet<number>} tiles
 * @param {(x: number, y: number) => 0|1} isBaseCell
 */
export function updateCurvedLayer(layer, tiles, isBaseCell) {
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const cell = layer.at(x, y);
      if (!cell) continue;
      const nw = isBaseCell(x - 1, y - 1);
      const ne = isBaseCell(x + 0, y - 1);
      const sw = isBaseCell(x - 1, y + 0);
      const se = isBaseCell(x + 0, y + 0);
      const tileID = ((nw << 1 | ne) << 1 | se) << 1 | sw;
      cell.layerID = tiles.getLayerID(tileID);
    }
  }
}

/**
 * @param {Layer} layer
 * @param {TileSheet<number>} tiles
 * @returns {(x: number, y: number) => 0|1}
 */
export function extendedBaseCellQuery(layer, tiles) {
  const filled = tiles.getLayerID(0b1111);
  return (x, y) => layer.at(
    Math.max(0, Math.min(layer.width - 1, x)),
    Math.max(0, Math.min(layer.height - 1, y)),
  )?.layerID == filled ? 1 : 0;
}

/**
 * @param {Layer} layer
 * @param {TileSheet<number>} tiles
 * @returns {(x: number, y: number) => 0|1}
 */
export function clippedBaseCellQuery(layer, tiles) {
  const filled = tiles.getLayerID(0b1111);
  return (x, y) => layer.at(x, y)?.layerID == filled ? 1 : 0;
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
 * @param {SimpleTile[]} tiles
 * @returns {Generator<{id: number, draw: drawback}>}
 */
export function* generateSimpleTiles(...tiles) {
  let id = 0;
  for (const tile of tiles) {
    yield { id, draw(ctx) { drawSimpleTile(tile, ctx) } };
    id++;
  }
}
