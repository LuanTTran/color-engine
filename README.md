# Aesthetikk Color Engine (Reference)

WebGL2 color pipeline from [Aesthetikk](https://aesthetikk.com): LUT, adjustments, bloom, diffusion, tone curves, clarity, film fade, spectrum, vignette, chromatic aberration. Source lives here so you can read the engine without the full app repo.

For React front-end engineers who want to see how a staged GPU pipeline is wired, or anyone tracing GLSL passes file by file.

Read in this order: [reading-order](docs/reading-order.md) → [architecture](docs/architecture.md) → [examples](examples/).

| Example | What it shows |
| --- | --- |
| [01-init-color-engine](examples/01-init-color-engine/) | `ColorEngine` init, texture upload, `applyEffects` |
| [02-pipeline-stages](examples/02-pipeline-stages/) | Stage ids and execution order |
| [03-lut-texture](examples/03-lut-texture/) | `loadLutTexture(ArrayBuffer)` |
| [04-react-hook-pattern](examples/04-react-hook-pattern/) | RAF scheduling, abort, re-apply on param changes |
| [05-zustand-effects](examples/05-zustand-effects/) | Zustand slices that match `FullEffectsParams` |

This tree is library code, typed examples, and docs. No Next.js app, no playground route, no LUT catalog, IndexedDB cache, auth, or billing. The shipped product adds editor UI and backend services on top of the same engine ideas.

Stack: WebGL2, GLSL, `EffectsPipeline` + per-effect processors, Zustand in the hook example.

```bash
npm install
npm run typecheck
```

MIT. [LICENSE](LICENSE).
