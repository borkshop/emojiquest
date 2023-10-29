// @ts-check

/** @typedef {(
 * | Array<SimpleTileKind>
 * | SimpleTileKind
 * )} SimpleTile */

/** @typedef {(
 * | SimpleTileFill
 * | SimpleTileText
 * | SimpleTileRect
 * )} SimpleTileKind */

/** @typedef {(
 * | number // px
 * | {prop: number}
 * | {lineProp: number}
 * )} SimpleMetric */

/** @typedef {object} SimpleTileFill
 * @prop {string} fill
 */

/** @typedef {object} SimpleTileText
 * @prop {string} text
 * @prop {string} [font]
 * @prop {string} [color]
 * @prop {SimpleMetric} [height]
 */

/** @typedef {object} Rect
 * @prop {SimpleMetric} x
 * @prop {SimpleMetric} y
 * @prop {SimpleMetric} w
 * @prop {SimpleMetric} h
 */

/** @typedef {object} SimpleTileRect
 * @prop {"border"|Rect} rect
 * @prop {SimpleMetric} [lineWidth]
 * @prop {string} [stroke]
 * @prop {string} [fill]
 */

/**
 * @param {SimpleTile} tile
 * @param {OffscreenCanvasRenderingContext2D} ctx
 */
export default function drawSimpleTile(tile, ctx) {
  if (Array.isArray(tile))
    for (const t of tile) drawSimpleTileKind(t, ctx);
  else drawSimpleTileKind(tile, ctx);
}

/**
 * @param {SimpleTileKind} tile
 * @param {OffscreenCanvasRenderingContext2D} ctx
 */
function drawSimpleTileKind(tile, ctx) {

  if ('rect' in tile) {
    const { canvas: { width: tileSize } } = ctx;
    const { rect, lineWidth, stroke, fill } = tile;
    ctx.beginPath();
    if (rect === 'border') {
      ctx.rect(0, 0, tileSize, tileSize);
    } else {
      const x = resolveSimpleMetric(rect.x, tileSize, ctx);
      const y = resolveSimpleMetric(rect.y, tileSize, ctx);
      const w = resolveSimpleMetric(rect.w, tileSize, ctx);
      const h = resolveSimpleMetric(rect.h, tileSize, ctx);
      ctx.rect(x, y, w, h);
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lineWidth ? resolveSimpleMetric(lineWidth, tileSize, ctx) : 1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  else if ('text' in tile) drawSimpleTileText(tile, ctx);

  else if ('fill' in tile) {
    const { canvas: { width: tileSize } } = ctx;
    ctx.fillStyle = tile.fill;
    ctx.fillRect(0, 0, tileSize, tileSize);
  }

  else throw new Error(`unsupported simple tile ${JSON.stringify(tile)}`);

}

/**
 * @param {SimpleTileText} tile
 * @param {OffscreenCanvasRenderingContext2D} ctx
 */
function drawSimpleTileText(tile, ctx) {
  const
    { canvas: { width: tileSize } } = ctx,
    {
      text,
      color = 'black',
      height = { prop: 0.9 },
      font = 'sans',
    } = tile,
    fontSize = resolveSimpleMetric(height, tileSize, ctx);

  ctx.fillStyle = color;
  ctx.textBaseline = 'bottom';

  if (setAdjustedFontSize(ctx, text, font, fontSize) === 0) {
    // TODO support fallback tile
    console.warn(`tile text "${Array.from(text)
      .map(c => {
        const code = c.codePointAt(0) || 0;
        // TODO less aggressive quoting, do the ascii thing
        return `\\u${code.toString(16).toUpperCase()}`;
      })
      .join('')}" is unsupported`);
    ctx.fillText('�', tileSize / 2, tileSize / 2);
  }

  const
    { actualWidth, actualHeight } = textBoundSize(ctx, text),
    widthRem = tileSize - actualWidth,
    heightRem = tileSize - actualHeight,
    x = Math.floor(widthRem / 2),
    y = tileSize - Math.floor(heightRem / 2);
  ctx.fillText(text, x, y);
}

/**
 * Emoji glyph sizes are a matter of "🤷 you just have to see what you get",
 * so this utility keeps trying to adjust the requested font size down,
 * until the actual width-x-height bounds of the given text fits within a size-x-size square.
 *
 * Returns any final adjust font size for reference,
 * throwing an exception if a usbale font size could not be found.
 *
 * Additionally, if the given Emoji glyph is unsupported in the given font,
 * this whole process stops early and 0 is returned.
 *
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {string} font
 * @param {number} size
 */
function setAdjustedFontSize(ctx, text, font, size) {
  for (let adjust = 0; adjust < size; adjust++) {
    ctx.font = `${size - adjust}px ${font}`;
    const { actualWidth, actualHeight } = textBoundSize(ctx, text);
    if (actualWidth === 0) return 0;
    if (actualHeight < size && actualWidth < size) return size - adjust;
  }
  throw new Error(`unable to find a usable font:${font} adjustment for size:${size} for text:${JSON.stringify(text)}`);
}

/**
 * @param {OffscreenCanvasRenderingContext2D} ctx
 * @param {string} text
 */
function textBoundSize(ctx, text) {
  const {
    actualBoundingBoxLeft,
    actualBoundingBoxRight,
    actualBoundingBoxDescent,
    actualBoundingBoxAscent,
  } = ctx.measureText(text),
    actualWidth = Math.abs(actualBoundingBoxLeft) + Math.abs(actualBoundingBoxRight),
    actualHeight = Math.abs(actualBoundingBoxAscent) + Math.abs(actualBoundingBoxDescent);
  return { actualWidth, actualHeight };
}

/**
 * @param {SimpleMetric} m
 * @param {number} wrt
 * @param {OffscreenCanvasRenderingContext2D} ctx
 */
function resolveSimpleMetric(m, wrt, ctx) {
  if (typeof m == 'number') return m;
  else if ('prop' in m) return m.prop * wrt;
  else if ('lineProp' in m) return m.lineProp * ctx.lineWidth;
  else throw new Error(`unsupported simple tile metric ${JSON.stringify(m)}`);
}
