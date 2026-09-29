import type { FullEffectsParams } from '../types/effects';
import type { FramebufferResource } from '../core/framebuffer-manager';
import type { FramebufferManager } from '../core/framebuffer-manager';
import type { ShaderManager } from '../core/shader-manager';
import type { TextureManager } from '../core/texture-manager';
import type { WebGLContextManager } from '../core/webgl-context';
import type { BaseProcessor } from '../processors/base-processor';
import type { PipelineExecutionParams, PipelineResult, PipelineStage } from '../types/pipeline';
import { createDefaultPipelineStages } from './pipeline-config';

interface EffectsPipelineDependencies {
  contextManager: WebGLContextManager;
  shaderManager: ShaderManager;
  framebufferManager: FramebufferManager;
  textureManager: TextureManager;
}

export class EffectsPipeline {
  private readonly contextManager: WebGLContextManager;
  private readonly shaderManager: ShaderManager;
  private readonly framebufferManager: FramebufferManager;
  private readonly textureManager: TextureManager;
  private readonly stages: PipelineStage<BaseProcessor<any>, any>[];
  private readonly processors = new Map<string, BaseProcessor<any>>();
  private initialized = false;

  constructor(dependencies: EffectsPipelineDependencies) {
    this.contextManager = dependencies.contextManager;
    this.shaderManager = dependencies.shaderManager;
    this.framebufferManager = dependencies.framebufferManager;
    this.textureManager = dependencies.textureManager;
    this.stages = createDefaultPipelineStages({
      contextManager: this.contextManager,
      shaderManager: this.shaderManager,
      framebufferManager: this.framebufferManager,
      textureManager: this.textureManager,
    }) as PipelineStage<BaseProcessor<any>, any>[];
  }

  execute(params: PipelineExecutionParams): PipelineResult {
    this.ensureInitialized();

    const gl = this.contextManager.getContext();

    if (!gl) {
      console.error('[WEBGL][PIPELINE] Missing WebGL context.');
      return { outputTexture: null };
    }

    let currentTexture: WebGLTexture | null = params.inputTexture;
    const effectParams: FullEffectsParams = params.effects;

    for (const stage of this.stages) {
      const processor = this.processors.get(stage.id);

      if (!processor) {
        console.warn(`[WEBGL][PIPELINE] No processor found for stage: ${stage.id}`);
        continue;
      }

      const enabled = stage.isEnabled({ effects: effectParams, options: params });

      if (!enabled) {
        continue;
      }

      const config = stage.configResolver?.({ effects: effectParams, options: params });

      const framebufferResource = this.getFramebufferResource(stage.id, params.width, params.height);

      if (!framebufferResource || !currentTexture) {
        console.error(`[WEBGL][PIPELINE] Failed to get framebuffer for stage: ${stage.id}`);
        continue;
      }

      const resultTexture = processor.render(
        {
          inputTexture: currentTexture,
          width: params.width,
          height: params.height,
          outputFramebuffer: framebufferResource.framebuffer,
          outputTexture: framebufferResource.texture,
        },
        config
      );

      this.framebufferManager.releaseFramebuffer();

      currentTexture = resultTexture ?? framebufferResource.texture;
    }

    return {
      outputTexture: currentTexture ?? null,
    };
  }

  cleanup(): void {
    for (const processor of this.processors.values()) {
      processor.cleanup();
    }

    this.processors.clear();
    this.framebufferManager.cleanup();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    for (const stage of this.stages) {
      const processor = stage.createProcessor({
        contextManager: this.contextManager,
        shaderManager: this.shaderManager,
        framebufferManager: this.framebufferManager,
        textureManager: this.textureManager,
      });

      processor.initialize();
      this.processors.set(stage.id, processor);
    }

    this.initialized = true;
  }

  private getFramebufferResource(
    key: string,
    width: number,
    height: number
  ): FramebufferResource | null {
    const resource = this.framebufferManager.getFramebuffer(key, width, height);

    if (!resource) {
      console.error(`[WEBGL][PIPELINE] Failed to acquire framebuffer for stage ${key}.`);
      return null;
    }

    this.framebufferManager.bindFramebuffer(key, width, height);
    return resource;
  }
}


