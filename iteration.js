/**
 * Provides missing language features for iterators.
 */

// @ts-check

/**
 * Enumerates a range of numbers.
 *
 * @param {number} [end]
 * @param {number} [start]
 * @param {number} [stride]
 * @yields {number}
 */
export function* count(end = Infinity, start = 0, stride = 1) {
  for (; start < end; start += stride) {
    yield start;
  }
}
