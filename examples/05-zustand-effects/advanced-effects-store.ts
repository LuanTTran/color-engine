// Adapted from aesthetikk/lib/stores/advanced-effects-store.ts
'use client';

import { create } from 'zustand';
import type {
  FixedCurvePoint,
  ClarityParams,
  FilmFadeParams,
  SpectrumParams,
  SpectrumTone,
  SpectralBalanceParams,
} from '@/lib/color-engine/types/effects';
import {
  DEFAULT_CLARITY_PARAMS,
  DEFAULT_FILM_FADE_PARAMS,
  DEFAULT_SPECTRUM_PARAMS,
  DEFAULT_SPECTRUM_TONE,
  TONAL_ZONE_POSITIONS,
} from '@/lib/color-engine/types/effects';

// ============================================
// Fixed 6-Point Curve System
// ============================================

/**
 * Get default fixed curve points (linear identity - no effect)
 * Points are at fixed x positions: 0, 20, 40, 60, 80, 100
 */
export const getDefaultFixedCurvePoints = (): FixedCurvePoint[] => [
  { x: TONAL_ZONE_POSITIONS.blacks, y: 0 },
  { x: TONAL_ZONE_POSITIONS.shadows, y: 20 },
  { x: TONAL_ZONE_POSITIONS.darks, y: 40 },
  { x: TONAL_ZONE_POSITIONS.lights, y: 60 },
  { x: TONAL_ZONE_POSITIONS.highlights, y: 80 },
  { x: TONAL_ZONE_POSITIONS.whites, y: 100 },
];

/**
 * Get linear (identity) fixed curve points - alias for reset
 */
export const getLinearFixedCurvePoints = (): FixedCurvePoint[] => getDefaultFixedCurvePoints();

// ============================================
// Store State Types
// ============================================

interface ToneCurvesState {
  enabled: boolean;
  /** Fixed 6-point luminance curve (only y values are adjustable) */
  luminancePoints: FixedCurvePoint[];
}

/** Tonal range keys for Spatial Volume */
type TonalRangeKey = 'shadows' | 'midtones' | 'highlights';

interface AdvancedEffectsState {
  toneCurves: ToneCurvesState;
  clarity: ClarityParams;
  filmFade: FilmFadeParams;
  spectrum: SpectrumParams;
}

interface AdvancedEffectsActions {
  // Tone Curves Actions
  setToneCurvesEnabled: (enabled: boolean) => void;
  /** Update a single point's y value by index (0-5) */
  updateCurvePointY: (index: number, y: number) => void;
  /** Update all points at once */
  setCurvePoints: (points: FixedCurvePoint[]) => void;
  resetCurve: () => void;

  // Clarity Actions
  setClarity: (params: Partial<ClarityParams>) => void;
  resetClarity: () => void;

  // Film Fade Actions
  setFilmFade: (params: Partial<FilmFadeParams>) => void;
  resetFilmFade: () => void;

  // Spectrum Actions
  setSpectrumEnabled: (enabled: boolean) => void;
  setSpatialTone: (toneKey: TonalRangeKey, tone: Partial<SpectrumTone>) => void;
  setSpectralBalance: (params: Partial<SpectralBalanceParams>) => void;
  resetSpectrum: () => void;

  // Global Actions
  resetAll: () => void;
}

type AdvancedEffectsStore = AdvancedEffectsState & AdvancedEffectsActions;

// ============================================
// Helpers
// ============================================

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// ============================================
// Default State
// ============================================

const DEFAULT_TONE_CURVES_STATE: ToneCurvesState = {
  enabled: false,
  luminancePoints: getDefaultFixedCurvePoints(),
};

const DEFAULT_ADVANCED_EFFECTS_STATE: AdvancedEffectsState = {
  toneCurves: { ...DEFAULT_TONE_CURVES_STATE },
  clarity: { ...DEFAULT_CLARITY_PARAMS },
  filmFade: { ...DEFAULT_FILM_FADE_PARAMS },
  spectrum: {
    enabled: DEFAULT_SPECTRUM_PARAMS.enabled,
    spatialVolume: {
      shadows: { ...DEFAULT_SPECTRUM_TONE },
      midtones: { ...DEFAULT_SPECTRUM_TONE },
      highlights: { ...DEFAULT_SPECTRUM_TONE },
    },
    spectralBalance: { ...DEFAULT_SPECTRUM_PARAMS.spectralBalance },
  },
};

// ============================================
// Store
// ============================================

