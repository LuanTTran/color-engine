// Adapted from aesthetikk/hooks/use-color-engine.ts (LUT store + cache bridge removed)

'use client';

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { ColorEngine } from '@/lib/color-engine';
import type { ToneCurvesParams, FixedCurvePoint } from '@/lib/color-engine/types/effects';
import { interpolateFixedCurve } from '@/lib/utils/curve-interpolation';
import { useColorEngineEffectsStore } from '../05-zustand-effects/color-engine-effects-store';
import { useAdvancedEffectsStore } from '../05-zustand-effects/advanced-effects-store';

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

const hashFixedCurvePoints = (points: FixedCurvePoint[]): string =>
  points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('|');

export interface UseColorEngineExcerptParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  colorEngine: ColorEngine | null;
  originalImage: HTMLImageElement | null;
  isWebGLReady: boolean;
  /** Optional LUT already loaded via `loadLutTexture` — no IndexedDB bridge in this repo. */
  lutTexture?: WebGLTexture | null;
}

export const useColorEngineExcerpt = ({
  canvasRef,
  colorEngine,
  originalImage,
  isWebGLReady,
  lutTexture = null,
}: UseColorEngineExcerptParams) => {
  const [isApplying, setIsApplying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const adjustments = useColorEngineEffectsStore((state) => state.adjustments);
  const grain = useColorEngineEffectsStore((state) => state.grain);
  const bloom = useColorEngineEffectsStore((state) => state.bloom);
  const diffusion = useColorEngineEffectsStore((state) => state.diffusion);
  const chromatic = useColorEngineEffectsStore((state) => state.chromatic);
  const vignette = useColorEngineEffectsStore((state) => state.vignette);

  const toneCurvesEnabled = useAdvancedEffectsStore((state) => state.toneCurves.enabled);
  const luminancePoints = useAdvancedEffectsStore((state) => state.toneCurves.luminancePoints);
  const clarity = useAdvancedEffectsStore((state) => state.clarity);
  const filmFade = useAdvancedEffectsStore((state) => state.filmFade);
  const spectrum = useAdvancedEffectsStore((state) => state.spectrum);

  const curveHash = useMemo(() => {
    if (!toneCurvesEnabled) return '';
    return hashFixedCurvePoints(luminancePoints);
  }, [toneCurvesEnabled, luminancePoints]);

  const memoizedCurve = useMemo(() => {
    if (!toneCurvesEnabled) return null;
    return { luminanceCurve: interpolateFixedCurve(luminancePoints) };
  }, [curveHash, toneCurvesEnabled, luminancePoints]);

  const toneCurvesParams = useMemo((): ToneCurvesParams | undefined => {
    if (!toneCurvesEnabled || !memoizedCurve) return undefined;
    return { enabled: toneCurvesEnabled, ...memoizedCurve };
  }, [toneCurvesEnabled, memoizedCurve]);

  const drawImageToCanvas = useCallback(
    async (img: HTMLImageElement, lut?: WebGLTexture) => {
      if (!canvasRef.current || !colorEngine) return;

      const gl = colorEngine.getWebGLContext();
      if (!gl) return;

      const imageData = imageElementToImageData(img);
      const imageTexture = colorEngine.createTextureFromImageData(imageData, { flipY: true });
      if (!imageTexture) return;

      const effects = {
        adjustments,
        grain,
        bloom,
        diffusion,
        chromatic,
        vignette,
        ...(toneCurvesParams && { toneCurves: toneCurvesParams }),
        ...(clarity.enabled && { clarity }),
        ...(filmFade.enabled && { filmFade }),
        ...(spectrum.enabled && { spectrum }),
      };

      const result = colorEngine.applyEffects({
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        inputTexture: imageTexture,
        effects,
        lutTexture: lut ?? null,
        lutIntensity: 1,
      });

      if (result.outputTexture) {
        colorEngine.renderTextureToCanvas(result.outputTexture);
      }

      colorEngine.deleteTexture(imageTexture);
    },
    [
      canvasRef,
      colorEngine,
      adjustments,
      grain,
      bloom,
      diffusion,
      chromatic,
      vignette,
      toneCurvesParams,
      clarity,
      filmFade,
      spectrum,
    ]
  );

  const applyCurrentEffects = useCallback(async () => {
    if (!originalImage || !colorEngine || !isWebGLReady) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsApplying(true);
    try {
      if (abortController.signal.aborted) return;
      await drawImageToCanvas(originalImage, lutTexture ?? undefined);
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('[COLOR-ENGINE] Error applying effects:', error);
      }
    } finally {
      if (abortControllerRef.current === abortController && !abortController.signal.aborted) {
        setIsApplying(false);
      }
    }
  }, [originalImage, isWebGLReady, colorEngine, drawImageToCanvas, lutTexture]);

  const applyCurrentEffectsRef = useRef(applyCurrentEffects);
  useEffect(() => {
    applyCurrentEffectsRef.current = applyCurrentEffects;
  });

  const rafIdRef = useRef<number | null>(null);
  const pendingApplyRef = useRef(false);

  const scheduleApplyEffects = useCallback(() => {
    pendingApplyRef.current = true;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (pendingApplyRef.current) {
          pendingApplyRef.current = false;
          applyCurrentEffectsRef.current();
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!originalImage || !colorEngine || !isWebGLReady) return;
    scheduleApplyEffects();
  }, [
    originalImage,
    colorEngine,
    isWebGLReady,
    lutTexture,
    adjustments,
    grain,
    bloom,
    diffusion,
    chromatic,
    vignette,
    toneCurvesParams,
    clarity,
    filmFade,
    spectrum,
    scheduleApplyEffects,
  ]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  return { isApplying, applyCurrentEffects, drawImageToCanvas, scheduleApplyEffects };
};
