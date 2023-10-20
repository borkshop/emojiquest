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
 * @param {WebGL2RenderingContext} gl
 * @param {Array<string|{name: string, source: Promise<string>}>} sources
 */
export async function compileProgram(gl, ...sources) {
  const prog = gl.createProgram();
  if (!prog) throw new Error('unable to create gl program');

  // NOTE: we intentionally do not check compile status/error per-shader...
  //      ...instead only doing so if subsequent linking fails.
  //      This is purported best practice, so DO NOT factor out a compileShader() utility.
  //      See <https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile>

  const shaders = await Promise.all(sources
    .map(ent => (typeof ent == 'string' ? {
      name: ent,
      source: fetch(ent).then(res => res.text())
    } : ent))
    .map(async ({ name, source }) => {
      const shader = createShader(gl, name);
      gl.shaderSource(shader, await source);
      gl.compileShader(shader);
      return { name, shader }
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

/** @typedef {object} shaderSpec
 * @prop {string} name
 * @prop {Promise<string>} source
 * @prop {"vert"|"frag"} [type]
 */

/** @param {string} name */
function guessShaderType(name) {
  if (name.endsWith('.vert')) return 'vert';
  if (name.endsWith('.frag')) return 'frag';
  if (name.endsWith('.vert.glsl')) return 'vert';
  if (name.endsWith('.frag.glsl')) return 'frag';
  throw new Error(`unable to guess shader type for ${name}`);
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {string} name
 * @param {"vert"|"frag"} [type]
 */
function createShader(gl, name, type) {
  if (!type) type = guessShaderType(name);
  const glType =
    type == 'vert' ? gl.VERTEX_SHADER
      : type == 'frag' ? gl.FRAGMENT_SHADER
        : null;
  if (glType == null)
    throw new Error(`unknown shader type:${type} for ${name}`);

  const shader = gl.createShader(glType);
  if (!shader)
    throw new Error(`unable to create type:${type} gl shader for ${name}`);

  return shader;
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLShader} shader
 * @param {string} sourceName
 */
function getShaderCompileError(gl, shader, sourceName) {
  const log = gl.getShaderInfoLog(shader) || '';
  const source = gl.getShaderSource(shader)
  return `compile error in ${sourceName}:\n${source
    ? [...annotateCompileError(source, log)].join('\n')
    : log
    }`
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

export function frameLoop() {
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
        while (!stopped) yield new Promise((resolve, reject) => {
          const pending = requestAnimationFrame(resolve);
          cancel = reason => {
            cancelAnimationFrame(pending);
            reject(reason);
          };
        });
      } catch (e) {
        if (e !== $stopped) throw e;
      }
    }(),
  };
}

/** @param {HTMLCanvasElement} $canvas */
export function sizeToClient($canvas) {
  const { clientWidth, clientHeight } = $canvas;
  if ($canvas.width != clientWidth ||
    $canvas.height != clientHeight) {
    $canvas.width = clientWidth;
    $canvas.height = clientHeight;
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} prog
 * @param {string} name
 * @param {number} binding
 */
export function makeUniformBlock(gl, prog, name, binding) {
  const blockIndex = gl.getUniformBlockIndex(prog, name);
  if (blockIndex == gl.INVALID_INDEX) throw new Error(`no such uniform block ${name}`);

  const size = gl.getActiveUniformBlockParameter(prog, blockIndex, gl.UNIFORM_BLOCK_DATA_SIZE);

  const varIndex = [...gl.getActiveUniformBlockParameter(prog, blockIndex, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES)];
  const varInfo = varIndex.map(i => {
    const info = gl.getActiveUniform(prog, i);
    if (!info) throw new Error(`unable to get active uniform ${name}[${i}]`);
    return info;
  });
  const varOffset = gl.getActiveUniforms(prog, varIndex, gl.UNIFORM_OFFSET);

  return {
    get name() { return name },
    get index() { return blockIndex },
    get binding() { return binding },
    get size() { return size },

    /** @param {WebGLProgram[]} progs */
    link(...progs) {
      for (const prog of progs)
        gl.uniformBlockBinding(prog, blockIndex, binding);
    },

    makeBuffer() {
      const ubo = gl.createBuffer();
      const bufData = new ArrayBuffer(size);

      return {
        bind(index = binding) {
          gl.bindBufferBase(gl.UNIFORM_BUFFER, index, ubo);
        },

        send() {
          gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
          gl.bufferData(gl.UNIFORM_BUFFER, bufData, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        },

        *vars() {
          for (const { name } of varInfo)
            yield name;
        },

        /** @param {string} varName */
        getVar(varName) {
          const i = varInfo.findIndex(info => info.name == varName);
          if (i < 0) throw new Error(`no such uniform ${name}.${varName}`)

          const offset = varOffset[i];
          const index = varIndex[i];
          const { type, size } = varInfo[i];

          const typeInfo = dataType(gl, type);
          if (!typeInfo)
            throw new Error(`unknown uniform variable type ${type} for ${name}.${varName}`);

          const { name: typeName, ArrayType, elements, byteLength } = typeInfo;
          const subView = new DataView(bufData, offset, byteLength * size);

          return {
            get blockName() { return name },
            get name() { return varName },
            get index() { return index },
            get offset() { return offset },
            get type() { return type },
            get byteLength() { return byteLength * size },

            /** @param {number} [i] */
            asArray(i = 0) {
              if (i < 0 || i >= size)
                throw new Error(`index out of range for uniform variable ${name}.${varName}`);
              return new ArrayType(bufData, offset + i * byteLength, elements);
            },

            /** @param {number} [i] */
            asFloatArray(i = 0) {
              if (i < 0 || i >= size)
                throw new Error(`index out of range for uniform variable ${name}.${varName}`);
              if (ArrayType != Float32Array)
                throw new Error(`uniform variable ${name}.${varName} is ${typeName} not float-like`);
              return new ArrayType(bufData, offset + i * byteLength, elements);
            },

            /** @param {number} [i] */
            asIntArray(i = 0) {
              if (i < 0 || i >= size)
                throw new Error(`index out of range for uniform variable ${name}.${varName}`);
              if (ArrayType != Int32Array)
                throw new Error(`uniform variable ${name}.${varName} is ${typeName} not int-like`);
              return new ArrayType(bufData, offset + i * byteLength, elements);
            },

            /** @param {number} [i] */
            asUintArray(i = 0) {
              if (i < 0 || i >= size)
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
              gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
              gl.bufferSubData(gl.UNIFORM_BUFFER, offset, subView);
              gl.bindBuffer(gl.UNIFORM_BUFFER, null);
            },

          };
        },
      };
    },

  };
}

/** @typedef {ReturnType<makeUniformBlock>} UniformBlock */
/** @typedef {ReturnType<UniformBlock["makeBuffer"]>} UniformBuffer */

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} dataType
 */
function dataTypeInfo(gl, dataType) {
  // TODO differentiate name from component name?
  switch (dataType) {
    case gl.INT: return { name: 'int', ArrayType: Int32Array, shape: [1] };
    case gl.INT_VEC2: return { name: 'ivec2', ArrayType: Int32Array, shape: [2] };
    case gl.INT_VEC3: return { name: 'ivec3', ArrayType: Int32Array, shape: [3] };
    case gl.INT_VEC4: return { name: 'ivec4', ArrayType: Int32Array, shape: [4] };

    case gl.UNSIGNED_INT: return { name: 'uint', ArrayType: Uint32Array, shape: [1] };
    case gl.UNSIGNED_INT_VEC2: return { name: 'uvec2', ArrayType: Uint32Array, shape: [2] };
    case gl.UNSIGNED_INT_VEC3: return { name: 'uvec3', ArrayType: Uint32Array, shape: [3] };
    case gl.UNSIGNED_INT_VEC4: return { name: 'uvec4', ArrayType: Uint32Array, shape: [4] };

    case gl.BOOL: return { name: 'bool', ArrayType: Uint32Array, shape: [1] };
    case gl.BOOL_VEC2: return { name: 'bvec2', ArrayType: Uint32Array, shape: [2] };
    case gl.BOOL_VEC3: return { name: 'bvec3', ArrayType: Uint32Array, shape: [3] };
    case gl.BOOL_VEC4: return { name: 'bvec4', ArrayType: Uint32Array, shape: [4] };

    case gl.FLOAT: return { name: 'float', ArrayType: Float32Array, shape: [1] };
    case gl.FLOAT_VEC2: return { name: 'vec2', ArrayType: Float32Array, shape: [2] };
    case gl.FLOAT_VEC3: return { name: 'vec3', ArrayType: Float32Array, shape: [3] };
    case gl.FLOAT_VEC4: return { name: 'vec4', ArrayType: Float32Array, shape: [4] };

    case gl.FLOAT_MAT2: return { name: 'mat2', ArrayType: Float32Array, shape: [2, 2] };
    case gl.FLOAT_MAT3: return { name: 'mat3', ArrayType: Float32Array, shape: [3, 3] };
    case gl.FLOAT_MAT4: return { name: 'mat4', ArrayType: Float32Array, shape: [4, 4] };

    case gl.FLOAT_MAT2x3: return { name: 'mat2x3', ArrayType: Float32Array, shape: [2, 3] };
    case gl.FLOAT_MAT2x4: return { name: 'mat2x4', ArrayType: Float32Array, shape: [2, 4] };
    case gl.FLOAT_MAT3x2: return { name: 'mat3x2', ArrayType: Float32Array, shape: [3, 2] };
    case gl.FLOAT_MAT3x4: return { name: 'mat3x4', ArrayType: Float32Array, shape: [3, 4] };
    case gl.FLOAT_MAT4x2: return { name: 'mat4x2', ArrayType: Float32Array, shape: [4, 3] };
    case gl.FLOAT_MAT4x3: return { name: 'mat4x3', ArrayType: Float32Array, shape: [4, 3] };

    default:
      return null;
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {(
 * | Float32ArrayConstructor
 * | Uint32ArrayConstructor
 * | Uint16ArrayConstructor
 * | Uint8ArrayConstructor
 * | Int32ArrayConstructor
 * | Int16ArrayConstructor
 * | Int8ArrayConstructor
 * )} cons
 */
export function arrayElementType(gl, cons) {
  switch (cons) {
    case Float32Array: return gl.FLOAT;
    case Uint32Array: return gl.UNSIGNED_INT;
    case Uint16Array: return gl.UNSIGNED_SHORT;
    case Uint8Array: return gl.UNSIGNED_BYTE;
    case Int32Array: return gl.INT;
    case Int16Array: return gl.SHORT;
    case Int8Array: return gl.BYTE;
    default: throw new Error(`unsupported array constructor ${cons.name}`);
  }
}

/**
 * @param {WebGL2RenderingContext} gl
 * @param {number} dataType
 */
export function dataType(gl, dataType) {
  const info = dataTypeInfo(gl, dataType);
  if (!info) return null;
  const elements = info.shape.reduce((a, b) => a * b);
  const byteLength = info.ArrayType.BYTES_PER_ELEMENT * elements;
  const elementType = arrayElementType(gl, info.ArrayType);

  return {
    ...info,
    elements,
    byteLength,
    elementType,
  };
}

/** @typedef {object} GLAttribSpec
 * @prop {number} attrib
 * @prop {number} [type]
 * @prop {WebGLBuffer} [buffer]
 * @prop {number} [usage]
 * @prop {boolean} [normalized]
 * @prop {boolean} [asInt]
 */

/** @typedef {object} GLElementsSpec
 * @prop {true} elements
 * @prop {number} [type]
 * @prop {WebGLBuffer} [buffer]
 * @prop {number} [usage]
 */

/** @typedef {object} ArraySpec
 * @prop {(
 * | Float32ArrayConstructor
 * | Uint32ArrayConstructor
 * | Uint16ArrayConstructor
 * | Uint8ArrayConstructor
 * | Int32ArrayConstructor
 * | Int16ArrayConstructor
 * | Int8ArrayConstructor
 * )} ArrayType
 * @prop {number} size
 * @prop {GLAttribSpec|GLElementsSpec} [gl]
 */

/** @template T @typedef {(
 * T extends Float32ArrayConstructor ? Float32Array :
 * T extends Uint32ArrayConstructor ? Uint32Array :
 * T extends Uint16ArrayConstructor ? Uint16Array :
 * T extends Uint8ArrayConstructor ? Uint8Array :
 * T extends Int32ArrayConstructor ? Int32Array :
 * T extends Int16ArrayConstructor ? Int16Array :
 * T extends Int8ArrayConstructor ? Int8Array :
 * never
 * )} constructedArray
 */

/** @template {{[name: string]: ArraySpec}} T
 * @typedef {{
 *   [Name in keyof T]: constructedArray<T[Name]["ArrayType"]>
 * }} dataProps */

/** Creates a simple backing data store for an array,
 * where each attribute is mapped to a single array.
 *
 * @template {{[name: string]: ArraySpec}} T
 * @param {WebGL2RenderingContext} gl
 * @param {T} typeMap
 * @param {number} [initialCapacity]
 */
export function makeFrame(gl, typeMap, initialCapacity = 8) {

  // TODO restore elements array varying type
  // /** @param {number} cap */
  // function makeElementArray(cap) {
  //   if (cap <= 256)
  //     return new Uint8Array(cap);
  //   if (cap <= 256 * 256)
  //     return new Uint16Array(cap);
  //   if (cap <= 256 * 256 * 256 * 256)
  //     return new Uint32Array(cap);
  //   throw new Error(`unsupported element index capacity: ${cap}`);
  // }

  // TODO support per-array dirty, ideeally with regions for subdata copy
  let dirty = true;

  let cap = initialCapacity;

  let elementsIndex = -1;
  let elementsLength = 0;

  const names = Object.keys(typeMap);
  const specs = Object.values(typeMap);
  const argl = specs.map(
    /** @returns {null|Required<Exclude<ArraySpec["gl"], undefined>>} */
    ({ ArrayType, size, gl: glSpec }, i) => {
      if (!glSpec) return null;

      // TODO support just-in-time buffer (re)creation and the ability to delete buffers

      if ('attrib' in glSpec) {
        const {
          attrib,
          type = arrayElementType(gl, ArrayType),
          buffer = gl.createBuffer(),
          usage = gl.STATIC_DRAW,
          normalized = false,
          asInt = false,
        } = glSpec;
        if (!buffer) throw new Error(`must create vertex buffer for "${names[i]}"`);
        return {
          attrib,
          type,
          buffer,
          usage,
          normalized,
          asInt,
        };
      } else if (glSpec.elements) {
        if (size != 1)
          throw new Error(`elements size must be 1`);
        if (elementsIndex != -1)
          throw new Error('multiple element arrays are unsupported');
        elementsIndex = i;
        const {
          type = arrayElementType(gl, ArrayType),
          buffer = gl.createBuffer(),
          usage = gl.STATIC_DRAW,
        } = glSpec;
        if (!buffer) throw new Error(`must create element buffer for "${names[i]}"`);
        return {
          elements: true,
          type,
          buffer,
          usage,
        };
      } else throw new Error(`invalid gl spec for "${names[i]}"`);
    });
  const data = specs.map(({ ArrayType, size }) =>
    new ArrayType(Math.ceil(cap * size)));

  const self = {
    get capacity() { return cap },

    get dirty() { return dirty },
    set dirty(d) { dirty = d },

    /** @param {number} n */
    resize(n, copy = true) {
      if (n != cap) {
        cap = n;
        for (let i = 0; i < data.length; i++) {
          const { ArrayType, size } = specs[i];
          const now = new ArrayType(Math.ceil(cap * size));
          if (copy) now.set(data[i].subarray(0, now.length));
          data[i] = now;
        }
        if (!copy) elementsLength = 0;
        dirty = true;
      } else if (!copy) {
        for (const ar of data) ar.fill(0);
        elementsLength = 0;
        dirty = true;
      }
    },

    // TODO compact() ?

    /** @param {number} needed */
    prune(needed) {
      let newCap = initialCapacity;
      // TODO clever maths to compute needed without a loop
      while (newCap < needed)
        newCap = newCap < 1024 ? 2 * newCap : newCap + newCap / 4;
      if (newCap < cap) self.resize(newCap);
    },

    grow(needed = cap + 1) {
      let newCap = cap;
      while (newCap < needed)
        newCap = newCap < 1024 ? 2 * newCap : newCap + newCap / 4;
      self.resize(newCap);
    },

    clear() {
      for (const ar of data) ar.fill(0);
      elementsLength = 0;
      dirty = true;
    },

    send() {
      for (let i = 0; i < data.length; i++) {
        const igl = argl[i];
        if (!igl) continue;
        const { buffer, usage } = igl;
        if ('attrib' in igl) {
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ARRAY_BUFFER, data[i], usage);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else if (igl.elements) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data[i], usage);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
      }
      dirty = false;
    },

    bind() {
      if (dirty) self.send();

      for (let i = 0; i < data.length; i++) {
        const igl = argl[i];
        if (!igl) continue;

        if ('attrib' in igl) {
          const { buffer, attrib, type, asInt, normalized } = igl;
          const { size } = specs[i];
          const stride = 0;
          const offset = 0;
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          if (asInt) {
            gl.vertexAttribIPointer(attrib, Math.ceil(size), type, stride, offset);
          } else {
            gl.vertexAttribPointer(attrib, Math.ceil(size), type, normalized, stride, offset);
          }
          gl.enableVertexAttribArray(attrib);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
        }
      }
    },

    /** @param {number} id */
    findElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      let lo = 0, hi = elementsLength;
      let sanity = cap;
      while (lo < hi) {
        if (--sanity < 0) throw new Error('find loop exeeded iteration budget');
        const mid = Math.floor(lo / 2 + hi / 2);
        const q = elements[mid];
        if (q === id) return mid;
        else if (q < id) lo = mid + 1;
        else if (q > id) hi = mid;
      }
      return lo;
    },

    /** @param {number} id */
    addElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      const eli = self.findElement(id);
      if (eli < elementsLength && elements[eli] === id) return;
      if (elementsLength === cap) throw new Error('element index full');
      if (eli > elementsLength + 1) throw new Error('inconceivable find result index');
      if (eli < elementsLength)
        elements.copyWithin(eli + 1, eli, elementsLength);
      elementsLength++;
      elements[eli] = id;
    },

    /** @param {number} id */
    delElement(id) {
      if (elementsIndex == -1)
        throw new Error('no elements index array defined');
      const elements = data[elementsIndex];
      const eli = self.findElement(id);
      if (eli < elementsLength && elements[eli] === id) {
        elements.copyWithin(eli, eli + 1);
        elementsLength--;
      }
    },

    // TODO hasElement(id)

    /** @param {number} mode */
    drawElements(mode) {
      const elGl = argl[elementsIndex];
      if (elementsIndex == -1 || !elGl)
        throw new Error('no elements index array defined');

      self.bind();

      const { buffer, type } = elGl;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
      gl.drawElements(mode, elementsLength, type, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    },

  };

  return /** @type {typeof self & dataProps<T>} */(
    Object.defineProperties(self, Object.fromEntries(
      names.map((name, i) => [name, { get: () => data[i] }])
    ))
  );
}
