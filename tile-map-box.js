// @ts-check

/**
 * @param {Object} [size]
 * @param {number} size.x
 * @param {number} size.y
 * @param {Object} [start]
 * @param {number} start.x
 * @param {number} start.y
 */
export function makeBoxTileMap(
  size = { x: 1, y: 1 },
  start = { x: 0, y: 0 },
  offset = 0,
) {
  const map = new Map();
  let i = offset;
  for (let y = start.y; y < start.y + size.y; y += 1) {
    for (let x = start.x; x < start.x + size.x; x += 1) {
      map.set(i, { x, y, a: 0 });
      i += 1;
    }
  }
  return map;
}
