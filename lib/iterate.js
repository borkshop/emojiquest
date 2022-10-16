// @ts-check

/**
 * @template T
 * @param {Iterable<T>} values
 * @yields {[number, T]}
 * @returns {IterableIterator<[number, T]>}
 */
export function* enumerate(values) {
  let index = 0;
  for (const value of values) {
    yield [index, value];
    index += 1;
  }
}
