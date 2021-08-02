// @ts-check

/**
 * @param {any} condition
 * @returns {asserts condition}
 */
export function assert(condition) {
  if (!condition) {
    throw new Error(`Assertion failed`);
  }
}
