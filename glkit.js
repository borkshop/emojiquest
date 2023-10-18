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
