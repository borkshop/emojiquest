// @ts-check

/* TODO
 * - implement sub-data range copying
 * - investigate switching to VAOs rather than webgl1 style binding
 * - support for other buffer targets like transform feedback which need to copy data back out of GL after a shader runs
 * - loosen coupling with dataframe module, either by abstracting component types, or by sharing a common core component type module
 */

// TODO this cross dependency may be better split out into a shard core "component data type" module
//    ; the dataframe modules doesn't actually care so much what the leaf/component data types are
//    , it just needs some such universe of component types to allocate onto aligned array buffer
//    ; this webgl2 modules doesn't care about the rest of the dataframe module
//    , but just needs a compatible universe of component types to map/bind onto GL buffers
// TODO maybe we can further abstract the interface expected here-in of "component data types" enough to drop the shared explicit types
//    , which would make this webgl2 module more generally usable outside of "has DataFrame" use cases.
/** @typedef {import('./dataframe.js').FieldInfo} FieldInfo */

/** Mappers copy named buffers into/outof GL.
 *
 * @typedef {object} NamedBuffer
 * @prop {string} name
 * @prop {ArrayBuffer} buffer
 * @prop {(gen: bigint) => Iterable<{ gen: bigint, start: number, end: number }>} modifiedSince
 */

/** Binders then bind fields withing mapped arrays to various parts of GL programs.
 *
 * @typedef {object} StridedFields
 * @prop {number} byteStride
 * @prop {Iterable<FieldInfo>} fieldInfo
 */

/**
 * Together that surface aligns with a DataFrame aspect, and so we call it the same here.
 *
 * But really the biggest specific coupling between DataFrame and this webgl2
 * mapping module is a shared set of component (field) data types.
 *
 * @typedef {NamedBuffer & StridedFields} Aspect
 */

/** @callback GLErrorHandler
 * @param {WebGL2RenderingContext} gl
 * @param {GLenum} code -- as returned by gl.getError()
 * @returns {Error|undefined}
 * */

/**
 * Implements a cancel-able async iterator over RAF (requestAnimationFrame)
 * with additional webgl error checking/reporting.
 *
 * @param {WebGL2RenderingContext} gl
 * @param {GLErrorHandler} [handleGLError]
 */
export function frameLoop(gl, handleGLError = allGLErrorsFatal) {
  /** @type {null|((reason?: any) => void)} */
  let cancel;
  let stopped = false;
  const $stopped = new Error('frame loop stopped');
  return {
    stop() {
      stopped = true;
      if (cancel) cancel($stopped);
    },
    frames: async function*() {
      try {
        while (!stopped) yield /** @type {Promise<DOMHighResTimeStamp>} */ (new Promise((resolve, reject) => {
          const pending = requestAnimationFrame(time => {
            cancel = null;
            const glErrorCode = gl.getError();
            // TODO implement restart given new gl context after glErrorCode == gl.CONTEXT_LOST_WEBGL
            const err = glErrorCode == gl.NO_ERROR ? undefined : handleGLError(gl, glErrorCode);
            if (err) reject(err);
            else resolve(time);
          });

          cancel = reason => {
            cancelAnimationFrame(pending);
            reject(reason);
          };
        }));
      } catch (e) {
        if (e !== $stopped) throw e;
      }
    }(),
  };
}

/** @type {GLErrorHandler} */
export function allGLErrorsFatal(gl, code) {
  switch (code) {
    case gl.NO_ERROR: return undefined;
    case gl.INVALID_ENUM: return new Error('webgl command passed an unacceptable enum value');
    case gl.INVALID_VALUE: return new Error('webgl command passed an out of range numeric argument');
    case gl.INVALID_OPERATION: return new Error('webgl command not allowed for current state');
    case gl.INVALID_FRAMEBUFFER_OPERATION: return new Error('webgl framebuffer is not complete when trying to render');
    case gl.OUT_OF_MEMORY: return new Error('webgl command out of memory');
    case gl.CONTEXT_LOST_WEBGL: return new Error('webgl context lost');
    default: return new Error(`webgl unknown error code ${code}`);
  }
}

