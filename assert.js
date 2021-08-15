// @ts-check

/**
 * @param {any} condition
 * @param {string} [message]
 * @returns {asserts condition}
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed${message ? ` ${message}` : ''}`);
  }
}
