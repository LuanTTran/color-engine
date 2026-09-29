import grainShaderSource from '@/lib/webgl/shaders/grain.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { GrainParams } from '../types/effects';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

type GrainProcessorConfig = GrainParams;

interface GrainUniforms {
  image: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  size: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
}

export class GrainProcessor extends BaseProcessor<GrainProcessorConfig> {
  private programInfo: { program: WebGLProgram; uniforms: GrainUniforms } | null = null;
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
      'color-engine/grain',
      vertexShaderSource,
      grainShaderSource,
      ['u_image', 'u_grainIntensity', 'u_grainSize', 'u_time']
    );

    if (!programInfo) {
      console.error('[WEBGL][GRAIN] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][GRAIN] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][GRAIN] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.programInfo = {
      program: programInfo.program,
      uniforms: {
        image: programInfo.uniforms.u_image ?? null,
        intensity: programInfo.uniforms.u_grainIntensity ?? null,
        size: programInfo.uniforms.u_grainSize ?? null,
        time: programInfo.uniforms.u_time ?? null,
      },
    };
    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };
    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: GrainProcessorConfig): WebGLTexture | null {
    this.ensureInitialized();

    if (!config || !config.enabled || config.intensity <= 0) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.programInfo || !this.attributeLocations) {
      return params.inputTexture;
    }

    const { uniforms } = this.programInfo;

    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram('color-engine/grain');

    if (!activeProgram) {
      return params.inputTexture;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (uniforms.image) {
      gl.uniform1i(uniforms.image, 0);
    }

    if (uniforms.intensity) {
      gl.uniform1f(uniforms.intensity, Math.max(0, Math.min(1, config.intensity)));
    }

    if (uniforms.size) {
      gl.uniform1f(uniforms.size, Math.max(1, Math.min(5, config.size)));
    }

    if (uniforms.time) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      gl.uniform1f(uniforms.time, now / 1000);
    }

    this.renderWithDefaultQuad();

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
    this.programInfo = null;
    this.shaderManager.deleteProgram('color-engine/grain');
    this.initialized = false;
  }

  private renderWithDefaultQuad(): void {
    if (!this.quadBuffer || !this.attributeLocations) {
      return;
    }

    const gl = this.getGLOrThrow();

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