/** @type {GLErrorHandler} */
export function ignoreGLCommandWarnings(gl, code) {
  switch (code) {
    case gl.NO_ERROR: return undefined;
    case gl.INVALID_ENUM: return undefined;
    case gl.INVALID_VALUE: return undefined;
    case gl.INVALID_OPERATION: return undefined;
    case gl.INVALID_FRAMEBUFFER_OPERATION: return undefined;
    case gl.OUT_OF_MEMORY: return new Error('webgl command out of memory');
    case gl.CONTEXT_LOST_WEBGL: return new Error('webgl context lost');
    default: return new Error(`webgl unknown error code ${code}`);
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Array<string|{name: string, source: Promise<string>}>} sources
 */
export async function compileProgram(gl, ...sources) {
  const prog = gl.createProgram();
  if (!prog) throw new Error('unable to create webgl program');

  const reSources = sources.map(ent => (typeof ent == 'string' ? {
    name: ent,
    source: fetch(ent).then(res => res.text())
  } : ent));

  // NOTE: we intentionally do not check compile status/error per-shader...
  //      ...instead only doing so if subsequent linking fails.
  //      This is purported best practice, so DO NOT factor out a compileShader() utility.
  //      See <https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile>
  const shaders = await Promise.all(
    reSources.map(async ({ name, source }) => {
      const shader = createShader(gl, name);
      gl.shaderSource(shader, await source);
      gl.compileShader(shader);
      return { name, shader };
    }));

  for (const { shader } of shaders)
    gl.attachShader(prog, shader);
  gl.linkProgram(prog);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(`GL program link error: ${[
      gl.getProgramInfoLog(prog)?.replace(/[\s\u0000]+$/, ''),
      ...shaders
        .filter(({ shader }) => !gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        .map(({ name, shader }) => getShaderCompileError(gl, shader, name))
    ].join('\n\n')}`);

  return prog;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} name
 * @param {"vert"|"frag"} [type]
 */
function createShader(gl, name, type) {
  if (!type) {
    if (name.endsWith('.vert')) type = 'vert';
    else if (name.endsWith('.frag')) type = 'frag';
    else if (name.endsWith('.vert.glsl')) type = 'vert';
    else if (name.endsWith('.frag.glsl')) type = 'frag';
    else throw new Error(`unable to guess weblgl shader type for ${name}`);
  }
  const glType =
    type == 'vert' ? gl.VERTEX_SHADER
      : type == 'frag' ? gl.FRAGMENT_SHADER
        : null;
  if (glType == null)
    throw new Error(`unknown webgl shader type:${type} for ${name}`);

  const shader = gl.createShader(glType);
  if (!shader)
    throw new Error(`unable to create webgl shader type:${type} name:${name}`);

  return shader;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLShader} shader
 * @param {string} sourceName
 */
function getShaderCompileError(gl, shader, sourceName) {
  const log = gl.getShaderInfoLog(shader) || '';
  const source = gl.getShaderSource(shader);
  return `compile error in ${sourceName}:\n${source
    ? [...annotateCompileError(source, log)].join('\n')
    : log
    }`;
}

/**
 * @param {string} src
 * @param {string} errorLog
 */
function* annotateCompileError(src, errorLog) {
  const contextCount = 3;
  const indent = 4;

  const errorLogLines = errorLog.replace(/[\s\u0000]+$/, '').split(/\n/);
  let errorLogI = 0;
  const nextErrorLog = () => {
    if (errorLogI >= errorLogLines.length) return null;
    const line = errorLogLines[errorLogI++];
    const match = /^ERROR: \d+:(\d+):\s*(.+?)$/.exec(line);
    if (!match) return { lineNo: 0, mess: line };
    const lineNo = parseInt(match[1] || '');
    const mess = match[2];
    return { lineNo, mess };
  };

  const rawLines = src.split(/\n/);
  const w = rawLines.length.toString().length + indent;
  const numLines = numberLines(w, rawLines);

  let nextError = nextErrorLog();
  while (nextError?.lineNo === 0) {
    yield `${' '.repeat(w)}${nextError.mess}`;
    nextError = nextErrorLog();
  }
  if (!nextError) return;
  let context = nextError.lineNo;

  let lineNo = 0;
  for (const line of numLines) {
    lineNo++;

    if (Math.abs(context - lineNo) <= contextCount) yield line;

    if (lineNo > context + contextCount) {
      if (!nextError) break;
      context = nextError.lineNo;
    }

    while (lineNo === nextError?.lineNo) {
      context = nextError.lineNo;
      yield `${' '.repeat(w)}  ^--${nextError.mess}`;

      nextError = nextErrorLog();
      while (nextError?.lineNo === 0) {
        yield `${' '.repeat(w + 5)}${nextError.mess}`;
        nextError = nextErrorLog();
      }
    }
  }
}

/**
 * @param {number} w
 * @param {Iterable<string>} lines
 */
function* numberLines(w, lines) {
  let n = 0;
  for (const line of lines) {
    n++;
    yield `${n.toString().padStart(w)}: ${line} `;
  }
}

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
    case gl.INT: return { name: 'int', scalarType: 'int', ArrayType: Int32Array, shape: 1 };
    case gl.INT_VEC2: return { name: 'ivec2', scalarType: 'int', ArrayType: Int32Array, shape: 2 };
    case gl.INT_VEC3: return { name: 'ivec3', scalarType: 'int', ArrayType: Int32Array, shape: 3 };
    case gl.INT_VEC4: return { name: 'ivec4', scalarType: 'int', ArrayType: Int32Array, shape: 4 };

    case gl.UNSIGNED_INT: return { name: 'uint', scalarType: 'uint', ArrayType: Uint32Array, shape: 1 };
    case gl.UNSIGNED_INT_VEC2: return { name: 'uvec2', scalarType: 'uint', ArrayType: Uint32Array, shape: 2 };
    case gl.UNSIGNED_INT_VEC3: return { name: 'uvec3', scalarType: 'uint', ArrayType: Uint32Array, shape: 3 };
    case gl.UNSIGNED_INT_VEC4: return { name: 'uvec4', scalarType: 'uint', ArrayType: Uint32Array, shape: 4 };

    //TODO can we crunch bools down into less than 4 bytes?
    //case gl.BOOL: return { name: 'bool', scalarType: 'bool', ArrayType: Uint8Array, shape: 1 };
    //case gl.BOOL_VEC2: return { name: 'bvec2', scalarType: 'bool', ArrayType: Uint8Array, shape: 2 };
    //case gl.BOOL_VEC3: return { name: 'bvec3', scalarType: 'bool', ArrayType: Uint8Array, shape: 3 };
    //case gl.BOOL_VEC4: return { name: 'bvec4', scalarType: 'bool', ArrayType: Uint8Array, shape: 4 };

    case gl.BOOL: return { name: 'bool', scalarType: 'bool', ArrayType: Uint32Array, shape: 1 };
    case gl.BOOL_VEC2: return { name: 'bvec2', scalarType: 'bool', ArrayType: Uint32Array, shape: 2 };
    case gl.BOOL_VEC3: return { name: 'bvec3', scalarType: 'bool', ArrayType: Uint32Array, shape: 3 };
    case gl.BOOL_VEC4: return { name: 'bvec4', scalarType: 'bool', ArrayType: Uint32Array, shape: 4 };

    case gl.FLOAT: return { name: 'float', scalarType: 'float', ArrayType: Float32Array, shape: 1 };
    case gl.FLOAT_VEC2: return { name: 'vec2', scalarType: 'float', ArrayType: Float32Array, shape: 2 };
    case gl.FLOAT_VEC3: return { name: 'vec3', scalarType: 'float', ArrayType: Float32Array, shape: 3 };
    case gl.FLOAT_VEC4: return { name: 'vec4', scalarType: 'float', ArrayType: Float32Array, shape: 4 };

    case gl.FLOAT_MAT2: return { name: 'mat2', scalarType: 'float', ArrayType: Float32Array, shape: [2, 2] };
    case gl.FLOAT_MAT3: return { name: 'mat3', scalarType: 'float', ArrayType: Float32Array, shape: [3, 3] };
    case gl.FLOAT_MAT4: return { name: 'mat4', scalarType: 'float', ArrayType: Float32Array, shape: [4, 4] };

    case gl.FLOAT_MAT2x3: return { name: 'mat2x3', scalarType: 'float', ArrayType: Float32Array, shape: [2, 3] };
    case gl.FLOAT_MAT2x4: return { name: 'mat2x4', scalarType: 'float', ArrayType: Float32Array, shape: [2, 4] };
    case gl.FLOAT_MAT3x2: return { name: 'mat3x2', scalarType: 'float', ArrayType: Float32Array, shape: [3, 2] };
    case gl.FLOAT_MAT3x4: return { name: 'mat3x4', scalarType: 'float', ArrayType: Float32Array, shape: [3, 4] };
    case gl.FLOAT_MAT4x2: return { name: 'mat4x2', scalarType: 'float', ArrayType: Float32Array, shape: [4, 3] };
    case gl.FLOAT_MAT4x3: return { name: 'mat4x3', scalarType: 'float', ArrayType: Float32Array, shape: [4, 3] };

    default: return null;
  }
}

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

