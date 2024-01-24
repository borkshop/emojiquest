// @ts-check

/** Specifies a DataFrame aspect, defaulting to dense storage.
 * Aspect data is allocated optimally for batch processing, especially of dense aspects;
 * this comes at the cost (runtime and api complexity) of transactional access (to/across each index position).
 *
 * Dense aspects have storage allocated 1:1 for every DataFrame index.
 *
 * Sparse aspects have their storage allocated on demand and,
 * each DataFrame index MAY have a single element defined/assigned to it.
 *
 * @typedef {(
 * | Element
 * | SparseElement
 * )} Aspect */

/** @typedef {{sparse: Element}} SparseElement */

// TODO multi aspects where each index may have 1 OR MORE elements

/** Each aspect is an array of elements, each element value may be:
 * - scalar, a number
 * - vector, a 1d typed array
 * - matrix, a 2d typed array
 * - struct, a named compound of scalar/vector/matrix field values
 *
 * @typedef {(
 * | Component
 * | ArrayElement
 * | StructElement
 * )} Element */

/** Specifies typed array element data, starting with scaslar elements (Size=1),
 * common vectors (Size=2,3,4), or larger "bag of numbers" types like matrices.
 *
 * @typedef {object} ArrayElement
 * @prop {Scalar} array -- component type
 * @prop {ArrayShape} shape -- component count per element, default 1
 */

/** @typedef {number|[cols: number, rows: number]} ArrayShape */

/** Specifies compound typed buffer data.
 *
 * NOTE scalar arrays will function the same as Component;
 *      i.e. {field: 'float32'} over {field: {array: 'float32', shape: 1}}
 *
 * @typedef {object} StructElement
 * @prop {{[field: string]: Component|ArrayElement }} struct
 * TODO padding/alignment options
 */

/** @typedef {{[name: string]: Aspect}} AspectMap */

/** @template {AspectMap} Aspects
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef {{
 *   [Name in keyof Aspects]: ThatAspect<Aspects[Name], IndexRef, IndexPropMap>
 * }} ThoseAspects */

/** @template {AspectMap} Aspects
 * @typedef {{
 *   [Name in keyof Aspects]: ThatAspectElement<Aspects[Name]>
 * }} ThoseElements */

/** @template {Aspect} A
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef {(
 * A extends SparseElement ? SparseAspect<A["sparse"]>
 * : A extends Element ? DenseAspect<A, IndexRef, IndexPropMap>
 * : never
 * )} ThatAspect */

/** @template {Aspect} A
 * @typedef {(
 * A extends SparseElement ? undefined|ThatValue<A["sparse"]>
 * : A extends Element ? ThatValue<A>
 * : never
 * )} ThatAspectElement */

/** @template {Element} E
 * @typedef {(
 * E extends Component ? ThatComponent<E>
 * : E extends ArrayElement ? ThatArrayValue<E["array"]>
 * : E extends StructElement ? ThatStructValue<E["struct"]>
 * : never
 * )} ThatValue */

/** @template {Element} E
 * @typedef {(
 * E extends Component ? {value: ThatComponent<E>}
 * : E extends ArrayElement ? {value: ThatArrayValue<E["array"]>}
 * : E extends StructElement ? ThatStructValue<E["struct"]>
 * : never
 * )} ThatWrappedValue */

/** @template {Component} C
 * @typedef {(
 * C extends Scalar ? ThatScalar<C>
 * : C extends Vector ? ThatVector<C>
 * : C extends Matrix ? ThatMatrix<C>
 * : never
 * )} ThatComponent */

/** @template {Scalar} S
 * @typedef {(
 * S extends 'float32'|'uint32'|'uint16'|'uint8'|'uint8Clamped'|'int32'|'int16'|'int8' ? number
 * : S extends 'bool' ? boolean
 * : never
 * )} ThatScalar */

/** @template {Vector} V
 * @typedef {(
 * V extends 'vec2'|'uvec2'|'ivec2' ? [x: number, y: number]
 * : V extends 'vec3'|'uvec3'|'ivec3' ? [x: number, y: number, z: number]
 * : V extends 'rgb' ? [r: number, g: number, b: number]
 * : V extends 'vec4'|'uvec4'|'ivec4' ? [x: number, y: number, z: number, w: number]
 * : V extends 'rgba' ? [r: number, g: number, b: number, a: number]
 * : V extends 'bvec2' ? [x: boolean, y: boolean]
 * : V extends 'bvec3' ? [x: boolean, y: boolean, z: boolean]
 * : V extends 'bvec4' ? [x: boolean, y: boolean, z: boolean, w: boolean]
 * : never
 * )} ThatVector */

/** @template {Matrix} M
 * @typedef {(
 * M extends 'mat2' ? [
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 * ]
 * : M extends 'mat3' ? [
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 *   x3: number, y3: number, z3: number,
 * ]
 * : M extends 'mat4' ? [
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 *   x3: number, y3: number, z3: number, w3: number,
 *   x4: number, y4: number, z4: number, w4: number,
 * ]
 * : M extends 'mat2x3' ? [
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 * ]
 * : M extends 'mat2x4' ? [
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 * ]
 * : M extends 'mat3x2' ? [
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 *   x3: number, y3: number,
 * ]
 * : M extends 'mat3x4' ? [
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 *   x3: number, y3: number, z3: number, w3: number,
 * ]
 * : M extends 'mat4x2' ? [
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 *   x3: number, y3: number,
 *   x4: number, y4: number,
 * ]
 * : M extends 'mat4x3' ? [
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 *   x3: number, y3: number, z3: number,
 *   x4: number, y4: number, z4: number,
 * ]
 * : never
 * )} ThatMatrix */

