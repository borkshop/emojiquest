// @ts-check

/** TODO
 * - mundane evolution/completion of what already exists:
 *   - implement range tree for invalidation tracking
 *   - should resize be more unified with permute?
 *   - revocable cursors, and any sub-object fields
 *
 * - all of the buffer descriptor plumbing would likely benefit
 *   from a refactor away from dynamic this dispatch:
 *   - usage of `this` cropped up as a natrual consequence of "just" fitting withing a PropertyDescriptor form
 *   - but it became especially insidious once subtle semantics around `this.buffer` being itself a get function crept in
 *   - and steadily grew more complex as invalidation concerns were added
 *   - so at this point, we'd probably be better served reworking the entire affair like:
 *     - a Context type that will encapsulate buffer bytes access and invalidation
 *     - a return type that supports both compound value get/set and a maybe empty field set
 *     - such rework may also dovetail nicely with introducing custom vector/matrix access
 *     - ...and allowing direct access to vector/matrix components similarly to struct fields
 *
 * - elaboration of datatypes:
 *   - local reference: stores index values, which will get remapped automatically on permute/resize/etc
 *     - usable to form graph structures like linked lists, trees, and such
 *   - foreign reference: stores bigint tokens
 *     - would be like a local ref, but with an extra layer of indirection to avoid being involved in foreign frame permute paths
 *     - note we don't yet even have a provider for such tokens, just a forward looking notion
 *   - datetime
 *   - arbitrary value Map<$index, V>
 *   - custom vector/matrix type that has named accessors like .x .xy .xyz etc
 *
 * - how to deal with component multiplicity:
 *   - while it's tempting to say "just implement multi-* aspect variants"...
 *   - ... may be better to just use local reference type to form lists/trees/etc
 *
 * - lateral expansion:
 *   - sub-frames ; basically a hashmap A:B join but B is sub-ordinally indexed similar to SparseAspect
 *   - peer frames ; basically a natural join a A:B:C:...
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

/** Each aspect is an array of elements, each element value may be:
 * - scalar, a number
 * - vector, a 1d typed array
 * - matrix, a 2d typed array
 * - struct, a named compound of scalar/vector/matrix field values
 *
 * @typedef {(
 * | Datum
 * | Order
 * )} Element */

/** @typedef {(
 * | Component
 * | ArrayElement
 * | StructElement
 * )} Datum */

/** Specifies an aspect whose data stores an ordering of $index values.
 *
 * @typedef {object} Order
 * @prop {"self"} order
 */

/** Specifies typed array element data, starting with scalar elements (Size=1),
 * common vectors (Size=2,3,4) or larger "bag of numbers" types like matrices.
 *
 * TODO 64 bit bigint array
 * TODO 16 bit floats array
 *
 * @typedef {(
 * | NumberArray
 * | BoolArray
 * )} ArrayElement
 */

/**
 * @typedef {object} NumberArray
 * @prop {(
 * | 'float32'
 * | 'uint32'
 * | 'uint16'
 * | 'uint8'
 * | 'uint8Clamped'
 * | 'int32'
 * | 'int16'
 * | 'int8'
 * )} array
 * @prop {ArrayShape} shape -- component count per element, default 1
 * @prop {ArrayLike<number>} [init] -- initial values, should match shape count
 */

/**
 * @typedef {object} BoolArray
 * @prop {'bool'} array
 * @prop {ArrayShape} shape -- component count per element, default 1
 * @prop {ArrayLike<boolean>} [init] -- initial values, should match shape count
 */

/** @typedef {number|[cols: number, rows: number]} ArrayShape */

/** Specifies compound typed buffer data.
 *
 * NOTE scalar arrays will function the same as Component;
 *      i.e. {field: 'float32'} over {field: {array: 'float32', shape: 1}}
 *
 * @typedef {object} StructElement
 * @prop {{[field: string]: StructField }} struct
 * TODO padding/alignment options
 */

/** @typedef {Component|ArrayElement} StructField */

/** A named collection of aspect specs, this is the primary part for specifying a DataFrame's scheme.
 *
 * @typedef {{[name: string]: Aspect}} AspectMap
 */

/// ThatType<...>s below all concretely map some part of a particular AspectMap
/// into corresponding data types as seen when using particular DataFrame<...> types.

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
 * E extends Order ? number
 * : E extends Component ? ThatComponent<E>
 * : E extends ArrayElement ? ThatArrayValue<E["array"]>
 * : E extends StructElement ? ThatStructValue<E["struct"]>
 * : never
 * )} ThatValue */

/** @template {Element} E
 * @typedef {(
 * E extends Order ? {order: number}
 * : E extends Component ? {value: ThatComponent<E>}
 * : E extends ArrayElement ? {value: ThatArrayValue<E["array"]>}
 * : E extends StructElement ? ThatStructValue<E["struct"]>
 * : never
 * )} ThatWrappedValue */

/** @template {Component} C
 * @typedef {(
 * C extends Scalar ? ThatScalar<C>
 * : C extends Vector ? ThatVector<C>
 * : C extends Matrix ? ThatMatrix<C>
 * : C extends ScalarInit ? ThatScalar<C["type"]>
 * : C extends VectorInit ? ThatVector<C["type"]>
 * : C extends MatrixInit ? ThatMatrix<C["type"]>
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
 * V extends 'vec2'|'uvec2'|'ivec2' ? ThatVec2
 * : V extends 'vec3'|'uvec3'|'ivec3' ? ThatVec3
 * : V extends 'rgb' ? ThatRGB
 * : V extends 'vec4'|'uvec4'|'ivec4' ? ThatVec4
 * : V extends 'rgba' ? ThatRGBA
 * : V extends 'bvec2' ? ThatBVec2
 * : V extends 'bvec3' ? ThatBVec3
 * : V extends 'bvec4' ? ThatBVec4
 * : never
 * )} ThatVector */

/** @typedef {[x: number, y: number]} ThatVec2 */
/** @typedef {[x: number, y: number, z: number]} ThatVec3 */
/** @typedef {[r: number, g: number, b: number]} ThatRGB */
/** @typedef {[x: number, y: number, z: number, w: number]} ThatVec4 */
/** @typedef {[r: number, g: number, b: number, a: number]} ThatRGBA */

/** @typedef {[x: boolean, y: boolean]} ThatBVec2 */
/** @typedef {[x: boolean, y: boolean, z: boolean]} ThatBVec3 */
/** @typedef {[x: boolean, y: boolean, z: boolean, w: boolean]} ThatBVec4 */

/** @template {Matrix} M
 * @typedef {(
 * M extends 'mat2' ? ThatMat2
 * : M extends 'mat3' ? ThatMat3
 * : M extends 'mat4' ? ThatMat4
 * : M extends 'mat2x3' ? ThatMat2x3
 * : M extends 'mat2x4' ? ThatMat2x4
 * : M extends 'mat3x2' ? ThatMat3x2
 * : M extends 'mat3x4' ? ThatMat3x4
 * : M extends 'mat4x2' ? ThatMat4x2
 * : M extends 'mat4x3' ? ThatMat4x3
 * : never
 * )} ThatMatrix */

/** @typedef {[
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 * ]} ThatMat2 */

/** @typedef {[
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 *   x3: number, y3: number, z3: number,
 * ]} ThatMat3 */

/** @typedef {[
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 *   x3: number, y3: number, z3: number, w3: number,
 *   x4: number, y4: number, z4: number, w4: number,
 * ]} ThatMat4 */

/** @typedef {[
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 * ]} ThatMat2x3 */

/** @typedef {[
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 * ]} ThatMat2x4 */

/** @typedef {[
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 *   x3: number, y3: number,
 * ]} ThatMat3x2 */

/** @typedef {[
 *   x1: number, y1: number, z1: number, w1: number,
 *   x2: number, y2: number, z2: number, w2: number,
 *   x3: number, y3: number, z3: number, w3: number,
 * ]} ThatMat3x4 */

/** @typedef {[
 *   x1: number, y1: number,
 *   x2: number, y2: number,
 *   x3: number, y3: number,
 *   x4: number, y4: number,
 * ]} ThatMat4x2 */

/** @typedef {[
 *   x1: number, y1: number, z1: number,
 *   x2: number, y2: number, z2: number,
 *   x3: number, y3: number, z3: number,
 *   x4: number, y4: number, z4: number,
 * ]} ThatMat4x3 */

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
 * @prop {number} $capacity -- limit value for $index iteration
 * @prop {Cache} _cache
 */

/**
 * @template Ref
 * @template {PropertyDescriptorMap} PropMap
 * @param {object} methods
 * @param {(ref: Ref) => number} methods.refToIndex
 * @param {() => void} [methods.clear]
 * @param {(index: number) => void} [methods.free]
 * @param {(upto: Ref|number, oldLength: number) => number|IndexResize} [methods.resize]
 * @param {(length: number) => Ref} [methods.upto]
 * @param {(perm: Iterable<[i: number, j: number]>, newLength?: number) => void} [methods.permute]
 * @param {PropMap} propMap
 * @returns {Index<Ref, PropMap>}
 */
