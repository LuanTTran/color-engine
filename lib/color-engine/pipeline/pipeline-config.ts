import type { FullEffectsParams } from '../types/effects';
import { AdjustmentsProcessor } from '../processors/adjustments-processor';
import { BloomProcessor } from '../processors/bloom-processor';
import { ChromaticProcessor } from '../processors/chromatic-processor';
import { ClarityProcessor } from '../processors/clarity-processor';
import { DiffusionProcessor } from '../processors/diffusion-processor';
import { FilmFadeProcessor } from '../processors/film-fade-processor';
import { GrainProcessor } from '../processors/grain-processor';
import { LutProcessor } from '../processors/lut-processor';
import { SpectrumProcessor } from '../processors/spectrum-processor';
import { ToneCurvesProcessor } from '../processors/tone-curves-processor';
import { VignetteProcessor } from '../processors/vignette-processor';
import type { ProcessorInitializationContext } from '../processors/base-processor';
import type { PipelineExecutionParams, PipelineStage, PipelineStageContext } from '../types/pipeline';

export interface PipelineOptions extends PipelineExecutionParams {}

const isLutEnabled = (context: PipelineStageContext) => {
  return Boolean(context.options.lutTexture);
};

const resolveLutConfig = (context: PipelineStageContext) => {
  if (!context.options.lutTexture) {
    return null;
  }

  return {
    lutTexture: context.options.lutTexture,
    intensity: context.options.lutIntensity ?? 1,
    lutSize: context.options.lutSize ?? 512,
    customGeometry: context.options.customGeometry ?? null,
  };
};

const ADJUSTMENTS_EPSILON = 1e-4;

const isAdjustmentsEnabled = (context: PipelineStageContext) => {
  const { brightness, contrast, saturation, exposure } = context.effects.adjustments;
  return (
    Math.abs(brightness) > ADJUSTMENTS_EPSILON ||
    Math.abs(contrast) > ADJUSTMENTS_EPSILON ||
    Math.abs(saturation) > ADJUSTMENTS_EPSILON ||
    Math.abs(exposure) > ADJUSTMENTS_EPSILON
  );
};

const resolveAdjustmentsConfig = (context: PipelineStageContext) => context.effects.adjustments;

const isGrainEnabled = (context: PipelineStageContext) => {
  const { grain } = context.effects;
  return grain.enabled && grain.intensity > 0;
};

const resolveGrainConfig = (context: PipelineStageContext) => context.effects.grain;

const isBloomEnabled = (context: PipelineStageContext) => {
  const { bloom } = context.effects;
  return (
    bloom.enabled && (
      bloom.intensity > 0 ||
      Math.abs(bloom.threshold - 0.8) > ADJUSTMENTS_EPSILON ||
      Math.abs(bloom.colorTemperature) > ADJUSTMENTS_EPSILON
    )
  );
};

const resolveBloomConfig = (context: PipelineStageContext) => context.effects.bloom;

const isDiffusionEnabled = (context: PipelineStageContext) => {
  const { diffusion } = context.effects;
  return (
    diffusion.enabled && (
      diffusion.intensity > 0 ||
      Math.abs(diffusion.highlightGlow - 0.5) > ADJUSTMENTS_EPSILON ||
      Math.abs(diffusion.softness - 0.5) > ADJUSTMENTS_EPSILON
    )
  );
};

const resolveDiffusionConfig = (context: PipelineStageContext) => context.effects.diffusion;

const isChromaticEnabled = (context: PipelineStageContext) => {
  const { chromatic } = context.effects;
  return chromatic.enabled && (chromatic.redOffset !== 0 || chromatic.blueOffset !== 0);
};

const resolveChromaticConfig = (context: PipelineStageContext) => context.effects.chromatic;

const isVignetteEnabled = (context: PipelineStageContext) => {
  const { vignette } = context.effects;
  return vignette.enabled;
};

