import { toSchemaDescription } from './schema-describer.js';

/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @param {Record<string, unknown>} value
 * @param {Record<string, import('./schema-describer.js').OptionalDescription | import('./schema-describer.js').RequiredDescription>} fields
 * @param {Array<string>} path
 * @param {string} origin
 * @returns {Record<string, unknown>}
 */
const diluteFields = (value, fields, path, origin) =>
  Object.fromEntries(
    Object.entries(fields)
      .map(([name, field]) => [
        name,
        field.type === 'optional' && value[name] == null
          ? undefined
          : dilute(value[name], field.description, [...path, name], origin),
      ])
      .filter(([_, field]) => field !== undefined),
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
   * @param {Uint8Array} value
   */
  uint8array: value => [...value],
  /**
   * @param {Uint16Array} value
   */
  uint16array: value => [...value],
  /**
   * @param {Record<string, unknown>} value
   * @param {import('./schema-describer.js').StructDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {Record<string, unknown>}
   */
  struct: (value, { fields }, path, origin) =>
    diluteFields(value, fields, path, origin),
  /**
   * @param {Record<string, unknown>} value
   * @param {import('./schema-describer.js').ChoiceDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  choice: (value, { tagName, options }, path, origin) => {
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
   * @param {import('./schema-describer.js').DictDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  dict: (value, { description }, path) => {
    if (!(value instanceof Map)) {
      throw new Error(`Expected map, got ${typeof value} at ${path.join('.')}`);
    }
    return Object.fromEntries(
      [...value.entries()].map(([name, value]) => [
        name,
        dilute(value, description, [...path, name]),
      ]),
    );
  },
  /**
   * @param {unknown} value
   * @param {import('./schema-describer.js').IndexDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  index: (value, { description }, path) => {
    if (!(value instanceof Map)) {
      throw new Error(`Expected map, got ${typeof value} at ${path.join('.')}`);
    }
    return Object.fromEntries(
      [...value.entries()].map(([index, value]) => [
        `${index}`,
        dilute(value, description, [...path, `${index}`]),
      ]),
    );
  },
  /**
   * @param {unknown} value
   * @param {import('./schema-describer.js').MapDescription} description
   * @param {Array<string>} path
   * @param {string} origin
   * @returns {unknown}
   */
  map: (value, { keyDescription, valueDescription }, path) => {
    if (!(value instanceof Map)) {
      throw new Error(`Expected map, got ${typeof value} at ${path.join('.')}`);
    }
    return new Map(
      [...value.entries()].map(([key, value], index) => [
        dilute(key, keyDescription, [...path, `${index}`]),
        dilute(value, valueDescription, [...path, `${index}`]),
      ]),
    );
  },
  /**
   * @param {unknown} value
   * @param {import('./schema-describer.js').ListDescription} description
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
   * @param {import('./schema-describer.js').OptionalDescription} description
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
 * @param {import('./schema-describer.js').SchemaDescription} description
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
 * @param {<T>(schema: SchemaTo<T>) => T} schema
 */
export const makeDiluter = schema => {
  const description = schema(toSchemaDescription);
  /**
   * @param {unknown} value
   * @param {object} [opts]
   * @param {string} [opts.origin]
   */
  return (value, { origin } = {}) => dilute(value, description, [], origin);
};