/** @typedef {object} UniformVar
 * @prop {string} name
 * @prop {number} offset
 * @prop {GLenum} type
 * @prop {GLint} size
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} name
 * @param {number} index
 * @param {number} size
 * @param {UniformVar[]} vars
 */
export function makeUniformBlock(gl, name, index, size, vars) {
  let binding = index;

  return {
    get name() { return name },
    get size() { return size },

    get index() { return index },

    get binding() { return binding },
    set binding(b) { binding = b },

    /**
     * @param {object} [options]
     * @param {() => boolean} [options.shouldSend]
     * @param {() => void} [options.sent]
     */
    makeBuffer(options = {}) {
      const {
        shouldSend = () => true,
        sent = () => { },
      } = options;

      /** @type {null|WebGLBuffer} */
      let ubo = null;
      const bufData = new ArrayBuffer(size);

      // TODO seems like we should be able to unify this with attrib struct/field accessors?

      /** @param {number} i */
      const getVar = i => {
        const {
          offset,
          name: varName, type: varType, size: varSize
        } = vars[i];

        const typInfo = typeInfo(gl, varType);
        if (!typInfo)
          throw new Error(`unknown uniform variable type ${varType} for ${name}.${varName}`);

        const { name: typeName, shape, ArrayType, scalarType } = typInfo;
        const elements = typeof shape == 'number' ? shape : shape[0] * shape[1];
        const byteLength = ArrayType.BYTES_PER_ELEMENT * elements;

        const subView = new DataView(bufData, offset, byteLength * varSize);

        const copyValue = (i = 0) => {
          if (elements > 1)
            return [...new ArrayType(bufData, offset + i * byteLength, elements)];
          switch (scalarType) {
            case 'float': return self.float;
            case 'int': return self.int;
            case 'uint': return self.uint;
            case 'bool': return self.bool;
            default: unreachable(scalarType);
          }
        };

        const self = {
          get blockName() { return name },
          get name() { return varName },
          get offset() { return offset },
          get type() { return varType },
          get size() { return varSize },
          get byteLength() { return byteLength * varSize },

          get value() {
            return varSize > 1
              ? Array.from(imap(irange(varSize), i => copyValue(i)))
              : copyValue()
          },

          toJSON: () => self.value,

          /** @param {number} [i] */
          asArray(i = 0) {
            if (i < 0 || i >= varSize)
              throw new Error(`index out of range for uniform variable ${name}.${varName}`);
            return new ArrayType(bufData, offset + i * byteLength, elements);
          },

          /** @param {number} [i] */
          asFloatArray(i = 0) {
            if (i < 0 || i >= varSize)
              throw new Error(`index out of range for uniform variable ${name}.${varName}`);
            if (ArrayType != Float32Array)
              throw new Error(`uniform variable ${name}.${varName} is ${typeName} not float-like`);
            return new ArrayType(bufData, offset + i * byteLength, elements);
          },

          /** @param {number} [i] */
          asIntArray(i = 0) {
            if (i < 0 || i >= varSize)
              throw new Error(`index out of range for uniform variable ${name}.${varName}`);
            if (ArrayType != Int32Array)
              throw new Error(`uniform variable ${name}.${varName} is ${typeName} not int-like`);
            return new ArrayType(bufData, offset + i * byteLength, elements);
          },

          /** @param {number} [i] */
          asUintArray(i = 0) {
            if (i < 0 || i >= varSize)
              throw new Error(`index out of range for uniform variable ${name}.${varName}`);
            if (ArrayType != Uint32Array)
              throw new Error(`uniform variable ${name}.${varName} is ${typeName} not uint-like`);
            return new ArrayType(bufData, offset + i * byteLength, elements);
          },

          get float() { return subView.getFloat32(0, littleEndian) },
          set float(v) { subView.setFloat32(0, v, littleEndian) },

          get uint() { return subView.getUint32(0, littleEndian) },
          set uint(v) { subView.setUint32(0, v, littleEndian) },

          get int() { return subView.getInt32(0, littleEndian) },
          set int(v) { subView.setInt32(0, v, littleEndian) },

          get bool() { return subView.getUint32(0, littleEndian) == 0 ? false : true },
          set bool(v) { subView.setUint32(0, v ? 1 : 0, littleEndian) },

          send() {
            if (!ubo) ubo = gl.createBuffer();
            if (!ubo) throw new Error(`failed to create uniform ${name} buffer`);
            gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
            gl.bufferSubData(gl.UNIFORM_BUFFER, offset, subView);
            gl.bindBuffer(gl.UNIFORM_BUFFER, null);
          },

        };
        return self;
      };

      /** @typedef {ReturnType<typeof getVar>} Var */

      const self = {
        get name() { return name },

        delete() {
          if (ubo) {
            gl.deleteBuffer(ubo);
            ubo = null;
          }
        },

        bind(index = binding) {
          if (shouldSend()) self.send();
          gl.bindBufferBase(gl.UNIFORM_BUFFER, index, ubo);
        },

        unbind() {
          // TODO anything useful?
        },

        send() {
          if (!ubo) ubo = gl.createBuffer();
          if (!ubo) throw new Error(`failed to create uniform ${name} buffer`);
          gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
          gl.bufferData(gl.UNIFORM_BUFFER, bufData, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.UNIFORM_BUFFER, null);
          sent();
        },

        *keys() {
          for (let i = 0; i < vars.length; i++)
            yield vars[i].name;
        },

        *values() {
          for (let i = 0; i < vars.length; i++)
            yield getVar(i);
        },

        *entries() {
          for (let i = 0; i < vars.length; i++) {
            const v = getVar(i);
            yield /** @type {[name: string, v: Var]} */ ([v.name, v]);
          }
        },

        toJSON() { return Object.fromEntries(self.entries()) },
        [Symbol.iterator]: () => self.entries(),

        /** @param {string} varName */
        get(varName) {
          const i = vars.findIndex(({ name }) => name == varName);
          return i < 0 ? undefined : getVar(i);
        },

        /** @param {string} varName */
        has: varName =>
          vars.findIndex(({ name }) => name == varName) >= 0,

        /** @param {string} varName */
        mustGet(varName) {
          const v = self.get(varName);
          if (v == undefined)
            throw new Error(`no such uniform ${name}.${varName}`);
          return v;
        },
      };
      return self;
    },

  };
}

