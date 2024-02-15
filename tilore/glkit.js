// @ts-check

/** @typedef {(
 * | Float32ArrayConstructor
 * | Uint32ArrayConstructor
 * | Uint16ArrayConstructor
 * | Uint8ArrayConstructor
 * | Uint8ClampedArrayConstructor
 * | Int32ArrayConstructor
 * | Int16ArrayConstructor
 * | Int8ArrayConstructor
 * )} TypedArrayConstructor */

/** @typedef {(
 * | 'int'
 * | 'ivec2'
 * | 'ivec3'
 * | 'ivec4'
 * | 'uint'
 * | 'uvec2'
 * | 'uvec3'
 * | 'uvec4'
 * | 'bool'
 * | 'bvec2'
 * | 'bvec3'
 * | 'bvec4'
 * | 'float'
 * | 'vec2'
 * | 'vec3'
 * | 'vec4'
 * | 'mat2'
 * | 'mat3'
 * | 'mat4'
 * | 'mat2x3'
 * | 'mat2x4'
 * | 'mat3x2'
 * | 'mat3x4'
 * | 'mat4x2'
 * | 'mat4x3'
 * )} TypeName */

/** @typedef {(
 * | 'int'
 * | 'uint'
 * | 'bool'
 * | 'float'
 * )} ScalarType */

/** @typedef {number|[cols: number, rows: number]} ArrayShape */

/** @typedef {object} TypeInfo
 * @prop {TypeName} name
 * @prop {TypedArrayConstructor} ArrayType
 * @prop {ScalarType} scalarType
 * @prop {ArrayShape} shape
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} type
 * @returns {TypeInfo|null}
 */
export function typeInfo(gl, type) {
  switch (type) {
    case gl.INT: return {
      name: 'int',
      scalarType: 'int',
      ArrayType: Int32Array,
      shape: 1
    };
    case gl.INT_VEC2: return {
      name: 'ivec2',
      scalarType: 'int',
      ArrayType: Int32Array,
      shape: 2
    };
    case gl.INT_VEC3: return {
      name: 'ivec3',
      scalarType: 'int',
      ArrayType: Int32Array,
      shape: 3
    };
    case gl.INT_VEC4: return {
      name: 'ivec4',
      scalarType: 'int',
      ArrayType: Int32Array,
      shape: 4
    };

    case gl.UNSIGNED_INT: return {
      name: 'uint',
      scalarType: 'uint',
      ArrayType: Uint32Array,
      shape: 1
    };
    case gl.UNSIGNED_INT_VEC2: return {
      name: 'uvec2',
      scalarType: 'uint',
      ArrayType: Uint32Array,
      shape: 2
    };
    case gl.UNSIGNED_INT_VEC3: return {
      name: 'uvec3',
      scalarType: 'uint',
      ArrayType: Uint32Array,
      shape: 3
    };
    case gl.UNSIGNED_INT_VEC4: return {
      name: 'uvec4',
      scalarType: 'uint',
      ArrayType: Uint32Array,
      shape: 4
    };

    case gl.BOOL: return {
      name: 'bool',
      scalarType: 'bool',
      ArrayType: Uint8Array,
      shape: 1
    };
    case gl.BOOL_VEC2: return {
      name: 'bvec2',
      scalarType: 'bool',
      ArrayType: Uint8Array,
      shape: 2
    };
    case gl.BOOL_VEC3: return {
      name: 'bvec3',
      scalarType: 'bool',
      ArrayType: Uint8Array,
      shape: 3
    };
    case gl.BOOL_VEC4: return {
      name: 'bvec4',
      scalarType: 'bool',
      ArrayType: Uint8Array,
      shape: 4
    };

    case gl.FLOAT: return {
      name: 'float',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: 1
    };
    case gl.FLOAT_VEC2: return {
      name: 'vec2',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: 2
    };
    case gl.FLOAT_VEC3: return {
      name: 'vec3',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: 3
    };
    case gl.FLOAT_VEC4: return {
      name: 'vec4',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: 4
    };

    case gl.FLOAT_MAT2: return {
      name: 'mat2',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [2, 2]
    };
    case gl.FLOAT_MAT3: return {
      name: 'mat3',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [3, 3]
    };
    case gl.FLOAT_MAT4: return {
      name: 'mat4',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [4, 4]
    };

    case gl.FLOAT_MAT2x3: return {
      name: 'mat2x3',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [2, 3]
    };
    case gl.FLOAT_MAT2x4: return {
      name: 'mat2x4',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [2, 4]
    };
    case gl.FLOAT_MAT3x2: return {
      name: 'mat3x2',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [3, 2]
    };
    case gl.FLOAT_MAT3x4: return {
      name: 'mat3x4',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [3, 4]
    };
    case gl.FLOAT_MAT4x2: return {
      name: 'mat4x2',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [4, 3]
    };
    case gl.FLOAT_MAT4x3: return {
      name: 'mat4x3',
      scalarType: 'float',
      ArrayType: Float32Array,
      shape: [4, 3]
    };

    default:
      return null;
  }
}