/** @template {ArrayElement["array"]} T
 * @typedef {ArrayLike<ThatScalar<T>>} ThatArrayValue */

/** @template {StructElement["struct"]} Fields
 * @typedef {{
 *   [Name in keyof Fields]: ThatValue<Fields[Name]>
 * }} ThatStructValue */

function makeCache() {
  /** @type {Map<string, any>} */
  const _cache = new Map();

  return {
    /**
     * @template T
     * @param {string} key
     * @param {() => T} miss
     * @returns {T}
     */
    get(key, miss) {
      let val = _cache.get(key);
      if (val === undefined) {
        val = miss();
        if (val !== undefined) {
          // TODO should we also not cache a null value?
          _cache.set(key, val);
        }
      }
      return val;
    },

    /** @param {string} key */
    delete(key) {
      return _cache.delete(key);
    },

    clear: () => _cache.clear(),
  };
}

/** @typedef {ReturnType<makeCache>} Cache */

/** @typedef {object} ThatElement
 * @prop {number} $index
 * @prop {Cache} _cache
 */

/**
 * @template Ref
 * @template {PropertyDescriptorMap} PropMap
 * @param {object} methods
 * @param {(ref: Ref) => number} methods.refToIndex
 * @param {() => void} [methods.clear]
 * @param {(upto: Ref|number) => number} [methods.resize]
 * @param {PropMap} propMap
 * @returns {Index<Ref, PropMap>}
 */
export function makeIndex({
  refToIndex,
  clear = () => { },
  resize = upto => {
    if (typeof upto != 'number') throw new Error('Index Ref-aware resize not implemented');
    return upto;
  },
}, propMap) {
  if (!Object.keys(propMap).every(key => key.startsWith('$')))
    throw new Error(`every index propMap key must start with "$"; found: ${Object.keys(propMap).filter(key => !key.startsWith('$'))}`);
  return {
    refToIndex,
    propMap,
    clear,
    resize,
  };
}

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {ThatElement} T
 * @template {PropertyDescriptorMap} ExtraPropMap
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {T} val
 * @param {ExtraPropMap} [extraProps]
 */
function makeIndexed(index, val, extraProps) {
  Object.defineProperties(val, index.propMap);
  if (extraProps) Object.defineProperties(val, extraProps);
  /** @typedef {ExtraPropMap extends never
   *   ? T & Created<IndexPropMap>
   *   : T & Created<IndexPropMap> & Created<ExtraPropMap>} R */
  return /** @type {R} */ (val);
}

/** An Index provides meaning to DataFrame ordinal indices.
 *
 * Each ordinal index is associated with domain reference data, may be encoded
 * directly in ordinal numeric data, stored in ancillary index data, or both.
 *
 * Examples include:
 * - natural number monotonic identifiers -- index 0 is id 1, and so on
 * - spatial index in row major layout with some width -- index 4 is xy=[1,1] under width 3
 * - opaque (e.g. string) identifers stored in index-instantiated maps
 *
 * @template Ref -- domain specific bundled representation of index data, sufficient to be turned back into an index ordinal
 * @template {PropertyDescriptorMap} PropMap
 * @typedef {object} Index
 * @prop {(ref: Ref) => number} refToIndex -- resolves packed reference data into DataFrame ordinal index number
 * @prop {PropMap} propMap -- all keys MUST begin with $, unpacks reference compoenent data, descriptors called with this:{$index:number}
 * @prop {() => void} clear
 * @prop {(upto: Ref|number) => number} resize
 */

export const MonotonicIndex = Object.freeze(makeIndex({
  refToIndex(id) { return id - 1 },
}, {
  $id: {
    enumerable: true,
    /** @this {ThatElement} */
    get() { return this.$index + 1 },
  },
}));

/**
 * @typedef {object} XYTopology
 * @prop {(x: number, y: number) => number} resize
 * @prop {(x: number, y: number) => number} at
 * @prop {($index: number) => number} getX
 * @prop {($index: number) => number} getY
 * @prop {($index: number) => [x: number, y: number]} getXY
 */

/** @param {{width: number}|{height: number}|XYTopology} [shape] */
export function makeXYIndex(shape = { width: 0 }) {
  // TODO accept relative origin

  const topo = (/** @returns {XYTopology} */ () => {
    if ('width' in shape) {
      let { width } = shape;
      return {
        at(x, y) {
          if (x >= width) return NaN;
          return y * width + x;
        },
        resize(x, y) {
          width = x;
          return x * y;
        },
        getX($index) { return $index % width },
        getY($index) { return Math.floor($index / width) },
        getXY($index) { return [$index % width, Math.floor($index / width)] },
      };
    }

    if ('height' in shape) {
      let { height } = shape;
      return {
        at(x, y) {
          if (y >= height) return NaN;
          return x * height + y;
        },
        resize(x, y) {
          height = y;
          return x * y;
        },
        getX($index) { return Math.floor($index / height) },
        getY($index) { return $index % height },
        getXY($index) { return [Math.floor($index / height), $index % height] },
      };
    }

    return shape;
  })();

  return Object.freeze(makeIndex({
    /** @param {[x: number, y: number]} at */
    refToIndex(at) {
      const [x, y] = at;
      const $index = (x < 0 || y < 0) ? NaN : topo.at(x, y);
      return $index;
    },
    resize(upto) {
      return typeof upto == 'number' ? upto : topo.resize(...upto);
    },
  }, {
    $x: {
      enumerable: true,
      /** @this {ThatElement} */
      get() { return topo.getX(this.$index) },
    },
    $y: {
      enumerable: true,
      /** @this {ThatElement} */
      get() { return topo.getY(this.$index) },
    },
    $xy: {
      enumerable: true,
      /** @this {ThatElement} */
      get() { return topo.getXY(this.$index) },
    },
  }));
}


