# Formula car replacement

Reviewed 13 November 2026. The procedural replacement keeps `props/race-car-generic.glb`, so `RACE_CAR`, the static display cars and the moving Convoy all use it without a runtime change.

## Options considered

| Option | Assessment |
| --- | --- |
| Improve the generator | Selected. Matches the existing flat faces, palette and baked occlusion. Controls dimensions, paint and byte size directly, with no external asset licence or conversion step. |
| [Kenney Racing Kit](https://kenney.nl/assets/racing-kit) | CC0 confirmed. A compatible low-poly source, but importing a vehicle would still require paint, dimensions and orientation checks. The procedural design already provides the requested formula silhouette within the size limit. |
| [Kenney Starter-Kit-Racing](https://github.com/KenneyNL/Starter-Kit-Racing) | Its README explicitly licenses models CC0, separately from the MIT game code. Vehicles use body and wheel children. This adds conversion work without an advantage over the generated model. No files imported. |
| [Poly Pizza F1 search](https://poly.pizza/search/F1) | The relevant [Racing car by scaranto](https://poly.pizza/m/EMcTJiXibv) is CC0, but its description identifies a touring car. Searches for formula did not establish a better candidate. No downloaded geometry, material or size claims were assumed. |
| [Sketchfab Low Poly F1](https://sketchfab.com/3d-models/low-poly-f1-0ac02bfa81f64549be15acaa78f36f29) | Page returned HTTP 403. Licence, download size and materials could not be independently verified. Not selected. |
| [Sketchfab animated formula car](https://sketchfab.com/3d-models/formula-1-car-animated-low-poly-free-866b7c6ddb344d4281e6160bd5491039) | Page returned HTTP 403. Search confirmed the model title and author b3t4, but not its licence or downloadable geometry. Not selected. |
| [Sketchfab Low Poly F1 Car](https://sketchfab.com/3d-models/low-poly-f1-car-ae0ab96fea2f44d9ac9309268477d015) | Page returned HTTP 403. Licence, download size and materials could not be independently verified. Not selected. |

The external options were screened from their published pages, not downloaded and benchmarked. No third-party model or branding is included, so no new attribution is required.

## Implementation

`formulaCar` in `designs.mjs` creates a tapered nose, front wing with endplates, elevated rear wing, sidepods with dark intakes, exposed octagonal tyres, suspension, an open cockpit and a faceted halo. Compare `previews/props.png` with the other kit vehicles and the 1.8 m human reference.

The car uses `wall-white` paint and `screen-dark` carbon. `bakedGeometry` multiplies material colours by baked occlusion, and Convoy multiplies those vertex colours by each instance's tint. Pale paint retains the eight distinct colours. Carbon receives the same multiplication but remains dark. This preserves the existing single-draw-call tint system.

The catalog envelope remains 2 m across X, 1 m high and 5.6 m along Z, with +Z forward and ground at Y=0. The design is authored along +X and uses the existing vehicle rotation and normalization. It exports 500 triangles in 43,640 bytes, without textures. Its explicit `prop` budget is 500 triangles rather than the 200 used for mass-instanced props. This catalog classification does not control runtime instancing; Convoy still instances all eight cars.

The normal generator, surface resolution and deterministic occlusion bake remain in use. There is no generator bypass or randomness. Regeneration changes only this GLB and its manifest and hash entries.

## Verification

- All 82 assets pass validation with zero glTF errors or warnings.
- All 83 generated files match byte-for-byte after regeneration.
- The category sheets and model orbit inspector render successfully.
- The running map loads the exported car in race mode with eight distinct RGB tints, and its +Z axis points in the direction of motion. Conference mode hides the race cars.
- Lint, all 171 tests, layout checks and production build pass. Vite retains its bundle-size advisory.

Follow-up surface review fixed slope-dependent polygon offset hiding low bodywork. Constant depth units retain separation between road layers. A shared grid definition now aligns twenty cars with twenty painted slots, each large enough for the 5.6 m car. Static and moving vehicles follow ground pitch and roll, covered by tyre-plane regression tests. The running map was rechecked after these changes.

The track, terrain, facilities and routes are unchanged. The spatial relationships in `ai/track-layout.md` remain intact; the layout and clearance tests pass.
