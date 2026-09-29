import type {
  BaseProcessor,
  ProcessorInitializationContext,
  ProcessorRenderParams,
} from '../processors/base-processor';

export type ProcessorId =
  | 'lut'
  | 'adjustments'
  | 'grain'
  | 'bloom'
  | 'diffusion'
  | 'chromatic'
  | 'vignette'
  | 'tone-curves'
  | 'spectrum'
  | 'film-fade'
  | 'clarity';

export type ProcessorFactory<TProcessor extends BaseProcessor<any>> = (
  context: ProcessorInitializationContext
) => TProcessor;

export interface ProcessorRegistryEntry<TProcessor extends BaseProcessor<any> = BaseProcessor<any>, TConfig = undefined> {
  id: ProcessorId;
  create: ProcessorFactory<TProcessor>;
  initialize?: (processor: TProcessor, config: TConfig) => void;
  render?: (processor: TProcessor, params: ProcessorRenderParams, config: TConfig) => WebGLTexture | null;
}

export interface ProcessorExecutionResult {
  texture: WebGLTexture | null;
  framebuffer?: WebGLFramebuffer | null;
}


