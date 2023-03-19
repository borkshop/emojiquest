import { toSchemaDescription } from './schema-describer.js';

/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @param {import('./schema-describer.js').SchemaDescription} description
 * @returns {string}
 */
const note = description => {
  if (description.type === 'string') {
    return 'string';
  } else if (description.type === 'number') {
    return 'number';
  } else if (description.type === 'boolean') {
    return 'boolean';
  } else if (description.type === 'uint8array') {
    return 'Uint8Array';
  } else if (description.type === 'uint16array') {
    return 'Uint16Array';
  } else if (description.type === 'dict') {
    return `Map<string, ${note(description.description)}>`;
  } else if (description.type === 'index') {
    return `Map<number, ${note(description.description)}>`;
  } else if (description.type === 'map') {
    return `Map<${note(description.keyDescription)}, ${note(
      description.valueDescription,
    )}>`;
  } else if (description.type === 'list') {
    return `Array<${note(description.description)}>`;
  } else if (description.type === 'struct') {
    return `{${Object.entries(description.fields)
      .map(
        ([name, { type, description }]) =>
          `${name}${type === 'optional' ? '?' : ''}: ${note(description)}`,
      )
      .join(', ')}}`;
  } else if (description.type === 'choice') {
    return Object.entries(description.options)
      .map(
        ([tagValue, fields]) =>
          `{${description.tagName}: ${JSON.stringify(
            tagValue,
          )}, ${Object.entries(fields)
            .map(
              ([name, { type, description }]) =>
                `${name}${type === 'optional' ? '?' : ''}: ${note(
                  description,
                )}`,
            )
            .join(', ')}}`,
      )
      .join(' | ');
  } else if (description.type === 'optional') {
    return `${note(description.description)} | undefined`;
  } else {
    return 'unknown';
  }
};

/**
 * @param {<T>(t: SchemaTo<T>) => T} schema
 */
export const toTypeScriptNotation = schema => {
  const description = schema(toSchemaDescription);
  return note(description);
};
