import type { FramebufferManager } from '../core/framebuffer-manager';
import type { ShaderManager } from '../core/shader-manager';
import type { TextureManager } from '../core/texture-manager';
import type { WebGLContextManager } from '../core/webgl-context';

export interface ProcessorInitializationContext {
  contextManager: WebGLContextManager;
  shaderManager: ShaderManager;
  framebufferManager: FramebufferManager;
  textureManager: TextureManager;
}

export interface ProcessorRenderParams {
  inputTexture: WebGLTexture;
  width: number;
  height: number;
  outputFramebuffer?: WebGLFramebuffer | null;
  outputTexture?: WebGLTexture | null;
}

export interface ProcessorLifecycle<TConfig = void> {
  initialize: (config?: TConfig) => void;
  render: (params: ProcessorRenderParams, config?: TConfig) => WebGLTexture | null;
  cleanup: () => void;
}

export abstract class BaseProcessor<TConfig = void>
  implements ProcessorLifecycle<TConfig>
{
  protected readonly contextManager: WebGLContextManager;
  protected readonly shaderManager: ShaderManager;
  protected readonly framebufferManager: FramebufferManager;
  protected readonly textureManager: TextureManager;
  protected configuration: TConfig | undefined;
  protected initialized = false;

  protected constructor(dependencies: ProcessorInitializationContext) {
    this.contextManager = dependencies.contextManager;
    this.shaderManager = dependencies.shaderManager;
    this.framebufferManager = dependencies.framebufferManager;
    this.textureManager = dependencies.textureManager;
  }

  /**
   * Initialize the processor.
   */
  abstract initialize(config?: TConfig): void;

  /**
   * Execute a render pass and return the resulting texture.
   */
  abstract render(params: ProcessorRenderParams, config?: TConfig): WebGLTexture | null;

  /**
   * Release GPU resources held by the processor.
   */
  abstract cleanup(): void;

  protected getGLOrThrow(): WebGL2RenderingContext {
    const gl = this.contextManager.getContext();

    if (!gl) {
      throw new Error('WEBGL_CONTEXT_NOT_INITIALIZED');
    }

    return gl;
  }

  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('PROCESSOR_NOT_INITIALIZED');
    }
  }
}


