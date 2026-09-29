# Load LUT from ArrayBuffer

[`ColorEngine.loadLutTexture`](../../lib/color-engine/index.ts) takes a buffer (PNG LUT in practice) and returns a `WebGLTexture`.

Sampling happens in [`fragment.glsl`](../../lib/webgl/shaders/fragment.glsl) and [`vertex.glsl`](../../lib/webgl/shaders/vertex.glsl). Stage glue: [`lut-processor.ts`](../../lib/color-engine/processors/lut-processor.ts).

Aesthetikk production loads catalog LUTs from IndexedDB via `LutCacheBridge` (`aesthetikk/lib/webgl/lut-cache-bridge.ts`). This repo stops at the buffer API so you are not pulling in cache or store code.

[`load-lut-buffer.ts`](./load-lut-buffer.ts) wraps `loadLutTexture` and shows `applyEffects` with a LUT bound.
