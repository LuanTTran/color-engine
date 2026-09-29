import type { WebGLContextManager } from './webgl-context';

export interface FramebufferResource {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

export interface FramebufferManager {
  getFramebuffer: (key: string, width: number, height: number) => FramebufferResource | null;
  bindFramebuffer: (key: string, width: number, height: number) => FramebufferResource | null;
  releaseFramebuffer: () => void;
  deleteFramebuffer: (key: string) => void;
  cleanup: () => void;
}

interface FramebufferOptions {
  minFilter?: GLenum;
  magFilter?: GLenum;
  wrapS?: GLenum;
  wrapT?: GLenum;
}

const DEFAULT_OPTIONS: FramebufferOptions = {
  minFilter: undefined,
  magFilter: undefined,
  wrapS: undefined,
  wrapT: undefined,
};

export const createFramebufferManager = (
  contextManager: WebGLContextManager,
  options: FramebufferOptions = {}
): FramebufferManager => {
  const framebufferCache = new Map<string, FramebufferResource>();
  const textureOptions = { ...DEFAULT_OPTIONS, ...options };

  const getGL = () => {
    const gl = contextManager.getContext();

    if (!gl) {
      console.error('[WEBGL][FBO] WebGL context is not available.');
      return null;
    }

    return gl;
  };

  const configureTexture = (gl: WebGL2RenderingContext, texture: WebGLTexture) => {
    const minFilter = textureOptions.minFilter ?? gl.LINEAR;
    const magFilter = textureOptions.magFilter ?? gl.LINEAR;
    const wrapS = textureOptions.wrapS ?? gl.CLAMP_TO_EDGE;
    const wrapT = textureOptions.wrapT ?? gl.CLAMP_TO_EDGE;

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  };

  const createTexture = (
    gl: WebGL2RenderingContext,
    width: number,
    height: number
  ): WebGLTexture | null => {
    const texture = gl.createTexture();

    if (!texture) {
      console.error('[WEBGL][FBO] Failed to create framebuffer texture.');
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    configureTexture(gl, texture);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
  };

  const createFramebuffer = (
    key: string,
    width: number,
    height: number
  ): FramebufferResource | null => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    const framebuffer = gl.createFramebuffer();

    if (!framebuffer) {
      console.error(`[WEBGL][FBO] Failed to create framebuffer for key ${key}.`);
      return null;
    }

    const texture = createTexture(gl, width, height);

    if (!texture) {
      gl.deleteFramebuffer(framebuffer);
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error(`[WEBGL][FBO] Framebuffer (${key}) incomplete with status ${status}.`);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const resource: FramebufferResource = {
      framebuffer,
      texture,
      width,
      height,
    };

    framebufferCache.set(key, resource);

    return resource;
  };

  const ensureFramebufferSize = (
    resource: FramebufferResource,
    width: number,
    height: number
  ): FramebufferResource | null => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    if (resource.width === width && resource.height === height) {
      return resource;
    }

    if (gl.isTexture(resource.texture)) {
      gl.deleteTexture(resource.texture);
    }

    const texture = createTexture(gl, width, height);

    if (!texture) {
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, resource.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    resource.texture = texture;
    resource.width = width;
    resource.height = height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return resource;
  };

  const getFramebuffer: FramebufferManager['getFramebuffer'] = (key, width, height) => {
    const cached = framebufferCache.get(key);

    if (!cached) {
      return createFramebuffer(key, width, height);
    }

    return ensureFramebufferSize(cached, width, height);
  };

  const bindFramebuffer: FramebufferManager['bindFramebuffer'] = (key, width, height) => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    const resource = getFramebuffer(key, width, height);

    if (!resource) {
      return null;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, resource.framebuffer);
    gl.viewport(0, 0, width, height);

    return resource;
  };

  const releaseFramebuffer: FramebufferManager['releaseFramebuffer'] = () => {
    const gl = getGL();

    if (!gl) {
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const deleteFramebuffer: FramebufferManager['deleteFramebuffer'] = (key) => {
    const gl = getGL();
    const resource = framebufferCache.get(key);

    if (!resource) {
      return;
    }

    if (gl) {
      if (gl.isFramebuffer(resource.framebuffer)) {
        gl.deleteFramebuffer(resource.framebuffer);
      }
      if (gl.isTexture(resource.texture)) {
        gl.deleteTexture(resource.texture);
      }
    }

    framebufferCache.delete(key);
  };

  const cleanup: FramebufferManager['cleanup'] = () => {
    const gl = getGL();

    for (const resource of framebufferCache.values()) {
      if (gl) {
        if (gl.isFramebuffer(resource.framebuffer)) {
          gl.deleteFramebuffer(resource.framebuffer);
        }
        if (gl.isTexture(resource.texture)) {
          gl.deleteTexture(resource.texture);
        }
      }
    }

    framebufferCache.clear();
  };

  return {
    getFramebuffer,
    bindFramebuffer,
    releaseFramebuffer,
    deleteFramebuffer,
    cleanup,
  };
};