// TODO other index types like
// xyz
// external identifier (map based?)

// TODO is there a stdlib version of this type function?
/** @template {PropertyDescriptor} Desc
 * @typedef {Desc["get"] extends Function ? ReturnType<Desc["get"]> : Desc["value"]} CreatedValue */

// TODO is there a stdlib version of this type function?
/** @template {PropertyDescriptorMap} PropMap
 * @typedef {{ [Name in keyof PropMap]: CreatedValue<PropMap[Name]> }} Created */

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {AspectMap} Aspects
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {Aspects} aspectSpecs
 * @param {number|IndexRef} [initialUpto]
 */
export function makeDataFrame(
  index,
  aspectSpecs,
  initialUpto = 0,
) {
  const aspectNames = Object.keys(aspectSpecs);
  for (const name of aspectNames)
    if (name.startsWith('$'))
      throw new Error('DataFrame aspect name may not begin with $');

  /** @typedef {ThoseAspects<Aspects, IndexRef, IndexPropMap>} ThemAspects */
  /** @typedef {{ [name in keyof Aspects]:
   *     Omit<ThemAspects[name], "resize"|"clear"|"elementDescriptor">
   * }} ThemExports */
  /** @typedef {ThatElement & Created<IndexPropMap>} ThatIndex */
  /** @typedef {ThatIndex & ThoseElements<Aspects>} ThatRecord */

  const initialLength = index.resize(initialUpto);

  const
    aspects = Object.entries(aspectSpecs).map(([name, spec]) =>
      typeof spec == 'string'
        ? makeDenseAspect(name, index, spec, initialLength)
        : 'sparse' in spec
          ? makeSparseAspect(name, spec.sparse, initialLength)
          : makeDenseAspect(name, index, spec, initialLength)),

    aspectPropMap = Object.fromEntries(aspectNames.map(
      /** @returns {[name: string, desc: PropertyDescriptor]} */
      (name, i) => [name, aspects[i].elementDescriptor]));

  let length = initialLength;

  /** @param {number} $index */
  const makeIndexRef = $index => {
    const _cache = makeCache();
    const $el = /** @type {ThatElement} */ (Object.create({
      get _cache() { return _cache },
    }, {
      $index: {
        get() { return $index },
        set(i) {
          _cache.clear();
          $index = Math.min(length, Math.max(0, i));
        },
      },
    }));
    return /** @type {ThatIndex} */ (makeIndexed(index, $el));
  };

  /** @param {number} $index */
  const get = $index => {
    const $ix = makeIndexRef($index);
    const $ref = /** @type {ThatRecord} */ (Object.defineProperties($ix, aspectPropMap));
    return Object.seal($ref);
  };

  return {
    get length() { return length },

    toIndex: index.refToIndex,

    clear() {
      index.clear();
      for (let i = 0; i < aspects.length; i++)
        aspects[i].clear();
    },

    /** @param {number|IndexRef} upto */
    resize(upto) {
      const newLength = index.resize(upto);
      length = newLength;
      for (let i = 0; i < aspects.length; i++)
        aspects[i].resize(length);
    },

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      return $index >= 0 && $index < length ? get($index) : undefined;
    },

    get,

    [Symbol.iterator]: () => iterateCursor(get(-1), () => length),

    aspects: /** @type {ThemExports} */ (
      Object.fromEntries(aspectNames.map((name, i) => [name,
        dropProperties({}, aspects[i], 'resize', 'clear', 'elementDescriptor')
      ]))),

  };
}

/** @typedef {object} AspectCore
 * @prop {string} name
 * @prop {ArrayBuffer} buffer
 * @prop {number} byteLength
 * @prop {number} byteStride
 * @prop {number} length
 * @prop {() => void} clear
 * @prop {(newLength: number) => void} resize
 * @prop {() => Iterable<FieldInfo>} fieldInfo
 */

/** @template {Element} E
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef {ThatElement & Created<IndexPropMap> & ThatWrappedValue<E>} ThatDenseValue
 */

/** @template {Element} E
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef { AspectCore & {
 *   elementDescriptor: PropertyDescriptor, // TODO type specialize get(T)/set()=>T ?
 *   ref: (ref: IndexRef) => ThatDenseValue<E, IndexPropMap>|undefined,
 *   get: ($index: number) => ThatDenseValue<E, IndexPropMap>,
 *   [Symbol.iterator]: () => Iterator<ThatDenseValue<E, IndexPropMap>>,
 * } } DenseAspect
 */

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {Element} E
 * @param {string} name
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {E} element
 * @returns {DenseAspect<E, IndexRef, IndexPropMap>}
 */
