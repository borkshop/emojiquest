// I solemnly swear this these are not ambient types.
export {};

/**
 * @template T
 * @typedef {object} Schema
 * @prop {() => T} number
 * @prop {() => T} boolean
 * @prop {() => T} string
 * @prop {(t: T) => T} optional
 * @prop {(t: T) => T} list
 * @prop {(t: T) => T} dict
 * @prop {(shape: Record<string, T>) => T} struct
 * @prop {(tagName: string, shape: Record<string, Record<string, T>>) => T} choice
 */
