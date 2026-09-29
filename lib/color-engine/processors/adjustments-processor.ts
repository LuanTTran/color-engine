import adjustmentsFragmentShader from '@/lib/color-engine/shaders/basic-adjustments.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

const ADJUSTMENTS_EPSILON = 1e-4;

type AdjustmentsConfig = {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
};

interface AdjustmentsUniformLocations {
  image: WebGLUniformLocation | null;
  brightness: WebGLUniformLocation | null;
  contrast: WebGLUniformLocation | null;
  saturation: WebGLUniformLocation | null;
  exposure: WebGLUniformLocation | null;
}

export class AdjustmentsProcessor extends BaseProcessor<AdjustmentsConfig> {
  private programKey = 'color-engine/adjustments';
  private programInfo: { program: WebGLProgram; uniforms: AdjustmentsUniformLocations } | null = null;
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
      adjustmentsFragmentShader,
      ['u_image', 'u_brightness', 'u_contrast', 'u_saturation', 'u_exposure']
    );

    if (!programInfo) {
      console.error('[WEBGL][ADJUSTMENTS] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][ADJUSTMENTS] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][ADJUSTMENTS] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.programInfo = {
      program: programInfo.program,
      uniforms: {
        image: programInfo.uniforms.u_image ?? null,
        brightness: programInfo.uniforms.u_brightness ?? null,
        contrast: programInfo.uniforms.u_contrast ?? null,
        saturation: programInfo.uniforms.u_saturation ?? null,
        exposure: programInfo.uniforms.u_exposure ?? null,
      },
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: AdjustmentsConfig): WebGLTexture | null {
    this.ensureInitialized();

    if (!config) {
      return params.inputTexture;
    }

    const brightness = config.brightness ?? 0;
    const contrast = config.contrast ?? 0;
    const saturation = config.saturation ?? 0;
    const exposure = config.exposure ?? 0;

    if (
      Math.abs(brightness) <= ADJUSTMENTS_EPSILON &&
      Math.abs(contrast) <= ADJUSTMENTS_EPSILON &&
      Math.abs(saturation) <= ADJUSTMENTS_EPSILON &&
      Math.abs(exposure) <= ADJUSTMENTS_EPSILON
    ) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.programInfo || !this.attributeLocations || !this.quadBuffer) {
      return params.inputTexture;
    }

    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram(this.programKey);

    if (!activeProgram) {
      return params.inputTexture;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (this.programInfo.uniforms.image) {
      gl.uniform1i(this.programInfo.uniforms.image, 0);
    }

    if (this.programInfo.uniforms.brightness) {
      gl.uniform1f(this.programInfo.uniforms.brightness, brightness);
    }

    if (this.programInfo.uniforms.contrast) {
      gl.uniform1f(this.programInfo.uniforms.contrast, contrast);
    }

    if (this.programInfo.uniforms.saturation) {
      gl.uniform1f(this.programInfo.uniforms.saturation, saturation);
    }

    if (this.programInfo.uniforms.exposure) {
      gl.uniform1f(this.programInfo.uniforms.exposure, exposure);
    }

    this.bindQuad(gl);
    this.drawQuad(gl);
    this.unbindQuad(gl);

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
    this.shaderManager.deleteProgram(this.programKey);
    this.initialized = false;
  }

  private bindQuad(gl: WebGL2RenderingContext): void {
    if (!this.quadBuffer || !this.attributeLocations) {
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