export function makeIndex({
  refToIndex,
  clear = () => { },
  free = () => { },
  resize = upto => {
    if (typeof upto != 'number') throw new Error('Index Ref-aware resize not implemented');
    return upto;
  },
  permute = () => { },
  upto = () => {
    throw new Error('Index Ref-aware resize not implemented');
  },
}, propMap) {
  if (!Object.keys(propMap).every(key => key.startsWith('$')))
    throw new Error(`every index propMap key must start with "$"; found: ${Object.keys(propMap).filter(key => !key.startsWith('$'))}`);
  return {
    refToIndex,
    propMap,
    clear,
    free,
    resize,
    permute,
    upto,
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
 * @prop {(index: number) => void} free
 * @prop {(upto: Ref|number, oldLength: number) => number|IndexResize} resize
 * @prop {(perm: Iterable<[i: number, j: number]>, newLength?: number) => void} permute
 * @prop {(length: number) => Ref} upto -- current effective limit of ref resolution ; should be equivalent to "the last upto passed to resize"
 */

/**
 * @param {ReturnType<Index<unknown, {}>["resize"]>} res
 */
function indexResLength(res) {
  return typeof res === 'number' ? res : res.newLength;
}

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
  /** @param {number} id */
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
  upto(length) {
    return length + 1;
  },
}, {
  $id: {
    enumerable: true,
    /** @this {ThatElement} */
    get() { return this.$index + 1 },
  },
}));

/**
 * @param {object} [options]
 * @param {() => bigint} [options.idSeed]
 * @param {() => ($index: number) => string} [options.makeIDGen]
 */
export function makeDurableIDIndex({
  idSeed = () => 0xDEAD_BEEFn, // TODO should we randomize by default?
  makeIDGen = () => {
    const state = new BigUint64Array(1)
    const advance = () => {
      // xorshift*
      state[0] ^= state[0] >> 12n;
      state[0] ^= state[0] << 25n;
      state[0] ^= state[0] >> 27n;
      state[0] *= 0x2545_F491_4F6C_DD1Dn;
    };
    advance();
    return $index => {
      if (isNaN($index)) state[0] = idSeed();
      else state[0] ^= BigInt($index);
      advance();
      return `#${state[0].toString(36)}`;
    };
  },
} = {}) {
  const genID = makeIDGen();

  /** @type {Map<string, number>} */
  const ids = new Map();
  /** @type {Map<number, string>} */
  const idOf = new Map();

  return Object.freeze(makeIndex({
    /** @param {string} $id */
    refToIndex($id) {
      const $index = ids.get($id);
      return $index === undefined ? -1 : $index;
    },

    clear() {
      ids.clear();
      idOf.clear();
      genID(NaN);
    },

    free($index) {
      const $id = idOf.get($index);
      if ($id === undefined) return;
      idOf.delete($index);
      ids.delete($id);
    },

    permute(swaps) {
      for (const [$indexA, $indexB] of swaps) {
        const $idA = idOf.get($indexA);
        const $idB = idOf.get($indexB);
        if ($idB === undefined) {
          idOf.delete($indexA);
        } else {
          idOf.set($indexA, $idB);
          ids.set($idB, $indexA);
        }
        if ($idA === undefined) {
          idOf.delete($indexB);
        } else {
          idOf.set($indexB, $idA);
          ids.set($idA, $indexB);
        }
      }
    },

  }, {
    $id: {
      enumerable: true,
      /** @this {ThatElement} */
      get() {
        const { $index } = this;
        let id = idOf.get($index);
        if (id === undefined) {
          do id = genID($index); while (ids.has(id));
          idOf.set($index, id);
          ids.set(id, $index);
        }
        return id;
      },
    },

  }));
}

/**
 * @typedef {object} XYTopology
 * @prop {(oldLength: number, x: number, y: number) => number|IndexResize} resize
 * @prop {(length: number) => [x: number, y: number]} upto
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
        upto(length) { return [width, Math.floor(length / width)] },
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
        upto(length) { return [Math.floor(length / height), height] },
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
    upto(length) {
      return topo.upto(length)
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

/** DataFrame is a named collection of identically indexed equal capacity aspects.
 *
 * Every $index value up to $capacity is considered to be an alive record.
 *
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {AspectMap} Aspects
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {Aspects} aspectSpecs
 * @param {number|IndexRef} [initialUpto]
 */
