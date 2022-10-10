import { colorsSchema } from '../../schema.js';

/**
 * @template T
 * @param {import('../../lib/schema.js').Schema<T>} $
 */
export const daia = $ => ({
  facetsPerFace: $.number(),
  tilesPerFacet: $.number(),
  colors: $.list(colorsSchema($)),
});