/** @typedef {ReturnType<typeof makeUniformBlock>} UniformBlock */

/** @typedef {(name: string) => undefined|string|GLAttrib} AttribMapper */

/** @typedef {(
 * | AttribMapper
 * | {[name: string]: string|GLAttrib}
 * )} AttribMapable */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Iterable<Aspect>} aspects
 * @param {object} [options]
 * @param {Program} [options.program]
 * @param {Iterable<GLAttrib>} [options.attribInfo]
 * @param {AttribMapable} [options.attribMap]
 * @param {{[name: string]: GLenum}} [options.target]
 * @param {{[name: string]: GLenum}} [options.usage]
 * @param {boolean} [options.resetAttribs]
 * @param {{[name: string]: (number|[number, number]|[number, number, number]|[number, number, number, number])}} [options.defaults]
 */
export function makeWebGLAspects(gl, aspects, options = {}) {
  const {
    program,
    attribInfo: attrInfo = program ? program.attribs() : undefined,
    attribMap,
    target,
    usage,
    resetAttribs = true,
    defaults,
  } = options, attribInfo = attrInfo && Array.from(attrInfo);

  const attribs = attribInfo && Array.from(attribInfo);
  const mappers = Array.from(aspects)
    .map(aspect => makeWebGLAspect(gl, aspect, {
      program,
      attribInfo: attribs,
      attribMap,
      target: target && target[aspect.name],
      usage: usage && usage[aspect.name]
    }))
    .filter(aspect => !!aspect);

  const attrDefaults = attribs && resetAttribs
    ? attribs.map(({ name, loc, type }) => {
      if (loc < 0) return null;
      const [dx, dy, dz, dw] = (/** @returns {[number, number, number, number]} */ () => {
        const val = defaults && defaults[name];
        if (val === undefined) return [0, 0, 0, 0];
        if (typeof val === 'number') return [val, val, val, val];
        if (val.length == 2) {
          const [x, y] = val;
          return [x, y, 0, 0];
        }
        if (val.length == 3) {
          const [x, y, z] = val;
          return [x, y, z, 0];
        }
        return val;
      })();

      switch (type) {
        case gl.FLOAT: return () => {
          gl.disableVertexAttribArray(loc);
          gl.vertexAttrib4f(loc, dx, dy, dz, dw);
        };

        // TODO case gl.BOOL: ?

        case gl.INT: return () => {
          gl.disableVertexAttribArray(loc);
          gl.vertexAttribI4i(loc, dx, dy, dz, dw);
        };

        case gl.UNSIGNED_INT: return () => {
          gl.disableVertexAttribArray(loc);
          gl.vertexAttribI4ui(loc, dx, dy, dz, dw);
        };

        default:
          // console.log('should reset?', loc, type, `0x${type.toString(16).padStart(4, '0')}`);
          return null;
      }
    }).filter(x => x != null)
    : []

  return mappers.length ? {
    /** @param {string} name */
    get(name) {
      for (const mapper of mappers)
        if (mapper.name === name) return mapper;
      return undefined;
    },

    delete() { for (const mapper of mappers) mapper.delete() },
    send() { for (const mapper of mappers) mapper.send() },
    // TODO recv() for copying data back from gl
    bind() {
      for (const ad of attrDefaults) ad();
      for (const mapper of mappers) mapper.bind()
    },
    unbind() { for (const mapper of mappers) mapper.unbind() },
  } : null;
}

