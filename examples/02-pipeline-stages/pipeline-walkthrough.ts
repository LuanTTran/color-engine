// Adapted from aesthetikk/lib/color-engine/pipeline/pipeline-config.ts

/**
 * Default stage order from `createDefaultPipelineStages` in pipeline-config.ts.
 * Each stage runs only when its `isEnabled` predicate passes (see that file).
 */
export const PIPELINE_STAGE_WALKTHROUGH = [
  {
    id: 'lut',
    order: 1,
    note: '3D LUT color grade when `lutTexture` is passed in pipeline options.',
  },
  {
    id: 'adjustments',
    order: 2,
    note: 'Brightness, contrast, saturation, exposure (`basic-adjustments.glsl`).',
  },
  {
    id: 'grain',
    order: 3,
    note: 'Film grain overlay (`lib/webgl/shaders/grain.glsl`).',
  },
  {
    id: 'bloom',
    order: 4,
    note: 'Highlight extract + Kawase blur + composite.',
  },
  {
    id: 'diffusion',
    order: 5,
    note: 'Soft highlight diffusion (blur + composite passes).',
  },
  {
    id: 'chromatic',
    order: 6,
    note: 'Chromatic aberration at edges.',
  },
  {
    id: 'tone-curves',
    order: 7,
    note: 'Luminance curve (optional advanced effect).',
  },
  {
    id: 'spectrum',
    order: 8,
    note: 'Spatial volume / spectral balance (optional).',
  },
  {
    id: 'vignette',
    order: 9,
    note: 'Edge darkening.',
  },
  {
    id: 'film-fade',
    order: 10,
    note: 'Lifted blacks / fade (optional).',
  },
  {
    id: 'clarity',
    order: 11,
    note: 'Local contrast via blur + unsharp (optional).',
  },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_WALKTHROUGH)[number]['id'];

/** IDs in execution order — mirrors `createDefaultPipelineStages` sort by `order`. */
export const orderedStageIds = (): PipelineStageId[] =>
  [...PIPELINE_STAGE_WALKTHROUGH]
    .sort((a, b) => a.order - b.order)
    .map((stage) => stage.id);
