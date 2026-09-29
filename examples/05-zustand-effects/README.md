# Zustand effect stores

Same files as `aesthetikk/lib/stores/color-engine-effects-store.ts` and `advanced-effects-store.ts`, copied under this folder.

| Store | State fields | Passed to `applyEffects` as |
| --- | --- | --- |
| `useColorEngineEffectsStore` | `adjustments`, `grain`, `bloom`, `diffusion`, `chromatic`, `vignette` | same property names |
| `useAdvancedEffectsStore` | `toneCurves` (UI points; hook interpolates), `clarity`, `filmFade`, `spectrum` | `toneCurves`, `clarity`, `filmFade`, `spectrum` when enabled |

[`use-color-engine-excerpt.tsx`](../04-react-hook-pattern/use-color-engine-excerpt.tsx) wires selectors into the effects object.

[`color-engine-effects-store.ts`](./color-engine-effects-store.ts) · [`advanced-effects-store.ts`](./advanced-effects-store.ts)
