// Adapted from aesthetikk/lib/stores/color-engine-effects-store.ts
'use client';

import { create } from 'zustand';
import type {
  AdjustmentsParams,
  BloomParams,
  ChromaticParams,
  DiffusionParams,
  EffectsParams,
  GrainParams,
  VignetteParams,
} from '@/lib/color-engine/types/effects';
import {
  DEFAULT_ADJUSTMENTS_PARAMS,
  DEFAULT_BLOOM_PARAMS,
  DEFAULT_CHROMATIC_PARAMS,
  DEFAULT_DIFFUSION_PARAMS,
  DEFAULT_EFFECTS_PARAMS,
  DEFAULT_GRAIN_PARAMS,
  DEFAULT_VIGNETTE_PARAMS,
} from '@/lib/color-engine/types/effects';

interface EffectsStore extends EffectsParams {
  setAdjustments: (params: Partial<AdjustmentsParams>) => void;
  setGrain: (params: Partial<GrainParams>) => void;
  setBloom: (params: Partial<BloomParams>) => void;
  setDiffusion: (params: Partial<DiffusionParams>) => void;
  setChromatic: (params: Partial<ChromaticParams>) => void;
  setVignette: (params: Partial<VignetteParams>) => void;
  resetAdjustments: () => void;
  resetGrain: () => void;
  resetBloom: () => void;
  resetDiffusion: () => void;
  resetChromatic: () => void;
  resetVignette: () => void;
  resetAll: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const useColorEngineEffectsStore = create<EffectsStore>((set) => ({
  adjustments: { ...DEFAULT_ADJUSTMENTS_PARAMS },
  grain: { ...DEFAULT_GRAIN_PARAMS },
  bloom: { ...DEFAULT_BLOOM_PARAMS },
  diffusion: { ...DEFAULT_DIFFUSION_PARAMS },
  chromatic: { ...DEFAULT_CHROMATIC_PARAMS },
  vignette: { ...DEFAULT_VIGNETTE_PARAMS },

  setAdjustments: (params) =>
    set((state) => ({
      adjustments: {
        brightness: params.brightness ?? state.adjustments.brightness,
        contrast: params.contrast ?? state.adjustments.contrast,
        saturation: params.saturation ?? state.adjustments.saturation,
        exposure: params.exposure ?? state.adjustments.exposure,
      },
    })),

  setGrain: (params) =>
    set((state) => ({
      grain: {
        enabled: params.enabled ?? state.grain.enabled,
        intensity: clamp(params.intensity ?? state.grain.intensity, 0, 1),
        size: clamp(params.size ?? state.grain.size, 1, 5),
      },
    })),

  setBloom: (params) =>
    set((state) => ({
      bloom: {
        enabled: params.enabled ?? state.bloom.enabled,
        intensity: clamp(params.intensity ?? state.bloom.intensity, 0, 1),
        threshold: clamp(params.threshold ?? state.bloom.threshold, 0.5, 1),
        colorTemperature: clamp(params.colorTemperature ?? state.bloom.colorTemperature, -1, 1),
      },
    })),

  setDiffusion: (params) =>
    set((state) => ({
      diffusion: {
        enabled: params.enabled ?? state.diffusion.enabled,
        intensity: clamp(params.intensity ?? state.diffusion.intensity, 0, 1),
        highlightGlow: clamp(params.highlightGlow ?? state.diffusion.highlightGlow, 0, 1),
        softness: clamp(params.softness ?? state.diffusion.softness, 0, 1),
      },
    })),

  setChromatic: (params) =>
    set((state) => ({
      chromatic: {
        enabled: params.enabled ?? state.chromatic.enabled,
        redOffset: clamp(params.redOffset ?? state.chromatic.redOffset, -1, 1),
        blueOffset: clamp(params.blueOffset ?? state.chromatic.blueOffset, -1, 1),
      },
    })),

  setVignette: (params) =>
    set((state) => ({
      vignette: {
        enabled: params.enabled ?? state.vignette.enabled,
        radius: clamp(params.radius ?? state.vignette.radius, 0, 1),
        smoothness: clamp(params.smoothness ?? state.vignette.smoothness, 0, 1),
      },
    })),

  resetAdjustments: () => set({ adjustments: { ...DEFAULT_ADJUSTMENTS_PARAMS } }),
  resetGrain: () => set({ grain: { ...DEFAULT_GRAIN_PARAMS } }),
  resetBloom: () => set({ bloom: { ...DEFAULT_BLOOM_PARAMS } }),
  resetDiffusion: () => set({ diffusion: { ...DEFAULT_DIFFUSION_PARAMS } }),
  resetChromatic: () => set({ chromatic: { ...DEFAULT_CHROMATIC_PARAMS } }),
  resetVignette: () => set({ vignette: { ...DEFAULT_VIGNETTE_PARAMS } }),
  resetAll: () =>
    set({
      adjustments: { ...DEFAULT_ADJUSTMENTS_PARAMS },
      grain: { ...DEFAULT_GRAIN_PARAMS },
      bloom: { ...DEFAULT_BLOOM_PARAMS },
      diffusion: { ...DEFAULT_DIFFUSION_PARAMS },
      chromatic: { ...DEFAULT_CHROMATIC_PARAMS },
      vignette: { ...DEFAULT_VIGNETTE_PARAMS },
    }),
}));

