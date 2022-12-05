/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @type {SchemaTo<(value: unknown) => unknown>}
 */
const toEnricher = {
  string: () => value => value,
  number: () => value => value,
  boolean: () => value => value,
  uint8array: () => value =>
    new Uint8Array(/** @type {Array<number>}*/ (value)),
  uint16array: () => value =>
    new Uint16Array(/** @type {Array<number>}*/ (value)),
  struct: shape => value =>
    Object.fromEntries(
      Object.getOwnPropertyNames(shape).map(name => [
        name,
        shape[name](/** @type {Record<string, unknown>} */ (value)[name]),
      ]),
    ),
  choice: (tagName, shapes) => value => {
    const { [tagName]: tagValue, ...rest } =
      /** @type {Record<string, unknown>} */ (value);
    const shape = shapes[/** @type {string} */ (tagValue)];
    return Object.fromEntries([
      ...Object.getOwnPropertyNames(shape).map(name => [
        name,
        shape[name](/** @type {Record<string, unknown>} */ (rest)[name]),
      ]),
      [tagName, tagValue],
    ]);
  },
  dict: enrichValue => value =>
    new Map(
      Object.getOwnPropertyNames(value).map(name => [
        name,
        enrichValue(/** @type {Record<string, unknown>} */ (value)[name]),
      ]),
    ),
  index: enrichValue => value =>
    new Map(
      Object.getOwnPropertyNames(value).map(key => [
        +key,
        enrichValue(/** @type {Record<string, unknown>} */ (value)[key]),
      ]),
    ),
  map: (enrichKey, enrichValue) => value =>
    new Map(
      /** @type {Array<[unknown, unknown]>} */ (value).map(([key, value]) => [
        enrichKey(key),
        enrichValue(value),
      ]),
    ),
  list: enrichValue => value =>
    /** @type {Array<unknown>} */ (value).map(enrichValue),
  optional: enrichValue => value =>
    value == null ? undefined : enrichValue(value),
};

/**
 * @param {<T>(t: SchemaTo<T>) => T} schema
 */
export const makeEnricher = schema => schema(toEnricher);
