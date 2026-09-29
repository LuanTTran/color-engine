/** Optional app-provided LUT cache (see aesthetikk/lib/webgl/lut-cache-bridge.ts). */
export interface LutCacheBridge {
  loadLutTexture(
    lutId: string,
    colorEngine: import('../index').ColorEngine
  ): Promise<WebGLTexture | null>;
}
