import diffusionBlurShaderSource from '@/lib/color-engine/shaders/diffusion-blur.glsl';
import diffusionCompositeShaderSource from '@/lib/color-engine/shaders/diffusion-composite.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { FramebufferResource } from '../core/framebuffer-manager';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

type DiffusionConfig = {
  enabled: boolean;
  intensity: number;
  highlightGlow: number;
  softness: number;
};

interface BlurUniforms {
  image: WebGLUniformLocation | null;
  blurDirection: WebGLUniformLocation | null;
  blurRadius: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
}

interface CompositeUniforms {
  originalImage: WebGLUniformLocation | null;
  blurredImage: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  highlightGlow: WebGLUniformLocation | null;
  softness: WebGLUniformLocation | null;
}

export class DiffusionProcessor extends BaseProcessor<DiffusionConfig> {
  private quadBuffer: WebGLBuffer | null = null;
  private attributeLocations: { position: number; texCoord: number } | null = null;

  private blurProgramKey = 'color-engine/diffusion/blur';
  private blurUniforms: BlurUniforms | null = null;

  private compositeProgramKey = 'color-engine/diffusion/composite';
  private compositeUniforms: CompositeUniforms | null = null;

  constructor(context: ProcessorInitializationContext) {
    super(context);
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const gl = this.getGLOrThrow();

    const blurProgramInfo = this.shaderManager.createProgram(
      this.blurProgramKey,
      vertexShaderSource,
      diffusionBlurShaderSource,
      ['u_image', 'u_blurDirection', 'u_blurRadius', 'u_resolution']
    );

    if (!blurProgramInfo) {
      console.error('[WEBGL][DIFFUSION] Failed to create blur shader program.');
      return;
    }

    const compositeProgramInfo = this.shaderManager.createProgram(
      this.compositeProgramKey,
      vertexShaderSource,
      diffusionCompositeShaderSource,
      ['u_originalImage', 'u_blurredImage', 'u_intensity', 'u_highlightGlow', 'u_softness']
    );

    if (!compositeProgramInfo) {
      console.error('[WEBGL][DIFFUSION] Failed to create composite shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(blurProgramInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(blurProgramInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][DIFFUSION] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][DIFFUSION] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.blurUniforms = {
      image: blurProgramInfo.uniforms.u_image ?? null,
      blurDirection: blurProgramInfo.uniforms.u_blurDirection ?? null,
      blurRadius: blurProgramInfo.uniforms.u_blurRadius ?? null,
      resolution: blurProgramInfo.uniforms.u_resolution ?? null,
    };

    this.compositeUniforms = {
      originalImage: compositeProgramInfo.uniforms.u_originalImage ?? null,
      blurredImage: compositeProgramInfo.uniforms.u_blurredImage ?? null,
      intensity: compositeProgramInfo.uniforms.u_intensity ?? null,
      highlightGlow: compositeProgramInfo.uniforms.u_highlightGlow ?? null,
      softness: compositeProgramInfo.uniforms.u_softness ?? null,
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: DiffusionConfig): WebGLTexture | null {
    this.ensureInitialized();

    if (!config || !config.enabled || config.intensity <= 0) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.attributeLocations || !this.quadBuffer || !this.blurUniforms || !this.compositeUniforms) {
      return params.inputTexture;
    }

    const blurRadius = 1 + Math.max(0, Math.min(1, config.softness)) * 9;

    const horizontalResource = this.bindFramebufferResource('diffusion_blur_h', params.width, params.height);

    if (!horizontalResource) {
      return params.inputTexture;
    }

    this.runBlurPass({
      gl,
      inputTexture: params.inputTexture,
      framebufferKey: 'diffusion_blur_h',
      framebuffer: horizontalResource,
      width: params.width,
      height: params.height,
      direction: [1, 0],
      radius: blurRadius,
    });

    const verticalResource = this.bindFramebufferResource('diffusion_blur_v', params.width, params.height);

    if (!verticalResource) {
      this.framebufferManager.releaseFramebuffer();
      return params.inputTexture;
    }

    this.runBlurPass({
      gl,
      inputTexture: horizontalResource.texture,
      framebufferKey: 'diffusion_blur_v',
      framebuffer: verticalResource,
      width: params.width,
      height: params.height,
      direction: [0, 1],
      radius: blurRadius,
    });

    this.framebufferManager.releaseFramebuffer();

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
    gl.bindTexture(gl.TEXTURE_2D, verticalResource.texture);

    if (this.compositeUniforms.blurredImage) {
      gl.uniform1i(this.compositeUniforms.blurredImage, 1);
    }

    if (this.compositeUniforms.intensity) {
      gl.uniform1f(this.compositeUniforms.intensity, Math.max(0, Math.min(1, config.intensity)));
    }

    if (this.compositeUniforms.highlightGlow) {
      gl.uniform1f(this.compositeUniforms.highlightGlow, Math.max(0, Math.min(1, config.highlightGlow)));
    }

    if (this.compositeUniforms.softness) {
      gl.uniform1f(this.compositeUniforms.softness, Math.max(0, Math.min(1, config.softness)));
    }

    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return params.outputTexture ?? verticalResource.texture;
  }

  cleanup(): void {
    const gl = this.contextManager.getContext();

    if (gl && this.quadBuffer && gl.isBuffer(this.quadBuffer)) {
      gl.deleteBuffer(this.quadBuffer);
    }

    this.quadBuffer = null;
    this.attributeLocations = null;
    this.blurUniforms = null;
    this.compositeUniforms = null;
    this.shaderManager.deleteProgram(this.blurProgramKey);
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
      console.error(`[WEBGL][DIFFUSION] Failed to bind framebuffer ${key}.`);
    }

    return resource;
  }

  private runBlurPass(params: {
    gl: WebGL2RenderingContext;
    inputTexture: WebGLTexture;
    framebufferKey: string;
    framebuffer: FramebufferResource;
    width: number;
    height: number;
    direction: [number, number];
    radius: number;
  }): void {
    const { gl, inputTexture, framebuffer, width, height, direction, radius } = params;

    const activeProgram = this.shaderManager.useProgram(this.blurProgramKey);

    if (!activeProgram || !this.blurUniforms) {
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
    gl.viewport(0, 0, width, height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTexture);

    if (this.blurUniforms.image) {
      gl.uniform1i(this.blurUniforms.image, 0);
    }

    if (this.blurUniforms.blurDirection) {
      gl.uniform2f(this.blurUniforms.blurDirection, direction[0], direction[1]);
    }

    if (this.blurUniforms.blurRadius) {
      gl.uniform1f(this.blurUniforms.blurRadius, radius);
    }

    if (this.blurUniforms.resolution) {
      gl.uniform2f(this.blurUniforms.resolution, width, height);
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

