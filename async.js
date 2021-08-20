/**
 * The async module provides promise utilities.
 */

// @ts-check

/**
 * @template T
 * @callback ResolveFn
 * @param {T | PromiseLike<T>} resolution
 */

/**
 * @callback RejectFn
 * @param {Error} error
 */

/**
 * @template T
 * @typedef {Object} Deferred
 * @property {Promise<T>} promise
 * @property {ResolveFn<T>} resolve
 * @property {RejectFn} reject
 */

/*
 * @template T
 * @return {Deferred<T>}
 */
export function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  if (resolve === undefined || reject === undefined) {
    throw new Error('The type system, it deceived us!');
  }
  /** @type {Deferred<T>} */
  return { promise, resolve, reject };
}

/**
 * @param {number} ms
 * @return {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
