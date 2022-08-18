// @ts-check

/**
 * @param {object} args
 * @param {import('../../topology.js').TileCoordinateFn} args.tileCoordinate
 */
export function makeTorusToponym({ tileCoordinate }) {
  /**
   * @param {number} location
   */
  const toponym = location => {
    let { x, y } = tileCoordinate(location);
    return `(${x}, ${y}) @${location}`;
  };

  return toponym;
}
