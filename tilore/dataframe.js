// @ts-check

/* TODO
 * - $used logic for indexes similar to how SparseAspect works,
 *   but for pre-allocated frames, and with reuse
 * - sub-frames ; basically a hashmap A:B join but B is sub-ordinally
 *   indexed similar to SparseAspect
 * - foreign frame reference aspect
 * - peer frames ; basically a nat join a A:B:C:...
 * - datatypes
 *   - datetime
 *   - arbitrary value Map<$index, V>
 *   - custom vector/matrix type that has named accessors like .x .xy .xyz etc
 * - multi-* aspects
 */

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
 * | Datum
 * )} Element */

/** @typedef {(
 * | Component
 * | ArrayElement
 * | StructElement
 * )} Datum */

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
 * @param {(upto: Ref|number, oldLength: number) => number|IndexResize} [methods.resize]
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
 * @prop {(upto: Ref|number, oldLength: number) => number|IndexResize} resize
 */

/** @typedef {object} IndexResize
 * @prop {number} newLength
 * @prop {() => Iterable<RemapEntry>} remap
 */

/** @typedef {object} RemapEntry
 * @prop {number} oldOffset
 * @prop {number} oldUpto
 * @prop {number} newOffset
 */

export const MonotonicIndex = Object.freeze(makeIndex({
  refToIndex(id) { return id - 1 },
  resize(upto, oldLength) {
    return {
      newLength: upto,
      *remap() {
        yield {
          oldOffset: 0,
          oldUpto: Math.min(oldLength, upto),
          newOffset: 0,
        };
      },
    };
  },
}, {
  $id: {
    enumerable: true,
    /** @this {ThatElement} */
    get() { return this.$index + 1 },
  },
}));

