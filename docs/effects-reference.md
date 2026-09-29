# Effects reference

Param types are defined in [`lib/color-engine/types/effects.ts`](../lib/color-engine/types/effects.ts).

| Effect | Processor | Shader(s) | Params |
|--------|-----------|-----------|--------|
| LUT | [`processors/lut-processor.ts`](../lib/color-engine/processors/lut-processor.ts) | [`lib/webgl/shaders/fragment.glsl`](../lib/webgl/shaders/fragment.glsl), [`vertex.glsl`](../lib/webgl/shaders/vertex.glsl) | via `applyEffects` options (`lutTexture`, `lutIntensity`, `lutSize`) |
| Adjustments | [`adjustments-processor.ts`](../lib/color-engine/processors/adjustments-processor.ts) | [`shaders/basic-adjustments.glsl`](../lib/color-engine/shaders/basic-adjustments.glsl) | `AdjustmentsParams` |
| Grain | [`grain-processor.ts`](../lib/color-engine/processors/grain-processor.ts) | [`lib/webgl/shaders/grain.glsl`](../lib/webgl/shaders/grain.glsl) | `GrainParams` |
| Bloom | [`bloom-processor.ts`](../lib/color-engine/processors/bloom-processor.ts) | [`bloom-extract.glsl`](../lib/color-engine/shaders/bloom-extract.glsl), [`kawase-blur.glsl`](../lib/color-engine/shaders/kawase-blur.glsl), [`bloom-composite.glsl`](../lib/color-engine/shaders/bloom-composite.glsl) | `BloomParams` |
| Diffusion | [`diffusion-processor.ts`](../lib/color-engine/processors/diffusion-processor.ts) | [`diffusion-blur.glsl`](../lib/color-engine/shaders/diffusion-blur.glsl), [`diffusion-composite.glsl`](../lib/color-engine/shaders/diffusion-composite.glsl) | `DiffusionParams` |
| Chromatic | [`chromatic-processor.ts`](../lib/color-engine/processors/chromatic-processor.ts) | [`chromatic.glsl`](../lib/color-engine/shaders/chromatic.glsl) | `ChromaticParams` |
| Vignette | [`vignette-processor.ts`](../lib/color-engine/processors/vignette-processor.ts) | [`vignette.glsl`](../lib/color-engine/shaders/vignette.glsl) | `VignetteParams` |
| Tone curves | [`tone-curves-processor.ts`](../lib/color-engine/processors/tone-curves-processor.ts) | [`tone-curves.glsl`](../lib/color-engine/shaders/tone-curves.glsl) | `ToneCurvesParams` |
| Clarity | [`clarity-processor.ts`](../lib/color-engine/processors/clarity-processor.ts) | [`clarity-blur.glsl`](../lib/color-engine/shaders/clarity-blur.glsl), [`clarity-unsharp.glsl`](../lib/color-engine/shaders/clarity-unsharp.glsl) | `ClarityParams` |
| Film fade | [`film-fade-processor.ts`](../lib/color-engine/processors/film-fade-processor.ts) | [`film-fade.glsl`](../lib/color-engine/shaders/film-fade.glsl) | `FilmFadeParams` |
| Spectrum | [`spectrum-processor.ts`](../lib/color-engine/processors/spectrum-processor.ts) | [`spectrum.glsl`](../lib/color-engine/shaders/spectrum.glsl) | `SpectrumParams` |
