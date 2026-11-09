# Asset conventions

The kit contains 60 models across eight categories. Three variants of each nature asset use deterministic seeds. The kit contains no downloaded models, textures, compression, logos, or embedded text. The viewer labels and human reference exist only in the preview.

## Coordinates and dimensions

All coordinates use metres, Y up, and +Z forward. The root node has the asset ID and an identity transform. X and Z are centred on the footprint. Above-ground geometry starts at y=0. Building skirts fill the conservative rectangular footprint from y=-3 to y=0. Gantries, the footbridge, the screen, props, nature, and the horizon backdrop have no skirt.

`catalog.mjs` defines above-ground dimensions. The manifest's measured bounding box includes skirts. Its `spec.height` excludes skirts. Its footprint is a conservative clockwise rectangle in the XZ plane, including roof overhangs. Place neighbouring tile origins one `spec.width` apart along X.

The four vehicles interpret the supplied sizes as length × width × height. Their X and Z dimensions are exchanged so their noses point toward +Z:

| ID | X × Z × above-ground Y, metres |
| --- | --- |
| race-car-generic | 2 × 5.6 × 1 |
| car-parked | 1.8 × 4.4 × 1.5 |
| shuttle-bus | 2.5 × 11 × 3.2 |
| light-aircraft | 11 × 8 × 2.5 |

These are the only changes to explicitly supplied dimension axes. Unspecified widths and depths for nature and poles, and the backdrop thickness, are design choices recorded in the catalog. The backdrop is 60 m thick across a 12,000 m width. The requested mountain silhouette is a stylised flat-topped horizon shape.

## Materials and geometry

`shared.mjs` defines the exact palette. Export converts hexadecimal sRGB colours to glTF's linear RGB factors. Glass is opaque with roughness 0.18. Other materials use roughness 0.85. Metal uses metallic factor 0.45. Each model has one node, one mesh, and one primitive per material. Vertices are unindexed and have flat face normals. There are no extensions or external resources.

## Validation coverage

`assets:validate` loads every GLB independently with glTF Transform and runs Khronos `gltf-validator`. It checks dimensions against the catalog within 10%, triangle budgets, centred bounds, ground and skirt depth, root name and transform, palette names, unique material primitives, file sizes, manifest bounds, footprint, instancing and tile flags, matching tile boundary vertices, flat unit normals, winding, nondegenerate triangles, absence of textures and extensions, stale GLBs, and the 15 MB kit limit. The size limit includes GLBs and manifest.

Results are written to `validation-report.json`. `determinism-report.json` records SHA-256 hashes for all 61 generated files. Rendering uses the exported GLBs, rather than the generator geometry.

## Reference access

BMR's gallery couldn't be reached when the kit was generated. Written descriptions of the architecture and the project's planning documents guided the designs. No gallery images were copied.
