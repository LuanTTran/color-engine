import vignetteShaderSource from '@/lib/color-engine/shaders/vignette.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { VignetteParams } from '../types/effects';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

type VignetteProcessorConfig = VignetteParams;

interface VignetteUniforms {
  image: WebGLUniformLocation | null;
  radius: WebGLUniformLocation | null;
  smoothness: WebGLUniformLocation | null;
}

export class VignetteProcessor extends BaseProcessor<VignetteProcessorConfig> {
  private programKey = 'color-engine/vignette';
  private uniforms: VignetteUniforms | null = null;
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
    const programInfo = this.shaderManager.createProgram(
      this.programKey,
      vertexShaderSource,
      vignetteShaderSource,
      ['u_image', 'u_radius', 'u_smoothness']
    );

    if (!programInfo) {
      console.error('[WEBGL][VIGNETTE] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][VIGNETTE] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][VIGNETTE] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.uniforms = {
      image: programInfo.uniforms.u_image ?? null,
      radius: programInfo.uniforms.u_radius ?? null,
      smoothness: programInfo.uniforms.u_smoothness ?? null,
    };
    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };
    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: VignetteProcessorConfig): WebGLTexture | null {
    this.ensureInitialized();

    // Skip if not enabled
    if (!config || !config.enabled) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.uniforms || !this.attributeLocations || !this.quadBuffer) {
      return params.inputTexture;
    }

    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram(this.programKey);

    if (!activeProgram) {
      return params.inputTexture;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (this.uniforms.image) {
      gl.uniform1i(this.uniforms.image, 0);
    }

    if (this.uniforms.radius) {
      gl.uniform1f(this.uniforms.radius, Math.max(0, Math.min(1, config.radius)));
    }

    if (this.uniforms.smoothness) {
      gl.uniform1f(this.uniforms.smoothness, Math.max(0, Math.min(1, config.smoothness)));
    }

    this.renderWithDefaultQuad(gl);

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
    this.uniforms = null;
    this.shaderManager.deleteProgram(this.programKey);
    this.initialized = false;
  }

  private renderWithDefaultQuad(gl: WebGL2RenderingContext): void {
    if (!this.quadBuffer || !this.attributeLocations) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(this.attributeLocations.position);
    gl.vertexAttribPointer(this.attributeLocations.position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(this.attributeLocations.texCoord);
    gl.vertexAttribPointer(this.attributeLocations.texCoord, 2, gl.FLOAT, false, 16, 8);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disableVertexAttribArray(this.attributeLocations.position);
    gl.disableVertexAttribArray(this.attributeLocations.texCoord);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
