/**
 * @template T
 * @typedef {import('./schema.js').Schema<T>} Schema
 */

/**
 * @type {Schema<string>}
 */
export const toTypeScriptNotation = {
  string: () => 'string',
  number: () => 'number',
  boolean: () => 'boolean',
  struct: shape =>
    `{${Object.entries(shape)
      .map(([name, schema]) => `${name}: ${schema}`)
      .join(', ')}}`,
  choice: (tagName, shapes) =>
    Object.entries(shapes)
      .map(
        ([tagValue, shape]) =>
          `{${tagName}: ${JSON.stringify(tagValue)}, ${Object.entries(shape)
            .map(([name, schema]) => `${name}: ${schema}`)
            .join(', ')}}`,
      )
      .join(' | '),
  dict: schema => `Map<string, ${schema}>`,
  list: schema => `Array<${schema}>`,
  optional: schema => `${schema} | undefined`,
};
