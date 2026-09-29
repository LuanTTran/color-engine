import filmFadeFragmentShader from '@/lib/color-engine/shaders/film-fade.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';
import type { FilmFadeParams } from '@/lib/color-engine/types/effects';

interface FilmFadeUniformLocations {
  image: WebGLUniformLocation | null;
  fadeAmount: WebGLUniformLocation | null;
  tintColor: WebGLUniformLocation | null;
}

export class FilmFadeProcessor extends BaseProcessor<FilmFadeParams> {
  private programKey = 'color-engine/film-fade';
  private programInfo: { program: WebGLProgram; uniforms: FilmFadeUniformLocations } | null = null;
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
      filmFadeFragmentShader,
      ['u_image', 'u_fadeAmount', 'u_tintColor']
    );

    if (!programInfo) {
      console.error('[WEBGL][FILM-FADE] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][FILM-FADE] Failed to resolve attribute locations.');
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
      console.error('[WEBGL][FILM-FADE] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.programInfo = {
      program: programInfo.program,
      uniforms: {
        image: programInfo.uniforms.u_image ?? null,
        fadeAmount: programInfo.uniforms.u_fadeAmount ?? null,
        tintColor: programInfo.uniforms.u_tintColor ?? null,
      },
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: FilmFadeParams): WebGLTexture | null {
    this.ensureInitialized();

    // Early exit if effect is disabled or has no effect
    if (!config || !config.enabled || config.fadeAmount <= 0) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.programInfo || !this.attributeLocations || !this.quadBuffer) {
      return params.inputTexture;
    }

    // Bind output framebuffer
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

    // Bind input texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    // Set uniforms
    if (this.programInfo.uniforms.image) {
      gl.uniform1i(this.programInfo.uniforms.image, 0);
    }

    if (this.programInfo.uniforms.fadeAmount) {
      gl.uniform1f(this.programInfo.uniforms.fadeAmount, config.fadeAmount);
    }

    if (this.programInfo.uniforms.tintColor) {
      gl.uniform3f(
        this.programInfo.uniforms.tintColor,
        config.tintColor.r,
        config.tintColor.g,
        config.tintColor.b
      );
    }

    // Draw quad
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