/**
 * @typedef {object} XYTopology
 * @prop {(oldLength: number, x: number, y: number) => number|IndexResize} resize
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
        resize(oldLength, newWidth, newHeight) {
          const oldWidth = width;
          const oldHeight = Math.ceil(oldLength / oldWidth);
          const newLength = newWidth * newHeight;
          width = newWidth;
          return {
            newLength,
            *remap() {
              const coWidth = Math.min(newWidth, oldWidth);
              const coHeight = Math.min(newHeight, oldHeight);
              for (let y = 0; y < coHeight; y++) {
                const oldOffset = y * oldWidth;
                yield {
                  oldOffset,
                  oldUpto: Math.min(oldLength, oldOffset + coWidth),
                  newOffset: y * newWidth,
                };
              }
            },
          };
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
        resize(oldLength, newWidth, newHeight) {
          const oldHeight = height;
          const oldWidth = Math.ceil(oldLength / oldHeight);
          const newLength = newWidth * newHeight;
          height = newHeight;
          return {
            newLength,
            *remap() {
              const coWidth = Math.min(newWidth, oldWidth);
              const coHeight = Math.min(newHeight, oldHeight);
              for (let x = 0; x < coWidth; x++) {
                const oldOffset = x * oldHeight;
                yield {
                  oldOffset,
                  oldUpto: Math.min(oldLength, oldOffset + coHeight),
                  newOffset: x * newHeight,
                };
              }
            },
          };
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
    resize(upto, oldLength) {
      return typeof upto == 'number' ? upto : topo.resize(oldLength, ...upto);
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

  const initialRes = index.resize(initialUpto, 0);
  const initialLength = typeof initialRes == 'number' ? initialRes : initialRes.newLength;

  const
    aspects = Object.entries(aspectSpecs).map(([name, spec]) => {
      if (typeof spec == 'object') {
        if (!spec)
          throw new Error('invalid dense aspect element spec');

        if ('sparse' in spec) {
          const { sparse } = spec;

          if (typeof sparse == 'object') {
            if (!sparse)
              throw new Error('invalid sparse aspect element spec');
          }

          return makeSparseDatumAspect(name, sparse, initialLength);
        }
      }

      return makeDenseDatumAspect(name, index, spec, initialLength);
    }),

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

    /** @param {number} $index */
    toRef($index) {
      return Object.seal(makeIndexRef($index));
    },

    clear() {
      index.clear();
      for (let i = 0; i < aspects.length; i++)
        aspects[i].clear();
    },

    /** @param {number|IndexRef} upto */
    resize(upto) {
      const res = index.resize(upto, length);
      const remap = typeof res == 'number' ? () => [] : res.remap;
      length = typeof res == 'number' ? res : res.newLength;
      for (let i = 0; i < aspects.length; i++)
        aspects[i].resize(length, remap);
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

/** @typedef { {
 *   buffer: ArrayBuffer,
 *   byteStride: number,
 * } } Buffer */

/** @typedef { Buffer & {
 *   name: string,
 *   length: number,
 *   clear: () => void,
 *   resize: (newLength: number, remap: () => Iterable<RemapEntry>) => void,
 *   fieldInfo: () => Iterable<FieldInfo>,
 * } } AspectCore */

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
 * @template {Datum} D
 * @param {string} name
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {D} dat
 * @returns {DenseAspect<D, IndexRef, IndexPropMap>}
 */
function makeDenseDatumAspect(name, index, dat, initialLength = 0) {
  const
    byteStride = datumByteLength(dat);

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

    const $ref = /** @type {ThatDenseValue<D, IndexPropMap>} */ (Object.defineProperties(makeIndexed(index, $el), propMap));

    return Object.seal($ref);
  };

  /** @type {DenseAspect<D, IndexRef, IndexPropMap>} */
  const self = {
    get name() { return name },
    get buffer() { return buffer },
    get byteStride() { return byteStride },
    get length() { return length },
    get elementDescriptor() { return elementDescriptor },
    fieldInfo: () => elementFieldInfo(dat),

    clear() {
      new Uint8Array(buffer).fill(0);
    },

    resize(newLength, remap) {
      const newBuffer = new ArrayBuffer(byteStride * newLength);

      const nu8 = new Uint8Array(newBuffer);
      const ou8 = new Uint8Array(buffer);
      for (const { oldOffset, oldUpto, newOffset } of remap()) {
        const n = nu8.subarray(byteStride * newOffset);
        const o = ou8.subarray(byteStride * oldOffset, byteStride * oldUpto);
        n.set(o);
      }

      // TODO fill new with specific default value?
      buffer = newBuffer;
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

  const {
    element: elementDescriptor,
    props: propMap,
  } = makeDatumDescriptors(name, dat, self);

  return self;
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
 *   capacity: number,
 *   elementDescriptor: PropertyDescriptor, // TODO type specialize get(T)/set()=>T ?
 *   get: ($index: number) => ThatSparseValue<E>,
 *   getFor: ($frameIndex: number) => ThatSparseValue<E>|undefined,
 *   [Symbol.iterator]: () => Iterator<ThatSparseValue<E>>,
 *   all: () => Iterator<ThatSparseValue<E>>,
 *   compact: () => void,
 * } } SparseAspect
 */

/** @typedef {object} SparseReverseIndex
 * @prop {($index: number) => number|undefined} get
 * @prop {($index: number, $frameIndex: number|undefined) => void} set
 * @prop {(entries: Iterable<[$frameIndex: number, $index: number]>) => void} update
 */

/**
 * @param {string} name
 * @param {object} options
 * @param {(capacity: number) => void} options.grow
 * @param {() => void} options.clear
 * @param {(i: number, j: number) => void} [options.swap]
 * @param {SparseReverseIndex} [options.reverse]
 * @param {number} [options.initialLength]
 */
function makeSparseIndex(name, {
  initialLength = 0,

  // TODO can we unify grow and clear into realloc(N, shouldCopy)?
  grow,
  clear,
  swap,
  reverse,
}) {
  let
    frameLength = 0,
    length = 0,
    capacity = initialLength
    ;

  const used = makeBitVector(capacity);

  const reuse = () => {
    const $index = used.claim();
    if ($index != undefined && $index >= length) {
      length = $index + 1;
    }
    return $index;
  };

  const alloc = () => {
    const $index = length++;
    while (capacity < length)
      capacity = capacity == 0 ? 2 * length
        : capacity < 1024 ? capacity * 2
          : capacity + capacity / 4;
    if (used.length < capacity) {
      used.length = capacity;
      grow(capacity);
    }
    used.set($index);
    return $index;
  };

  let
    /** @type Map<number, number> */
    indexMap = new Map(); // maps DataFrame index -> Aspect index

  if (!reverse) {
    /** @type Map<number, number> */
    const reverseMap = new Map(); // maps Aspect index -> DataFrame index
    reverse = {
      get($index) { return reverseMap.get($index) },
      set($index, $frameIndex) {
        if ($frameIndex == undefined)
          reverseMap.delete($index);
        else
          reverseMap.set($index, $frameIndex);
      },
      update(entries) {
        reverseMap.clear();
        for (const [$frameIndex, $index] of entries)
          reverseMap.set($index, $frameIndex);
      },
    };
  }
  const {
    get: reverseGet,
    set: reverseSet,
    update: reverseUpdate,
  } = reverse;

  /**
   * @param {number} $frameIndex
   * @param {number|undefined} [$index]
   */
  const del = ($frameIndex, $index) => {
    if ($index == undefined)
      $index = indexMap.get($frameIndex);
    if ($index == undefined) return;
    indexMap.delete($frameIndex);
    used.unset($index);
    length = indexMap.size;
    reverseSet($index, undefined);
  };

  /**
   * @param {number} $frameIndex
   * @param {number|undefined} $index
   */
  const set = ($frameIndex, $index) => {
    if ($index == undefined) {
      del($frameIndex);
    } else {
      used.set($index);
      indexMap.set($frameIndex, $index);
      length = indexMap.size;
      reverseSet($index, $frameIndex);
    }
  };

  /**
   * @param {number} $index
   * @param {Cache} [cache]
   */
  const makeElement = ($index, cache) => {
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
          $index = Math.min(capacity, Math.max(0, i));
        },
      },

      $frameIndex: {
        enumerable: true,

        /** @this {ThatElement} */
        get() { return reverseGet(this.$index) },

        /** @this {ThatElement} */
        set($frameIndex) {
          const { $index } = this;
          if ($frameIndex == undefined) {
            const $priorFrameIndex = reverseGet($index);
            if ($priorFrameIndex != undefined)
              del($priorFrameIndex, $index);
          } else if (typeof $frameIndex == 'number') {
            set($frameIndex, $index);
          }
        },
      },
    }));

    return $el;
  };

  return {
    get frameLength() { return frameLength },

    get capacity() { return capacity },
    // TODO set capacity(n) for prune and explicit pre-alloc?

    get length() { return length },

    reuse,
    alloc,

    clear() {
      capacity = initialLength;
      length = 0;
      indexMap.clear();
      used.length = capacity;
      used.clear();
      reverseUpdate([]);
      clear();
    },

    /** @type {AspectCore["resize"]} */
    resize(newLength, remap) {
      /** @type Map<number, number> */
      const newIndexMap = new Map();

      for (const { oldOffset, oldUpto, newOffset } of remap()) {
        for (
          let $oldFrameIndex = oldOffset, $newFrameIndex = newOffset;
          $oldFrameIndex < oldUpto;
          $oldFrameIndex++, $newFrameIndex++
        ) {
          const $index = indexMap.get($oldFrameIndex);
          if ($index == undefined) continue;
          newIndexMap.set($newFrameIndex, $index);
        }
      }

      indexMap = newIndexMap;
      frameLength = newLength;
      used.clear();
      for (const $index of newIndexMap.values())
        used.set($index);
      reverseUpdate(newIndexMap);
    },

    compact() {
      if (!swap)
        throw new Error(`sparse aspect "${name}" does not support compaction`);

      // TODO evolve to relocate entire contiguous ranges when possible
      let $holeIndex = 0, $nextIndex = 0;
      for (; $nextIndex < capacity; $nextIndex++) {
        if (!used.is($nextIndex)) continue;

        const $frameIndex = reverseGet($nextIndex);
        if ($frameIndex == undefined) continue;

        while ($holeIndex < $nextIndex && used.is($holeIndex))
          $holeIndex++;
        if ($holeIndex >= $nextIndex) continue;

        swap($holeIndex, $nextIndex);
        used.set($holeIndex);
        used.unset($nextIndex);

        indexMap.set($frameIndex, $holeIndex);

        reverseSet($holeIndex, $frameIndex);
        reverseSet($nextIndex, undefined);
      }

      length = used.is($holeIndex) ? $holeIndex + 1 : $holeIndex;
    },

    ref: makeElement,

    /** @param {number} $frameIndex */
    get($frameIndex) { return indexMap.get($frameIndex) },

    /** @param {number} $frameIndex */
    has($frameIndex) { return indexMap.has($frameIndex) },

    /** @param {number} $index */
    used($index) { return used.is($index) },

    set,

    /** @param {GetSetProp} inner @returns {GetSetProp} */
    wrapDescriptor(inner) {
      const { enumerable, get: innerGet, set: innerSet } = inner;
      return Object.freeze({
        enumerable,

        /** @this {ThatElement} */
        get() {
          const { $index: $frameIndex, _cache } = this;
          const $index = indexMap.get($frameIndex);
          if ($index == undefined) return undefined;
          const $element = _cache.get(`${name}$element`, () => makeElement($index, _cache));
          return innerGet.call($element);
        },

        /** @this {ThatElement} @param {any} value */
        set(value) {
          const { $index: $frameIndex, _cache } = this;
          let $index = indexMap.get($frameIndex);
          if (value !== null && value !== undefined) {
            if ($index === undefined) {
              $index = reuse();
              if ($index === undefined) $index = alloc();
              set($frameIndex, $index);
            }
            const $mustIndex = $index;
            const $element = _cache.get(`${name}$element`, () => makeElement($mustIndex, _cache));
            innerSet.call($element, value);
          } else if ($index !== undefined) {
            _cache.delete(`${name}$element`);
            del($frameIndex, $index);
          }
        },

      });
    },

  };
}