export const useAdvancedEffectsStore = create<AdvancedEffectsStore>((set) => ({
  // Initial State
  ...DEFAULT_ADVANCED_EFFECTS_STATE,

  // ----------------------------------------
  // Tone Curves Actions
  // ----------------------------------------

  setToneCurvesEnabled: (enabled) =>
    set((state) => ({
      toneCurves: { ...state.toneCurves, enabled },
    })),

  updateCurvePointY: (index, y) =>
    set((state) => {
      if (index < 0 || index >= 6) return state;

      const newPoints = state.toneCurves.luminancePoints.map((point, i) =>
        i === index ? { ...point, y: clamp(y, 0, 100) } : point
      );

      return {
        toneCurves: {
          ...state.toneCurves,
          luminancePoints: newPoints,
        },
      };
    }),

  setCurvePoints: (points) =>
    set((state) => {
      // Ensure we always have exactly 6 points with correct x positions
      const validatedPoints = points.map((point, i) => ({
        x: getDefaultFixedCurvePoints()[i].x,
        y: clamp(point.y, 0, 100),
      }));

      return {
        toneCurves: {
          ...state.toneCurves,
          luminancePoints: validatedPoints,
        },
      };
    }),

  resetCurve: () =>
    set((state) => ({
      toneCurves: {
        ...state.toneCurves,
        luminancePoints: getLinearFixedCurvePoints(),
      },
    })),

  // ----------------------------------------
  // Clarity Actions
  // ----------------------------------------

  setClarity: (params) =>
    set((state) => ({
      clarity: {
        enabled: params.enabled ?? state.clarity.enabled,
        intensity: clamp(params.intensity ?? state.clarity.intensity, 0, 1),
        radius: clamp(params.radius ?? state.clarity.radius, 0.5, 3),
        threshold: clamp(params.threshold ?? state.clarity.threshold, 0, 1),
      },
    })),

  resetClarity: () =>
    set({
      clarity: { ...DEFAULT_CLARITY_PARAMS },
    }),

  // ----------------------------------------
  // Film Fade Actions
  // ----------------------------------------

  setFilmFade: (params) =>
    set((state) => ({
      filmFade: {
        enabled: params.enabled ?? state.filmFade.enabled,
        fadeAmount: clamp(params.fadeAmount ?? state.filmFade.fadeAmount, 0, 1),
        tintColor: params.tintColor
          ? {
              r: clamp(params.tintColor.r, 0, 1),
              g: clamp(params.tintColor.g, 0, 1),
              b: clamp(params.tintColor.b, 0, 1),
            }
          : state.filmFade.tintColor,
      },
    })),

  resetFilmFade: () =>
    set({
      filmFade: { ...DEFAULT_FILM_FADE_PARAMS },
    }),

  // ----------------------------------------
  // Spectrum Actions
  // ----------------------------------------

  setSpectrumEnabled: (enabled) =>
    set((state) => ({
      spectrum: { ...state.spectrum, enabled },
    })),

  setSpatialTone: (toneKey, tone) =>
    set((state) => {
      const currentTone = state.spectrum.spatialVolume[toneKey];
      return {
        spectrum: {
          ...state.spectrum,
          spatialVolume: {
            ...state.spectrum.spatialVolume,
            [toneKey]: {
              hue: clamp(tone.hue ?? currentTone.hue, 0, 1),
              saturation: clamp(tone.saturation ?? currentTone.saturation, -1, 1),
              strength: clamp(tone.strength ?? currentTone.strength, 0, 1),
            },
          },
        },
      };
    }),

  setSpectralBalance: (params) =>
    set((state) => ({
      spectrum: {
        ...state.spectrum,
        spectralBalance: {
          hueShift: clamp(
            params.hueShift ?? state.spectrum.spectralBalance.hueShift,
            -1,
            1
          ),
          saturationShift: clamp(
            params.saturationShift ?? state.spectrum.spectralBalance.saturationShift,
            -1,
            1
          ),
        },
      },
    })),

  resetSpectrum: () =>
    set({
      spectrum: {
        enabled: DEFAULT_SPECTRUM_PARAMS.enabled,
        spatialVolume: {
          shadows: { ...DEFAULT_SPECTRUM_TONE },
          midtones: { ...DEFAULT_SPECTRUM_TONE },
          highlights: { ...DEFAULT_SPECTRUM_TONE },
        },
        spectralBalance: { ...DEFAULT_SPECTRUM_PARAMS.spectralBalance },
      },
    }),

  // ----------------------------------------
  // Global Actions
  // ----------------------------------------

  resetAll: () =>
    set({
      toneCurves: {
        ...DEFAULT_TONE_CURVES_STATE,
        luminancePoints: getLinearFixedCurvePoints(),
      },
      clarity: { ...DEFAULT_CLARITY_PARAMS },
      filmFade: { ...DEFAULT_FILM_FADE_PARAMS },
      spectrum: {
        enabled: DEFAULT_SPECTRUM_PARAMS.enabled,
        spatialVolume: {
          shadows: { ...DEFAULT_SPECTRUM_TONE },
          midtones: { ...DEFAULT_SPECTRUM_TONE },
          highlights: { ...DEFAULT_SPECTRUM_TONE },
        },
        spectralBalance: { ...DEFAULT_SPECTRUM_PARAMS.spectralBalance },
      },
    }),
}));

// ============================================
// Selector Hooks (for optimized re-renders)
// ============================================

/** Get current luminance curve points */
export const useLuminancePoints = (): FixedCurvePoint[] => {
  return useAdvancedEffectsStore((state) => state.toneCurves.luminancePoints);
};

/** Check if any advanced effect is active */
export const useHasActiveAdvancedEffect = (): boolean => {
  return useAdvancedEffectsStore((state) => {
    const { toneCurves, clarity, filmFade, spectrum } = state;
    return (
      toneCurves.enabled ||
      (clarity.enabled && clarity.intensity > 0) ||
      (filmFade.enabled && filmFade.fadeAmount > 0) ||
      spectrum.enabled
    );
  });
};
