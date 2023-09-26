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
    throw new Error([
      `GL program link error: ${gl.getProgramInfoLog(prog)}`,
      ...shaders
        .filter(({ shader }) => !gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        .map(({ name, shader }) => getShaderCompileError(gl, shader, name))
    ].join('\n'));

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
    ? annotateCompileError(source, log)
    : log
    }`
}

/**
 * @param {string} src
 * @param {string} mess
 */
function annotateCompileError(src, mess) {
  var match = /^ERROR: \d+:(\d+):/.exec(mess);
  if (!match) {
    return mess;
  }
  const lineNo = parseInt(match[1] || '');
  const contextCount = 3;

  const lines = src.split(/\n/);
  const numLines = lines.length;
  const w = numLines.toString().length;

  return [...annotateLine(
    numberLines(w, lines),
    lineNo, contextCount,
    `${' '.repeat(w)} ^ --${mess} `
  )].join('\n');
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

/**
 * @param {Iterable<string>} lines
 * @param {number} lineNo
 * @param {number} contextCount
 * @param {string} mess
 */
function* annotateLine(lines, lineNo, contextCount, mess) {
  let n = 0;
  for (const line of lines) {
    n++;
    if (Math.abs(lineNo - n) <= contextCount) {
      yield line;
    }
    if (n === lineNo) {
      yield mess;
    }
  }
}
