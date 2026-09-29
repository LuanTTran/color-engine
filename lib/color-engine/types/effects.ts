export interface AdjustmentsParams {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
}

export interface GrainParams {
  enabled: boolean;
  intensity: number;
  size: number;
}

export interface BloomParams {
  enabled: boolean;
  intensity: number;
  threshold: number;
  colorTemperature: number; // -1 (cool) to 1 (warm)
}

export interface DiffusionParams {
  enabled: boolean;
  intensity: number;
  highlightGlow: number;
  softness: number;
}

export interface ChromaticParams {
  enabled: boolean;
  redOffset: number;
  blueOffset: number;
}

export interface VignetteParams {
  enabled: boolean;
  radius: number;
  smoothness: number;
}

// ============================================
// Advanced Effects Types
// ============================================

/**
 * Fixed curve point with predefined x position (tonal zone)
 * Only y (output value) is adjustable by the user
 */
export interface FixedCurvePoint {
  x: number; // Fixed position: 0, 20, 40, 60, 80, 100
  y: number; // 0-100 (output value, adjustable)
}

/**
 * Tonal zone identifiers for the 6 fixed curve points
 */
export type TonalZone = 'blacks' | 'shadows' | 'darks' | 'lights' | 'highlights' | 'whites';

/**
 * Fixed x positions for each tonal zone (0-100 scale)
 */
export const TONAL_ZONE_POSITIONS: Record<TonalZone, number> = {
  blacks: 0,
  shadows: 20,
  darks: 40,
  lights: 60,
  highlights: 80,
  whites: 100,
};

/**
 * Simplified Tone Curves - Single luminance curve with fixed 6 points
 * RGB mapping is derived from dominant colors at runtime
 */
export interface ToneCurvesParams {
  enabled: boolean;
  luminanceCurve: Float32Array; // 256 values (0-1 range)
}

export interface ClarityParams {
  enabled: boolean;
  intensity: number; // 0-1
  radius: number; // 0.5-3.0
  threshold: number; // 0-1
}

export interface FilmFadeParams {
  enabled: boolean;
  fadeAmount: number; // 0-1
  tintColor: { r: number; g: number; b: number }; // 0-1 each
}

// ============================================
// Spectrum Types
// ============================================

/** Individual tone settings for a tonal range (shadows/midtones/highlights) */
export interface SpectrumTone {
  hue: number; // 0-1 (full hue rotation)
  saturation: number; // -1 to 1 (decrease/increase)
  strength: number; // 0-1 (effect intensity)
}

/** Spatial Volume: Color adjustments per tonal range */
export interface SpatialVolumeParams {
  shadows: SpectrumTone;
  midtones: SpectrumTone;
  highlights: SpectrumTone;
}

/** Spectral Balance: Global hue/saturation shift */
export interface SpectralBalanceParams {
  hueShift: number; // -1 to 1 (full rotation range)
  saturationShift: number; // -1 to 1 (decrease/increase)
}

/** Combined Spectrum parameters */
export interface SpectrumParams {
  enabled: boolean;
  spatialVolume: SpatialVolumeParams;
  spectralBalance: SpectralBalanceParams;
}

export interface EffectsParams {
  adjustments: AdjustmentsParams;
  grain: GrainParams;
  bloom: BloomParams;
  diffusion: DiffusionParams;
  chromatic: ChromaticParams;
  vignette: VignetteParams;
}

/** Advanced effects params - managed by separate store */
export interface AdvancedEffectsParams {
  toneCurves: ToneCurvesParams;
  clarity: ClarityParams;
  filmFade: FilmFadeParams;
  spectrum: SpectrumParams;
}

/** Combined effects params for full pipeline processing */
export interface FullEffectsParams extends EffectsParams {
  toneCurves?: ToneCurvesParams;
  clarity?: ClarityParams;
  filmFade?: FilmFadeParams;
  spectrum?: SpectrumParams;
}

export const DEFAULT_ADJUSTMENTS_PARAMS: AdjustmentsParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
};

export const DEFAULT_GRAIN_PARAMS: GrainParams = {
  enabled: false,
  intensity: 0,
  size: 2,
};

export const DEFAULT_BLOOM_PARAMS: BloomParams = {
  enabled: false,
  intensity: 0,
  threshold: 0.8,
  colorTemperature: 0,
};

export const DEFAULT_DIFFUSION_PARAMS: DiffusionParams = {
  enabled: false,
  intensity: 0,
  highlightGlow: 0.5,
  softness: 0.5,
};

export const DEFAULT_CHROMATIC_PARAMS: ChromaticParams = {
  enabled: false,
  redOffset: 0,
  blueOffset: 0,
};

export const DEFAULT_VIGNETTE_PARAMS: VignetteParams = {
  enabled: false,
  radius: 0.75,
  smoothness: 0.5,
};

// ============================================
// Advanced Effects Defaults
// ============================================

/** Creates a linear identity curve (input = output) */
const createLinearCurve = (): Float32Array => {
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    curve[i] = i / 255;
  }
  return curve;
};

export const DEFAULT_TONE_CURVES_PARAMS: ToneCurvesParams = {
  enabled: false,
  luminanceCurve: createLinearCurve(),
};

export const DEFAULT_CLARITY_PARAMS: ClarityParams = {
  enabled: false,
  intensity: 0,
  radius: 1.5,
  threshold: 0.1,
};

export const DEFAULT_FILM_FADE_PARAMS: FilmFadeParams = {
  enabled: false,
  fadeAmount: 0,
  tintColor: { r: 1, g: 0.95, b: 0.9 }, // Warm sepia-ish tint
};

// ============================================
// Spectrum Defaults
// ============================================

export const DEFAULT_SPECTRUM_TONE: SpectrumTone = {
  hue: 0,
  saturation: 0,
  strength: 0,
};

export const DEFAULT_SPATIAL_VOLUME_PARAMS: SpatialVolumeParams = {
  shadows: { ...DEFAULT_SPECTRUM_TONE },
  midtones: { ...DEFAULT_SPECTRUM_TONE },
  highlights: { ...DEFAULT_SPECTRUM_TONE },
};

export const DEFAULT_SPECTRAL_BALANCE_PARAMS: SpectralBalanceParams = {
  hueShift: 0,
  saturationShift: 0,
};

export const DEFAULT_SPECTRUM_PARAMS: SpectrumParams = {
  enabled: false,
  spatialVolume: { ...DEFAULT_SPATIAL_VOLUME_PARAMS },
  spectralBalance: { ...DEFAULT_SPECTRAL_BALANCE_PARAMS },
};

export const DEFAULT_EFFECTS_PARAMS: EffectsParams = {
  adjustments: DEFAULT_ADJUSTMENTS_PARAMS,
  grain: DEFAULT_GRAIN_PARAMS,
  bloom: DEFAULT_BLOOM_PARAMS,
  diffusion: DEFAULT_DIFFUSION_PARAMS,
  chromatic: DEFAULT_CHROMATIC_PARAMS,
  vignette: DEFAULT_VIGNETTE_PARAMS,
};

export const DEFAULT_ADVANCED_EFFECTS_PARAMS: AdvancedEffectsParams = {
  toneCurves: DEFAULT_TONE_CURVES_PARAMS,
  clarity: DEFAULT_CLARITY_PARAMS,
  filmFade: DEFAULT_FILM_FADE_PARAMS,
  spectrum: DEFAULT_SPECTRUM_PARAMS,
};