export function makeDataFrame(index, aspectSpecs, initialUpto = 0) {
  for (const name of Object.keys(aspectSpecs))
    if (name.startsWith('$'))
      throw new Error('DataFrame aspect name may not begin with $');

  /** @typedef {ThoseAspects<Aspects, IndexRef, IndexPropMap>} ThemAspects */
  /** @typedef {{ [name in keyof Aspects]:
   *   Omit<ThemAspects[name], "setInit"|"permute"|"resize"|"clear"|"elementDescriptor">
   * }} ThemExports */
  /** @typedef {ThatElement & Created<IndexPropMap>} ThatIndex */
  /** @typedef {ThatIndex & ThoseElements<Aspects>} ThatRecord */

  const
    initialLength = indexResLength(index.resize(initialUpto, 0)),

    aspects = Object.entries(aspectSpecs).map(([name, spec]) =>
      makeAspect(name, index, spec, { initialLength })),

    aspectExports = /** @type {ThemExports} */ (Object.fromEntries(aspects.map(aspect =>
      [aspect.name, dropProperties({}, aspect, 'permute', 'resize', 'clear', 'elementDescriptor')]
    ))),

    aspectPropMap = Object.fromEntries(aspects.map(
      ({ name, elementDescriptor }) => [name, elementDescriptor]));

  let length = initialLength;

  /** @param {number} $index */
  const makeIndexRef = $index => {
    const _cache = makeCache();
    const $el = /** @type {ThatElement} */ (Object.create({
      get _cache() { return _cache },
      get $capacity() { return length },
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

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      return $index >= 0 && $index < length ? get($index) : undefined;
    },

    get,

    [Symbol.iterator]: () => iterateCursor(get(-1)),

    aspects: aspectExports,

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

    upto() {
      return index.upto(length);
    },

    /**
     * @param {Iterable<[i: number, j: number]>} perm
     * @param {number} [newLength]
     */
    permute(perm, newLength) {
      for (const aspect of aspects)
        aspect.permute(perm, newLength);
      index.permute(perm, newLength);
    },

    compact() {
      for (const aspect of aspects)
        if ('compact' in aspect)
          aspect.compact();
    },

  };
}

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {AspectMap} Aspects
 * @typedef {ReturnType<typeof makeDataFrame<IndexRef, IndexPropMap, Aspects>>} DataFrame
 */

/** SpasreDataFrame is like DataFrame, except only some $indexes are considered to be alive.
 *
 * An $index become alive after it has been returned by alloc()ed and until it has been free()ed.
 *
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {AspectMap} Aspects
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {Aspects} aspectSpecs
 * @param {number} [initialLength]
 */
export function makeSparseDataFrame(index, aspectSpecs, initialLength = 0) {
  for (const name of Object.keys(aspectSpecs))
    if (name.startsWith('$'))
      throw new Error('DataFrame aspect name may not begin with $');

  /** @typedef {ThoseAspects<Aspects, IndexRef, IndexPropMap>} ThemAspects */
  /** @typedef {{ [name in keyof Aspects]:
   *   Omit<ThemAspects[name], "setInit"|"permute"|"resize"|"clear"|"elementDescriptor">
   * }} ThemExports */

  const
    spal = makeSparseAllocator({
      grow(length, oldLength) {
        for (const aspect of aspects)
          aspect.resize(length, () => [{
            newOffset: 0,
            oldOffset: 0,
            oldUpto: oldLength,
          }]);
      },
      initialLength,
    }),

    aspects = Object.entries(aspectSpecs).map(([name, spec]) =>
      makeAspect(name, index, spec, {
        initialLength,
        alive: $index => spal.isUsed($index),
      })),

    aspectExports = /** @type {ThemExports} */ (Object.fromEntries(aspects.map(aspect =>
      [aspect.name, dropProperties({}, aspect, 'setInit', 'permute', 'resize', 'clear', 'elementDescriptor')]
    ))),

    aspectPropMap = Object.fromEntries(aspects.map(
      ({ name, elementDescriptor }) => [name, elementDescriptor]));

  /**
   * @param {number} $index
   * @returns {ThatElement & {$used: boolean} & Created<IndexPropMap> & ThoseElements<Aspects>}
   */
  const get = $index => {
    const _cache = makeCache();

    return Object.seal(makeIndexed(index, {
      _cache,

      get $capacity() { return spal.capacity },

      get $index() { return $index },
      set $index(i) {
        _cache.clear();
        $index = Math.min(spal.capacity, Math.max(0, i));
      },

      get $used() { return spal.isUsed(this.$index) },
      set $used(is) { spal.setUsed(this.$index, is) },

    }, aspectPropMap));
  };

  const self = {
    get length() { return spal.length },

    get capacity() { return spal.capacity },
    set capacity(cap) {
      cap -= spal.freeCount;
      if (cap > spal.capacity)
        spal.capacity = cap;
    },

    toIndex: index.refToIndex,

    alloc() {
      let $index = spal.reuse();
      if ($index == undefined)
        $index = spal.alloc();
      for (let i = 0; i < aspects.length; i++)
        aspects[i].setInit($index);
      return get($index);
    },

    /** @param {number} $index */
    free($index) {
      spal.free($index);
      index.free($index);
    },

    get,

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      if ($index < 0) return undefined;
      if (!spal.isUsed($index)) return undefined;
      return get($index);
    },

    [Symbol.iterator]: () => iterateCursor(get(-1), ({ $index }) => spal.isUsed($index)),

    aspects: aspectExports,

    clear() {
      spal.clear();
      index.clear();
      for (let i = 0; i < aspects.length; i++)
        aspects[i].clear();
    },

    /**
     * @param {Iterable<[i: number, j: number]>} perm
     * @param {number} [newLength]
     */
    permute(perm, newLength) {
      for (const aspect of aspects)
        aspect.permute(perm, newLength);
      index.permute(perm, newLength);
    },

    compact() {
      /** @type {null|ReturnType<makePermutation>} */
      let perm = null;
      spal.compact(($holeIndex, $usedIndex) => {
        if (perm === null)
          perm = makePermutation(spal.capacity);
        const tmp = perm[$holeIndex];
        perm[$holeIndex] = perm[$usedIndex];
        perm[$usedIndex] = tmp;
        return true;
      });

      if (perm !== null) {
        const swaps = Array.from(permutationSwaps(perm));
        const newLength = spal.length;
        self.permute(swaps, newLength);
      }
      for (const aspect of aspects)
        if ('compact' in aspect)
          aspect.compact();
    },

  };
  return self;
}

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {AspectMap} Aspects
 * @typedef {ReturnType<makeSparseDataFrame<IndexRef, IndexPropMap, Aspects>>} SparseDataFrame
 */

/**
 * @typedef {object} AspectOptions
 * @prop {number} [initialLength]
 * @prop {($frameIndex: number) => boolean} [alive]
 */

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {Aspect} A
 * @param {string} name
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {A} spec
 * @param {AspectOptions} [opts]
 * @returns {ThatAspect<A, IndexRef, IndexPropMap>}
 */
export function makeAspect(name, index, spec, opts) {
  /** @typedef {ThatAspect<A, IndexRef, IndexPropMap>} TA */
  if (typeof spec == 'object') {
    if (!spec)
      throw new Error('invalid dense aspect element spec');

    if ('sparse' in spec) {
      const { sparse } = spec;

      if (typeof sparse == 'object') {
        if (!sparse)
          throw new Error('invalid sparse aspect element spec');
        if ('order' in sparse)
          return /** @type {TA} */ (makeSparseOrderAspect(name, sparse, opts));
      }

      return /** @type {TA} */ (makeSparseDatumAspect(name, sparse, opts));
    }

    if ('order' in spec)
      return /** @type {TA} */ (makeDenseOrderAspect(name, index, spec, opts));
  }

  return /** @type {TA} */ (makeDenseDatumAspect(name, index, spec, opts));
}

/** @typedef { {
 *   buffer: ArrayBuffer,
 *   byteStride: number,
 * } } Buffer */

/** @typedef { Buffer & {
 *   invalidate: (start?: number, end?: number) => void,
 *   modifiedSince: (gen: bigint) => Iterable<{ gen: bigint, start: number, end: number }>,
 * } } InvalBuffer */

/** @typedef { Buffer & {
 *   modifiedSince: (gen: bigint) => Iterable<{ gen: bigint, start: number, end: number }>,
 * } } DirtyBuffer */

/** @typedef { DirtyBuffer & {
 *   length: number,
 *   capacity: number,
 * } } BufferElements */

/** @template [Value=unknown]
 * @typedef { BufferElements & {
 *   name: string,
 *   spec: Element,
 *   fieldInfo: Iterable<FieldInfo>,
 *   get: ($index: number) => Value,
 *   [Symbol.iterator]: () => Iterator<Value>,
 * } } AspectCoreRO
 */

/** @template [Value=unknown]
 * @typedef { AspectCoreRO<Value> & InvalBuffer & {
 *   clear: () => void,
 *   resize: (newLength: number, remap?: () => Iterable<RemapEntry>) => void,
 *   permute: (perm: Iterable<[i: number, j: number]>, newLength?: number) => void, // TODO unify with resize?
 *   setInit: ($index: number) => void,
 * } } AspectCore
 */

/** @template {Element} E
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef {ThatElement & Created<IndexPropMap> & ThatWrappedValue<E>} ThatDenseValue
 */

/** @template {Element} E
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @typedef { AspectCore<ThatDenseValue<E, IndexPropMap>> & {
 *   spec: E,
 *   elementDescriptor: GetSetProp, // TODO type specialize get()=>T/set(T) ?
 *   ref: (ref: IndexRef) => ThatDenseValue<E, IndexPropMap>|undefined,
 * } } DenseAspect
 */

function makeDirtyTracker() {
  let
    lastGen = 1n,
    nextGen = 1n; // TODO interval tree

  return {
    /**
     * @param {number} _start
     * @param {number} _end
     */
    invalidate(_start, _end) {
      lastGen = nextGen;
      // TODO add interval to tree
    },

    /**
     * @param {bigint} gen
     * @param {number} length
     */
    *modifiedSince(gen, length) {
      if (lastGen > gen) {
        yield { gen: lastGen, start: 0, end: length };
        nextGen = lastGen + 1n;
      }
      if (gen >= nextGen) {
        nextGen = gen + 1n;
      }
    },
  };
}

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {Datum} D
 * @param {string} name
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {D} dat
 * @param {AspectOptions} [options]
 * @returns {DenseAspect<D, IndexRef, IndexPropMap>}
 */
function makeDenseDatumAspect(name, index, dat, {
  initialLength = 0,
  alive,
} = {}) {
  const byteStride = datumByteLength(dat);
  const init = datumInit(dat);

  let
    length = initialLength,
    buffer = new ArrayBuffer(initialLength * byteStride);

  /** @param {number} $index */
  const setInit = $index => {
    if (init) {
      elementDescriptor.set.call({
        $index,
        $capacity: length,
        _cache: makeCache(),
      }, init);
    }
  };

  const doInit = (u8 = new Uint8Array(buffer)) => {
    if (init) {
      setInit(0);
      copyInitData(u8, byteStride);
    }
  };

  /** @param {number} $index */
  const get = $index => {
    const _cache = makeCache();
    const $el = /** @type {ThatElement} */ (Object.create({
      get _cache() { return _cache },
      get $capacity() { return length },
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

  const dt = makeDirtyTracker();

  /** @type {DenseAspect<D, IndexRef, IndexPropMap>} */
  const self = {
    invalidate(start = 0, end = buffer.byteLength) { dt.invalidate(start, end) },
    modifiedSince(gen) { return dt.modifiedSince(gen, buffer.byteLength) },

    get name() { return name },
    get spec() { return dat },

    get buffer() { return buffer },
    get byteStride() { return byteStride },

    get capacity() { return length },
    get length() { return length },

    get elementDescriptor() { return elementDescriptor },
    get fieldInfo() { return datumFieldInfo(dat) },

    clear() {
      new Uint8Array(buffer).fill(0);
      self.invalidate();
    },

    resize(newLength, remap = () => []) {
      const ou8 = new Uint8Array(buffer);
      buffer = new ArrayBuffer(byteStride * newLength);
      length = newLength;
      const nu8 = new Uint8Array(buffer);
      doInit(nu8);

      for (const { oldOffset, oldUpto, newOffset } of remap()) {
        const n = nu8.subarray(byteStride * newOffset);
        const o = ou8.subarray(byteStride * oldOffset, byteStride * oldUpto);
        n.set(o);
      }

      // TODO can this be more specific, eliding non-moved regions?
      self.invalidate();
    },

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      if ($index < 0 || $index >= length) return undefined;
      if (alive && !alive($index)) return undefined;
      return get($index);
    },

    get,
    setInit,

    [Symbol.iterator]: alive
      ? () => iterateCursor(get(-1), ({ $index }) => alive($index))
      : () => iterateCursor(get(-1)),

    permute(perm, newLength) {
      const tmp = new Uint8Array(byteStride);
      const u8 = new Uint8Array(buffer);
      for (const [i, j] of perm) {
        const a = u8.subarray(byteStride * i, byteStride * (i + 1));
        const b = u8.subarray(byteStride * j, byteStride * (j + 1));
        tmp.set(a);
        // a.set(b);
        u8.copyWithin(
          byteStride * i,
          byteStride * j, byteStride * (j + 1));
        b.set(tmp);
      }
      if (newLength !== undefined)
        length = newLength;

      // TODO invalidate only permuted elements
      self.invalidate();
    },

  };

  const {
    element: elementDescriptor,
    props: propMap,
  } = makeDatumDescriptors(name, dat, self);

  doInit();

  return self;
}

/**
 * @template IndexRef
 * @template {PropertyDescriptorMap} IndexPropMap
 * @template {Order} O
 * @param {string} name
 * @param {Index<IndexRef, IndexPropMap>} index
 * @param {O} order
 * @param {AspectOptions} [options]
 * @returns {DenseAspect<O, IndexRef, IndexPropMap>}
 */
function makeDenseOrderAspect(name, index, order, {
  initialLength = 0,
  alive
} = {}) {
  let
    length = initialLength,
    datType = orderType(order, { length }),
    byteStride = datumByteLength(datType),
    ArrayType = componentTypedArray(datType),

    buffer = new ArrayBuffer(length * byteStride),
    coBuffer = new ArrayBuffer(length * byteStride),

    array = new ArrayType(buffer),
    coArray = new ArrayType(coBuffer);

  for (let i = 0; i < length; i++) {
    array[i] = i;
    coArray[i] = i;
  }

  /** @param {number} $index */
  const get = $index => {
    const _cache = makeCache();

    // TODO needs to be a cast because makeDatumDescriptors doesn't narrow down its return type to a specific mapped extension of PropertyDescriptorMap
    return /** @type {ThatDenseValue<O, IndexPropMap>} */ (Object.seal(makeIndexed(index, {
      _cache,
      get $capacity() { return length },

      get $index() { return $index },
      set $index(i) {
        _cache.clear();
        $index = Math.min(length, Math.max(0, i));
      },
    }, propMap)));
  };

  const dt = makeDirtyTracker();

  /** @type {DenseAspect<O, IndexRef, IndexPropMap>} */
  const self = {
    invalidate(start = 0, end = buffer.byteLength) { dt.invalidate(start, end) },
    modifiedSince(gen) { return dt.modifiedSince(gen, buffer.byteLength) },

    get name() { return name },
    get spec() { return order },

    get buffer() { return buffer },
    get byteStride() { return byteStride },

    get capacity() { return length },
    get length() { return length },

    get elementDescriptor() { return orderDesc },
    get fieldInfo() { return datumFieldInfo(datType) },

    clear() {
      for (let i = 0; i < length; i++) {
        array[i] = i;
        coArray[i] = i;
      }
      self.invalidate();
    },

    resize(newLength/* TODO use remap */) {
      const newDatType = orderType(order, { length: newLength });
      const newByteStride = datumByteLength(newDatType);
      const newArrayType = componentTypedArray(newDatType);
      const newBuffer = new ArrayBuffer(newLength * newByteStride);
      const newCoBuffer = new ArrayBuffer(newLength * newByteStride);
      const newArray = new newArrayType(newBuffer);
      const newCoArray = new newArrayType(newCoBuffer);

      for (let i = 0; i < newLength; i++) {
        newArray[i] = i;
        newCoArray[i] = i;
      }

      buffer = newBuffer;
      coBuffer = newCoBuffer;
      array = newArray;
      coArray = newCoArray;
      length = newLength;

      if (datType != newDatType) {
        datType = newDatType;
        byteStride = newByteStride;
        ArrayType = newArrayType;
      }

      self.invalidate();
    },

    permute(perm, newLength) {
      for (const [i, j] of perm) {
        const iOrder = coArray[i], jOrder = coArray[j];
        coArray[i] = jOrder;
        coArray[j] = iOrder;
        array[iOrder] = j;
        array[jOrder] = i;
      }
      if (newLength !== undefined)
        length = newLength;

      // TODO more specific from perm
      self.invalidate();
    },

    get,
    setInit: () => { },

    /** @param {IndexRef} ref */
    ref(ref) {
      const $index = index.refToIndex(ref);
      if ($index < 0 || $index >= length) return undefined;
      if (alive && !alive($index)) return undefined;
      return get($index);
    },

    [Symbol.iterator]: alive
      ? () => iterateCursor(get(-1), ({ $index }) => alive($index))
      : () => iterateCursor(get(-1)),
  };

  /** @type {GetSetProp} */
  const orderDesc = {
    enumerable: true,

    /** @this {ThatElement} */
    get() {
      const { $index } = this;
      const order = coArray[$index];
      return order;
    },

    /** @this {ThatElement} */
    set(order) {
      if (typeof order != 'number' || Math.floor(order) != order || order < 0)
        throw new TypeError('order value must be an ordinal number');
      if (order >= length)
        throw new TypeError('order value out of range');
      const { $index } = this;
      const $otherIndex = array[order];
      if ($otherIndex != $index) {
        const prior = coArray[$index];
        array[prior] = $otherIndex;
        array[order] = $index;
        coArray[$otherIndex] = prior;
        coArray[$index] = order;

        const { BYTES_PER_ELEMENT } = array;
        self.invalidate($index * BYTES_PER_ELEMENT, ($index + 1) * BYTES_PER_ELEMENT);
        self.invalidate(prior * BYTES_PER_ELEMENT, (prior + 1) * BYTES_PER_ELEMENT);
        // NOTE coArray/coBuffer are not externally observable, so need no invalidation
      }
    },
  };

  const propMap = { order: orderDesc };

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
 * @typedef { AspectCore<ThatSparseValue<E>> & {
 *   spec: E,
 *   elementDescriptor: GetSetProp, // TODO type specialize get(T)/set()=>T ?
 *   getFor: ($frameIndex: number) => ThatSparseValue<E>|undefined,
 *   compact: () => void,
 * } } SparseAspect
 */

/** @typedef {object} SparseReverseIndex
 * @prop {($index: number) => number|undefined} get
 * @prop {($index: number, $frameIndex: number|undefined) => void} set
 * @prop {(entries: Iterable<[$frameIndex: number, $index: number]>) => void} update
 */

/**
 * @param {object} options
 * @param {(capacity: number, oldCapacity: number) => void} options.grow
 * @param {number} [options.initialLength]
 */
function makeSparseAllocator({
  grow,
  initialLength = 0,
}) {
  let length = 0, capacity = initialLength;
  const used = makeBitVector(capacity);

  /** @param {number} atLeast */
  const ensure = atLeast => {
    while (capacity < atLeast)
      capacity = capacity < 1024
        ? 2 * (capacity == 0 ? 1 : capacity)
        : capacity + capacity / 4;
    if (used.length < capacity) {
      const oldCapacity = used.length;
      used.length = capacity;
      grow(capacity, oldCapacity);
    }
  };

  const alloc = () => {
    ensure(length + 1);
    return length;
  };

  /** @param {number} $index */
  const getUsed = $index => used.is($index);

  /**
   * @param {number} $index
   * @param {boolean} is
   */
  const setUsed = ($index, is) => {
    if (is && used.set($index)) {
      length++;
      return true;
    }
    else if (!is && used.unset($index)) {
      length--;
      return true;
    }
    return false;
  };

  return {
    get length() { return length },

    get capacity() { return capacity },
    set capacity(cap) {
      if (cap < capacity)
        throw new Error('SparseAllocator truncation not supported'); // TODO should it be?
      ensure(cap);
    },

    get freeCount() { return used.countFree() },

    allocHole: alloc,
    alloc() {
      const $index = alloc();
      if (used.set($index)) length++;
      return $index;
    },

    /** @param {number} $index */
    free($index) {
      if (used.unset($index)) length--;
    },

    mayReuse: () => used.claim(false),
    reuse() {
      const $index = used.claim();
      if ($index != undefined && $index >= length)
        length = $index + 1;
      return $index;
    },

    isUsed: getUsed,
    setUsed,

    clear() {
      length = 0;
      capacity = initialLength;
      used.length = capacity;
      used.clear();
    },

    /** @param {Iterable<number>} usedIndices */
    update(usedIndices) {
      length = 0;
      used.clear();
      for (const $index of usedIndices)
        if (used.set($index)) length++;
    },

    /**
     * @param {($holeIndex: number, $usedIndex: number) => boolean} swap
     */
    compact(swap) {
      if (!used.anyFree()) return;
      let $holeIndex = 0, $nextIndex = 0;
      for (; $nextIndex < capacity; $nextIndex++) {
        if (!used.is($nextIndex)) continue;
        while ($holeIndex < $nextIndex && used.is($holeIndex))
          $holeIndex++;
        if ($holeIndex >= $nextIndex) continue;
        if (swap($holeIndex, $nextIndex)) {
          used.set($holeIndex);
          used.unset($nextIndex);
        }
      }
      length = used.is($holeIndex) ? $holeIndex + 1 : $holeIndex;
    },

  };
}

/**
 * @param {string} name
 * @param {object} options
 * @param {(capacity: number) => void} options.grow
 * @param {() => void} options.clear
 * @param {($frameIndex: number) => boolean} [options.alive]
 * @param {(i: number, j: number) => void} [options.swap]
 * @param {SparseReverseIndex} [options.reverse]
 * @param {number} [options.initialLength]
 */
function makeSparseAspectIndex(name, {
  initialLength = 0,

  // TODO can we unify grow and clear into realloc(N, shouldCopy)?
  grow,
  clear,
  alive,
  swap,
  reverse,
}) {
  const spal = makeSparseAllocator({
    grow,
    initialLength,
  });

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
    spal.free($index);
    indexMap.delete($frameIndex);
    reverseSet($index, undefined);
  };

  /**
   * @param {number} $frameIndex
   * @param {number|undefined} $reqIndex
   */
  const set = ($frameIndex, $reqIndex) => {
    if ($reqIndex == undefined || (alive && !alive($frameIndex))) {
      del($frameIndex);
      return;
    }

    const $priorIndex = indexMap.get($frameIndex);
    const { length } = spal;
    if ($reqIndex >= length && $priorIndex == length - 1) return;

    const $index = $reqIndex >= spal.length ? spal.allocHole() : $reqIndex;

    if ($priorIndex != undefined) {
      spal.free($priorIndex);
      indexMap.delete($frameIndex);
      reverseSet($priorIndex, $frameIndex);
    }

    const $priorFrameIndex = spal.isUsed($index) ? reverseGet($index) : undefined;
    if ($priorFrameIndex != undefined) {
      const $newIndex = $priorIndex == undefined ? spal.allocHole() : $priorIndex;
      spal.setUsed($newIndex, true);
      indexMap.set($priorFrameIndex, $newIndex);
      reverseSet($newIndex, $priorFrameIndex);
    }

    spal.setUsed($index, true);
    indexMap.set($frameIndex, $index);
    reverseSet($index, $frameIndex);
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
      get $capacity() { return spal.capacity },
    }, {
      $index: {
        enumerable: true,
        get() { return $index },
        set: indexReadonly ? undefined : i => {
          theCache.clear();
          $index = Math.min(spal.capacity, Math.max(0, i));
        },
      },

      $frameIndex: {
        enumerable: true,

        /** @this {ThatElement} */
        get() {
          const { $index } = this;
          const $frameIndex = reverseGet($index);
          if (alive && $frameIndex != undefined && !alive($frameIndex)) {
            reverseSet($index, undefined);
            return undefined;
          }
          return $frameIndex;
        },

        /** @this {ThatElement} */
        set($frameIndex) {
          if (alive && $frameIndex != undefined && !alive($frameIndex))
            $frameIndex = undefined;
          const { $index } = this;
          if ($frameIndex == undefined) {
            const $priorFrameIndex = reverseGet($index);
            if ($priorFrameIndex != undefined)
              del($priorFrameIndex, $index);
          } else if (typeof $frameIndex == 'number') {
            set($frameIndex, $index);
          }
          theCache.clear();
        },
      },
    }));

    return $el;
  };

  let frameLength = initialLength;

  return {
    get length() { return spal.length },
    get capacity() { return spal.capacity },
    get frameLength() { return frameLength },

    clear() {
      spal.clear();
      indexMap.clear();
      reverseUpdate([]);
      clear();
    },

    /** @type {AspectCore["resize"]} */
    resize(newLength, remap = () => []) {
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
      spal.update(newIndexMap.values())
      reverseUpdate(newIndexMap);
    },

    /** @type {AspectCore["permute"]} */
    permute(perm, newLength) {
      if (newLength !== undefined)
        frameLength = newLength;
      for (const [i, j] of perm) {
        const indexI = indexMap.get(i), indexJ = indexMap.get(j);
        if (indexI != undefined) {
          if (j < frameLength) {
            indexMap.set(j, indexI);
            reverseSet(indexI, j);
          } else {
            indexMap.delete(j);
            reverseSet(indexI, undefined);
          }
        } else indexMap.delete(j);
        if (indexJ != undefined) {
          if (i < frameLength) {
            indexMap.set(i, indexJ);
            reverseSet(indexJ, i);
          } else {
            indexMap.delete(i);
            reverseSet(indexJ, undefined);
          }
        } else indexMap.delete(i);
      }
    },

    compact() {
      // TODO evolve to relocate entire contiguous ranges when possible
      if (!swap) return;
      spal.compact(($holeIndex, $usedIndex) => {
        const $frameIndex = reverseGet($usedIndex);
        if ($frameIndex == undefined) return false;
        if (alive && !alive($frameIndex)) {
          indexMap.delete($frameIndex);
          reverseSet($usedIndex, undefined);
          return false;
        }

        swap($holeIndex, $usedIndex);
        indexMap.set($frameIndex, $holeIndex);
        reverseSet($holeIndex, $frameIndex);
        reverseSet($usedIndex, undefined);
        return true;
      });
    },

    ref: makeElement,

    /** @param {number} $frameIndex */
    get($frameIndex) {
      if (alive && !alive($frameIndex)) {
        indexMap.delete($frameIndex);
        return undefined;
      }
      return indexMap.get($frameIndex);
    },

    /** @param {number} $frameIndex */
    has($frameIndex) {
      if (alive && !alive($frameIndex)) {
        indexMap.delete($frameIndex);
        return false;
      }
      return indexMap.has($frameIndex);
    },

    /** @param {number} $index */
    used($index) { return spal.isUsed($index) },

    set,

    /** @param {GetSetProp} inner @returns {GetSetProp} */
    wrapDescriptor(inner) {
      const { enumerable, get: innerGet, set: innerSet } = inner;
      return Object.freeze({
        enumerable,

        /** @this {ThatElement} */
        get() {
          const { $index: $frameIndex, _cache } = this;
          if (alive && !alive($frameIndex)) return undefined;

          const $index = indexMap.get($frameIndex);
          if ($index == undefined) return undefined;

          const $element = _cache.get(`${name}$element`, () => makeElement($index, _cache));
          return innerGet.call($element);
        },

        /** @this {ThatElement} @param {any} value */
        set(value) {
          const { $index: $frameIndex, _cache } = this;
          const $dead = alive && !alive($frameIndex);
          let $index = indexMap.get($frameIndex);
          if (!$dead && value !== null && value !== undefined) {
            if ($index === undefined) {
              $index = spal.mayReuse();
              if ($index === undefined) $index = spal.allocHole();
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
 * @param {AspectOptions} [options]
 * @returns {SparseAspect<D>}
 */
function makeSparseDatumAspect(name, dat, {
  initialLength = 0,
  alive,
} = {}) {
  const index = makeSparseAspectIndex(name, {
    initialLength,
    alive,

    grow(capacity) {
      const newByteLength = capacity * byteStride;
      if (newByteLength > buffer.byteLength) {
        // TODO use buffer.transfer someday
        const ou8 = u8;
        buffer = new ArrayBuffer(newByteLength);
        u8 = new Uint8Array(buffer);
        doInit();
        u8.set(ou8);
        self.invalidate();
      }
    },

    clear() {
      buffer = new ArrayBuffer(index.capacity * byteStride);
      u8 = new Uint8Array(buffer);
      self.invalidate();
    },

    swap(i, j) {
      const
        ao = byteStride * i, ae = byteStride * (i + 1),
        bo = byteStride * j, be = byteStride * (j + 1),
        a = u8.subarray(ao, ae),
        b = u8.subarray(bo, be);
      tmp.set(a);
      // a.set(b);
      u8.copyWithin(ao, bo, be);
      b.set(tmp);

      self.invalidate(ao, ae);
      self.invalidate(bo, be);
    },

  });

  const byteStride = datumByteLength(dat);
  const init = datumInit(dat);
  const tmp = new Uint8Array(byteStride);

  let
    buffer = new ArrayBuffer(index.capacity * byteStride),
    u8 = new Uint8Array(buffer);

  /** @param {number} $index */
  const setInit = $index => {
    if (init) {
      innerDescriptor.set.call({
        $index,
        $capacity: index.capacity,
        _cache: makeCache(),
      }, init);
    }
  };

  const doInit = () => {
    if (init) {
      setInit(0);
      copyInitData(u8, byteStride);
    }
  };

  /** @param {number} $index @param {Cache} [cache] */
  const ref = ($index, cache) => Object.seal(
    /** @type {ThatSparseElement & ThatSparseValue<D>} */
    (Object.defineProperties(index.ref($index, cache), propMap)));

  const dt = makeDirtyTracker();

  /** @type {SparseAspect<D>} */
  const self = {
    invalidate(start = 0, end = buffer.byteLength) { dt.invalidate(start, end) },
    modifiedSince(gen) { return dt.modifiedSince(gen, buffer.byteLength) },

    get name() { return name },
    get spec() { return dat },

    get buffer() { return buffer },
    get byteStride() { return byteStride },

    get capacity() { return index.capacity },
    get length() { return index.length },

    get elementDescriptor() { return frameDescriptor },
    get fieldInfo() { return datumFieldInfo(dat) },

    clear() { index.clear() },
    resize(newLength, remap) { index.resize(newLength, remap) },
    permute(perm, newLength) { index.permute(perm, newLength) },

    get: $index => ref($index),

    setInit($frameIndex) {
      if (init) {
        frameDescriptor.set.call({
          $index: $frameIndex,
          $capacity: index.capacity,
          _cache: makeCache(),
        }, init);
      } else {
        index.set($frameIndex, undefined);
      }
    },

    getFor($frameIndex) {
      if (alive && !alive($frameIndex)) return undefined;
      const $index = index.get($frameIndex);
      return $index === undefined ? undefined : ref($index, makeCache());
    },

    [Symbol.iterator]: alive
      ? () => iterateCursor(ref(-1), ({ $index, $frameIndex }) => index.used($index) && $frameIndex !== undefined && alive($frameIndex))
      : () => iterateCursor(ref(-1), ({ $index }) => index.used($index)),

    compact() { index.compact() },
  };

  const {
    element: innerDescriptor,
    props: propMap,
  } = makeDatumDescriptors(name, dat, self);

  const frameDescriptor = index.wrapDescriptor(innerDescriptor);

  doInit();

  return self;
}

/**
 * @template {Order} O
 * @param {string} name
 * @param {O} order
 * @param {AspectOptions} [options]
 * @returns {SparseAspect<O>}
 */
function makeSparseOrderAspect(name, order, {
  initialLength = 0,
  alive,
} = {}) {
  let
    datType = orderType(order, { length: initialLength }),
    byteStride = datumByteLength(datType),
    ArrayType = componentTypedArray(datType),
    buffer = new ArrayBuffer(initialLength * byteStride),
    array = new ArrayType(buffer);

  /** @param {number} capacity */
  const grow = capacity => {
    const newDatType = orderType(order, { length: index.frameLength });
    const realloc = capacity != array.length || newDatType != datType;

    if (newDatType != datType) {
      datType = newDatType;
      byteStride = datumByteLength(datType);
      ArrayType = componentTypedArray(datType);
    }

    if (realloc) {
      const newBuffer = new ArrayBuffer(capacity * byteStride);
      const newArray = new ArrayType(newBuffer);
      newArray.set(array);
      buffer = newBuffer;
      array = newArray;
      self.invalidate();
    }
  };

  const index = makeSparseAspectIndex(name, {
    initialLength,
    alive,

    grow,

    clear() {
      buffer = new ArrayBuffer(index.capacity * byteStride);
      array = new ArrayType(buffer);
      self.invalidate();
    },

    swap(i, j) {
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;

      const { BYTES_PER_ELEMENT } = array;
      self.invalidate(i * BYTES_PER_ELEMENT, (i + 1) * BYTES_PER_ELEMENT);
      self.invalidate(j * BYTES_PER_ELEMENT, (j + 1) * BYTES_PER_ELEMENT);
    },

    reverse: {
      get: $index => index.used($index) ? array[$index] : undefined,
      set($index, $frameIndex) {
        const { BYTES_PER_ELEMENT } = array;
        array[$index] = $frameIndex == undefined ? 0 : $frameIndex;
        self.invalidate($index * BYTES_PER_ELEMENT, ($index + 1) * BYTES_PER_ELEMENT);
      },
      update(entries) {
        const { BYTES_PER_ELEMENT } = array;
        grow(index.capacity);
        for (const [$frameIndex, $index] of entries) {
          array[$index] = $frameIndex;
          self.invalidate($index * BYTES_PER_ELEMENT, ($index + 1) * BYTES_PER_ELEMENT);
        }
      },
    },

  });

  /** @type {GetSetProp} */
  const orderDesc = {
    enumerable: true,

    /** @this {ThatSparseElement} */
    get() {
      const { $frameIndex } = this;
      if ($frameIndex == undefined) return undefined;
      return index.get($frameIndex);
    },

    /** @this {ThatSparseElement} */
    set($reqIndex) {
      const { $frameIndex } = this;
      if ($frameIndex == undefined) return;

      if ($reqIndex == undefined) {
        index.set($frameIndex, undefined);
        return;
      }

      if (typeof $reqIndex != 'number' || Math.floor($reqIndex) != $reqIndex || $reqIndex < 0)
        throw new TypeError('order value must be an ordinal number');

      // TODO would be nice to test for noop without compacting first: does index have any used after $index?
      index.compact();
      const $index = index.get($frameIndex);

      if ($reqIndex != $index)
        index.set($frameIndex, $reqIndex);
    },
  },
    propMap = { order: orderDesc };

  /** @param {number} $index @param {Cache} [cache] */
  const ref = ($index, cache) => Object.seal(
    /** @type {ThatSparseElement & ThatSparseValue<O>} */
    (Object.defineProperties(index.ref($index, cache), propMap)));

  const dt = makeDirtyTracker();

  /** @type {SparseAspect<O>} */
  const self = {
    invalidate(start = 0, end = buffer.byteLength) { dt.invalidate(start, end) },
    modifiedSince(gen) { return dt.modifiedSince(gen, buffer.byteLength) },

    get name() { return name },
    get spec() { return order },

    get buffer() { return buffer },
    get byteStride() { return byteStride },

    get capacity() { return index.capacity },
    get length() { return index.length },

    get elementDescriptor() { return index.wrapDescriptor(orderDesc) },
    get fieldInfo() { return datumFieldInfo(datType) },

    clear() { index.clear() },
    resize(newLength, remap) { index.resize(newLength, remap) },

    get: $index => ref($index),
    setInit: () => { },

    getFor($frameIndex) {
      if (alive && !alive($frameIndex)) return undefined;
      const $index = index.get($frameIndex);
      return $index === undefined ? undefined : ref($index, makeCache());
    },

    [Symbol.iterator]: alive
      ? () => iterateCursor(ref(-1), ({ $index, $frameIndex }) => index.used($index) && $frameIndex !== undefined && alive($frameIndex))
      : () => iterateCursor(ref(-1), ({ $index }) => index.used($index)),

    compact() { index.compact() },

    permute(perm, newLength) { index.permute(perm, newLength) },
  };
  return self;
}

/**
 * @param {string} name
 * @param {Datum} dat
 * @param {InvalBuffer} buf
 * @returns {{ element: GetSetProp, props: GetSetPropMap }}
 * TODO map each value types more narrowly
 */
function makeDatumDescriptors(name, dat, buf) {
  if (typeof dat == 'string' || 'type' in dat) {
    const element = makeComponentDescriptor(name, dat, buf);
    return { props: { value: element }, element };
  }

  if ('array' in dat) {
    const element = makeArrayDescriptor(name, dat, buf);
    return { props: { value: element }, element };
  }

  if ('struct' in dat)
    return makeStructDescriptors(name, dat, buf);

  unreachable(dat);
}

/**
 * @param {string} name
 * @param {Component} typ
 * @param {InvalBuffer} buf
 */
function makeComponentDescriptor(name, typ, buf) {
  const type = scalarType(typ);
  const shape = componentShape(typ);
  if (typeof shape == 'number' && shape == 1) {
    const { wrapStructDesc } = makeStructView(name, buf);
    return wrapStructDesc(makeScalarDescriptor(type));
  }
  // TODO specific legs for vector/matrix descriptors ; share with makeFieldDescriptor
  return makeArrayDescriptor(name, { array: type, shape }, buf);
}

/**
 * @param {string} name
 * @param {ArrayElement} element
 * @param {InvalBuffer} buf
 */
function makeArrayDescriptor(name, element, buf) {
  const
    { array: type } = element,
    arrayType = componentTypedArray(type);

  /** @param {ThatElement} el */
  const getView = el => el._cache.get(name,
    /** @returns {constructedArray<arrayType>} */
    () => {
      // NOTE important to call buf.buffer AFTER $index access which may invalidate buffer
      const
        { $index } = el,
        { shape } = element,
        { buffer, byteStride } = buf,
        arrayStride = typeof shape == 'number' ? shape : shape[0] * shape[1],
        $offset = $index * byteStride,
        $end = ($index + 1) * byteStride,
        ar = new arrayType(buffer, $offset, arrayStride);
      return onPropSet(ar, () => buf.invalidate($offset, $end));
    });

  return {
    enumerable: true,

    /** @this {ThatElement} */
    get() { return getView(this) },

    /** @this {ThatElement} @param {any} values */
    set(values) {
      const view = getView(this);
      if (values !== view) {
        const
          { $index } = this,
          { byteStride } = buf,
          $offset = $index * byteStride,
          $end = ($index + 1) * byteStride;
        view.set(values);
        buf.invalidate($offset, $end);
      }
    },
  };
}

/**
 * @param {string} name
 * @param {StructElement} element
 * @param {InvalBuffer} buf
 */
function makeStructDescriptors(name, element, buf) {
  const { getThatStruct, wrapStructDesc } = makeStructView(name, buf);
  const nom = `${name}.`;
  const fieldEnts = Array.from(fieldDescriptorEntries(nom, element));
  const propEnts = fieldEnts.map(([field, desc]) => [field, wrapStructDesc(desc)]);
  /** @param {ThatElement} el */
  const getView = el => el._cache.get(nom, () =>
    Object.seal(Object.create(getThatStruct(el), Object.fromEntries(fieldEnts))));
  return {
    element: {
      enumerable: true,

      /** @this {ThatElement} */
      get() { return getView(this) },

      /** @this {ThatElement} @param {any} val */
      set(val) {
        const view = getView(this);
        if (val !== view) Object.assign(view, val);
      },
    },
    props: Object.fromEntries(propEnts)
  };
}

/**
 * @param {string} name
 * @param {InvalBuffer} buf
 */
function makeStructView(name, buf) {
  /** @param {ThatElement} el @returns {ThatStruct} */
  const getThatStruct = el => el._cache.get(`${name}$ThatStruct`, () => {
    // NOTE important to call buf.buffer AFTER $index access which may invalidate buffer
    const
      { $index, _cache } = el,
      { buffer, byteStride } = buf;
    const $offset = $index * byteStride, $end = $offset + byteStride;
    const $dataView = (isNaN($offset) || $end > buffer.byteLength) ? undefined
      : new DataView(buffer, $index * byteStride, byteStride);
    return {
      _cache,
      $dataView,
      $invalidate() {
        // NOTE probably not worth to to do sub-element invalidation
        buf.invalidate($offset, $end);
      },
    };
  });

  return {
    getThatStruct,

    /** @param {GetSetProp} desc */
    wrapStructDesc({ get, set }) {
      return {
        enumerable: true,
        /** @this {ThatElement} */
        get() { return get.call(getThatStruct(this)) },
        /** @this {ThatElement} @param {any} val */
        set(val) { set.call(getThatStruct(this), val) },
      };
    },
  };
}

/** @typedef {object} ThatStruct
 * @prop {Cache} _cache
 * @prop {DataView} [$dataView]
 * @prop {() => void} $invalidate
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
 * @param {StructField} field
 * @returns {GetSetProp}
 */
function makeFieldDescriptor(name, field, byteOffset = 0) {
  // TODO unify with makeComponentDescriptor & makeArrayDescriptor ; but differs in `this` typing

  const type = fieldType(field);
  switch (type) {
    case 'float32':
    case 'uint32':
    case 'uint16':
    case 'uint8':
    case 'uint8Clamped':
    case 'int32':
    case 'int16':
    case 'int8':
    case 'bool':
      return makeScalarDescriptor(type, byteOffset);
    // TODO specific legs for vector/matrix descriptors
  }

  const arrayStride = fieldStride(field);
  const arrayType = componentTypedArray(type);

  /**
   * @param {ThatStruct} struct
   * @returns {undefined|constructedArray<arrayType>}
   */
  const getThatArray = struct => struct._cache.get(`${name}$Array`, () => {
    const { $dataView } = struct;
    if (!$dataView) return undefined;
    const { buffer, byteOffset: viewByteOffset } = $dataView;
    return new arrayType(buffer, viewByteOffset + byteOffset, arrayStride);
  });

  return {
    enumerable: true,

    /** @this {ThatStruct} */
    get() {
      const { $invalidate } = this;
      const ar = getThatArray(this);
      return ar ? onPropSet(ar, $invalidate) : undefined;
    },

    /** @this {ThatStruct} @param {ArrayLike<number>} values */
    set(values) {
      getThatArray(this)?.set(values);
      this.$invalidate();
    },
  };
}

/**
 * @param {Scalar} type
 * @returns {GetSetProp}
 */
function makeScalarDescriptor(type, byteOffset = 0) {
  switch (type) {
    case 'bool': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getUint8(byteOffset) ? true : false },
      /** @this {ThatStruct} @param {boolean|number} value */
      set(value) {
        this.$dataView?.setUint8(byteOffset, value ? 1 : 0);
        this.$invalidate();
      },
    };

    case 'float32': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getFloat32(byteOffset, littleEndian) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setFloat32(byteOffset, value, littleEndian);
        this.$invalidate();
      },
    };

    case 'uint32': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getUint32(byteOffset, littleEndian) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setUint32(byteOffset, value, littleEndian);
        this.$invalidate();
      },
    };

    case 'uint16': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getUint16(byteOffset, littleEndian) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setUint16(byteOffset, value, littleEndian);
        this.$invalidate();
      },
    };

    case 'uint8Clamped':
    case 'uint8': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getUint8(byteOffset) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setUint8(byteOffset, value);
        this.$invalidate();
      },
    };

    case 'int32': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getInt32(byteOffset, littleEndian) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setInt32(byteOffset, value, littleEndian);
        this.$invalidate();
      },
    };

    case 'int16': return {
      enumerable: true,
      /** @this {ThatStruct} */
      get() { return this.$dataView?.getInt16(byteOffset, littleEndian) },
      /** @this {ThatStruct} @param {number} value */
      set(value) {
        this.$dataView?.setInt16(byteOffset, value, littleEndian);
        this.$invalidate();
      },
    };

    case 'int8':
      return {
        enumerable: true,
        /** @this {ThatStruct} */
        get() { return this.$dataView?.getInt8(byteOffset) },
        /** @this {ThatStruct} @param {number} value */
        set(value) {
          this.$dataView?.setInt8(byteOffset, value);
          this.$invalidate();
        },
      };

    default: unreachable(type);
  }
}