export function makeDenseAspect(name, index, element, initialLength = 0) {
  if (typeof element != 'string' && typeof element != 'object')
    throw new Error('invalid aspect element spec');

  const
    byteStride = elementByteLength(element),
    elementDescriptor = makeElementDescriptor(name, element, () => buffer, byteStride),
    propMap = makeWrappedDescriptorMap(name, element, () => buffer, byteStride);

  let
    length = initialLength,
    buffer = new ArrayBuffer(initialLength * byteStride);

  /** @param {number} $index */
  const get = $index => {
    const _cache = makeCache();
    const $el = /** @type {ThatElement} */ (Object.create({
      get _cache() { return _cache },
    }, {
      $index: {
        get() { return $index },
        set(i) {
          _cache.clear();
          $index = Math.min(length, Math.max(0, i));
        },
      },
    }));

    const $ref = /** @type {ThatDenseValue<E, IndexPropMap>} */ (Object.defineProperties(makeIndexed(index, $el), propMap));

    return Object.seal($ref);
  };

  return {
    get name() { return name },
    get buffer() { return buffer },
    get byteLength() { return length * byteStride },
    get byteStride() { return byteStride },
    get length() { return length },
    get elementDescriptor() { return elementDescriptor },
    fieldInfo: () => elementFieldInfo(element),

    clear() {
      new Uint8Array(buffer).fill(0);
      // TODO specific default value?
    },

    resize(newLength) {
      // TODO fill new with specific default value?
      // TODO copy old data over; use index to inform topology
      buffer = new ArrayBuffer(byteStride * newLength);
      length = newLength;
    },

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      return $index >= 0 && $index < length ? get($index) : undefined;
    },

    get,

    [Symbol.iterator]: () => iterateCursor(get(-1), () => length),
  };
}

/** @typedef {ThatElement & {
 *   $frameIndex: number|undefined,
 * } } ThatSparseElement
 */

/** @template {Element} E
 * @typedef {ThatSparseElement & ThatWrappedValue<E>} ThatSparseValue
 */

/** @template {Element} E
 * @typedef { AspectCore & {
 *   elementDescriptor: PropertyDescriptor, // TODO type specialize get(T)/set()=>T ?
 *   get: ($index: number) => ThatSparseValue<E>,
 *   getFor: ($frameIndex: number) => ThatSparseValue<E>|undefined,
 *   [Symbol.iterator]: () => Iterator<ThatSparseValue<E>>,
 *   all: () => Iterator<ThatSparseValue<E>>,
 * } } SparseAspect
 */

/**
 * @template {Element} E
 * @param {string} name
 * @param {E} element
 * @returns {SparseAspect<E>}
 */
export function makeSparseAspect(name, element, initialLength = 0) {
  if (typeof element != 'string' && typeof element != 'object')
    throw new Error('invalid aspect element spec');

  const
    byteStride = elementByteLength(element),
    innerDescriptor = makeElementDescriptor(name, element, () => buffer, byteStride),
    propMap = makeWrappedDescriptorMap(name, element, () => buffer, byteStride);

  let
    length = 0,
    buffer = new ArrayBuffer(initialLength * byteStride);

  const
    used = makeBitVector(initialLength),
    /** @type Map<number, number> */
    indexMap = new Map(), // maps DataFrame index -> Aspect index
    /** @type Map<number, number> */
    reverseMap = new Map() // maps Aspect index -> DataFrame index
    ;

  const reuse = () => {
    const $index = used.claim();
    if ($index != undefined && $index >= length) {
      length = $index + 1;
    }
    return $index;
  };

  const alloc = () => {
    const $index = length++;

    let capacity = buffer.byteLength / byteStride;
    while (capacity < length)
      capacity = capacity == 0 ? 2 * length
        : capacity < 1024 ? capacity * 2
          : capacity + capacity / 4;

    const newByteLength = capacity * byteStride;
    if (newByteLength > buffer.byteLength) {
      const newBuffer = new ArrayBuffer(newByteLength);
      new Uint8Array(newBuffer).set(new Uint8Array(buffer));
      buffer = newBuffer;
      used.length = capacity;
    }

    used.set($index);
    return $index;
  };

  // TODO compaction wen

  /**
   * @param {number} $index
   * @param {Cache} [cache]
   */
  const ref = ($index, cache) => {
    const indexReadonly = cache ? true : false;
    const theCache = cache ? cache : makeCache();

    const $el = /** @type {ThatSparseElement} */ (Object.create({
      get _cache() { return theCache },
    }, {
      $index: {
        enumerable: true,
        get() { return $index },
        set: indexReadonly ? undefined : i => {
          theCache.clear();
          $index = Math.min(length, Math.max(0, i));
        },
      },

      $frameIndex: {
        enumerable: true,
        get() { return reverseMap.get($index) },
        set($frameIndex) {
          if ($frameIndex == undefined) {
            const prior = reverseMap.get($index);
            if (prior != undefined) indexMap.delete(prior);
            reverseMap.delete($index);
            used.unset($index);
          } else {
            used.set($index);
            indexMap.set($frameIndex, $index);
            reverseMap.set($index, $frameIndex);
          }
        },
      },
    }));

    const $ref = /** @type {ThatSparseValue<E>} */ (Object.defineProperties($el, propMap));

    return Object.seal($ref);
  };

  const outerDescriptor = {
    enumerable: true,

    /** @this {ThatElement} */
    get() {
      const { $index: $frameIndex, _cache } = this;
      const $index = indexMap.get($frameIndex);
      if ($index == undefined) return undefined;
      const $ref = _cache.get(`${name}$ref`, () => ref($index, _cache));
      return innerDescriptor.get.call($ref);
    },

    /** @this {ThatElement} @param {any} value */
    set(value) {
      const { $index: $frameIndex, _cache } = this;
      let $index = indexMap.get($frameIndex);
      if (value !== null && value !== undefined) {
        if ($index === undefined) {
          $index = reuse();
          if ($index === undefined) $index = alloc();
          indexMap.set($frameIndex, $index);
          reverseMap.set($index, $frameIndex);
        }
        const $mustIndex = $index;
        const $ref = _cache.get(`${name}$ref`, () => ref($mustIndex, _cache));
        innerDescriptor.set.call($ref, value);
      } else if ($index !== undefined) {
        _cache.delete(`${name}$ref`);
        indexMap.delete($frameIndex);
        reverseMap.delete($index);
        used.unset($index);
      }
    },
  };

  return {
    get name() { return name },
    get buffer() { return buffer },
    get byteStride() { return byteStride },
    get byteLength() { return length * byteStride },
    get length() { return length },
    get elementDescriptor() { return outerDescriptor },
    fieldInfo: () => elementFieldInfo(element),

    clear() {
      indexMap.clear();
      reverseMap.clear();
      length = 0;
      used.clear();
      buffer = new ArrayBuffer(initialLength);
      used.length = initialLength;
    },

    resize(newLength) {
      for (const [$frameIndex, $index] of indexMap) {
        if ($frameIndex >= newLength) {
          indexMap.delete($frameIndex);
          reverseMap.delete($index);
          used.unset($index);
        }
      }
      // TODO when to trigger compaction after shrink?

      // TODO remap moved ids if necessary (e.g. sparse reference to spatially indexed data)
    },

    get: $index => ref($index),

    getFor($frameIndex) {
      const $index = indexMap.get($frameIndex);
      return $index === undefined ? undefined : ref($index, makeCache());
    },

    [Symbol.iterator]: () => iterateCursor(ref(-1), () => length,
      cur => reverseMap.get(cur.$index) !== undefined),

    all: () => iterateCursor(ref(-1), () => length),

  };
}