/**
 * @param {WebGL2RenderingContext} gl
 */
export function* glInspectBuffers(gl) {
  for (const [name, target] of /** @type {[string, GLenum][]} */([
    ["array", gl.ARRAY_BUFFER],
    ["element_array", gl.ELEMENT_ARRAY_BUFFER],
    //["copy_read", gl.COPY_READ_BUFFER],
    //["copy_write", gl.COPY_WRITE_BUFFER],
    //["transform_feedback", gl.TRANSFORM_FEEDBACK_BUFFER],
    //["uniform", gl.UNIFORM_BUFFER],
    //["pixel_pack", gl.PIXEL_PACK_BUFFER],
    //["pixel_unpack", gl.PIXEL_UNPACK_BUFFER],
  ])) yield {
    name,
    size: gl.getBufferParameter(target, gl.BUFFER_SIZE),
    usage: gl.getBufferParameter(target, gl.BUFFER_USAGE),
  };
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {Aspect} aspect
 * @param {object} [options]
 * @param {Program} [options.program]
 * @param {Iterable<GLAttrib>} [options.attribInfo]
 * @param {AttribMapable} [options.attribMap]
 * @param {GLenum} [options.target]
 * @param {GLenum} [options.usage]
 */
export function makeWebGLAspect(gl, aspect, options = {}) {
  const {
    program,
    attribInfo: attrInfo = program ? program.attribs() : undefined,
    attribMap: mayMapAttrib,
    ...opts
  } = options, attribInfo = attrInfo && Array.from(attrInfo);
  /** @type {AttribMapper|undefined} */
  const attribMap = mayMapAttrib
    ? typeof mayMapAttrib == 'function' ? mayMapAttrib
      : name => mayMapAttrib[name]
    : undefined;
  const { binder, ...mapperOpts } = aspectBinder(gl, aspect, { ...opts, attribInfo, attribMap });
  if (!binder) return null;
  return makeGLBufMapper(gl, aspect, binder, mapperOpts);
}

/**
 * @typedef {object} GLBinder
 * @prop {() => void} bind
 * @prop {() => void} unbind
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {{name: string} & StridedFields} aspect
 * @param {object} [options]
 * @param {GLenum} [options.target]
 * @param {GLenum} [options.usage]
 * @param {Iterable<GLAttrib>} [options.attribInfo]
 * @param {(name: string) => undefined|string|GLAttrib} [options.attribMap]
 */
function aspectBinder(gl, aspect, options = {}) {
  const {
    attribInfo,
    attribMap,
    target = gl.ARRAY_BUFFER,
    usage = gl.STATIC_DRAW,
  } = options;

  /** @type {null|GLBinder} */
  let binder = null;

  if (target == gl.ARRAY_BUFFER) {
    binder = attribInfo ? makeGLAspectBinder(gl, aspect.name, aspect.fieldInfo, {
      byteStride: aspect.byteStride,
      attribInfo,
      attribMap,
    }) : null;
  } else if (target == gl.ELEMENT_ARRAY_BUFFER) {
    binder = makeGLElementsBinder(gl, aspect.fieldInfo);
  } else {
    // noop mapper until we need other implementations, e.g. transform feedback
    binder = { bind() { }, unbind() { } };
  }

  return { target, usage, binder };
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {NamedBuffer} data
 * @param {GLBinder} binder
 * @param {object} options
 * @param {GLenum} [options.target]
 * @param {GLenum} [options.usage]
 */
function makeGLBufMapper(gl, data, binder, options) {
  const {
    target = gl.ARRAY_BUFFER,
    usage = gl.STATIC_DRAW,
  } = options;

  /** @type {WebGLBuffer|null} */
  let glBuffer = null;
  let lastModified = 0n;

  const self = {
    get name() { return data.name },
    get buffer() { return data.buffer },

    /** @returns {GLenum} */
    get target() { return target }, // TODO set target() ?

    /** @returns {GLenum} */
    get usage() { return usage }, // TODO set usage() ?

    delete() {
      if (glBuffer) {
        gl.deleteBuffer(glBuffer);
        glBuffer = null;
      }
    },

    send() {
      if (!glBuffer) glBuffer = gl.createBuffer();
      if (!glBuffer) throw new Error(`unable to create webgl buffer for ${data.name}`);
      gl.bindBuffer(target, glBuffer);
      gl.bufferData(target, data.buffer, usage);
      gl.bindBuffer(target, null);
    },

    // TODO recv() for copying data back from gl

    bind() {
      let isDirty = !glBuffer;
      if (!isDirty) {
        // TODO send only dirty ranges
        for (const _ of data.modifiedSince(lastModified)) {
          isDirty = true;
          break;
        }
      }
      if (isDirty) self.send();
      gl.bindBuffer(target, glBuffer);
      binder.bind();
    },

    unbind() {
      binder.unbind();
      gl.bindBuffer(target, null);
    },
  };
  return self;
}

/** @typedef {(
 * | 'float32'
 * | 'uint32'
 * | 'uint16'
 * | 'uint8'
 * | 'uint8Clamped'
 * | 'int32'
 * | 'int16'
 * | 'int8'
 * | 'bool'
 * )} FieldType */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} name
 * @param {Iterable<FieldInfo>} fields
 * @param {object} options
 * @param {number} options.byteStride
 * @param {Iterable<GLAttrib>} options.attribInfo
 * @param {(name: string) => undefined|string|GLAttrib} [options.attribMap]
 */
function makeGLAspectBinder(gl, name, fields, {
  byteStride,
  attribInfo,
  attribMap,
}) {
  /** @param {string} name */
  const getAttribByName = name => {
    for (const ai of attribInfo)
      if (ai.name === name) return ai;
    return undefined;
  };

  /** @param {string} name */
  const resolveAttr = name => {
    if (attribMap) {
      const am = attribMap(name);
      if (am !== undefined)
        return typeof am == 'string' ? getAttribByName(am) : am;
    }
    return getAttribByName(name);
  };

  /** @param {FieldInfo} field */
  const bindField = (field, fieldName = field.name) => {
    const attr = resolveAttr(fieldName);
    return attr
      ? makeGLFieldBinder(gl, field, attr, { name, byteStride })
      : null;
  };

  const flds = Array.from(fields);

  // TODO loosen to not be as attached to singular "value" field?
  if (flds.length === 1) {
    const [theField] = flds;
    if (theField.name === 'value') {
      const theBinder = bindField(theField, name);
      if (theBinder) return theBinder;
    }
  }

  const fieldBinders = flds
    .map(field => bindField(field))
    .filter(b => b !== null);

  return fieldBinders.length
    ? fieldBinders.length == 1 ? fieldBinders[0]
      : {
        bind() { for (const b of fieldBinders) b.bind() },
        unbind() { for (const b of fieldBinders) b.unbind() },
      }
    : null;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {FieldInfo["type"]} type
 */
export function fieldGLType(gl, type) {
  switch (type) {
    case 'float32': return gl.FLOAT;
    case 'uint32': return gl.UNSIGNED_INT;
    case 'uint16': return gl.UNSIGNED_SHORT;
    case 'uint8':
    case 'uint8Clamped': return gl.UNSIGNED_BYTE;
    case 'int32': return gl.INT;
    case 'int16': return gl.SHORT;
    case 'int8': return gl.BYTE;
    case 'bool': return gl.BOOL;
    default: unreachable(type);
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {FieldInfo} field
 * @param {GLAttrib} attrib
 * @param {object} options
 * @param {number} options.byteStride
 * @param {string} [options.name]
 */
function makeGLFieldBinder(gl, field, attrib, {
  byteStride,
  name = 'unknown',
}) {
  // TODO is this always used only for ARRAY_BUFFER targets?
  if (byteStride > 255)
    throw new Error('byteStride may not exceed 255 for WebGL ARRAY_BUFFER attrib targets');

  const { loc } = attrib;
  const attribTypeInfo = typeInfo(gl, attrib.type);
  if (!attribTypeInfo)
    throw new Error(`unknown WebGL attribute type ${JSON.stringify(attrib)}`);
  const {
    name: attribNominalType,
    shape: attribShape,
    scalarType: attribScalarType,
  } = attribTypeInfo;

  const {
    name: fieldName,
    type: fieldType,
    typeSpec: fieldSpec,
    byteOffset,
    shape
  } = field;
  const size = Math.ceil(typeof shape == 'number' ? shape : shape[0] * shape[1]);
  const glType = fieldGLType(gl, fieldType);

  if (!equalShapes(attribShape, shape))
    throw new Error(`incompatible field ${name}.${fieldName} shape [${shape}]${fieldType} for WebGL attribute ${attrib.name}@${loc} ${attribNominalType} (as [${attribShape}]${attribScalarType})`);

  switch (attribScalarType) {

    case 'bool':
      switch (fieldType) {
        case 'uint8':
        case 'uint8Clamped':
        case 'uint16':
        case 'uint32':
          // TODO allow int scalars too?
          break;
        default:
          throw new Error(`incompatible field ${name}.${fieldName} type [${shape}]${fieldType} for WebGL attribute ${attrib.name}@${loc} ${attribNominalType}`);
      }
      return {
        bind() {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribIPointer(loc, size, glType, byteStride, byteOffset);
        },
        unbind() {
          gl.disableVertexAttribArray(loc);
        }
      };

    case 'int':
      switch (fieldType) {
        case 'int8':
        case 'int16':
        case 'int32':
          break;
        default:
          throw new Error(`incompatible field ${name}.${fieldName} type [${shape}]${fieldType} for WebGL attribute ${attrib.name}@${loc} ${attribNominalType}`);
      }
      return {
        bind() {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribIPointer(loc, size, glType, byteStride, byteOffset);
        },
        unbind() {
          gl.disableVertexAttribArray(loc);
        }
      };

    case 'uint':
      switch (fieldType) {
        case 'uint8':
        case 'uint8Clamped':
        case 'uint16':
        case 'uint32':
          break;
        default:
          throw new Error(`incompatible field ${name}.${fieldName} type [${shape}]${fieldType} for WebGL attribute ${attrib.name}@${loc} ${attribNominalType}`);
      }
      return {
        bind() {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribIPointer(loc, size, glType, byteStride, byteOffset);
        },
        unbind() {
          gl.disableVertexAttribArray(loc);
        }
      };

    case 'float':
      switch (fieldType) {
        case 'float32':
          // TODO allow integer data too?
          break;
        default:
          throw new Error(`incompatible field ${name}.${fieldName} type [${shape}]${fieldType} for WebGL attribute ${attrib.name}@${loc} ${attribNominalType}`);
      }
      // TODO out of band option path
      const normalized = fieldSpec === 'rgb' || fieldSpec === 'rgba';
      return {
        bind() {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, glType, normalized, byteStride, byteOffset);
        },
        unbind() {
          gl.disableVertexAttribArray(loc);
        }
      };

    default: unreachable(attribScalarType);
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 */
export function makeProgram(gl, prog) {
  const attribs = new Map(imap(glProgramAttributes(gl, prog),
    /** @returns {[name: string, attr: GLAttrib]} */ attr => [attr.name, attr]));
  const uniforms = new Map(imap(glProgramUniforms(gl, prog),
    /** @returns {[name: string, attr: GLUniform]} */ uni => [uni.name, uni]));
  const uniformBlocks = new Map(imap(glProgramUniformBlocks(gl, prog),
    /** @returns {[name: string, block: UniformBlock]} */ ub => [ub.name, ub.block]));

  return {
    get prog() { return prog },

    *attribs() { yield* attribs.values() },
    /** @param {string} name */
    getAttrib(name) { return attribs.get(name) },
    /** @param {string} name */
    mustGetAttrib(name) {
      const attr = attribs.get(name);
      if (attr === undefined) throw new Error(`must have gl attrib ${name}`);
      return attr;
    },

    *uniforms() { yield* uniforms.values() },
    /** @param {string} name */
    getUniform(name) { return uniforms.get(name) },
    /** @param {string} name */
    mustGetUniform(name) {
      const uni = uniforms.get(name)
      if (uni === undefined) throw new Error(`must have gl uniform ${name}`);
      return uni;
    },

    *uniformBlocks() { yield* uniformBlocks.values() },
    /** @param {string} name */
    getUniformBlock(name) { return uniformBlocks.get(name) },
    /** @param {string} name */
    mustGetUniformBlock(name) {
      const block = uniformBlocks.get(name)
      if (block === undefined) throw new Error(`must have gl uniform block ${name}`);
      return block;
    },

    bind() {
      gl.useProgram(prog);
    },

    unbind() {
      gl.useProgram(null);
    },

    delete() {
      gl.deleteProgram(prog);
    },

    linkUniformBlocks() {
      for (const { index, binding } of uniformBlocks.values())
        gl.uniformBlockBinding(prog, index, binding);
    },

    *inspectAttribs() {
      for (const { name, loc, size, type } of attribs.values()) {
        const value = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_ENABLED)
          ? {
            buffer: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING),
            size: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_SIZE),
            stride: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_STRIDE),
            type: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_TYPE),
            normalized: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED),
            integer: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_INTEGER),
            divisor: gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_DIVISOR),
          }
          : gl.getVertexAttrib(loc, gl.CURRENT_VERTEX_ATTRIB);
        yield { name, size, type, loc, value };
      }
    },

    *inspectUniforms() {
      for (const { name, size, type, loc } of uniforms.values()) {
        const value = gl.getUniform(prog, loc);
        yield { name, size, type, loc, value };
      }
    },

  };
}

