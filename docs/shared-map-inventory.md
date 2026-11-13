# Shared map extraction inventory

## Baseline

The original production build passed the layout check and emitted 946.89 kB of JavaScript and 24.96 kB of CSS. Fonts and imported logos were separate files. The layout has a 4,800 m circuit, 693 m start-finish straight, 1,061 m separate straight and 15 m width.

Local evidence is in `artifacts/shared-map/baseline/`, excluded from Git. Desktop and phone screenshots cover the opening view and lake selection. `resources.json` records startup requests. The existing performance runner covers both quality tiers, location framing and race mode. The browser lifecycle runner checks concurrent maps, independent selection, deliberate section interaction, double destruction and interrupted startup.

## Resource ownership

| Resource | Owner and cleanup |
| --- | --- |
| Shell, accessible IDs and root CSS state | One mount, removed by `destroy()` |
| Renderer, animation loop and context | Mount, stopped and disposed before removal |
| Ground, site, scenery, traffic and loaded kit | `MapResources`, including late async results |
| Materials and procedural textures | Construction scope, disposed with its mount |
| Precinct clones and highlight fades | Precinct owner and scene owner |
| Water animation uniforms | Each water source, shared only with its own material clones |
| Shadow targets, sky environment and postprocessing | Scene lights, sky and effect owners |
| Resize and intersection observers | Mount cleanup registry |
| Event popover document listener | AbortController returned by the event switch |
| Touch handlers, media preference listener and repeating buttons | Explicit cleanup functions |
| Hint and intro timers | Hint and mount cleanup registry |
| Model, font and branding loads | Checked after async boundaries; late branding updates stop on disposal |
| Selection URL | Standalone or PitchDecks adapter |
| Performance inspection | Private source module, attached to `window` only by standalone development entry |

Construction yields to the browser while generating geometry. A queue keeps construction scopes from interleaving across those yields. Each scope creates separate caches and scenery templates, captures their disposal, and clears its construction references afterward. Existing maps render independently while another map starts. This avoids duplicating every drawing function's parameters during extraction. Parallel construction would require passing an instance resource object through the drawing functions.

Mutable scratch vectors used only within synchronous calculations remain shared. They do not retain map state across async boundaries. Fonts and bundled logo bytes are immutable assets.

## Integration boundaries

The package contains the layout and bundles Three.js. React is an optional peer for the `/react` export. CSS fonts and logos are embedded by the library build. Models, location images and the static preview are copied explicitly to a versioned host directory.

The browser entry does not use the browser URL for selection. Standalone owns `?location=`. The PitchDecks page must use its existing router and password gate when that consumer integration is added. The deck section must not write selection to the URL. The package retains the existing quality and optional performance diagnostics query flags.

No circuit, scenery placement, grading or location data changed.

## Measured extraction comparison

The extracted standalone build emits 960.44 kB of JavaScript and 29.82 kB of CSS. JavaScript increased by 13.55 kB, about 1.4 percent. The package embeds font and logo bytes, so its file sizes are not directly comparable with the standalone files.

Across all twelve performance views, draw calls, triangles, GPU geometry counts and GPU texture counts exactly match the original. GPU medians range from 0.0 to 1.5 ms slower and 0.0 to 2.4 ms faster on this machine. Treat those timing differences as local measurements rather than phone performance predictions. Both result files are retained with the local baseline artifacts.