/**
 * @param {string} name
 * @param {Element} element
 * @param {() => ArrayBuffer} getBuffer
 * @param {number} [byteStride]
 */
function makeElementDescriptor(name, element, getBuffer, byteStride = elementByteLength(element)) {
  if (typeof element == 'string') {
    const type = scalarType(element);
    const shape = componentShape(element);
    if (typeof shape == 'number' && shape == 1)
      return makeScalarDescriptor(`${name}$`, type, getBuffer, byteStride);
    element = { array: type, shape };
  }

  if ('array' in element)
    return makeArrayDescriptor(`${name}@`, element, getBuffer, byteStride);

  else if ('struct' in element)
    return makeStruct(`${name}.`, element, getBuffer, byteStride).compoundDescriptor;

  else unreachable(element);
}

/**
 * @param {string} name
 * @param {Element} element
 * @param {() => ArrayBuffer} getBuffer
 * @param {number} [byteStride]
 * @returns {PropertyDescriptorMap}
 * TODO map each value types more narrowly
 */
function makeWrappedDescriptorMap(name, element, getBuffer, byteStride = elementByteLength(element)) {
  if (typeof element == 'string') {
    const type = scalarType(element);
    const shape = componentShape(element);
    if (typeof shape == 'number' && shape == 1)
      return {
        value: makeScalarDescriptor(`${name}$`, type, getBuffer, byteStride),
      };
    element = { array: type, shape };
  }

  if ('array' in element)
    return {
      value: makeArrayDescriptor(`${name}@`, element, getBuffer, byteStride),
    };

  if ('struct' in element)
    return makeStruct(`${name}.`, element, getBuffer, byteStride).propMap;

  else unreachable(element);
}

/**
 * @param {string} name
 * @param {Scalar} type
 * @param {() => ArrayBuffer} getBuffer
 * @param {number} [byteStride]
 */
function makeScalarDescriptor(name, type, getBuffer, byteStride = componentByteLength(type)) {
  const { propMap: { value } } = makeStruct(name, { struct: { value: type } }, getBuffer, byteStride);
  return value;
}

/**
 * @param {string} name
 * @param {ArrayElement} element
 * @param {() => ArrayBuffer} getBuffer
 * @param {number} [byteStride]
 */
function makeArrayDescriptor(name, element, getBuffer, byteStride = elementByteLength(element)) {
  const
    { array: type } = element,
    arrayType = componentTypedArray(type);
  return makeCompoundDescriptor(name,
    /** @returns {constructedArray<arrayType>} */
    el => {
      // NOTE important to call getBuffer() AFTER $index access which may invalidate buffer
      const
        { $index } = el,
        { shape } = element,
        arrayStride = typeof shape == 'number' ? shape : shape[0] * shape[1];
      return new arrayType(getBuffer(), $index * byteStride, arrayStride);
    },

    (ar, values) => ar.set(values));
}

/**
 * @param {string} name
 * @param {StructElement} element
 * @param {() => ArrayBuffer} getBuffer
 * @param {number} [byteStride]
 */
