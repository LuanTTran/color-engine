# Reading order (~30 minutes)

1. **[`lib/color-engine/index.ts`](../lib/color-engine/index.ts)** — `ColorEngine` lifecycle: WebGL init, textures, `applyEffects`, optional LUT cache interface.
2. **[`lib/color-engine/pipeline/effects-pipeline.ts`](../lib/color-engine/pipeline/effects-pipeline.ts)** — `execute`: ping-pong textures through ordered stages.
3. **[`lib/color-engine/pipeline/pipeline-config.ts`](../lib/color-engine/pipeline/pipeline-config.ts)** — `createDefaultPipelineStages`, `isEnabled` predicates per effect.
4. **One processor + shaders** — e.g. [`bloom-processor.ts`](../lib/color-engine/processors/bloom-processor.ts) with [`kawase-blur.glsl`](../lib/color-engine/shaders/kawase-blur.glsl), [`bloom-extract.glsl`](../lib/color-engine/shaders/bloom-extract.glsl), [`bloom-composite.glsl`](../lib/color-engine/shaders/bloom-composite.glsl).
5. **[`examples/04-react-hook-pattern`](../examples/04-react-hook-pattern/)** — RAF-throttled re-apply when store params change.
6. **[`examples/05-zustand-effects`](../examples/05-zustand-effects/)** — Param shapes that feed `FullEffectsParams`.

Deep dive after that: [`effects-reference.md`](./effects-reference.md), [`architecture.md`](./architecture.md).

Keeping in sync with the main app: [`sync-from-aesthetikk.md`](./sync-from-aesthetikk.md).
