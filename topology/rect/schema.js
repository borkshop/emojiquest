import { pointSchema, colorsSchema } from '../../schema.js';

/**
 * @template T
 * @param {import('../../lib/schema.js').Schema<T>} $
 */
export const rect = $ => ({
  size: pointSchema($),
  colors: colorsSchema($),
});
