import fragmentShaderSource from '@/lib/webgl/shaders/fragment.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';

interface LutCustomGeometry {
  vertices: Float32Array;
  textureCoords: Float32Array;
}

export interface LutProcessorConfig {
  lutTexture: WebGLTexture;
  intensity?: number;
  lutSize?: number;
  customGeometry?: LutCustomGeometry | null;
}

interface LutUniforms {
  image: WebGLUniformLocation | null;
  lut: WebGLUniformLocation | null;
  lutSize: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
}

export class LutProcessor extends BaseProcessor<LutProcessorConfig> {
  private programInfo: { program: WebGLProgram; uniforms: LutUniforms } | null = null;
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
      'color-engine/lut',
      vertexShaderSource,
      fragmentShaderSource,
      ['u_image', 'u_lut', 'u_lutSize', 'u_intensity']
    );

    if (!programInfo) {
      console.error('[WEBGL][LUT] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][LUT] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][LUT] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.programInfo = {
      program: programInfo.program,
      uniforms: {
        image: programInfo.uniforms.u_image ?? null,
        lut: programInfo.uniforms.u_lut ?? null,
        lutSize: programInfo.uniforms.u_lutSize ?? null,
        intensity: programInfo.uniforms.u_intensity ?? null,
      },
    };
    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };
    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: LutProcessorConfig): WebGLTexture | null {
    this.ensureInitialized();

    if (!config || !config.lutTexture) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.programInfo || !this.attributeLocations) {
      return params.inputTexture;
    }

    const { uniforms } = this.programInfo;
    const intensity = Math.max(0, Math.min(1, config.intensity ?? 1));
    const lutSize = config.lutSize ?? 512;

    if (params.outputFramebuffer) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, params.outputFramebuffer);
    }

    gl.viewport(0, 0, params.width, params.height);

    const activeProgram = this.shaderManager.useProgram('color-engine/lut');

    if (!activeProgram) {
      return params.inputTexture;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    if (uniforms.image) {
      gl.uniform1i(uniforms.image, 0);
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, config.lutTexture);

    if (uniforms.lut) {
      gl.uniform1i(uniforms.lut, 1);
    }

    if (uniforms.lutSize) {
      gl.uniform1f(uniforms.lutSize, lutSize);
    }

    if (uniforms.intensity) {
      gl.uniform1f(uniforms.intensity, intensity);
    }

    if (config.customGeometry) {
      this.renderWithCustomGeometry(config.customGeometry);
    } else {
      this.renderWithDefaultQuad();
    }

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
    this.programInfo = null;
    this.shaderManager.deleteProgram('color-engine/lut');
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

  private renderWithCustomGeometry(geometry: LutCustomGeometry): void {
    const gl = this.getGLOrThrow();
    const { vertices, textureCoords } = geometry;

    const vertexBuffer = gl.createBuffer();
    const texCoordBuffer = gl.createBuffer();

    if (!vertexBuffer || !texCoordBuffer || !this.attributeLocations) {
      if (vertexBuffer && gl.isBuffer(vertexBuffer)) {
        gl.deleteBuffer(vertexBuffer);
      }
      if (texCoordBuffer && gl.isBuffer(texCoordBuffer)) {
        gl.deleteBuffer(texCoordBuffer);
      }
      return;
    }

    try {
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.attributeLocations.position);
      gl.vertexAttribPointer(this.attributeLocations.position, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, textureCoords, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(this.attributeLocations.texCoord);
      gl.vertexAttribPointer(this.attributeLocations.texCoord, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
    } finally {
      gl.disableVertexAttribArray(this.attributeLocations.position);
      gl.disableVertexAttribArray(this.attributeLocations.texCoord);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(texCoordBuffer);
    }
  }
}


