# Regenerate the asset kit

Run all commands from the repository root with Node.js 22.18 or later and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm assets
pnpm assets:validate
pnpm assets:determinism
```

`pnpm assets` rebuilds 82 GLBs and `public/models/manifest.json`. Every model gets ambient occlusion baked into its vertex colours ([occlusion.mjs](occlusion.mjs)): corners, undersides and the foot of each wall darken, and tileable models are baked between copies of themselves so their seams match. The map multiplies the shade into each material's colour. The fixed nature seeds and locked dependencies produce byte-identical model files. The determinism command compares SHA-256 hashes before and after regeneration.

## Inspect the assets

Start the local preview server:

```bash
pnpm assets:preview
```

Open [the asset grid](http://127.0.0.1:4173). Choose a category, then click a card to orbit its model. Each card includes a 1.8 m human reference. Tileable assets appear three times along X at their exact placement interval.

Generate the eight category contact sheets with headless Chrome:

```bash
pnpm assets:render
```

The default browser path is `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. On another system, set `ASSET_BROWSER` to a Chromium executable:

```bash
ASSET_BROWSER=/path/to/chromium pnpm assets:render
```

Open every PNG in `tools/assets/previews/`. Check silhouettes, surfaces, stage direction, and tile joins. Regenerate the sheets after changing geometry.

## Add an asset

1. Add its ID, category, above-ground width, depth, height, budget class, and tileability to `catalog.mjs`. Set `skirt` for buildings. Add a note for any dimension interpretation.
2. Add its construction branch to `designs.mjs`. Use `KitShape` from `shared.mjs` for boxes, beams, cylinders, roofs, and extruded profiles. Place the front toward +Z. Keep the footprint centred on X and Z.
3. Use names from `palette` in `shared.mjs`. Add detail through geometry and colour. Keep screens and boards blank.
4. Return `s.finish(a)`. This fits the above-ground design to the catalog envelope, adds the 3 m building skirt, computes flat normals, and merges all geometry using the same material.
5. Run the regeneration, validation, determinism, and rendering commands above.
6. Open the affected contact sheet. For a tileable asset, check all three copies. Correct the geometry before accepting the new files.

Read [asset conventions](reference.md) before placing these models in a map.
