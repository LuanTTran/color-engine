# Initialize ColorEngine and apply effects

You need WebGL2 and a canvas. The sample sets `canvas.width` / `canvas.height` from the loaded image.

Read [`lib/color-engine/index.ts`](../../lib/color-engine/index.ts) for `initialize`, `createTextureFromImageData`, `applyEffects`, and `renderTextureToCanvas`. Default numbers live in [`types/effects.ts`](../../lib/color-engine/types/effects.ts) (`DEFAULT_*`).

[`init-and-apply.ts`](./init-and-apply.ts) loads an image URL, uploads it, runs the pipeline with `DEFAULT_EFFECTS_PARAMS`, and blits the output texture to the canvas.