/**
 * @template {Datum} D
 * @param {string} name
 * @param {D} dat
 * @returns {SparseAspect<D>}
 */
function makeSparseDatumAspect(name, dat, initialLength = 0) {
  const index = makeSparseIndex(name, {
    initialLength,

    grow(capacity) {
      const newByteLength = capacity * byteStride;
      if (newByteLength > buffer.byteLength) {
        // TODO use buffer.transfer someday
        const newBuffer = new ArrayBuffer(newByteLength);
        new Uint8Array(newBuffer).set(new Uint8Array(buffer));
        buffer = newBuffer;
        u8 = new Uint8Array(buffer);
      }
    },

    clear() {
      buffer = new ArrayBuffer(index.capacity * byteStride);
      u8 = new Uint8Array(buffer);
    },

    swap(i, j) {
      const a = u8.subarray(byteStride * i, byteStride * (i + 1));
      const b = u8.subarray(byteStride * j, byteStride * (j + 1));
      tmp.set(a);
      // a.set(b);
      u8.copyWithin(
        byteStride * i,
        byteStride * j, byteStride * (j + 1));
      b.set(tmp);
    },

  }),
    byteStride = datumByteLength(dat),
    tmp = new Uint8Array(byteStride)
    ;

  let
    buffer = new ArrayBuffer(index.capacity * byteStride),
    u8 = new Uint8Array(buffer)
    ;

  /**
   * @param {number} $index
   * @param {Cache} [cache]
   * @returns {ThatSparseValue<D>}
   */
  const ref = ($index, cache) => Object.seal(Object.create(index.ref($index, cache), propMap));

  /** @type {SparseAspect<D>} */
  const self = {
    get name() { return name },

    get capacity() { return index.capacity },

    get length() { return index.length },
    get elementDescriptor() { return index.wrapDescriptor(innerDescriptor) },
    clear() { index.clear() },

    resize(newLength, remap) { index.resize(newLength, remap) },

    compact() { index.compact() },

    get buffer() { return buffer },
    get byteStride() { return byteStride },
    fieldInfo: () => elementFieldInfo(dat),

    get: $index => ref($index),

    getFor($frameIndex) {
      const $index = index.get($frameIndex);
      return $index === undefined ? undefined : ref($index, makeCache());
    },

    [Symbol.iterator]: () => iterateCursor(ref(-1),
      () => index.capacity,
      ({ $index }) => index.used($index)),

    all: () => iterateCursor(ref(-1), () => index.capacity),

  };

  const {
    element: innerDescriptor,
    props: propMap,
  } = makeDatumDescriptors(name, dat, self);

  return self;
}

