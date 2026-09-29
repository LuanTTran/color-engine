// Adapted from aesthetikk/lib/color-engine/index.ts and editor init patterns

import { ColorEngine } from '@/lib/color-engine';
import {
  DEFAULT_ADJUSTMENTS_PARAMS,
  DEFAULT_EFFECTS_PARAMS,
  type FullEffectsParams,
} from '@/lib/color-engine/types/effects';

const imageElementToImageData = (img: HTMLImageElement): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D context unavailable');
  }
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export const initColorEngineOnCanvas = (canvas: HTMLCanvasElement): ColorEngine => {
  const engine = new ColorEngine();
  engine.initialize({ canvas, label: 'color-engine-example' });
  return engine;
};

export const applyDefaultEffectsToImage = async (
  engine: ColorEngine,
  canvas: HTMLCanvasElement,
  imageUrl: string
): Promise<void> => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load image'));
    el.src = imageUrl;
  });

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const imageData = imageElementToImageData(img);
  const inputTexture = engine.createTextureFromImageData(imageData, { flipY: true });
  if (!inputTexture) {
    throw new Error('Failed to upload image to GPU');
  }

  const effects: FullEffectsParams = {
    ...DEFAULT_EFFECTS_PARAMS,
    adjustments: {
      ...DEFAULT_ADJUSTMENTS_PARAMS,
      exposure: 0.05,
    },
  };

  const result = engine.applyEffects({
    width: canvas.width,
    height: canvas.height,
    inputTexture,
    effects,
    lutTexture: null,
    lutIntensity: 1,
  });

  if (result.outputTexture) {
    engine.renderTextureToCanvas(result.outputTexture);
  }

  engine.deleteTexture(inputTexture);
};
