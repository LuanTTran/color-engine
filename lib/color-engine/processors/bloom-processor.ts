import bloomCompositeShaderSource from '@/lib/color-engine/shaders/bloom-composite.glsl';
import bloomExtractShaderSource from '@/lib/color-engine/shaders/bloom-extract.glsl';
import kawaseBlurShaderSource from '@/lib/color-engine/shaders/kawase-blur.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { FramebufferResource } from '../core/framebuffer-manager';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

type BloomConfig = {
  enabled: boolean;
  intensity: number;
  threshold: number;
  colorTemperature: number;
};

interface ExtractUniforms {
  image: WebGLUniformLocation | null;
  threshold: WebGLUniformLocation | null;
}

interface KawaseBlurUniforms {
  image: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  offset: WebGLUniformLocation | null;
  apertureShape: WebGLUniformLocation | null;
  anamorphicRatio: WebGLUniformLocation | null;
}

interface CompositeUniforms {
  originalImage: WebGLUniformLocation | null;
  bloomImage: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  colorTemperature: WebGLUniformLocation | null;
}

// Default to circular (0) aperture shape internally
const DEFAULT_APERTURE_SHAPE = 0;

// Kawase blur iteration offsets - each pass uses increasing offset
// More iterations = larger blur radius
const KAWASE_OFFSETS = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0];
const KAWASE_ITERATIONS = 5;

export class BloomProcessor extends BaseProcessor<BloomConfig> {
  private quadBuffer: WebGLBuffer | null = null;
  private attributeLocations: { position: number; texCoord: number } | null = null;

  private extractProgramKey = 'color-engine/bloom/extract';
  private extractUniforms: ExtractUniforms | null = null;

  private kawaseProgramKey = 'color-engine/bloom/kawase';
  private kawaseUniforms: KawaseBlurUniforms | null = null;

  private compositeProgramKey = 'color-engine/bloom/composite';
  private compositeUniforms: CompositeUniforms | null = null;