/**
 * @param {Order} element
 * @param {{length: number}} ctx
 * @returns {'uint8'|'uint16'|'uint32'}
 */
function orderType(element, ctx) {
  const { order } = element;
  switch (order) {
    case 'self':
      const { length } = ctx;
      return lengthType(length);
    default: unreachable(order);
  }
}

/** @param {number} length */
function lengthType(length) {
  if (length == 0) return 'uint8';
  const nBytes = Math.ceil(Math.log(length) / Math.log(2) / 8);
  switch (nBytes) {
    case 0:
    case 1: return 'uint8';
    case 2: return 'uint16';
    case 3:
    case 4: return 'uint32';
    default: throw new Error(`unsupported order index range ${length}`);
  }
}

/** @param {number} length */
export function makePermutation(length) {
  const datType = lengthType(length);
  const ArrayType = componentTypedArray(datType);
  const perm = new ArrayType(length);
  for (let i = 0; i < perm.length; i++) perm[i] = i;
  return perm;
}

/**
 * Yields an operational stream of index transpositions to reproduce the given
 * permutation's cycle structure; in other words:
 *
 *     for (const [i, j] of permutationSwaps(perm))
 *         swap(data, i j) // however you implement this
 *     // now data has been reordered according to perm's index reordering
 *
 * @param {ArrayLike<number>} perm
 * @returns {Generator<[i: number, j: number]>}
 */
