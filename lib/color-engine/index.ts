import type { LutCacheBridge } from './types/lut-cache';
import { createFramebufferManager } from './core/framebuffer-manager';
import type { FramebufferManager } from './core/framebuffer-manager';
import { createShaderManager } from './core/shader-manager';
import type { ShaderManager } from './core/shader-manager';
import { createTextureManager } from './core/texture-manager';
import type { TextureCreationOptions, TextureManager } from './core/texture-manager';
import { createWebGLContextManager } from './core/webgl-context';
import type { WebGLContextManager } from './core/webgl-context';
import { EffectsPipeline } from './pipeline/effects-pipeline';
import type { PipelineExecutionParams, PipelineResult } from './types/pipeline';
import {
  DEFAULT_ADJUSTMENTS_PARAMS,
  DEFAULT_BLOOM_PARAMS,
  DEFAULT_CHROMATIC_PARAMS,
  DEFAULT_CLARITY_PARAMS,
  DEFAULT_DIFFUSION_PARAMS,
  DEFAULT_EFFECTS_PARAMS,
  DEFAULT_FILM_FADE_PARAMS,
  DEFAULT_GRAIN_PARAMS,
  DEFAULT_SPECTRUM_PARAMS,
  DEFAULT_VIGNETTE_PARAMS,
  type AdjustmentsParams,
  type BloomParams,
  type ChromaticParams,
  type ClarityParams,
  type DiffusionParams,
  type EffectsParams,
  type FilmFadeParams,
  type FullEffectsParams,
  type GrainParams,
  type SpectrumParams,
  type ToneCurvesParams,
  type VignetteParams,
} from './types/effects';

export interface ColorEngineInitializationOptions {
  canvas: HTMLCanvasElement;
  label?: string;
  lutCache?: LutCacheBridge | null;
}

export interface ColorEngineApplyParams {
  width: number;
  height: number;
  inputTexture: WebGLTexture;
  effects: FullEffectsParams | PartialEffectsInput;
  lutTexture?: WebGLTexture | null;
  lutIntensity?: number;
  lutSize?: number;
  customGeometry?: PipelineExecutionParams['customGeometry'];
}

