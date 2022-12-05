/**
 * @template T
 * @typedef {import('./schema.js').SchemaTo<T>} SchemaTo
 */

/**
 * @param {unknown} allegedValue
 * @param {Array<string>} errors
 * @param {Array<string>} [path]
 */
const validateNumberArray = (allegedValue, errors, path = []) => {
  if (!Array.isArray(allegedValue)) {
    errors.push(`expected array at ${path.join('.')}`);
  } else {
    let index = 0;
    for (const value of allegedValue) {
      if (typeof value !== 'number') {
        errors.push(`expected number at ${path.join('.')}.${index}`);
      }
      index += 1;
    }
  }
};

/**
 * @type {SchemaTo<(allegedValue: unknown, errors: Array<string>, path?: Array<string>) => void>}
 */
const toValidator = {
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
  uint8array: () => validateNumberArray,
  uint16array: () => validateNumberArray,
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
  index:
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
        for (const [key, value] of Object.entries(allegedObject)) {
          if (!Number.isSafeInteger(+key)) {
            errors.push(
              `expected an numeric key at ${path.join(
                '.',
              )} but got ${JSON.stringify(key)}`,
            );
          }
          schema(value, errors, [...path, key]);
        }
      }
    },
  map:
    (keySchema, valueSchema) =>
    (allegedValue, errors, path = []) => {
      if (!Array.isArray(allegedValue)) {
        errors.push(`expected an array at ${path.join('.')}`);
      } else {
        let index = 0;
        for (const entry of allegedValue) {
          if (!Array.isArray(entry) || entry.length !== 2) {
            errors.push(
              `expected a duple (array of length 2) entry at ${path.join(
                '.',
              )}.${index}`,
            );
          } else {
            const [key, value] = entry;
            keySchema(key, errors, [...path, `${index}`]);
            valueSchema(value, errors, [...path, `${index}`]);
            index += 1;
          }
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
 * @param {<T>(t: SchemaTo<T>) => T} schema
 */
export const makeValidator = schema => schema(toValidator);
