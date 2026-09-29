import clarityBlurShaderSource from '@/lib/color-engine/shaders/clarity-blur.glsl';
import clarityUnsharpShaderSource from '@/lib/color-engine/shaders/clarity-unsharp.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { FramebufferResource } from '../core/framebuffer-manager';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';
import type { ClarityParams } from '@/lib/color-engine/types/effects';

interface BlurUniformLocations {
  image: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  direction: WebGLUniformLocation | null;
  radius: WebGLUniformLocation | null;
}

interface UnsharpUniformLocations {
  originalImage: WebGLUniformLocation | null;
  blurredImage: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  threshold: WebGLUniformLocation | null;
}

export class ClarityProcessor extends BaseProcessor<ClarityParams> {
  private blurProgramKey = 'color-engine/clarity/blur';
  private unsharpProgramKey = 'color-engine/clarity/unsharp';
  
  private blurUniforms: BlurUniformLocations | null = null;
  private unsharpUniforms: UnsharpUniformLocations | null = null;
  
  private quadBuffer: WebGLBuffer | null = null;
  private attributeLocations: { position: number; texCoord: number } | null = null;

  constructor(context: ProcessorInitializationContext) {
    super(context);
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    const gl = this.getGLOrThrow();

    // Create blur shader program
    const blurProgramInfo = this.shaderManager.createProgram(
      this.blurProgramKey,
      vertexShaderSource,
      clarityBlurShaderSource,
      ['u_image', 'u_resolution', 'u_direction', 'u_radius']
    );

    if (!blurProgramInfo) {
      console.error('[WEBGL][CLARITY] Failed to create blur shader program.');
      return;
    }

    // Create unsharp mask shader program
    const unsharpProgramInfo = this.shaderManager.createProgram(
      this.unsharpProgramKey,
      vertexShaderSource,
      clarityUnsharpShaderSource,
      ['u_originalImage', 'u_blurredImage', 'u_intensity', 'u_threshold']
    );

    if (!unsharpProgramInfo) {
      console.error('[WEBGL][CLARITY] Failed to create unsharp shader program.');
      return;
    }

    // Get attribute locations from blur program (same for both)
    const positionLocation = gl.getAttribLocation(blurProgramInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(blurProgramInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][CLARITY] Failed to resolve attribute locations.');
      return;
    }

    // Create quad buffer
    const quadVertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
       1.0, -1.0, 1.0, 0.0,
      -1.0,  1.0, 0.0, 1.0,
      -1.0,  1.0, 0.0, 1.0,
       1.0, -1.0, 1.0, 0.0,
       1.0,  1.0, 1.0, 1.0,
    ]);

    const buffer = gl.createBuffer();

    if (!buffer) {
      console.error('[WEBGL][CLARITY] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Store uniform locations
    this.blurUniforms = {
      image: blurProgramInfo.uniforms.u_image ?? null,
      resolution: blurProgramInfo.uniforms.u_resolution ?? null,
      direction: blurProgramInfo.uniforms.u_direction ?? null,
      radius: blurProgramInfo.uniforms.u_radius ?? null,
    };

    this.unsharpUniforms = {
      originalImage: unsharpProgramInfo.uniforms.u_originalImage ?? null,
      blurredImage: unsharpProgramInfo.uniforms.u_blurredImage ?? null,
      intensity: unsharpProgramInfo.uniforms.u_intensity ?? null,
      threshold: unsharpProgramInfo.uniforms.u_threshold ?? null,
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: ClarityParams): WebGLTexture | null {
    this.ensureInitialized();

    // Early exit if effect is disabled or has no effect
    if (!config || !config.enabled || config.intensity <= 0) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.blurUniforms || !this.unsharpUniforms || !this.attributeLocations || !this.quadBuffer) {
      return params.inputTexture;
    }

    // Clamp config values
    const intensity = Math.max(0, Math.min(1, config.intensity));
    const radius = Math.max(0.5, Math.min(3, config.radius));
    const threshold = Math.max(0, Math.min(1, config.threshold));

    // Pass 1: Horizontal blur
    const horizontalBlurResource = this.bindFramebufferResource('clarity_blur_h', params.width, params.height);

    if (!horizontalBlurResource) {
      return params.inputTexture;
    }

    this.runBlurPass({
      gl,
      inputTexture: params.inputTexture,
      framebuffer: horizontalBlurResource,
      width: params.width,
      height: params.height,
      direction: [1.0, 0.0], // Horizontal
      radius,
    });

    // Pass 2: Vertical blur
    const verticalBlurResource = this.bindFramebufferResource('clarity_blur_v', params.width, params.height);

    if (!verticalBlurResource) {
      this.framebufferManager.releaseFramebuffer();
      return params.inputTexture;
    }

    this.runBlurPass({
      gl,
      inputTexture: horizontalBlurResource.texture,
      framebuffer: verticalBlurResource,
      width: params.width,
      height: params.height,
      direction: [0.0, 1.0], // Vertical
      radius,
    });

    this.framebufferManager.releaseFramebuffer();

    // Pass 3: Unsharp mask (combine original with blurred)
    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram(this.unsharpProgramKey);

    if (!activeProgram) {
      return params.inputTexture;
    }

    // Bind original image to texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (this.unsharpUniforms.originalImage) {
      gl.uniform1i(this.unsharpUniforms.originalImage, 0);
    }

    // Bind blurred image to texture unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, verticalBlurResource.texture);

    if (this.unsharpUniforms.blurredImage) {
      gl.uniform1i(this.unsharpUniforms.blurredImage, 1);
    }

    // Set uniforms
    if (this.unsharpUniforms.intensity) {
      gl.uniform1f(this.unsharpUniforms.intensity, intensity);
    }

    if (this.unsharpUniforms.threshold) {
      gl.uniform1f(this.unsharpUniforms.threshold, threshold);
    }

    // Draw
    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

    // Cleanup texture bindings
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
    this.blurUniforms = null;
    this.unsharpUniforms = null;
    this.shaderManager.deleteProgram(this.blurProgramKey);
    this.shaderManager.deleteProgram(this.unsharpProgramKey);
    this.initialized = false;
  }

  private bindFramebufferResource(
    key: string,
    width: number,
    height: number
  ): FramebufferResource | null {
    const resource = this.framebufferManager.bindFramebuffer(key, width, height);

    if (!resource) {
      console.error(`[WEBGL][CLARITY] Failed to bind framebuffer ${key}.`);
    }

    return resource;
  }

  private runBlurPass(params: {
    gl: WebGL2RenderingContext;
    inputTexture: WebGLTexture;
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

    if (this.blurUniforms.resolution) {
      gl.uniform2f(this.blurUniforms.resolution, width, height);
    }

    if (this.blurUniforms.direction) {
      gl.uniform2f(this.blurUniforms.direction, direction[0], direction[1]);
    }

    if (this.blurUniforms.radius) {
      gl.uniform1f(this.blurUniforms.radius, radius);
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