export interface PartialEffectsInput {
  adjustments?: Partial<AdjustmentsParams>;
  grain?: Partial<GrainParams>;
  bloom?: Partial<BloomParams>;
  diffusion?: Partial<DiffusionParams>;
  chromatic?: Partial<ChromaticParams>;
  vignette?: Partial<VignetteParams>;
  // Advanced effects (optional)
  toneCurves?: ToneCurvesParams;
  clarity?: ClarityParams;
  filmFade?: FilmFadeParams;
  spectrum?: SpectrumParams;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const clampRange = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export class ColorEngine {
  private readonly contextManager: WebGLContextManager;
  private readonly shaderManager: ShaderManager;
  private readonly framebufferManager: FramebufferManager;
  private readonly textureManager: TextureManager;
  private pipeline: EffectsPipeline | null = null;
  private lutCache: LutCacheBridge | null = null;
  private initialized = false;
  private exportTextures = new Set<WebGLTexture>();

  constructor() {
    this.contextManager = createWebGLContextManager();
    this.shaderManager = createShaderManager(this.contextManager);
    this.framebufferManager = createFramebufferManager(this.contextManager);
    this.textureManager = createTextureManager(this.contextManager);
  }

  initialize(options: ColorEngineInitializationOptions): void {
    const { canvas, label, lutCache } = options;

    if (!canvas) {
      throw new Error('COLOR_ENGINE_INIT_NO_CANVAS');
    }

    const gl = this.contextManager.initialize(canvas, {
      alpha: true,
      desynchronized: true,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
      antialias: true,
      label,
    });

    if (!gl) {
      throw new Error('COLOR_ENGINE_WEBGL_UNAVAILABLE');
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.BLEND);

    this.pipeline?.cleanup();
    this.pipeline = new EffectsPipeline({
      contextManager: this.contextManager,
      shaderManager: this.shaderManager,
      framebufferManager: this.framebufferManager,
      textureManager: this.textureManager,
    });

    this.lutCache = lutCache ?? null;
    this.initialized = true;
  }

  applyEffects(params: ColorEngineApplyParams): PipelineResult {
    this.ensureInitialized();

    if (!this.pipeline) {
      throw new Error('COLOR_ENGINE_PIPELINE_MISSING');
    }

    const gl = this.getWebGLContextOrThrow();

    if (!gl.isTexture(params.inputTexture)) {
      throw new Error('COLOR_ENGINE_INVALID_INPUT_TEXTURE');
    }

    if (params.lutTexture && !gl.isTexture(params.lutTexture)) {
      throw new Error('COLOR_ENGINE_INVALID_LUT_TEXTURE');
    }

    const executionParams: PipelineExecutionParams = {
      width: params.width,
      height: params.height,
      inputTexture: params.inputTexture,
      effects: this.sanitizeEffects(params.effects),
      lutTexture: params.lutTexture ?? null,
      lutIntensity: params.lutIntensity,
      lutSize: params.lutSize,
      customGeometry: params.customGeometry ?? null,
    };

    return this.pipeline.execute(executionParams);
  }

  applyLut(
    inputTexture: WebGLTexture,
    lutTexture: WebGLTexture,
    width: number,
    height: number,
    intensity = 1
  ): PipelineResult {
    return this.applyEffects({
      width,
      height,
      inputTexture,
      effects: DEFAULT_EFFECTS_PARAMS,
      lutTexture,
      lutIntensity: clamp01(intensity),
    });
  }

  applyEffectsPipeline(
    inputTexture: WebGLTexture,
    width: number,
    height: number,
    effects: PartialEffectsInput,
    lutTexture: WebGLTexture | null,
    intensity = 1
  ): PipelineResult {
    return this.applyEffects({
      width,
      height,
      inputTexture,
      effects,
      lutTexture,
      lutIntensity: clamp01(intensity),
    });
  }

  renderTextureToCanvas(texture: WebGLTexture): void {
    this.ensureInitialized();

    if (!this.pipeline) {
      throw new Error('COLOR_ENGINE_PIPELINE_MISSING');
    }

    const gl = this.getWebGLContextOrThrow();

    if (!gl.isTexture(texture)) {
      throw new Error('COLOR_ENGINE_INVALID_TEXTURE');
    }

    const canvasSize = this.getCanvasSize();
    if (!canvasSize) {
      console.error('[COLOR-ENGINE] Canvas size not available');
      return;
    }

    // Bind to canvas (null framebuffer) and set viewport
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasSize.width, canvasSize.height);

    // Use the shader manager to get the LUT program
    const program = this.shaderManager.useProgram('color-engine/lut');
    if (!program) {
      console.error('[COLOR-ENGINE] LUT shader program not available for canvas rendering');
      return;
    }

    // Bind the texture to render
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Get uniform locations and set them
    const imageUniform = gl.getUniformLocation(program, 'u_image');
    const intensityUniform = gl.getUniformLocation(program, 'u_intensity');
    
    if (imageUniform) {
      gl.uniform1i(imageUniform, 0);
    }
    
    // Set intensity to 0 for passthrough (no LUT applied)
    if (intensityUniform) {
      gl.uniform1f(intensityUniform, 0.0);
    }

    // Get attribute locations
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');

    // Create a simple quad for rendering
    // Standard texture coordinates (no flip in shader, so we flip here)
    const quadVertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,  // bottom-left
       1.0, -1.0, 1.0, 0.0,  // bottom-right
      -1.0,  1.0, 0.0, 1.0,  // top-left
      -1.0,  1.0, 0.0, 1.0,  // top-left
       1.0, -1.0, 1.0, 0.0,  // bottom-right
       1.0,  1.0, 1.0, 1.0,  // top-right
    ]);

    const buffer = gl.createBuffer();
    if (!buffer) {
      console.error('[COLOR-ENGINE] Failed to create buffer for canvas rendering');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

    // Set up vertex attributes
    if (positionLocation >= 0) {
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    }

    if (texCoordLocation >= 0) {
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    }

    // Draw the quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Cleanup
    if (positionLocation >= 0) {
      gl.disableVertexAttribArray(positionLocation);
    }
    if (texCoordLocation >= 0) {
      gl.disableVertexAttribArray(texCoordLocation);
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteBuffer(buffer);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  createTextureFromImageData(imageData: ImageData, options?: TextureCreationOptions): WebGLTexture | null {
    this.ensureInitialized();

    return this.textureManager.createFromImageData(imageData, undefined, options);
  }

  createTextureFromImage(element: HTMLImageElement, options?: TextureCreationOptions): WebGLTexture | null {
    this.ensureInitialized();

    return this.textureManager.loadFromImageElement(element, undefined, options);
  }

  deleteTexture(texture: WebGLTexture | null | undefined): void {
    if (!texture) {
      return;
    }

    this.textureManager.deleteTextureDirect(texture);
    this.exportTextures.delete(texture);
  }

  async loadLutTexture(buffer: ArrayBuffer): Promise<WebGLTexture | null> {
    this.ensureInitialized();

    if (buffer.byteLength === 0) {
      throw new Error('COLOR_ENGINE_EMPTY_LUT_BUFFER');
    }

    const gl = this.getWebGLContextOrThrow();
    const blob = new Blob([buffer], { type: 'image/png' });
    const image = new Image();

    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);

      image.onload = () => {
        const texture = this.textureManager.loadFromImageElement(image, undefined, {
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.CLAMP_TO_EDGE,
          wrapT: gl.CLAMP_TO_EDGE,
          flipY: false,
        });

        URL.revokeObjectURL(url);
        resolve(texture);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      image.src = url;
    });
  }

  async loadCachedLutTexture(lutId: string): Promise<WebGLTexture | null> {
    this.ensureInitialized();

    if (!this.lutCache) {
      throw new Error('COLOR_ENGINE_LUT_CACHE_UNAVAILABLE');
    }

    return this.lutCache.loadLutTexture(lutId, this);
  }

  markTextureForExport(texture: WebGLTexture | null | undefined): void {
    if (!texture) {
      return;
    }

    this.exportTextures.add(texture);
  }

  cleanupExportResources(): void {
    if (this.exportTextures.size === 0) {
      return;
    }

    const gl = this.getWebGLContextOrThrow();

    for (const texture of this.exportTextures) {
      if (gl.isTexture(texture)) {
        gl.deleteTexture(texture);
      }
    }

    this.exportTextures.clear();
  }

  cleanup(): void {
    this.pipeline?.cleanup();
    this.pipeline = null;
    this.cleanupExportResources();
    this.shaderManager.cleanup();
    this.framebufferManager.cleanup();
    this.textureManager.cleanup();
    this.contextManager.destroy();
    this.lutCache = null;
    this.initialized = false;
  }

  getWebGLContext(): WebGL2RenderingContext | null {
    return this.contextManager.getContext();
  }

  getTextureManager(): TextureManager {
    return this.textureManager;
  }

  getFramebufferManager(): FramebufferManager {
    return this.framebufferManager;
  }

  getCanvasSize(): { width: number; height: number } | null {
    return this.contextManager.getCanvasSize();
  }

  resize(width: number, height: number): void {
    this.contextManager.resize(width, height);
  }

  isContextLost(): boolean {
    return this.contextManager.isContextLost();
  }

  private sanitizeEffects(effects: FullEffectsParams | PartialEffectsInput): FullEffectsParams {
    const baseEffects: EffectsParams = {
      adjustments: this.clampAdjustments(effects.adjustments),
      grain: this.clampGrain(effects.grain),
      bloom: this.clampBloom(effects.bloom),
      diffusion: this.clampDiffusion(effects.diffusion),
      chromatic: this.clampChromatic(effects.chromatic),
      vignette: this.clampVignette(effects.vignette),
    };

    // Include advanced effects if present (with sanitization)
    const advancedEffects: Partial<FullEffectsParams> = {};

    if (effects.toneCurves) {
      advancedEffects.toneCurves = this.clampToneCurves(effects.toneCurves);
    }

    if (effects.clarity) {
      advancedEffects.clarity = this.clampClarity(effects.clarity);
    }

    if (effects.filmFade) {
      advancedEffects.filmFade = this.clampFilmFade(effects.filmFade);
    }

    if (effects.spectrum) {
      advancedEffects.spectrum = this.clampSpectrum(effects.spectrum);
    }

    return {
      ...baseEffects,
      ...advancedEffects,
    };
  }

  private clampAdjustments(adjustments?: Partial<AdjustmentsParams>): AdjustmentsParams {
    const source = adjustments ?? DEFAULT_ADJUSTMENTS_PARAMS;

    return {
      brightness: clampRange(source.brightness ?? DEFAULT_ADJUSTMENTS_PARAMS.brightness, -1, 1),
      contrast: clampRange(source.contrast ?? DEFAULT_ADJUSTMENTS_PARAMS.contrast, -1, 1),
      saturation: clampRange(source.saturation ?? DEFAULT_ADJUSTMENTS_PARAMS.saturation, -1, 1),
      exposure: clampRange(source.exposure ?? DEFAULT_ADJUSTMENTS_PARAMS.exposure, -1, 1),
    };
  }

  private clampGrain(grain?: Partial<GrainParams>): GrainParams {
    const source = grain ?? DEFAULT_GRAIN_PARAMS;

    return {
      enabled: Boolean(source.enabled ?? DEFAULT_GRAIN_PARAMS.enabled),
      intensity: clamp01(source.intensity ?? DEFAULT_GRAIN_PARAMS.intensity),
      size: clampRange(source.size ?? DEFAULT_GRAIN_PARAMS.size, 1, 5),
    };
  }

  private clampBloom(bloom?: Partial<BloomParams>): BloomParams {
    const source = bloom ?? DEFAULT_BLOOM_PARAMS;

    return {
      enabled: Boolean(source.enabled ?? DEFAULT_BLOOM_PARAMS.enabled),
      intensity: clamp01(source.intensity ?? DEFAULT_BLOOM_PARAMS.intensity),
      threshold: clampRange(source.threshold ?? DEFAULT_BLOOM_PARAMS.threshold, 0.5, 1),
      colorTemperature: clampRange(source.colorTemperature ?? DEFAULT_BLOOM_PARAMS.colorTemperature, -1, 1),
    };
  }

  private clampDiffusion(diffusion?: Partial<DiffusionParams>): DiffusionParams {
    const source = diffusion ?? DEFAULT_DIFFUSION_PARAMS;

    return {
      enabled: Boolean(source.enabled ?? DEFAULT_DIFFUSION_PARAMS.enabled),
      intensity: clamp01(source.intensity ?? DEFAULT_DIFFUSION_PARAMS.intensity),
      highlightGlow: clamp01(source.highlightGlow ?? DEFAULT_DIFFUSION_PARAMS.highlightGlow),
      softness: clamp01(source.softness ?? DEFAULT_DIFFUSION_PARAMS.softness),
    };
  }

  private clampChromatic(chromatic?: Partial<ChromaticParams>): ChromaticParams {
    const source = chromatic ?? DEFAULT_CHROMATIC_PARAMS;

    return {
      enabled: Boolean(source.enabled ?? DEFAULT_CHROMATIC_PARAMS.enabled),
      redOffset: clampRange(source.redOffset ?? DEFAULT_CHROMATIC_PARAMS.redOffset, -1, 1),
      blueOffset: clampRange(source.blueOffset ?? DEFAULT_CHROMATIC_PARAMS.blueOffset, -1, 1),
    };
  }

  private clampVignette(vignette?: Partial<VignetteParams>): VignetteParams {
    const source = vignette ?? DEFAULT_VIGNETTE_PARAMS;

    return {
      enabled: Boolean(source.enabled ?? DEFAULT_VIGNETTE_PARAMS.enabled),
      radius: clamp01(source.radius ?? DEFAULT_VIGNETTE_PARAMS.radius),
      smoothness: clamp01(source.smoothness ?? DEFAULT_VIGNETTE_PARAMS.smoothness),
    };
  }

  private clampToneCurves(toneCurves: ToneCurvesParams): ToneCurvesParams {
    // ToneCurves uses Float32Array which is already validated by the store
    // We just ensure the enabled flag is valid
    return {
      enabled: Boolean(toneCurves.enabled),
      luminanceCurve: toneCurves.luminanceCurve,
    };
  }

  private clampClarity(clarity: Partial<ClarityParams>): ClarityParams {
    return {
      enabled: Boolean(clarity.enabled ?? DEFAULT_CLARITY_PARAMS.enabled),
      intensity: clamp01(clarity.intensity ?? DEFAULT_CLARITY_PARAMS.intensity),
      radius: clampRange(clarity.radius ?? DEFAULT_CLARITY_PARAMS.radius, 0.5, 3),
      threshold: clamp01(clarity.threshold ?? DEFAULT_CLARITY_PARAMS.threshold),
    };
  }

  private clampFilmFade(filmFade: Partial<FilmFadeParams>): FilmFadeParams {
    const tintColor = filmFade.tintColor ?? DEFAULT_FILM_FADE_PARAMS.tintColor;

    return {
      enabled: Boolean(filmFade.enabled ?? DEFAULT_FILM_FADE_PARAMS.enabled),
      fadeAmount: clamp01(filmFade.fadeAmount ?? DEFAULT_FILM_FADE_PARAMS.fadeAmount),
      tintColor: {
        r: clamp01(tintColor.r),
        g: clamp01(tintColor.g),
        b: clamp01(tintColor.b),
      },
    };
  }

  private clampSpectrum(spectrum: Partial<SpectrumParams>): SpectrumParams {
    const spatialVolume = spectrum.spatialVolume ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume;
    const spectralBalance = spectrum.spectralBalance ?? DEFAULT_SPECTRUM_PARAMS.spectralBalance;

    return {
      enabled: Boolean(spectrum.enabled ?? DEFAULT_SPECTRUM_PARAMS.enabled),
      spatialVolume: {
        shadows: {
          hue: clamp01(spatialVolume.shadows?.hue ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.shadows.hue),
          saturation: clampRange(spatialVolume.shadows?.saturation ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.shadows.saturation, -1, 1),
          strength: clamp01(spatialVolume.shadows?.strength ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.shadows.strength),
        },
        midtones: {
          hue: clamp01(spatialVolume.midtones?.hue ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.midtones.hue),
          saturation: clampRange(spatialVolume.midtones?.saturation ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.midtones.saturation, -1, 1),
          strength: clamp01(spatialVolume.midtones?.strength ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.midtones.strength),
        },
        highlights: {
          hue: clamp01(spatialVolume.highlights?.hue ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.highlights.hue),
          saturation: clampRange(spatialVolume.highlights?.saturation ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.highlights.saturation, -1, 1),
          strength: clamp01(spatialVolume.highlights?.strength ?? DEFAULT_SPECTRUM_PARAMS.spatialVolume.highlights.strength),
        },
      },
      spectralBalance: {
        hueShift: clampRange(spectralBalance.hueShift ?? DEFAULT_SPECTRUM_PARAMS.spectralBalance.hueShift, -1, 1),
        saturationShift: clampRange(spectralBalance.saturationShift ?? DEFAULT_SPECTRUM_PARAMS.spectralBalance.saturationShift, -1, 1),
      },
    };
  }

  private ensureInitialized(): void {
    if (this.initialized) {
      return;
    }

    throw new Error('COLOR_ENGINE_NOT_INITIALIZED');
  }

  private getWebGLContextOrThrow(): WebGL2RenderingContext {
    const gl = this.contextManager.getContext();

    if (!gl) {
      throw new Error('COLOR_ENGINE_CONTEXT_NOT_READY');
    }

    return gl;
  }
}

