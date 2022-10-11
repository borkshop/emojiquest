/**
 * @template T
 * @typedef {import('./schema.js').Schema<T>} Schema
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
 *   OptionalDescription |
 *   ListDescription |
 *   DictDescription |
 *   StructDescription |
 *   ChoiceDescription
 * )} SchemaDescription
 */

/**
 * @type {Schema<SchemaDescription>}
 */
export const toSchemaDescription = {
  string: () => ({ type: 'string' }),
  number: () => ({ type: 'number' }),
  boolean: () => ({ type: 'boolean' }),
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

/**
 * @param {Record<string, unknown>} value
 * @param {Record<string, OptionalDescription | RequiredDescription>} fields
 * @param {Array<string>} path
 * @param {string} origin
 * @returns {Record<string, unknown>}
 */
const diluteFields = (value, fields, path, origin) =>
  Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [
      name,
      field.type === 'optional' &&
      (value)[name] == null
        ? undefined
        : dilute(
            (value)[name],
            field.description,
            [...path, name],
            origin,
          ),
    ]),
  );

const diluters = {
  /**
   * @param {string} value
   */
  string: value => value,
  /**
   * @param {number} value
   */
  number: value => value,
  /**
   * @param {boolean} value
   */
  boolean: value => value,
  /**
   * @param {Record<string, unknown>} value
   * @param {StructDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {Record<string, unknown>}
   */
  struct: (value, { fields }, path, origin) => diluteFields(value, fields, path, origin),
  /**
   * @param {Record<string, unknown>} value
   * @param {ChoiceDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  choice: (value, { tagName, options }, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(
        `Expected object, got ${typeof value} at ${path.join('.')}`,
      );
    }
    const { [tagName]: tagValue } = /** @type {{[name: string]: unknown}} */ (
      value
    );
    if (typeof tagValue !== 'string') {
      throw new Error(
        `Expected tag named ${tagName} to have a string value, got ${typeof tagValue} at ${path.join(
          '.',
        )}`,
      );
    }
    const fields = options[tagValue];
    return {
      [tagName]: tagValue,
      ...diluteFields(value, fields, path, origin),
    };
  },
  /**
   * @param {unknown} value
   * @param {DictDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  dict: (value, { description }, path) => {
    if (!(value instanceof Map)) {
      throw new Error(
        `Expected map, got ${typeof value} at ${path.join('.')}`,
      );
    }
    return Object.fromEntries(
      [...value.entries()].map(([name, value]) => [
        name,
        dilute(value, description, [...path, name]),
      ])
    );
  },
  /**
   * @param {unknown} value
   * @param {ListDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  list: (value, { description }, path) => {
    if (!Array.isArray(value)) {
      throw new Error(
        `Expected array, got ${typeof value} at ${path.join('.')}`,
      );
    }
    return value.map((value, index) =>
      dilute(value, description, [...path, `${index}`]),
    );
  },
  /**
   * @param {unknown} value
   * @param {OptionalDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  optional: (value, { description }, path) => {
    if (value) {
      return dilute(value, description, path);
    }
    return undefined;
  },
};

/**
 * @param {unknown} value
 * @param {SchemaDescription} description
 * @param {Array<string>} [path]
 * @param {string} [origin]
 */
const dilute = (value, description, path = [], origin = '<unknown>') => {
  const { type } = description;
  const { [type]: diluter } = diluters;
  return diluter(
    /** @type {never} */ (value),
    /** @type {never} */ (description),
    path,
    origin,
  );
};

/**
 * @param {<T>(schema: Schema<T>) => T} schema
 */
export const makeDiluter = schema => {
  const description = schema(toSchemaDescription);
  /**
   * @param {unknown} value
   * @param {object} [opts]
   * @param {string} [opts.origin]
   */
  return (value, { origin }) => dilute(value, description, [], origin);
};

/**
 * @param {<T>(schema: Schema<T>) => T} schema
 */
export const makeEncoder = schema => {
  const dilute = makeDiluter(schema);
  /**
   * @param {unknown} value
   * @param {object} [opts]
   * @param {string} [opts.origin]
   * @param {string} [opts.tab]
   */
  return (value, { origin, tab }) => JSON.stringify(dilute(value, { origin }), null, tab);
};
