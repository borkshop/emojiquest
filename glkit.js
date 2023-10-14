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