/** @typedef {ReturnType<typeof makeProgram>} Program */

/** @typedef {object} GLAttrib
 * @prop {string} name
 * @prop {GLint} loc
 * @prop {GLenum} type
 * @prop {GLint} size
 */

/** @typedef {object} GLUniform
 * @prop {string} name
 * @prop {WebGLUniformLocation} loc
 * @prop {GLenum} type
 * @prop {GLint} size
 */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 */
function* glProgramUniforms(gl, prog) {
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  if (typeof count != 'number' || count < 0) {
    console.warn('unable to get WebGL ACTIVE_UNIFORMS program parameter');
    return;
  }

  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(prog, i);
    if (!info) {
      console.warn(`unable to get WebGL active uniform ${i} info`);
      continue;
    }

    const { name, type, size } = info;
    if (name.startsWith('gl_')) continue;

    const loc = gl.getUniformLocation(prog, name);
    if (loc === null) continue;

    yield { name, type, size, loc };
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 */
function* glProgramUniformBlocks(gl, prog) {
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORM_BLOCKS);
  if (typeof count != 'number' || count < 0) {
    console.warn('unable to get WebGL ACTIVE_UNIFORM_BLOCKS program parameter');
    return;
  }

  for (let i = 0; i < count; i++) {
    const name = gl.getActiveUniformBlockName(prog, i);
    if (!name) {
      console.warn(`unable to get WebGL active uniform block name ${i}`);
      continue;
    }

    const blockIndex = gl.getUniformBlockIndex(prog, name);
    if (blockIndex == gl.INVALID_INDEX) throw new Error(`no such uniform block ${name}`);

    /** @type {number[]} */
    const varIndex = gl.getActiveUniformBlockParameter(prog, blockIndex, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES);
    /** @type {number[]} */
    const varOffset = gl.getActiveUniforms(prog, varIndex, gl.UNIFORM_OFFSET);
    const varInfo = [...varIndex].map(i => gl.getActiveUniform(prog, i));
    const varSpec = varInfo.map((info, i) => {
      if (!info) return null;
      const { name, type, size } = info;
      return { name, offset: varOffset[i], type, size };
    }).filter(x => x !== null);

    const size = gl.getActiveUniformBlockParameter(prog, i, gl.UNIFORM_BLOCK_DATA_SIZE);
    if (typeof size !== 'number')
      throw new Error(`invalid uniform block data size index:${i} name:${name}`);

    const block = makeUniformBlock(gl, name, blockIndex, size, varSpec);

    yield { name, block };
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 */
function* glProgramAttributes(gl, prog) {
  const count = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
  if (typeof count != 'number' || count < 0) {
    console.warn('unable to get WebGL ACTIVE_ATTRIBUTES program parameter');
    return;
  }

  for (let i = 0; i < count; i++) {
    const info = gl.getActiveAttrib(prog, i);
    if (!info) {
      console.warn(`unable to get WebGL active attribute ${i} info`);
      continue;
    }
    const { name, type, size } = info;
    if (name.startsWith('gl_')) continue;

    const loc = gl.getAttribLocation(prog, name);
    if (loc < 0) {
      console.warn(`unable to get location for WebGL attribute ${name} ${typeInfo(gl, type)?.name}`);
      continue;
    }

    yield { name, type, size, loc };
  }
}

/**
 * @param {WebGL2RenderingContext} _gl
 * @param {Iterable<FieldInfo> | (() => Iterable<FieldInfo>)} fields
 */
function makeGLElementsBinder(_gl, fields) {
  const aspectFields = Array.from(typeof fields == 'function' ? fields() : fields);
  if (aspectFields.length > 1)
    throw new Error('WebGL ELEMENT_ARRAY_BUFFER targets only support mapping a single field');

  return {
    // TODO anything useful?
    bind() { },
    unbind() { },
  };
}

/** @param {number} n */
function* irange(n) {
  for (let i = 0; i < n; i++) yield i;
}

/** @template I, O
 * @param {Iterable<I>} it
 * @param {(v: I, i: number) => O} fn
 */
function* imap(it, fn) {
  let i = 0;
  for (const v of it)
    yield fn(v, i++);
}

/**
 * @param {ArrayShape} a
 * @param {ArrayShape} b
 */
function equalShapes(a, b) {
  return typeof a == 'number'
    ? typeof b == 'number' && a === b
    : Array.isArray(b) && a[0] === b[0] && a[1] === b[1];
}

/** @param {never} nope @returns {never} */
function unreachable(nope, mess = `inconceivable ${nope}`) {
  throw new Error(mess);
}
