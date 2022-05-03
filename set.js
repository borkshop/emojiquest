// @ts-check

/**
 * @template T
 * @param {Set<T>=} a
 * @param {Set<T>=} b
 * @returns {Iterable<T>}
 */
export function* setIntersection(a, b) {
  if (!a) {
    return;
  }
  if (!b) {
    return;
  }
  for (const v of a) {
    if (b.has(v)) {
      yield v;
    }
  }
}

/**
 * @template T
 * @param {Set<T>=} a
 * @param {Set<T>=} b
 * @returns {Iterable<T>}
 */
export function* setDifference(a, b) {
  if (!a) {
    return;
  }
  if (!b) {
    yield* a;
    return;
  }
  for (const v of a) {
    if (!b.has(v)) {
      yield v;
    }
  }
}