/** @typedef {object} GLAttribSpec
 * @prop {number} attrib
 * @prop {boolean} [normalized]
 * @prop {boolean} [asInt]
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {AspectCore} aspect
 * @param {object} [options]
 * @param {number} [options.target]
 * @param {number} [options.usage]
 * @param {{[name: string]: GLAttribSpec}} [options.attribMap]
 */
export function makeWebGLAspect(gl, aspect, {
  target = gl.ARRAY_BUFFER,
  usage = gl.STATIC_DRAW,
  attribMap = {},
} = {}) {
  const aspectFields = Array.from(aspect.fieldInfo());
  const attribEntries = Object.entries(attribMap);

  if (target == gl.ELEMENT_ARRAY_BUFFER && aspectFields.length > 1)
    throw new Error('element array buffer only supports mapping a single field');

  if (target != gl.ARRAY_BUFFER && attribEntries.length > 0)
    throw new Error('attribute mapping is only supported for ARRAY_BUFFER targets');

  const { byteStride } = aspect;
  if (attribEntries.length > 0 && byteStride > 255)
    throw new Error('aspect byteStride may not exceed 255 fo ARRAY_BUFFER attrib targets');

  const aspectFieldMap = Object.fromEntries(aspectFields.map(field => [field.name, field]));
  const attribs = attribEntries.map(
    ([name, { attrib, normalized = false, asInt = false }]) => {
      const field = aspectFieldMap[name];
      if (!field)
        throw new Error(`no such aspect field "${name}"`);
      const { type: fieldType, byteOffset, shape } = field;
      const size = Math.ceil(typeof shape == 'number' ? shape : shape[0] * shape[1]);
      const glType = scalarGLType(gl, fieldType);
      return {
        attrib,
        normalized,
        asInt,
        glType,
        size,
        byteOffset,
      };
    });

  /** @type {WebGLBuffer|null} */
  let buffer = null;

  return {
    delete() {
      if (buffer) {
        gl.deleteBuffer(buffer);
        buffer = null;
      }
    },

    send() {
      if (!buffer) buffer = gl.createBuffer()
      if (!buffer) throw new Error(`unable to create webgl buffer for DataFrame aspect "${aspect.name}"`);
      gl.bindBuffer(target, buffer)
      gl.bufferData(target, aspect.buffer, usage);
      gl.bindBuffer(target, null)
    },

    // TODO recv() for copying data back from gpu

    bind() {
      gl.bindBuffer(target, buffer)
      for (const { attrib, glType, size, normalized, asInt, byteOffset } of attribs) {
        gl.enableVertexAttribArray(attrib);
        if (asInt) {
          gl.vertexAttribIPointer(attrib, size, glType, byteStride, byteOffset);
        } else {
          gl.vertexAttribPointer(attrib, size, glType, normalized, byteStride, byteOffset);
        }
      }
      gl.bindBuffer(target, null)
    },

    unbind() {
      for (const { attrib } of attribs)
        gl.disableVertexAttribArray(attrib);
    },

  };
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Scalar} scalar
 */
