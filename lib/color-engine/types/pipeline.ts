import type { EffectsParams, FullEffectsParams } from './effects';
import type { BaseProcessor } from '../processors/base-processor';
import type { ProcessorFactory, ProcessorId } from './processors';

export interface PipelineExecutionParams {
  width: number;
  height: number;
  inputTexture: WebGLTexture;
  effects: FullEffectsParams;
  lutTexture?: WebGLTexture | null;
  lutIntensity?: number;
  lutSize?: number;
  customGeometry?: {
    vertices: Float32Array;
    textureCoords: Float32Array;
  } | null;
}

export interface PipelineStageContext {
  effects: FullEffectsParams;
  options: PipelineExecutionParams;
}

export interface PipelineStage<TProcessor extends BaseProcessor<any>, TConfig = void> {
  id: ProcessorId;
  order: number;
  createProcessor: ProcessorFactory<TProcessor>;
  isEnabled: (context: PipelineStageContext) => boolean;
  configResolver?: (context: PipelineStageContext) => TConfig;
}

export interface PipelineResult {
  outputTexture: WebGLTexture | null;
  outputFramebuffer?: WebGLFramebuffer | null;
}


