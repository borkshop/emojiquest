/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @type {SchemaTo<string>}
 */
const toTypeScriptNotator = {
  string: () => 'string',
  number: () => 'number',
  boolean: () => 'boolean',
  uint8array: () => 'Uint8Array',
  uint16array: () => 'Uint16Array',
  struct: shape =>
    `{${Object.entries(shape)
      .map(([name, type]) => `${name}: ${type}`)
      .join(', ')}}`,
  choice: (tagName, shapes) =>
    Object.entries(shapes)
      .map(
        ([tagValue, shape]) =>
          `{${tagName}: ${JSON.stringify(tagValue)}, ${Object.entries(shape)
            .map(([name, type]) => `${name}: ${type}`)
            .join(', ')}}`,
      )
      .join(' | '),
  dict: type => `Map<string, ${type}>`,
  index: type => `Map<number, ${type}>`,
  map: (keyType, valueType) => `Map<${keyType}, ${valueType}>`,
  list: type => `Array<${type}>`,
  optional: type => `${type} | undefined`,
};

/**
 * @param {<T>(t: SchemaTo<T>) => T} schema
 */
export const toTypeScriptNotation = schema => schema(toTypeScriptNotator);
