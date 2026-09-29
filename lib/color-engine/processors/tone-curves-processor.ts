import toneCurvesFragmentShader from '@/lib/color-engine/shaders/tone-curves.glsl';
import vertexShaderSource from '@/lib/webgl/shaders/vertex.glsl';
import type { ProcessorInitializationContext, ProcessorRenderParams } from './base-processor';
import { BaseProcessor } from './base-processor';
import type { ToneCurvesParams } from '@/lib/color-engine/types/effects';

interface ToneCurvesUniformLocations {
  image: WebGLUniformLocation | null;
  curveLUT: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
}

/**
 * Tone Curves Processor
 * 
 * Applies tone curve adjustments using a 256x1 1D LUT texture.
 * Uses a single luminance curve that adjusts brightness while preserving color ratios.
 * The curve is controlled by 6 fixed points at predefined tonal positions.
 */
export class ToneCurvesProcessor extends BaseProcessor<ToneCurvesParams> {
  private programKey = 'color-engine/tone-curves';
  private programInfo: { program: WebGLProgram; uniforms: ToneCurvesUniformLocations } | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private attributeLocations: { position: number; texCoord: number } | null = null;
  private curveLUTTexture: WebGLTexture | null = null;
  
  // Cache to detect when curve needs updating
  private lastCurveHash: string = '';

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
      toneCurvesFragmentShader,
      ['u_image', 'u_curveLUT', 'u_intensity']
    );

    if (!programInfo) {
      console.error('[WEBGL][TONE-CURVES] Failed to create shader program.');
      return;
    }

    const positionLocation = gl.getAttribLocation(programInfo.program, 'a_position');
    const texCoordLocation = gl.getAttribLocation(programInfo.program, 'a_texCoord');

    if (positionLocation < 0 || texCoordLocation < 0) {
      console.error('[WEBGL][TONE-CURVES] Failed to resolve attribute locations.');
      return;
    }

    // Create quad buffer
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
      console.error('[WEBGL][TONE-CURVES] Failed to create quad buffer.');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // Create LUT texture (256x1, R8 format) - single luminance curve
    const lutTexture = gl.createTexture();
    if (!lutTexture) {
      console.error('[WEBGL][TONE-CURVES] Failed to create LUT texture.');
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, lutTexture);
    // Initialize with identity curve (256x1 pixels, R8 format)
    const identityData = this.createIdentityLUTData();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 1, 0, gl.RED, gl.UNSIGNED_BYTE, identityData);
    
    // Use LINEAR filtering for smooth curve interpolation
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.programInfo = {
      program: programInfo.program,
      uniforms: {
        image: programInfo.uniforms.u_image ?? null,
        curveLUT: programInfo.uniforms.u_curveLUT ?? null,
        intensity: programInfo.uniforms.u_intensity ?? null,
      },
    };

    this.attributeLocations = {
      position: positionLocation,
      texCoord: texCoordLocation,
    };

    this.quadBuffer = buffer;
    this.curveLUTTexture = lutTexture;
    this.initialized = true;
  }

  render(params: ProcessorRenderParams, config?: ToneCurvesParams): WebGLTexture | null {
    this.ensureInitialized();

    // Early exit if effect is disabled
    if (!config || !config.enabled) {
      return params.inputTexture;
    }

    const gl = this.getGLOrThrow();

    if (!this.programInfo || !this.attributeLocations || !this.quadBuffer || !this.curveLUTTexture) {
      return params.inputTexture;
    }

    // Update LUT texture if curve has changed
    this.updateCurveLUT(gl, config);

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

    // Bind input texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, params.inputTexture);

    // Bind LUT texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveLUTTexture);

    // Set uniforms
    if (this.programInfo.uniforms.image) {
      gl.uniform1i(this.programInfo.uniforms.image, 0);
    }

    if (this.programInfo.uniforms.curveLUT) {
      gl.uniform1i(this.programInfo.uniforms.curveLUT, 1);
    }

    if (this.programInfo.uniforms.intensity) {
      // Always use full intensity (1.0) - curve points provide full control
      gl.uniform1f(this.programInfo.uniforms.intensity, 1.0);
    }

    // Draw quad
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

    if (gl) {
      if (this.quadBuffer && gl.isBuffer(this.quadBuffer)) {
        gl.deleteBuffer(this.quadBuffer);
      }
      if (this.curveLUTTexture && gl.isTexture(this.curveLUTTexture)) {
        gl.deleteTexture(this.curveLUTTexture);
      }
    }

    this.quadBuffer = null;
    this.curveLUTTexture = null;
    this.attributeLocations = null;
    this.programInfo = null;
    this.lastCurveHash = '';
    this.shaderManager.deleteProgram(this.programKey);
    this.initialized = false;
  }

  /**
   * Create identity LUT data (input = output)
   */
  private createIdentityLUTData(): Uint8Array {
    const data = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      data[i] = i;
    }
    return data;
  }

  /**
   * Update the LUT texture with current curve data
   */
  private updateCurveLUT(gl: WebGL2RenderingContext, config: ToneCurvesParams): void {
    // Generate hash to check if update is needed
    const curveHash = this.generateCurveHash(config);
    if (curveHash === this.lastCurveHash) {
      return;
    }

    // Pack luminance curve into 256x1 texture
    const data = new Uint8Array(256);

    // Convert Float32Array (0-1) to Uint8Array (0-255)
    for (let i = 0; i < 256; i++) {
      const value = Math.max(0, Math.min(1, config.luminanceCurve[i]));
      data[i] = Math.round(value * 255);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.curveLUTTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.lastCurveHash = curveHash;
  }

  /**
   * Generate a hash string from curve data for change detection
   */
  private generateCurveHash(config: ToneCurvesParams): string {
    // Sample values from the curve for quick comparison
    const sampleIndices = [0, 51, 102, 153, 204, 255]; // Corresponds to 6 tonal zones
    const samples: number[] = [];
    
    for (const idx of sampleIndices) {
      samples.push(config.luminanceCurve[idx]);
    }
    
    return samples.map(v => v.toFixed(4)).join(',');
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
