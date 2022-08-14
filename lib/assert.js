/**
 * The assert module provides a small assertion utility that is useful
 * for type narrowing and capturing failed invariants.
 */

// @ts-check

/**
 * @param {boolean} condition
 * @param {string} [message]
 * @returns {asserts condition}
 */
export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * @param {number} value
 * @param {string} [message]
 * @returns {asserts value}
 */
export function assertNonZero(value, message) {
  if (value === 0) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * @template T
 * @param {T | undefined} value
 * @param {string} [message]
 * @returns {asserts value is T}
 */
export function assertDefined(value, message) {
  assert(value !== undefined, message);
}

/**
 * @template T
 * @param {T | undefined} value
 * @param {string} [message]
 * @returns {T}
 */
export function assumeDefined(value, message) {
  assert(value !== undefined, message);
  return value;
}

/**
 * @param {number} value
 * @param {string} [message]
 * @returns {number}
 */
export function assumeGreaterThanZero(value, message) {
  assert(value > 0, message);
  return value;
}
