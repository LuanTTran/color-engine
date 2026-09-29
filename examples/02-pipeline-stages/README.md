# Pipeline stages

Stage definitions: [`pipeline-config.ts`](../../lib/color-engine/pipeline/pipeline-config.ts) (`createDefaultPipelineStages`). The loop that runs them: [`effects-pipeline.ts`](../../lib/color-engine/pipeline/effects-pipeline.ts) (`execute` calls each processor’s `render` when that stage’s `isEnabled` passes).

[`pipeline-walkthrough.ts`](./pipeline-walkthrough.ts) lists every stage id in order (lut through clarity) with a short note per pass.
