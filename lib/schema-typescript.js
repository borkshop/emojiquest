/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @type {SchemaTo<string>}
 */
export const toTypeScriptNotation = {
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
  map: (keyType, valueType) => `Map<${keyType}, ${valueType}>`,
  list: type => `Array<${type}>`,
  optional: type => `${type} | undefined`,
};
