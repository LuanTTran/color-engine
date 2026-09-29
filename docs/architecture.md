# Architecture

High-level flow from canvas to pixels:

```mermaid
flowchart LR
  Canvas["HTMLCanvasElement"]
  CE["ColorEngine"]
  EP["EffectsPipeline"]
  P1["Processors\n(LUT → … → clarity)"]
  Canvas --> CE
  CE --> EP
  EP --> P1
  P1 --> CE
  CE --> Canvas
```

1. **`ColorEngine`** ([`lib/color-engine/index.ts`](../lib/color-engine/index.ts)) owns WebGL context, shader/texture/framebuffer managers, and constructs an **`EffectsPipeline`** on `initialize`.
2. **`EffectsPipeline`** ([`pipeline/effects-pipeline.ts`](../lib/color-engine/pipeline/effects-pipeline.ts)) runs `execute`: for each stage, if enabled, the stage’s processor renders from the current input texture to an FBO and swaps ping-pong buffers.
3. **Stage list** ([`pipeline/pipeline-config.ts`](../lib/color-engine/pipeline/pipeline-config.ts)) wires processor classes (`LutProcessor`, `BloomProcessor`, …) with `isEnabled` + `configResolver` helpers.
4. **Core utilities** under [`lib/color-engine/core/`](../lib/color-engine/core/) — context, shaders, textures, framebuffers — are shared by every processor.

Shared fullscreen quad shaders for several passes live under [`lib/webgl/shaders/`](../lib/webgl/shaders/). Effect-specific GLSL lives under [`lib/color-engine/shaders/`](../lib/color-engine/shaders/).

LUT catalog and IndexedDB caching are **app-layer** concerns in production Aesthetikk; this repo exposes only `loadLutTexture(ArrayBuffer)` and a `LutCacheBridge` interface stub ([`types/lut-cache.ts`](../lib/color-engine/types/lut-cache.ts)).
