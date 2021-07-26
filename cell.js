
// Not an ambient type module:
export default null;

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
  }
});

