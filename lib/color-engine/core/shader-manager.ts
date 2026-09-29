import type { WebGLContextManager } from './webgl-context';

export interface ShaderProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

export interface ShaderManager {
  createProgram: (
    key: string,
    vertexSource: string,
    fragmentSource: string,
    uniformNames?: string[]
  ) => ShaderProgramInfo | null;
  getProgram: (key: string) => ShaderProgramInfo | null;
  useProgram: (key: string) => WebGLProgram | null;
  deleteProgram: (key: string) => void;
  cleanup: () => void;
}

export const createShaderManager = (contextManager: WebGLContextManager): ShaderManager => {
  const cache = new Map<string, ShaderProgramInfo>();

  const compileShader = (
    type: GLenum,
    source: string,
    label: string
  ): WebGLShader | null => {
    const gl = contextManager.getContext();

    if (!gl) {
      console.error(`[WEBGL][SHADER] Missing WebGL context while compiling ${label}.`);
      return null;
    }

    const shader = gl.createShader(type);

    if (!shader) {
      console.error(`[WEBGL][SHADER] Failed to create shader for ${label}.`);
      return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

    if (!compiled) {
      console.error(`[WEBGL][SHADER] Compile error in ${label}:`, gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const createProgram: ShaderManager['createProgram'] = (
    key,
    vertexSource,
    fragmentSource,
    uniformNames = []
  ) => {
    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const gl = contextManager.getContext();

    if (!gl) {
      console.error(`[WEBGL][SHADER] Missing WebGL context while creating program ${key}.`);
      return null;
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource, `${key} (vertex)`);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource, `${key} (fragment)`);

    if (!vertexShader || !fragmentShader) {
      if (vertexShader && gl.isShader(vertexShader)) {
        gl.deleteShader(vertexShader);
      }
      if (fragmentShader && gl.isShader(fragmentShader)) {
        gl.deleteShader(fragmentShader);
      }
      return null;
    }

    const program = gl.createProgram();

    if (!program) {
      console.error(`[WEBGL][SHADER] Failed to create program ${key}.`);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);

    if (!linked) {
      console.error(`[WEBGL][SHADER] Link error in program ${key}:`, gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    const uniforms: ShaderProgramInfo['uniforms'] = {};

    for (const name of uniformNames) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    const programInfo: ShaderProgramInfo = {
      program,
      uniforms,
    };

    cache.set(key, programInfo);

    return programInfo;
  };

  const getProgram: ShaderManager['getProgram'] = (key) => cache.get(key) ?? null;

  const useProgram: ShaderManager['useProgram'] = (key) => {
    const gl = contextManager.getContext();

    if (!gl) {
      console.error('[WEBGL][SHADER] Cannot use program without WebGL context.');
      return null;
    }

    const programInfo = cache.get(key);

    if (!programInfo) {
      return null;
    }

    gl.useProgram(programInfo.program);

    return programInfo.program;
  };

  const deleteProgram: ShaderManager['deleteProgram'] = (key) => {
    const gl = contextManager.getContext();

    if (!gl) {
      cache.delete(key);
      return;
    }

    const info = cache.get(key);

    if (!info) {
      return;
    }

    if (gl.isProgram(info.program)) {
      gl.deleteProgram(info.program);
    }

    cache.delete(key);
  };

  const cleanup: ShaderManager['cleanup'] = () => {
    const gl = contextManager.getContext();

    for (const [key, info] of cache) {
      if (gl && gl.isProgram(info.program)) {
        gl.deleteProgram(info.program);
      }
      cache.delete(key);
    }
  };

  return {
    createProgram,
    getProgram,
    useProgram,
    deleteProgram,
    cleanup,
  };
};


