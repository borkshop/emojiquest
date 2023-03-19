/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @typedef {object} StringDescription
 * @prop {'string'} type
 *
 * @typedef {object} NumberDescription
 * @prop {'number'} type
 *
 * @typedef {object} BooleanDescription
 * @prop {'boolean'} type
 *
 * @typedef {object} Uint8ArrayDescription
 * @prop {'uint8array'} type
 *
 * @typedef {object} Uint16ArrayDescription
 * @prop {'uint16array'} type
 *
 * @typedef {object} OptionalDescription
 * @prop {'optional'} type
 * @prop {SchemaDescription} description
 *
 * @typedef {object} RequiredDescription
 * @prop {'required'} type
 * @prop {SchemaDescription} description
 *
 * @typedef {object} DictDescription
 * @prop {'dict'} type
 * @prop {SchemaDescription} description
 *
 * @typedef {object} IndexDescription
 * @prop {'index'} type
 * @prop {SchemaDescription} description
 *
 * @typedef {object} MapDescription
 * @prop {'map'} type
 * @prop {SchemaDescription} keyDescription
 * @prop {SchemaDescription} valueDescription
 *
 * @typedef {object} ListDescription
 * @prop {'list'} type
 * @prop {SchemaDescription} description
 *
 * @typedef {object} StructDescription
 * @prop {'struct'} type
 * @prop {Record<string, OptionalDescription | RequiredDescription>} fields
 *
 * @typedef {object} ChoiceDescription
 * @prop {'choice'} type
 * @prop {string} tagName
 * @prop {Record<string, Record<string, OptionalDescription | RequiredDescription>>} options
 *
 * @typedef {(
 *   StringDescription |
 *   NumberDescription |
 *   BooleanDescription |
 *   Uint8ArrayDescription |
 *   Uint16ArrayDescription |
 *   OptionalDescription |
 *   ListDescription |
 *   DictDescription |
 *   IndexDescription |
 *   MapDescription |
 *   StructDescription |
 *   ChoiceDescription
 * )} SchemaDescription
 */

/**
 * @type {SchemaTo<SchemaDescription>}
 */
export const toSchemaDescription = {
  string: () => ({ type: 'string' }),
  number: () => ({ type: 'number' }),
  boolean: () => ({ type: 'boolean' }),
  uint8array: () => ({ type: 'uint8array' }),
  uint16array: () => ({ type: 'uint16array' }),
  struct: fields => ({
    type: 'struct',
    fields: Object.fromEntries(
      Object.entries(fields).map(([name, description]) => [
        name,
        description.type === 'optional'
          ? description
          : { type: 'required', description },
      ]),
    ),
  }),
  choice: (tagName, options) => ({
    type: 'choice',
    tagName,
    options: Object.fromEntries(
      Object.entries(options).map(([tagValue, fields]) => [
        tagValue,
        Object.fromEntries(
          Object.entries(fields).map(([name, description]) => [
            name,
            description.type === 'optional'
              ? description
              : { type: 'required', description },
          ]),
        ),
      ]),
    ),
  }),
  dict: description => ({
    type: 'dict',
    description,
  }),
  index: description => ({
    type: 'index',
    description,
  }),
  map: (keyDescription, valueDescription) => ({
    type: 'map',
    keyDescription,
    valueDescription,
  }),
  list: description => ({
    type: 'list',
    description,
  }),
  optional: description =>
    description.type === 'optional'
      ? description
      : {
          type: 'optional',
          description,
        },
};
