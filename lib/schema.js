// I solemnly swear this these are not ambient types.
export {};

/**
 * @template T
 * @typedef {object} SchemaTo
 * @prop {() => T} number
 * @prop {() => T} boolean
 * @prop {() => T} string
 * @prop {() => T} uint8array
 * @prop {() => T} uint16array
 * @prop {(t: T) => T} optional
 * @prop {(t: T) => T} list
 * @prop {(t: T) => T} dict
 * @prop {(t: T) => T} index
 * @prop {(k: T, v: T) => T} map
 * @prop {(shape: Record<string, T>) => T} struct
 * @prop {(tagName: string, shape: Record<string, Record<string, T>>) => T} choice
 */

/**
 * @typedef {<T>(schema: SchemaTo<T>) => T} Schema
 */