export function scalarGLType(gl, scalar) {
  switch (scalar) {
    case 'float32': return gl.FLOAT;
    case 'uint32': return gl.UNSIGNED_INT;
    case 'uint16': return gl.UNSIGNED_SHORT;
    case 'uint8':
    case 'uint8Clamped': return gl.UNSIGNED_BYTE;
    case 'int32': return gl.INT;
    case 'int16': return gl.SHORT;
    case 'int8': return gl.BYTE;
    case 'bool': return gl.BOOL;
    default: unreachable(scalar);
  }
}

/**
 * @param {string} name
 * @param {Datum} dat
 * @param {Buffer} buf
 * @returns {{ element: GetSetProp, props: GetSetPropMap }}
 * TODO map each value types more narrowly
 */
function makeDatumDescriptors(name, dat, buf) {
  if (typeof dat == 'string') {
    const type = scalarType(dat);
    const shape = componentShape(dat);
    if (typeof shape == 'number' && shape == 1) {
      const { propMap: props } = makeStruct(`${name}$`, { struct: { value: type } }, buf);
      const { value: element } = props;
      return { props, element };
    }
    dat = { array: type, shape };
  }

  if ('array' in dat) {
    const element = makeArrayDescriptor(`${name}@`, dat, buf);
    return { props: { value: element }, element };
  }

  if ('struct' in dat) {
    const { compoundDescriptor: element, propMap: props } = makeStruct(`${name}.`, dat, buf);
    return { props, element };
  }

  else unreachable(dat);
}