function makeStruct(name, element, getBuffer, byteStride = elementByteLength(element)) {
  /** @param {ThatElement} el */
  const getThatStruct = el => el._cache.get(`${name}$ThatStruct`, () => {
    // NOTE important to call getBuffer() AFTER $index access which may invalidate buffer
    const { $index, _cache } = el;
    const $offset = $index * byteStride, $end = $offset + byteStride;
    const buffer = getBuffer();
    const $dataView = (isNaN($offset) || $end > buffer.byteLength) ? undefined
      : new DataView(buffer, $index * byteStride, byteStride);
    return { $dataView, _cache };
  });

  return {
    get compoundDescriptor() {
      return makeCompoundDescriptor(name,
        /** @returns {ThatStructValue<typeof element.struct>} */
        el => Object.seal(Object.create(getThatStruct(el), makeFieldDescriptorMap(name, element))),
        (obj, values) => Object.assign(obj, values));
    },

    get propMap() {
      return Object.fromEntries(Array.from(fieldDescriptorEntries(name, element))
        .map(([field, { get, set }]) => [field, {
          enumerable: true,
          /** @this {ThatElement} */
          get() { return get.call(getThatStruct(this)) },
          /** @this {ThatElement} @param {any} val */
          set(val) { set.call(getThatStruct(this), val) },
        }]));
    },

  };
}

/**
 * @template T
 * @param {string} name
 * @param {(el: ThatElement) => T} makeView
 * @param {(view: T, data: any) => void} update
 */
function makeCompoundDescriptor(name, makeView, update) {
  /** @param {ThatElement} el */
  const getView = el => el._cache.get(name, () => makeView(el));

  return {
    enumerable: true,

    /** @this {ThatElement} */
    get() { return getView(this) },

    /** @this {ThatElement} @param {any} val */
    set(val) {
      const view = getView(this);
      if (val !== view) update(view, val);
    },
  };
}

/** @typedef {object} ThatStruct
 * @prop {DataView} $dataView
 * @prop {Cache} _cache
 */

function getHostLittleEndian() {
  const testNumber = 0x12_34_56_78;
  const testArray = new Uint32Array(1);
  testArray[0] = testNumber;
  const testView = new DataView(testArray.buffer);
  if (testView.getUint32(0, true) == testNumber)
    return true;
  if (testView.getUint32(0, false) == testNumber)
    return false;
  throw new Error('failed to test host endianness');
}

const littleEndian = getHostLittleEndian();

/**
 * @param {string} name
 * @param {StructElement} element
 * @returns {PropertyDescriptorMap}
 * TODO map each field value type more narrowly
 */
function makeFieldDescriptorMap(name, element) {
  return Object.fromEntries(fieldDescriptorEntries(name, element));
}

/** @typedef {Required<Pick<PropertyDescriptor, "enumerable"|"get"|"set">>} GetSetProp */

/**
 * @param {string} name
 * @param {StructElement} element
 * @returns {Generator<[field: string, desc: GetSetProp]>}
 */
function* fieldDescriptorEntries(name, element) {
  const { struct } = element;
  let byteOffset = 0;
  for (const [field, type] of Object.entries(struct)) {
    const byteLength = elementByteLength(type);
    yield [field, makeFieldDescriptor(`${name}.${field}`, type, byteOffset)];
    byteOffset += byteLength;
  }
}

/**
 * @param {string} name
 * @param {ArrayElement|Component} type
 * @returns {GetSetProp}
 */
function makeFieldDescriptor(name, type, byteOffset = 0) {
  const arrayStride = typeof type == 'string' ? componentStride(type) : componentStride(type.array, type.shape);
  if (typeof type == 'string' && arrayStride == 1) {
    const scalar = scalarType(type);
    switch (scalar) {
      case 'bool': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getUint8(byteOffset) ? true : false },
        /** @this {ThatStruct} @param {boolean|number} value */
        set(value) { this.$dataView?.setUint8(byteOffset, value ? 1 : 0) },
      };

      case 'float32': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getFloat32(byteOffset, littleEndian) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setFloat32(byteOffset, value, littleEndian) },
      };

      case 'uint32': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getUint32(byteOffset, littleEndian) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setUint32(byteOffset, value, littleEndian) },
      };

      case 'uint16': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getUint16(byteOffset, littleEndian) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setUint16(byteOffset, value, littleEndian) },
      };

      case 'uint8Clamped':
      case 'uint8': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getUint8(byteOffset) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setUint8(byteOffset, value) },
      };

      case 'int32': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getInt32(byteOffset, littleEndian) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setInt32(byteOffset, value, littleEndian) },
      };

      case 'int16': return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getInt16(byteOffset, littleEndian) },
        /** @this {ThatStruct} @param {number} value */
        set(value) { this.$dataView?.setInt16(byteOffset, value, littleEndian) },
      };

      case 'int8':
        return {
          enumerable: true,
          /** @this {ThatStruct} */
          get() { return this.$dataView?.getInt8(byteOffset) },
          /** @this {ThatStruct} @param {number} value */
          set(value) { this.$dataView?.setInt8(byteOffset, value) },
        };

      default: unreachable(scalar);
    }
  } else {
    const arrayType = typeof type == 'string' ? componentTypedArray(type) : componentTypedArray(type.array);

    /** @param {ThatStruct} struct */
    const getThatArray = struct => struct._cache.get(`${name}$Array`, () => {
      const { buffer, byteOffset: viewByteOffset } = struct.$dataView;
      return new arrayType(buffer, viewByteOffset + byteOffset, arrayStride);
    });

    return {
      enumerable: true,

      /** @this {ThatStruct} */
      get() { return getThatArray(this) },

      /** @this {ThatStruct} @param {ArrayLike<number>} values */
      set(values) { getThatArray(this).set(values) },
    };
  }
}

