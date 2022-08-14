/**
 * A cell is an object with accessor and mutator functions that close over a
 * mutable value.
 * Cells are useful for creating property descriptors, but also generally for
 * distributing read and write authority over a value to different producers
 * and consumers.
 */

/**
 * @template T
 * @callback GetFn
 * @returns {T} value
 */

/**
 * @template T
 * @callback SetFn
 * @param {T} newValue
 */

/**
 * @template T
 * @typedef {Object} Cell
 * @property {SetFn<T>} set
 * @property {GetFn<T>} get
 */

/**
 * @template T
 * @param {T} value
 */
export const cell = value => ({
  get() {
    return value;
  },
  /**
   * @param {T} newValue
   */
  set(newValue) {
    value = newValue;
  },
});
