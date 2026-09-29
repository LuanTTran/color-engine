import type { WebGLContextManager } from './webgl-context';

export interface TextureCreationOptions {
  minFilter?: GLenum;
  magFilter?: GLenum;
  wrapS?: GLenum;
  wrapT?: GLenum;
  flipY?: boolean;
  premultiplyAlpha?: boolean;
}

export interface TextureManager {
  createFromImageData: (
    imageData: ImageData,
    key?: string,
    options?: TextureCreationOptions
  ) => WebGLTexture | null;
  createEmptyTexture: (
    width: number,
    height: number,
    key?: string,
    options?: TextureCreationOptions
  ) => WebGLTexture | null;
  loadFromImageElement: (
    image: HTMLImageElement,
    key?: string,
    options?: TextureCreationOptions
  ) => WebGLTexture | null;
  loadFromArrayBuffer: (
    buffer: ArrayBuffer,
    key?: string,
    mimeType?: string,
    options?: TextureCreationOptions
  ) => Promise<WebGLTexture | null>;
  getTexture: (key: string) => WebGLTexture | null;
  deleteTexture: (key: string) => void;
  deleteTextureDirect: (texture: WebGLTexture | null | undefined) => void;
  cleanup: () => void;
}

// WebGL constants (using numeric values for SSR compatibility)
// LINEAR = 0x2601 (9729), CLAMP_TO_EDGE = 0x812F (33071)
const DEFAULT_OPTIONS: Required<Omit<TextureCreationOptions, 'minFilter' | 'magFilter' | 'wrapS' | 'wrapT'>> &
  TextureCreationOptions = {
  minFilter: 0x2601, // WebGL2RenderingContext.LINEAR
  magFilter: 0x2601, // WebGL2RenderingContext.LINEAR
  wrapS: 0x812F, // WebGL2RenderingContext.CLAMP_TO_EDGE
  wrapT: 0x812F, // WebGL2RenderingContext.CLAMP_TO_EDGE
  flipY: false,
  premultiplyAlpha: false,
};

export const createTextureManager = (contextManager: WebGLContextManager): TextureManager => {
  const textureCache = new Map<string, WebGLTexture>();

  const getGL = () => {
    const gl = contextManager.getContext();

    if (!gl) {
      console.error('[WEBGL][TEXTURE] WebGL context is not available.');
      return null;
    }

    return gl;
  };

  const applyTextureOptions = (
    gl: WebGL2RenderingContext,
    options?: TextureCreationOptions
  ) => {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, merged.minFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, merged.magFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, merged.wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, merged.wrapT ?? gl.CLAMP_TO_EDGE);

    if (merged.flipY !== undefined) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, merged.flipY ? 1 : 0);
    }

    if (merged.premultiplyAlpha !== undefined) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, merged.premultiplyAlpha ? 1 : 0);
    }
  };

  const registerTexture = (key: string | undefined, texture: WebGLTexture | null) => {
    if (!key || !texture) {
      return;
    }

    textureCache.set(key, texture);
  };

  const createTexture = (
    gl: WebGL2RenderingContext,
    key: string | undefined,
    setup: () => void,
    options?: TextureCreationOptions
  ): WebGLTexture | null => {
    const texture = gl.createTexture();

    if (!texture) {
      console.error('[WEBGL][TEXTURE] Failed to create texture.');
      return null;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    applyTextureOptions(gl, options);
    setup();
    gl.bindTexture(gl.TEXTURE_2D, null);

    registerTexture(key, texture);

    return texture;
  };

  const createFromImageData: TextureManager['createFromImageData'] = (imageData, key, options) => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    return createTexture(
      gl,
      key,
      () => {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          imageData
        );
      },
      options
    );
  };

  const createEmptyTexture: TextureManager['createEmptyTexture'] = (
    width,
    height,
    key,
    options
  ) => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    return createTexture(
      gl,
      key,
      () => {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      },
      options
    );
  };

  const loadFromImageElement: TextureManager['loadFromImageElement'] = (image, key, options) => {
    const gl = getGL();

    if (!gl) {
      return null;
    }

    return createTexture(
      gl,
      key,
      () => {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      },
      options
    );
  };

  const loadFromArrayBuffer: TextureManager['loadFromArrayBuffer'] = async (
    buffer,
    key,
    mimeType = 'image/png',
    options
  ) => {
    const blob = new Blob([buffer], { type: mimeType });
    const image = new Image();

    return new Promise<WebGLTexture | null>((resolve) => {
      image.onload = () => {
        const texture = loadFromImageElement(image, key, options);
        resolve(texture);
      };

      image.onerror = () => {
        console.error('[WEBGL][TEXTURE] Failed to load image from ArrayBuffer.');
        resolve(null);
      };

      image.src = URL.createObjectURL(blob);
    });
  };

  const getTexture: TextureManager['getTexture'] = (key) => textureCache.get(key) ?? null;

  const deleteTexture: TextureManager['deleteTexture'] = (key) => {
    const gl = getGL();

    if (!gl) {
      textureCache.delete(key);
      return;
    }

    const texture = textureCache.get(key);

    if (!texture) {
      return;
    }

    if (gl.isTexture(texture)) {
      gl.deleteTexture(texture);
    }

    textureCache.delete(key);
  };

  const deleteTextureDirect: TextureManager['deleteTextureDirect'] = (texture) => {
    const gl = getGL();

    if (!gl || !texture) {
      return;
    }

    if (gl.isTexture(texture)) {
      gl.deleteTexture(texture);
    }

    for (const [key, cachedTexture] of textureCache) {
      if (cachedTexture === texture) {
        textureCache.delete(key);
      }
    }
  };

  const cleanup: TextureManager['cleanup'] = () => {
    const gl = getGL();

    for (const [key, texture] of textureCache) {
      if (gl && gl.isTexture(texture)) {
        gl.deleteTexture(texture);
      }
      textureCache.delete(key);
    }
  };

  return {
    createFromImageData,
    createEmptyTexture,
    loadFromImageElement,
    loadFromArrayBuffer,
    getTexture,
    deleteTexture,
    deleteTextureDirect,
    cleanup,
  };
};


