/** @typedef {object} tileSpec
 * @prop {string} [glyph]
 * @prop {string} [glyphStyle]
 * @prop {number} [param.glyphHeight]
 * @prop {string} [param.glyphFont]
 * @prop {string} [fill]
 * @prop {{size: number, style: string}} [border]
 */

/** @callback drawback
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @returns {void}
 */

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