export function* permutationSwaps(perm) {
  // NOTE this emits each cycle contiguously,
  //      which will skip arbitrarily through both read and write space.
  //      for example:
  //          (1 2 3 4)
  //          (2 3 4)·(1 2)
  //          (3 4)·(2 3)·(1 2)
  //      where the · operator is rtl applicative ala `f·g = f(g(...))`
  //
  // TODO is it possible to generate transpositions that provide better read/write locality?
  const touched = makeBitVector(perm.length);
  for (let i = 0; i < perm.length; i++) {
    let j = perm[i];
    if (j == i) continue; // fixed element
    if (touched.is(i)) continue; // already handled this cycle
    touched.set(i);
    let last = i;
    while (j != i) {
      touched.set(j);
      yield [last, j];
      last = j, j = perm[j];
    }
  }
}

/** @template {Element} E
 * @typedef {(
 * E extends Component ? ThatComponent<E>
 * : E extends ArrayElement ? ThatArrayValue<E["array"]>
 * : E extends StructElement ? Partial<ThatStructValue<E["struct"]>>
 * : E extends Order ? number
 * : never
 * )} ThatInit */

/** @template {Datum} D
 * @param {D} dat
 * @returns {undefined|ThatInit<D>}
 */
function datumInit(dat) {
  if (typeof dat !== 'object')
    return undefined;

  if ('array' in dat)
    return /** @type {undefined|ThatInit<D>} */(dat.init);

  if ('init' in dat)
    return /** @type {undefined|ThatInit<D>} */(dat.init);

  if ('struct' in dat) {
    const ents = Object.entries(dat.struct)
      .map(([name, field]) => /** @type {[name: string, init: undefined|ThatInit<StructElement>]} */([name, datumInit(field)]))
      .filter(([_name, field]) => field !== undefined);
    return ents.length > 0
      ? /** @type {undefined|ThatInit<D>} */(Object.fromEntries(ents))
      : undefined;
  }

  unreachable(dat);
}

