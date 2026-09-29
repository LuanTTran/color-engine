# Sync from Aesthetikk

The reference tree under `/color-engine` is a **copy** of selected paths from the parent Aesthetikk repo. Paths and post-sync steps are listed in [`scripts/sync-manifest.json`](../scripts/sync-manifest.json).

## Copy tiers (summary)

| Tier | What |
|------|------|
| A | `lib/color-engine/**`, root `glsl.d.ts` |
| B | `lib/webgl/shaders/vertex.glsl`, `fragment.glsl`, `grain.glsl` |
| C | `lib/utils/curve-interpolation.ts` (tone-curve interpolation in React example) |

**Do not** copy playground UI, LUT catalog stores, API routes, or `lib/webgl/lut-cache-bridge.ts` — see the parent plan `documents/implementation/color-engine-reference-repo-plan.md`.

## After each engine sync

1. **Re-apply the LUT cache adapter** in `lib/color-engine/index.ts`:
   - Import `LutCacheBridge` from `./types/lut-cache`, not `../webgl/lut-cache-bridge`.
   - Keep `lib/color-engine/types/lut-cache.ts` (reference-only interface).

2. Run `npm run typecheck` in this repo.

3. Update the Session log in the parent plan if you are handing off to another agent.

## Forked / manual files

Never blind-overwrite:

- `lib/color-engine/types/lut-cache.ts`
- `lib/color-engine/index.ts` (import line only, after bulk sync)
- `examples/**`, `docs/**`, root `README.md`, `package.json`
