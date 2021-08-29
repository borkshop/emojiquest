/**
 * The assert module provides a small assertion utility that is useful
 * for type narrowing and capturing failed invariants.
 */

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

/**
 * @template T
 * @param {T | undefined} value
 * @returns {T}
 */
export function check(value) {
  assert(value !== undefined);
  return value;
}
