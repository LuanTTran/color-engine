// Adapted from aesthetikk/lib/color-engine/index.ts (`loadLutTexture`)

import type { ColorEngine } from '@/lib/color-engine';
import { DEFAULT_EFFECTS_PARAMS } from '@/lib/color-engine/types/effects';

/**
 * Load a LUT from raw bytes (e.g. PNG cube export).
 * Production Aesthetikk uses IndexedDB + `LutCacheBridge` in the main app only —
 * this reference repo does not ship `lut-cache.ts` / catalog APIs.
 */
export const loadLutFromArrayBuffer = async (
  engine: ColorEngine,
  lutBuffer: ArrayBuffer
): Promise<WebGLTexture | null> => {
  if (lutBuffer.byteLength === 0) {
    throw new Error('LUT buffer is empty');
  }

  const lutTexture = await engine.loadLutTexture(lutBuffer);
  return lutTexture;
};

export const applyImageWithLut = async (
  engine: ColorEngine,
  inputTexture: WebGLTexture,
  width: number,
  height: number,
  lutTexture: WebGLTexture,
  lutSize = 512
) => {
  return engine.applyEffects({
    width,
    height,
    inputTexture,
    effects: DEFAULT_EFFECTS_PARAMS,
    lutTexture,
    lutIntensity: 1,
    lutSize,
  });
};
