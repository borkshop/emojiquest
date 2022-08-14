// @ts-check

// Not an ambient types JSDoc.
export {};

/**
 * @typedef {Object} TileCoordinate
 * @prop {number} t - tile number
 * @prop {number} f - face number of tile
 * @prop {number} n - row major index of tile on face
 * @prop {number} x - horizontal position on face
 * @prop {number} y - vertical position on face
 */

/**
 * @typedef {Object} TileQuery
 * @prop {number} f - face number of tile
 * @prop {number} x - horizontal position on face
 * @prop {number} y - vertical position on face
 */

/**
 * @callback TileCoordinateFn
 * @param {number} t - tile index
 * @returns {TileCoordinate}
 */

/**
 * @callback TileNumberFn
 * @param {TileQuery} coord - tile coordinate
 * @returns {number}
 */

/**
 * @callback NeighborFn
 * @param {number} t
 * @param {number} direction
 * @returns {number}
 */

/**
 * @typedef {Object} Cursor
 * @prop {number} position
 * @prop {number} direction
 */

/**
 * @typedef {Object} CursorChange
 * @prop {number} position
 * @prop {number} direction
 * @prop {number} turn
 * @prop {boolean} transit
 */

/**
 * @callback AdvanceFn
 * @param {Cursor} cursor
 * @returns {CursorChange}
 */

/**
 * @callback ToponymFn
 * @param {number} t
 * @returns {string}
 */
