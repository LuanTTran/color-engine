/**
 * WebGL Context Manager
 * Handles WebGL2 context initialization, loss/restoration lifecycle, and canvas utilities.
 */

export interface WebGLContextOptions extends WebGLContextAttributes {
  /**
   * Optional label used for logging and debugging.
   */
  label?: string;
}

export interface WebGLContextManager {
  /**
   * Initialize or reinitialize the WebGL2 context using the provided canvas.
   */
  initialize: (
    canvas: HTMLCanvasElement,
    options?: WebGLContextOptions
  ) => WebGL2RenderingContext | null;
  /**
   * Retrieve the active WebGL2 context, if available.
   */
  getContext: () => WebGL2RenderingContext | null;
  /**
   * Get the canvas currently managed by the context manager.
   */
  getCanvas: () => HTMLCanvasElement | null;
  /**
   * Returns the canvas dimensions, if a canvas is managed.
   */
  getCanvasSize: () => { width: number; height: number } | null;
  /**
   * Resize the managed canvas and update the WebGL viewport.
   */
  resize: (width: number, height: number) => void;
  /**
   * Update the viewport to match the provided dimensions.
   */
  setViewport: (width: number, height: number) => void;
  /**
   * Indicates whether the WebGL context is currently lost.
   */
  isContextLost: () => boolean;
  /**
   * Release listeners and references held by the manager.
   */
  destroy: () => void;
}

export const createWebGLContextManager = (): WebGLContextManager => {
  let gl: WebGL2RenderingContext | null = null;
  let canvasElement: HTMLCanvasElement | null = null;
  let contextLost = false;
  let contextLabel: string | undefined;

  const detachEventListeners = () => {
    if (!canvasElement) {
      return;
    }

    canvasElement.removeEventListener('webglcontextlost', handleContextLost as EventListener);
    canvasElement.removeEventListener('webglcontextrestored', handleContextRestored as EventListener);
  };

  const attachEventListeners = () => {
    if (!canvasElement) {
      return;
    }

    canvasElement.addEventListener('webglcontextlost', handleContextLost, { passive: false });
    canvasElement.addEventListener('webglcontextrestored', handleContextRestored, { passive: true });
  };

  const log = (message: string, ...args: unknown[]) => {
    if (!contextLabel) {
      return;
    }

    console.log(`[WEBGL][${contextLabel}] ${message}`, ...args);
  };

  const warn = (message: string, ...args: unknown[]) => {
    if (!contextLabel) {
      return;
    }

    console.warn(`[WEBGL][${contextLabel}] ${message}`, ...args);
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    log('Context lost. Waiting for restoration.');
  };

  const handleContextRestored = () => {
    contextLost = false;
    log('Context restored.');

    if (!canvasElement) {
      warn('Context restored but no canvas attached.');
      return;
    }

    gl = canvasElement.getContext('webgl2');

    if (!gl) {
      warn('Failed to restore WebGL2 context after loss.');
      return;
    }

    gl.viewport(0, 0, canvasElement.width, canvasElement.height);
  };

  const initialize: WebGLContextManager['initialize'] = (canvas, options) => {
    if (!canvas) {
      return null;
    }

    if (canvasElement !== canvas) {
      detachEventListeners();
    }

    canvasElement = canvas;
    contextLabel = options?.label;

    gl = canvasElement.getContext('webgl2', options ?? undefined);

    if (!gl) {
      console.error('[WEBGL] WebGL2 not supported or failed to initialize.');
      return null;
    }

    contextLost = false;
    attachEventListeners();
    gl.viewport(0, 0, canvasElement.width, canvasElement.height);

    if (options?.label) {
      log('Context initialized.');
    }

    return gl;
  };

  const getContext: WebGLContextManager['getContext'] = () => gl;

  const getCanvas: WebGLContextManager['getCanvas'] = () => canvasElement;

  const getCanvasSize: WebGLContextManager['getCanvasSize'] = () => {
    if (!canvasElement) {
      return null;
    }

    return {
      width: canvasElement.width,
      height: canvasElement.height,
    };
  };

  const resize: WebGLContextManager['resize'] = (width, height) => {
    if (!canvasElement || !gl) {
      return;
    }

    if (canvasElement.width === width && canvasElement.height === height) {
      return;
    }

    canvasElement.width = width;
    canvasElement.height = height;
    gl.viewport(0, 0, width, height);
  };

  const setViewport: WebGLContextManager['setViewport'] = (width, height) => {
    if (!gl) {
      return;
    }

    gl.viewport(0, 0, width, height);
  };

  const isContextLost: WebGLContextManager['isContextLost'] = () => contextLost;

  const destroy: WebGLContextManager['destroy'] = () => {
    detachEventListeners();
    gl = null;
    canvasElement = null;
    contextLost = false;
    contextLabel = undefined;
  };

  return {
    initialize,
    getContext,
    getCanvas,
    getCanvasSize,
    resize,
    setViewport,
    isContextLost,
    destroy,
  };
};