  constructor(context: ProcessorInitializationContext) {
    super(context);
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const gl = this.getGLOrThrow();

    const extractProgramInfo = this.shaderManager.createProgram(
      this.extractProgramKey,
      vertexShaderSource,
      bloomExtractShaderSource,
      ['u_image', 'u_threshold']
    );

    if (!extractProgramInfo) {
      console.error('[WEBGL][BLOOM] Failed to create extract shader program.');
      return;
    }

    const kawaseProgramInfo = this.shaderManager.createProgram(
      this.kawaseProgramKey,
      vertexShaderSource,
      kawaseBlurShaderSource,
      ['u_image', 'u_resolution', 'u_offset', 'u_apertureShape', 'u_anamorphicRatio']
    );

    if (!kawaseProgramInfo) {
      console.error('[WEBGL][BLOOM] Failed to create Kawase blur shader program.');
      return;
    }

    const compositeProgramInfo = this.shaderManager.createProgram(
      this.compositeProgramKey,
      vertexShaderSource,
      bloomCompositeShaderSource,
      ['u_originalImage', 'u_bloomImage', 'u_intensity', 'u_colorTemperature']
    );

    if (!compositeProgramInfo) {
      console.error('[WEBGL][BLOOM] Failed to create composite shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(extractProgramInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(extractProgramInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][BLOOM] Failed to resolve attribute locations.');
      return;
    }

    const quadVertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
      1.0, -1.0, 1.0, 0.0,
      -1.0, 1.0, 0.0, 1.0,
      -1.0, 1.0, 0.0, 1.0,
      1.0, -1.0, 1.0, 0.0,
      1.0, 1.0, 1.0, 1.0,
    ]);

    const buffer = gl.createBuffer();

    if (!buffer) {
      console.error('[WEBGL][BLOOM] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.extractUniforms = {
      image: extractProgramInfo.uniforms.u_image ?? null,
      threshold: extractProgramInfo.uniforms.u_threshold ?? null,
    };

    this.kawaseUniforms = {
      image: kawaseProgramInfo.uniforms.u_image ?? null,
      resolution: kawaseProgramInfo.uniforms.u_resolution ?? null,
      offset: kawaseProgramInfo.uniforms.u_offset ?? null,
      apertureShape: kawaseProgramInfo.uniforms.u_apertureShape ?? null,
      anamorphicRatio: kawaseProgramInfo.uniforms.u_anamorphicRatio ?? null,
    };

    this.compositeUniforms = {
      originalImage: compositeProgramInfo.uniforms.u_originalImage ?? null,
      bloomImage: compositeProgramInfo.uniforms.u_bloomImage ?? null,
      intensity: compositeProgramInfo.uniforms.u_intensity ?? null,
      colorTemperature: compositeProgramInfo.uniforms.u_colorTemperature ?? null,
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: BloomConfig): WebGLTexture | null {
    this.ensureInitialized();

    if (!config || !config.enabled || config.intensity <= 0) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.attributeLocations || !this.quadBuffer || !this.extractUniforms || !this.kawaseUniforms || !this.compositeUniforms) {
      return params.inputTexture;
    }

    const intensity = Math.max(0, Math.min(1, config.intensity));
    const threshold = Math.max(0.5, Math.min(1, config.threshold));
    const colorTemperature = Math.max(-1, Math.min(1, config.colorTemperature));

    // Step 1: Extract bright pixels
    const extractResource = this.bindFramebufferResource('bloom_extract', params.width, params.height);

    if (!extractResource) {
      return params.inputTexture;
    }

    this.runExtractPass({
      gl,
      inputTexture: params.inputTexture,
      framebuffer: extractResource,
      width: params.width,
      height: params.height,
      threshold,
    });

    // Step 2: Multi-pass Kawase blur with ping-pong
    let currentTexture = extractResource.texture;
    let pingPong = 0;

    for (let i = 0; i < KAWASE_ITERATIONS; i++) {
      const blurKey = `bloom_kawase_${pingPong}`;
      const blurResource = this.bindFramebufferResource(blurKey, params.width, params.height);

      if (!blurResource) {
        this.framebufferManager.releaseFramebuffer();
        return params.inputTexture;
      }

      this.runKawasePass({
        gl,
        inputTexture: currentTexture,
        framebuffer: blurResource,
        width: params.width,
        height: params.height,
        offset: KAWASE_OFFSETS[i + 1], // Start from offset 1.0
      });

      currentTexture = blurResource.texture;
      pingPong = 1 - pingPong; // Toggle between 0 and 1
    }

    this.framebufferManager.releaseFramebuffer();

    // Step 3: Composite bloom with original
    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram(this.compositeProgramKey);

    if (!activeProgram) {
      return params.inputTexture;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (this.compositeUniforms.originalImage) {
      gl.uniform1i(this.compositeUniforms.originalImage, 0);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);

    if (this.compositeUniforms.bloomImage) {
      gl.uniform1i(this.compositeUniforms.bloomImage, 1);
    }

    if (this.compositeUniforms.intensity) {
      gl.uniform1f(this.compositeUniforms.intensity, intensity);
    }

    if (this.compositeUniforms.colorTemperature) {
      gl.uniform1f(this.compositeUniforms.colorTemperature, colorTemperature);
    }

    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return params.outputTexture ?? params.inputTexture;
  }

  cleanup(): void {
    const gl = this.contextManager.getContext();

    if (gl && this.quadBuffer && gl.isBuffer(this.quadBuffer)) {
      gl.deleteBuffer(this.quadBuffer);
    }

    this.quadBuffer = null;
    this.attributeLocations = null;
    this.extractUniforms = null;
    this.kawaseUniforms = null;
    this.compositeUniforms = null;
    this.shaderManager.deleteProgram(this.extractProgramKey);
    this.shaderManager.deleteProgram(this.kawaseProgramKey);
    this.shaderManager.deleteProgram(this.compositeProgramKey);
    this.initialized = false;
  }

  private bindFramebufferResource(
    key: string,
    width: number,
    height: number
  ): FramebufferResource | null {
    const resource = this.framebufferManager.bindFramebuffer(key, width, height);

    if (!resource) {
      console.error(`[WEBGL][BLOOM] Failed to bind framebuffer ${key}.`);
    }

    return resource;
  }

  private runExtractPass(params: {
    gl: WebGL2RenderingContext;
    inputTexture: WebGLTexture;
    framebuffer: FramebufferResource;
    width: number;
    height: number;
    threshold: number;
  }): void {
    const { gl, inputTexture, framebuffer, width, height, threshold } = params;

    const activeProgram = this.shaderManager.useProgram(this.extractProgramKey);

    if (!activeProgram || !this.extractUniforms) {
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);

    if (this.extractUniforms.image) {
      gl.uniform1i(this.extractUniforms.image, 0);
    }

    if (this.extractUniforms.threshold) {
      gl.uniform1f(this.extractUniforms.threshold, threshold);
    }

    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private runKawasePass(params: {
    gl: WebGL2RenderingContext;
    inputTexture: WebGLTexture;
    framebuffer: FramebufferResource;
    width: number;
    height: number;
    offset: number;
  }): void {
    const { gl, inputTexture, framebuffer, width, height, offset } = params;

    const activeProgram = this.shaderManager.useProgram(this.kawaseProgramKey);

    if (!activeProgram || !this.kawaseUniforms) {
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);

    if (this.kawaseUniforms.image) {
      gl.uniform1i(this.kawaseUniforms.image, 0);
    }

    if (this.kawaseUniforms.resolution) {
      gl.uniform2f(this.kawaseUniforms.resolution, width, height);
    }

    if (this.kawaseUniforms.offset) {
      gl.uniform1f(this.kawaseUniforms.offset, offset);
    }

    if (this.kawaseUniforms.apertureShape) {
      gl.uniform1i(this.kawaseUniforms.apertureShape, DEFAULT_APERTURE_SHAPE);
    }

    if (this.kawaseUniforms.anamorphicRatio) {
      // 2:1 horizontal stretch for anamorphic
      gl.uniform1f(this.kawaseUniforms.anamorphicRatio, 2.0);
    }

    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private bindQuad(gl: WebGL2RenderingContext): void {
    if (!this.attributeLocations || !this.quadBuffer) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.attributeLocations.position);
    gl.vertexAttribPointer(this.attributeLocations.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.attributeLocations.texCoord);
    gl.vertexAttribPointer(this.attributeLocations.texCoord, 2, gl.FLOAT, false, 16, 8);
  }

  private unbindQuad(gl: WebGL2RenderingContext): void {
    if (!this.attributeLocations) {
      return;
    }

    gl.disableVertexAttribArray(this.attributeLocations.position);
    gl.disableVertexAttribArray(this.attributeLocations.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private drawQuad(gl: WebGL2RenderingContext): void {
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