/** @param {Element} element */
function elementByteLength(element) {
  if (typeof element == 'string')
    return componentByteLength(element);

  if ('array' in element) {
    const { array: component, shape } = element;
    return componentByteLength(component, shape);
  }

  if ('struct' in element) {
    const
      { struct } = element,
      fields = Object.values(struct);
    let n = 0;
    for (const field of fields) {
      if (typeof field == 'string') n += componentByteLength(field);
      else n += elementByteLength(field);
    }
    return n;
  }

  unreachable(element);
}

/** @typedef {object} FieldInfo
 * @prop {string} name
 * @prop {number} byteOffset
 * @prop {number} byteLength
 * @prop {Component|ArrayElement} typeSpec
 * @prop {Scalar} type
 * @prop {ArrayShape} shape
 */

/**
 * @param {Element} element
 * @returns {Generator<FieldInfo>}
 */
function* elementFieldInfo(element) {
  if (typeof element == 'string') {
    yield {
      name: 'value',
      byteOffset: 0,
      get byteLength() { return elementByteLength(element) },
      typeSpec: element,
      get type() { return scalarType(element) },
      get shape() { return componentShape(element) },
    };
  }

  else if ('array' in element) {
    const { array, shape } = element;
    yield {
      name: 'value',
      byteOffset: 0,
      get byteLength() { return elementByteLength(element) },
      typeSpec: element,
      type: array,
      shape,
    };
  }

  else if ('struct' in element) {
    let byteOffset = 0;
    for (const [name, field] of Object.entries(element.struct)) {
      const byteLength = elementByteLength(field);

      if (typeof field == 'string') {
        yield {
          name,
          byteOffset,
          byteLength,
          typeSpec: field,
          get type() { return scalarType(field) },
          get shape() { return componentShape(field) },
        };
      }
      else if ('array' in field) {
        const { array, shape } = field;
        yield {
          name,
          byteOffset,
          byteLength,
          typeSpec: field,
          type: array,
          shape,
        };
      }
      else unreachable(field);

      byteOffset += byteLength;
    }
  }

  else unreachable(element);
}

/** @param {Component} component */
function componentByteLength(component, shape = componentShape(component)) {
  const
    size = typeof shape == 'number' ? shape : shape[0] * shape[1],
    { BYTES_PER_ELEMENT } = componentTypedArray(component);
  return size * BYTES_PER_ELEMENT;
}

/** @param {Component} component */
function componentStride(component, shape = componentShape(component)) {
  return typeof shape == 'number' ? shape : shape[0] * shape[1];
}

/** @typedef {(
 * | Scalar
 * | Vector
 * | Matrix
 * )} Component
 */

/** Basic scalar element types.
 *
 * @typedef {(
 * | 'float32'
 * | 'uint32'
 * | 'uint16'
 * | 'uint8'
 * | 'uint8Clamped'
 * | 'int32'
 * | 'int16'
 * | 'int8'
 * | 'bool'
 * )} Scalar
 * TODO 64 bit types
 * TODO 16 bit floats once they standard
 */

/** Common vector types; ArrayElement convenience alises.
 *
 * @typedef {(
 * | 'vec2'
 * | 'vec3'
 * | 'vec4'
 * | 'uvec2'
 * | 'uvec3'
 * | 'uvec4'
 * | 'ivec2'
 * | 'ivec3'
 * | 'ivec4'
 * | 'bvec2'
 * | 'bvec3'
 * | 'bvec4'
 * | 'rgb'
 * | 'rgba'
 * )} Vector
 */

/** Common matrix types; ArrayElement convenience alises.
 *
 * @typedef {(
 * | 'mat2'
 * | 'mat3'
 * | 'mat4'
 * | 'mat2x3'
 * | 'mat2x4'
 * | 'mat3x2'
 * | 'mat3x4'
 * | 'mat4x2'
 * | 'mat4x3'
 * )} Matrix
 */

/** @template T
 * @typedef {(
 * T extends Float32ArrayConstructor ? Float32Array :
 * T extends Uint32ArrayConstructor ? Uint32Array :
 * T extends Uint16ArrayConstructor ? Uint16Array :
 * T extends Uint8ArrayConstructor ? Uint8Array :
 * T extends Uint8ClampedArrayConstructor ? Uint8ClampedArray :
 * T extends Int32ArrayConstructor ? Int32Array :
 * T extends Int16ArrayConstructor ? Int16Array :
 * T extends Int8ArrayConstructor ? Int8Array :
 * never
 * )} constructedArray
 */

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
 * | Float32Array
 * | Uint32Array
 * | Uint16Array
 * | Uint8Array
 * | Uint8ClampedArray
 * | Int32Array
 * | Int16Array
 * | Int8Array
 * )} TypedArray

/**
 * @param {ArrayElement|Component} component
 * @returns {Scalar}
 */
function scalarType(component) {
  if (typeof component != 'string') return scalarType(component.array);
  switch (component) {
    case 'vec2':
    case 'vec3':
    case 'vec4':
    case 'mat2':
    case 'mat3':
    case 'mat4':
    case 'mat2x3':
    case 'mat2x4':
    case 'mat3x2':
    case 'mat3x4':
    case 'mat4x2':
    case 'mat4x3':
      return 'float32';

    case 'bvec4':
    case 'bvec3':
    case 'bvec2':
    case 'uint8Clamped':
    case 'rgb':
    case 'rgba':
      return 'uint8';

    case 'uvec2':
    case 'uvec3':
    case 'uvec4':
      return 'uint32';

    case 'ivec2':
    case 'ivec3':
    case 'ivec4':
      return 'int32';

    case 'bool':
    case 'float32':
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'int8':
    case 'int16':
    case 'int32':
      return component;

    default:
      unreachable(component);
  }
}

