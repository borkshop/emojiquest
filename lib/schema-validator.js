/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @type {SchemaTo<(allegedValue: unknown, errors: Array<string>, path?: Array<string>) => void>}
 */
export const toValidator = {
  string:
    () =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'string') {
        errors.push(`expected a string at ${path.join('.')}`);
      }
    },
  number:
    () =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'number') {
        errors.push(`expected a number at ${path.join('.')}`);
      }
    },
  boolean:
    () =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'boolean') {
        errors.push(`expected a boolean at ${path.join('.')}`);
      }
    },
  struct:
    shape =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'object') {
        errors.push(
          `expected an object at ${path.join(
            '.',
          )} but got ${typeof allegedValue}`,
        );
      } else if (allegedValue === undefined) {
        errors.push(`expected an object at ${path.join('.')}`);
      } else if (allegedValue === null) {
        errors.push(`expected an object at ${path.join('.')} but got null`);
      } else if (Array.isArray(allegedValue)) {
        errors.push(`expected an object at ${path.join('.')} but got an array`);
      } else {
        const allegedObject = /** @type {{[name: string]: unknown}} */ (
          allegedValue
        );
        for (const [name, schema] of Object.entries(shape)) {
          schema(allegedObject[name], errors, [...path, name]);
        }
      }
    },
  choice:
    (tagName, shapes) =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'object') {
        errors.push(
          `expected an object at ${path.join(
            '.',
          )} but got ${typeof allegedValue}`,
        );
      } else if (allegedValue === null) {
        errors.push(`expected an object at ${path.join('.')} but got null`);
      } else if (Array.isArray(allegedValue)) {
        errors.push(`expected an object at ${path.join('.')} but got an array`);
      } else {
        const allegedObject = /** @type {{[name: string]: unknown}} */ (
          allegedValue
        );
        const { [tagName]: tagValue, ...rest } = allegedObject;
        if (typeof tagValue !== 'string') {
          errors.push(
            `expected distinguishing property named ${tagName} with value of type string on object at ${path.join(
              '.',
            )} but got ${typeof tagValue}`,
          );
        } else if (!Object.prototype.hasOwnProperty.call(shapes, tagValue)) {
          errors.push(
            `expected distinguishing property named ${tagName} with a value that is one of ${Object.keys(
              shapes,
            )} at ${path.join('.')}`,
          );
        } else {
          const shape = shapes[tagValue];
          const seen = new Set(Object.keys(shape));
          for (const [name, schema] of Object.entries(shape)) {
            seen.delete(name);
            schema(rest[name], errors, [...path, name]);
          }
          if (seen.size) {
            errors.push(
              `unexpected properties on object with distinguishing property named ${tagName} with value ${tagValue}: ${[
                ...seen,
              ].join(', ')}`,
            );
          }
        }
      }
    },
  dict:
    schema =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'object') {
        errors.push(
          `expected an object at ${path.join(
            '.',
          )} but got ${typeof allegedValue}`,
        );
      } else if (allegedValue === null) {
        errors.push(`expected an object at ${path.join('.')} but got null`);
      } else if (Array.isArray(allegedValue)) {
        errors.push(`expected an object at ${path.join('.')} but got an array`);
      } else {
        const allegedObject = /** @type {{[name: string]: unknown}} */ (
          allegedValue
        );
        for (const [name, value] of Object.entries(allegedObject)) {
          schema(value, errors, [...path, name]);
        }
      }
    },
  list:
    schema =>
    (allegedValue, errors, path = []) => {
      if (typeof allegedValue !== 'object') {
        errors.push(
          `expected an array at ${path.join(
            '.',
          )} but got ${typeof allegedValue}`,
        );
      } else if (allegedValue === null) {
        errors.push(`expected an array at ${path.join('.')} but got null`);
      } else if (!Array.isArray(allegedValue)) {
        errors.push(`expected an array at ${path.join('.')} but got an object`);
      } else {
        let index = 0;
        for (const value of allegedValue) {
          schema(value, errors, [...path, `${index}`]);
          index += 1;
        }
      }
    },
  optional:
    schema =>
    (allegedValue, errors, path = []) => {
      if (allegedValue !== null && allegedValue !== undefined) {
        schema(allegedValue, errors, path);
      }
    },
};

/**
 * @type {SchemaTo<(value: unknown) => unknown>}
 */
export const toEnricher = {
  string: () => value => value,
  number: () => value => value,
  boolean: () => value => value,
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
  list: enrichValue => value =>
    /** @type {Array<unknown>} */ (value).map(enrichValue),
  optional: enrichValue => value =>
    value == null ? undefined : enrichValue(value),
};
