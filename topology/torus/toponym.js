// @ts-check

/**
 * @param {object} args
 * @param {import('../../topology.js').TileCoordinateFn} args.tileCoordinate
 * @param {number} [args.offset]
 */
export function makeToponym({ tileCoordinate, offset = 0 }) {
  /**
   * @param {number} location
   */
  const toponym = location => {
    let { x, y } = tileCoordinate(location);
    return `(${x}, ${y}) @${location + offset}`;
  };

  return toponym;
}