/** @param {Datum} dat */
function datumByteLength(dat) {
  if (typeof dat == 'string' || 'type' in dat)
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
 * @param {Datum} dat
 * @returns {Generator<FieldInfo>}
 */
function* datumFieldInfo(dat) {
  if (typeof dat == 'string' || 'type' in dat) {
    yield {
      name: 'value',
      byteOffset: 0,
      get byteLength() { return datumByteLength(dat) },
      typeSpec: dat,
      get type() { return scalarType(dat) },
      get shape() { return componentShape(dat) },
    };
  }

  else if ('array' in dat) {
    const { array, shape } = dat;
    yield {
      name: 'value',
      byteOffset: 0,
      get byteLength() { return datumByteLength(dat) },
      typeSpec: dat,
      type: array,
      shape,
    };
  }

  else if ('struct' in dat) {
    let byteOffset = 0;
    for (const [name, field] of Object.entries(dat.struct)) {
      const byteLength = datumByteLength(field);

      if (typeof field == 'string' || 'type' in field) {
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

  else unreachable(dat);
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

/** @param {StructField} field */
function fieldType(field) {
  if (typeof field == 'string')
    return field;
  if ('type' in field)
    return field.type;
  if ('array' in field)
    return field.array;
  unreachable(field);
}

/** @param {StructField} field */
function fieldStride(field) {
  if (typeof field == 'string' || 'type' in field)
    return componentStride(field);
  if ('array' in field)
    return componentStride(field.array, field.shape);
  unreachable(field);
}

/** @typedef {(
 * | Scalar
 * | ScalarInit
 * | Vector
 * | VectorInit
 * | Matrix
 * | MatrixInit
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

/** Basic scalar element types, with an initial value provided.
 *
 * @typedef {(
 * | {type: 'float32', init: number}
 * | {type: 'uint32', init: number}
 * | {type: 'uint16', init: number}
 * | {type: 'uint8', init: number}
 * | {type: 'uint8Clamped', init: number}
 * | {type: 'int32', init: number}
 * | {type: 'int16', init: number}
 * | {type: 'int8', init: number}
 * | {type: 'bool', init: boolean}
 * )} ScalarInit
 * TODO 64 bit types
 * TODO 16 bit floats once they standard
 */

/** Common vector types; ArrayElement convenience aliases.
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

/** Common vector types, with provided initial values.
 *
 * @typedef {(
 * | {type: 'vec2'|'uvec2'|'ivec2', init: ThatVec2}
 * | {type: 'vec3'|'uvec3'|'ivec3', init: ThatVec3}
 * | {type: 'vec4'|'uvec4'|'ivec4', init: ThatVec4}
 * | {type: 'rgb', init: ThatRGB}
 * | {type: 'rgba', init: ThatRGBA}
 * | {type: 'bvec2', init: ThatBVec2}
 * | {type: 'bvec3', init: ThatBVec3}
 * | {type: 'bvec4', init: ThatBVec4}
 * )} VectorInit
 */

/** Common matrix types; ArrayElement convenience aliases.
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

/** Common matrix types witih provided initial values; ArrayElement convenience aliases.
 *
 * @typedef {(
 * | {type: 'mat2', init: ThatMat2}
 * | {type: 'mat3', init: ThatMat3}
 * | {type: 'mat4', init: ThatMat4}
 * | {type: 'mat2x3', init: ThatMat2x3}
 * | {type: 'mat2x4', init: ThatMat2x4}
 * | {type: 'mat3x2', init: ThatMat3x2}
 * | {type: 'mat3x4', init: ThatMat3x4}
 * | {type: 'mat4x2', init: ThatMat4x2}
 * | {type: 'mat4x3', init: ThatMat4x3}
 * )} MatrixInit
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

/**
 * @param {ArrayElement|Component} component
 * @returns {Scalar}
 */
function scalarType(component) {
  if (typeof component != 'string')
    return scalarType('type' in component ? component.type : component.array);

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
  if (typeof component !== 'string')
    return componentTypedArray(component.type);
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
  if (typeof component !== 'string')
    return componentShape(component.type);
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

// LUT to count set/unset bits in a byte
const byteZeroCount = new Uint8Array(256);
const byteOneCount = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let n = 0;
  for (let j = 0; j < 8; j++)
    if ((i & (1 << j)) != 0) n++;
  byteZeroCount[i] = 8 - n;
  byteOneCount[i] = n;
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

    countFree(under = length) {
      let n = 0;
      const upto = (under + 1) / 8;
      for (let el = 0; el < vec.length && el < upto; el++)
        n += byteZeroCount[vec[el]];
      return n;
    },

    anyFree(under = length) {
      const upto = (under + 1) / 8;
      for (let el = 0; el < vec.length && el < upto; el++) {
        const val = vec[el];
        if (val == 0xff) continue;
        for (let bit = 0, i = el * 8; bit < 8 && i < length && i < under; bit++, i++) {
          const mask = 1 << bit;
          if ((val & mask) != 0) continue;
          return true;
        }
      }
      return false;
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
      if (i >= length) return false;
      const el = Math.floor(i / 8);
      const bit = i % 8;
      const mask = 1 << bit;
      const prior = vec[el] & mask;
      vec[el] &= 0xff & ~mask;
      return prior != 0;
    },

    /** @param {number} i */
    set(i) {
      if (i >= length) return false;
      const el = Math.floor(i / 8);
      const bit = i % 8;
      const mask = 1 << bit;
      const prior = vec[el] & mask;
      vec[el] |= mask;
      return prior == 0;
    },

    claim(mark = true) {
      for (let el = 0; el < vec.length; el++) {
        const val = vec[el];
        if (val == 0xff) continue;
        for (let bit = 0, i = el * 8; bit < 8 && i < length; bit++, i++) {
          const mask = 1 << bit;
          if ((val & mask) != 0) continue;
          if (mark) vec[el] = val | mask;
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
 * @template {{$index: number, $capacity: number}} Cursor
 * @param {Cursor} cur
 * @param {(cur: Cursor) => boolean} [filter]
 * @returns {Iterator<Cursor>}
 */
function iterateCursor(cur, filter) {
  return {
    next: filter ? () => {
      const { $capacity } = cur;
      let { $index } = cur;
      while ($index < $capacity) {
        if ((cur.$index = ++$index) >= $capacity) break;
        if (filter(cur))
          return { done: false, value: cur };
      }
      return { done: true, value: undefined };
    } : () => {
      const { $capacity } = cur;
      let { $index } = cur;
      if ($index < $capacity) cur.$index = ++$index;
      if ($index >= $capacity)
        return { done: true, value: undefined };
      return { done: false, value: cur };
    }
  };
}

/**
 * @template {{$index: number, $capacity: number}} Cursor
 * @template V
 * @param {Cursor} cur
 * @param {(cur: Cursor) => V} [mapfn]
 */
export function* icur(cur, mapfn) {
  if (mapfn) {
    for (; cur.$index < cur.$capacity; cur.$index++)
      yield mapfn(cur);
  } else {
    for (; cur.$index < cur.$capacity; cur.$index++)
      yield cur;
  }
}

/**
 * @template {object} T
 * @param {T} o
 * @param {() => void} on
 */
function onPropSet(o, on) {
  return new Proxy(o, {
    set(target, p, newValue) {
      const ok = Reflect.set(target, p, newValue, o);
      if (ok) on();
      return ok;
    },
    get(target, p) {
      const value = Reflect.get(target, p, o);
      return typeof value === 'function' ? value.bind(o) : value;
    },
  });
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

/** @param {number} n */
function* initCopyRanges(n) {
  let i = 1;
  for (; 2 * i <= n; i *= 2)
    yield [i, 0, i];
  i /= 2;
  let off = 2 * i;
  for (; off < n && off + i <= n; off += i)
    yield [off, 0, i];
  for (i /= 2; off < n && i >= 1; i /= 2)
    if (off + i <= n) {
      yield [off, 0, i];
      off += i;
    }
}

/**
 * @param {Uint8Array} u8
 * @param {number} byteStride
 */
function copyInitData(u8, byteStride) {
  const length = Math.floor(u8.length / byteStride);
  for (const [target, start, end] of initCopyRanges(length))
    u8.copyWithin(byteStride * target, byteStride * start, byteStride * end);
}

/** @param {never} nope @returns {never} */
function unreachable(nope, mess = `inconceivable ${nope}`) {
  throw new Error(mess);
}