/**
 * @param {Component} component
 * @returns {TypedArrayConstructor}
 */
function componentTypedArray(component) {
  switch (component) {
    case 'float32':
    case 'vec2':
    case 'vec3':
    case 'vec4':
    case 'mat2':
    case 'mat3':
    case 'mat4':
    case 'mat2x3':
    case 'mat2x4':
    case 'mat3x2':
    case 'mat3x4':
    case 'mat4x2':
    case 'mat4x3':
      return Float32Array;

    case 'uint8':
    case 'bool':
    case 'bvec4':
    case 'bvec3':
    case 'bvec2':
      return Uint8Array;

    case 'uint8Clamped':
      return Uint8ClampedArray;

    case 'uint16':
      return Uint16Array;

    case 'uint32':
    case 'uvec2':
    case 'uvec3':
    case 'uvec4':
      return Uint32Array;

    case 'int8':
      return Int8Array;

    case 'int16':
      return Int16Array;

    case 'int32':
    case 'ivec2':
    case 'ivec3':
    case 'ivec4':
      return Int32Array;

    case 'rgb':
    case 'rgba':
      return Uint8ClampedArray;

    default:
      unreachable(component);
  }
}

/**
 * @param {Component} component
 * @returns {ArrayShape}
 */
function componentShape(component) {
  switch (component) {
    case 'float32':
    case 'uint32':
    case 'uint16':
    case 'uint8':
    case 'uint8Clamped':
    case 'int32':
    case 'int16':
    case 'int8':
    case 'bool':
      return 1;

    case 'vec2':
    case 'uvec2':
    case 'ivec2':
    case 'bvec2':
      return 2;

    case 'vec3':
    case 'uvec3':
    case 'ivec3':
    case 'bvec3':
    case 'rgb':
      return 3;

    case 'vec4':
    case 'uvec4':
    case 'ivec4':
    case 'bvec4':
    case 'rgba':
      return 4;

    case 'mat2': return [2, 2];
    case 'mat3': return [3, 3];
    case 'mat4': return [4, 4];
    case 'mat2x3': return [2, 3];
    case 'mat2x4': return [2, 4];
    case 'mat3x2': return [3, 2];
    case 'mat3x4': return [3, 4];
    case 'mat4x2': return [4, 2];
    case 'mat4x3': return [4, 3];

    default:
      unreachable(component);
  }
}

/** @param {number} length */
function makeBitVector(length) {
  let vec = new Uint8Array(Math.ceil(length / 8));
  return {
    get length() { return length },

    set length(newLength) {
      if (length != newLength) {
        const newVec = new Uint8Array(Math.ceil(newLength / 8));
        newVec.set(newVec.length < vec.length ? vec.subarray(0, newVec.length) : vec);
        vec = newVec;
        length = newLength;
      }
    },

    clear() { vec.fill(0) },

    /** @param {number} i */
    is(i) {
      if (i >= length) return false;
      const el = Math.floor(i / 8);
      const bit = i % 8;
      const mask = 1 << bit;
      return (vec[el] & mask) == 0 ? false : true;
    },

    /** @param {number} i */
    unset(i) {
      if (i < length) {
        const el = Math.floor(i / 8);
        const bit = i % 8;
        const mask = 1 << bit;
        vec[el] &= 0xff & ~mask;
      }
    },

    /** @param {number} i */
    set(i) {
      if (i < length) {
        const el = Math.floor(i / 8);
        vec[el] |= 1 << i % 8;
      }
    },

    claim() {
      for (let el = 0; el < vec.length; el++) {
        const val = vec[el];
        if (val == 0xff) continue;
        for (let bit = 0, i = el * 8; bit < 8 && i < length; bit++, i++) {
          const mask = 1 << bit;
          if ((val & mask) != 0) continue;
          vec[el] = val | mask;
          return i;
        }
      }
      return undefined;
    },
  };
}

/**
 * @template {{$index: number}} Cursor
 * @param {Cursor} cur
 * @param {() => number} getLength
 * @param {(cur: Cursor) => boolean} [filter]
 * @returns {Iterator<Cursor>}
 */
function iterateCursor(cur, getLength, filter) {
  return {
    next: filter ? () => {
      const length = getLength();
      while (cur.$index < length) {
        if (++cur.$index >= length) break;
        if (filter(cur))
          return { done: false, value: cur };
      }
      return { done: true, value: undefined };
    } : () => {
      const length = getLength();
      if (cur.$index < length) cur.$index++;
      if (cur.$index >= length)
        return { done: true, value: undefined };
      return { done: false, value: cur };
    }
  };
}

/**
 * @template B, O
 * @template {keyof B} BK
 * @param {O} o
 * @param {B} b
 * @param {Array<BK>} propNames
 */
function dropProperties(o, b, ...propNames) {
  const propDescMap = Object.getOwnPropertyDescriptors(b);
  for (const prop of propNames)
    delete propDescMap[prop];
  return /** @type {O & Omit<B, BK>} */ (Object.defineProperties(o, propDescMap));
}

/** @param {never} nope @returns {never} */
function unreachable(nope, mess = `inconceivable ${nope}`) {
  throw new Error(mess);
}
