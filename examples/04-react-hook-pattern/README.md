# React hook pattern (RAF + abort)

Trimmed from `aesthetikk/hooks/use-color-engine.ts`. Still there: `scheduleApplyEffects` (one `requestAnimationFrame` per burst of slider changes), `AbortController` around async work, the dependency list that triggers re-apply, and `drawImageToCanvas` → `applyEffects` → `renderTextureToCanvas`. Gone: `useLutStore`, `lutCacheBridge`, `loadCachedLutTexture`, cache stats.

Pass `lutTexture` if you already loaded a LUT ([example 03](../03-lut-texture/README.md)). Effect fields come from the Zustand copies in [example 05](../05-zustand-effects/README.md).

Slider throttling in the main app is written up in `aesthetikk/documents/how-it-works/slider-throttling.md` (not vendored here).

[`use-color-engine-excerpt.tsx`](./use-color-engine-excerpt.tsx)