/**
 * @param {string} name
 * @param {ArrayElement} element
 * @param {Buffer} buf
 */
function makeArrayDescriptor(name, element, buf) {
  const
    { array: type } = element,
    arrayType = componentTypedArray(type);
  return makeCompoundDescriptor(name,
    /** @returns {constructedArray<arrayType>} */
    el => {
      // NOTE important to call buf.buffer AFTER $index access which may invalidate buffer
      const
        { $index } = el,
        { shape } = element,
        { buffer, byteStride } = buf,
        arrayStride = typeof shape == 'number' ? shape : shape[0] * shape[1];
      return new arrayType(buffer, $index * byteStride, arrayStride);
    },

    (ar, values) => ar.set(values));
}

/**
 * @param {string} name
 * @param {StructElement} element
 * @param {Buffer} buf
 */
function makeStruct(name, element, buf) {
  /** @param {ThatElement} el */
  const getThatStruct = el => el._cache.get(`${name}$ThatStruct`, () => {
    // NOTE important to call buf.buffer AFTER $index access which may invalidate buffer
    const
      { $index, _cache } = el,
      { buffer, byteStride } = buf;
    const $offset = $index * byteStride, $end = $offset + byteStride;
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

/** @typedef {{[key: string]: GetSetProp}} GetSetPropMap */

/**
 * @param {string} name
 * @param {StructElement} element
 * @returns {Generator<[field: string, desc: GetSetProp]>}
 */
function* fieldDescriptorEntries(name, element) {
  const { struct } = element;
  let byteOffset = 0;
  for (const [field, type] of Object.entries(struct)) {
    const byteLength = datumByteLength(type);
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

/** @param {Datum} dat */
function datumByteLength(dat) {
  if (typeof dat == 'string')
    return componentByteLength(dat);

  if ('array' in dat) {
    const { array: component, shape } = dat;
    return componentByteLength(component, shape);
  }

  if ('struct' in dat) {
    const
      { struct } = dat,
      fields = Object.values(struct);
    let n = 0;
    for (const field of fields) {
      if (typeof field == 'string') n += componentByteLength(field);
      else n += datumByteLength(field);
    }
    return n;
  }

  unreachable(dat);
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
      get byteLength() { return datumByteLength(element) },
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
      get byteLength() { return datumByteLength(element) },
      typeSpec: element,
      type: array,
      shape,
    };
  }

  else if ('struct' in element) {
    let byteOffset = 0;
    for (const [name, field] of Object.entries(element.struct)) {
      const byteLength = datumByteLength(field);

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

    *[Symbol.iterator]() {
      for (let el = 0; el < vec.length; el++) {
        const val = vec[el];
        for (let bit = 0, i = el * 8; bit < 8 && i < length; bit++, i++) {
          const mask = 1 << bit;
          yield (val & mask) != 0 ? true : false;
        }
      }
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