const resolveVignetteConfig = (context: PipelineStageContext) => context.effects.vignette;

const isFilmFadeEnabled = (context: PipelineStageContext): boolean => {
  const { filmFade } = context.effects;
  return Boolean(filmFade?.enabled && (filmFade?.fadeAmount ?? 0) > 0);
};

const resolveFilmFadeConfig = (context: PipelineStageContext) => context.effects.filmFade;

const isClarityEnabled = (context: PipelineStageContext): boolean => {
  const { clarity } = context.effects;
  return Boolean(clarity?.enabled && (clarity?.intensity ?? 0) > 0);
};

const resolveClarityConfig = (context: PipelineStageContext) => context.effects.clarity;

const isToneCurvesEnabled = (context: PipelineStageContext): boolean => {
  const { toneCurves } = context.effects;
  return Boolean(toneCurves?.enabled);
};

const resolveToneCurvesConfig = (context: PipelineStageContext) => context.effects.toneCurves;

const isSpectrumEnabled = (context: PipelineStageContext): boolean => {
  const { spectrum } = context.effects;
  return Boolean(spectrum?.enabled);
};

const resolveSpectrumConfig = (context: PipelineStageContext) => context.effects.spectrum;

export const createDefaultPipelineStages = (
  context: ProcessorInitializationContext
): PipelineStage<any, any>[] => {
  const stages: PipelineStage<any, any>[] = [
    {
      id: 'lut',
      order: 1,
      createProcessor: () => new LutProcessor(context),
      isEnabled: isLutEnabled,
      configResolver: resolveLutConfig,
    },
    {
      id: 'adjustments',
      order: 2,
      createProcessor: () => new AdjustmentsProcessor(context),
      isEnabled: isAdjustmentsEnabled,
      configResolver: resolveAdjustmentsConfig,
    },
    {
      id: 'grain',
      order: 3,
      createProcessor: () => new GrainProcessor(context),
      isEnabled: isGrainEnabled,
      configResolver: resolveGrainConfig,
    },
    {
      id: 'bloom',
      order: 4,
      createProcessor: () => new BloomProcessor(context),
      isEnabled: isBloomEnabled,
      configResolver: resolveBloomConfig,
    },
    {
      id: 'diffusion',
      order: 5,
      createProcessor: () => new DiffusionProcessor(context),
      isEnabled: isDiffusionEnabled,
      configResolver: resolveDiffusionConfig,
    },
    {
      id: 'chromatic',
      order: 6,
      createProcessor: () => new ChromaticProcessor(context),
      isEnabled: isChromaticEnabled,
      configResolver: resolveChromaticConfig,
    },
    {
      id: 'tone-curves',
      order: 7,
      createProcessor: () => new ToneCurvesProcessor(context),
      isEnabled: isToneCurvesEnabled,
      configResolver: resolveToneCurvesConfig,
    },
    {
      id: 'spectrum',
      order: 8,
      createProcessor: () => new SpectrumProcessor(context),
      isEnabled: isSpectrumEnabled,
      configResolver: resolveSpectrumConfig,
    },
    {
      id: 'vignette',
      order: 9,
      createProcessor: () => new VignetteProcessor(context),
      isEnabled: isVignetteEnabled,
      configResolver: resolveVignetteConfig,
    },
    {
      id: 'film-fade',
      order: 10,
      createProcessor: () => new FilmFadeProcessor(context),
      isEnabled: isFilmFadeEnabled,
      configResolver: resolveFilmFadeConfig,
    },
    {
      id: 'clarity',
      order: 11,
      createProcessor: () => new ClarityProcessor(context),
      isEnabled: isClarityEnabled,
      configResolver: resolveClarityConfig,
    },
  ];

  return stages.sort((a, b) => a.order - b.order);
};

export const isStageEnabled = (
  stage: PipelineStage<any, any>,
  effects: FullEffectsParams,
  options: PipelineOptions
) => stage.isEnabled({ effects, options });


