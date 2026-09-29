import chromaticShaderSource from '@/lib/color-engine/shaders/chromatic.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { ChromaticParams } from '../types/effects';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

type ChromaticProcessorConfig = ChromaticParams;

interface ChromaticUniforms {
  image: WebGLUniformLocation | null;
  redOffset: WebGLUniformLocation | null;
  blueOffset: WebGLUniformLocation | null;
}

export class ChromaticProcessor extends BaseProcessor<ChromaticProcessorConfig> {
  private programKey = 'color-engine/chromatic';
  private uniforms: ChromaticUniforms | null = null;
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
      chromaticShaderSource,
      ['u_image', 'u_redOffset', 'u_blueOffset']
    );

    if (!programInfo) {
      console.error('[WEBGL][CHROMATIC] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][CHROMATIC] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][CHROMATIC] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.uniforms = {
      image: programInfo.uniforms.u_image ?? null,
      redOffset: programInfo.uniforms.u_redOffset ?? null,
      blueOffset: programInfo.uniforms.u_blueOffset ?? null,
    };
    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };
    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: ChromaticProcessorConfig): WebGLTexture | null {
    this.ensureInitialized();

    // Skip if not enabled or both offsets are zero
    if (!config || !config.enabled || (config.redOffset === 0 && config.blueOffset === 0)) {
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

    if (this.uniforms.redOffset) {
      gl.uniform1f(this.uniforms.redOffset, Math.max(-1, Math.min(1, config.redOffset)));
    }

    if (this.uniforms.blueOffset) {
      gl.uniform1f(this.uniforms.blueOffset, Math.max(-1, Math.min(1, config.blueOffset)));
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
