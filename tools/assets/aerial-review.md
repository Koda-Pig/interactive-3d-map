# Aerial architecture review

Reviewed 12 November 2026. This describes the current kit, replacing the earlier comparison against the first architecture pass.

## Kit and rendering

The catalog contains **82 procedural models across eight categories**, plus six crowd figures built separately from Kenney's Mini Characters. The procedural GLBs total **2,462,920 bytes**, or **2,544,277 bytes including the manifest**. These sizes exclude the crowd figures.

| Category | Procedural models |
| --- | ---: |
| racing | 12 |
| conference | 8 |
| hospitality | 11 |
| mixed-use | 15 |
| transport | 7 |
| props | 11 |
| setting | 3 |
| nature | 15 |

Every procedural model has baked ambient occlusion in vertex colours. Tileable models are baked between neighbouring copies. The palette remains shared, glass is opaque, and geometry is flat-shaded. The separate crowd pipeline simplifies and shades six CC0 source characters. Those figures appear near the camera, with simpler people drawn farther away.

## Architecture and placement

The pit building has stepped glazed floors, terrace bands, roof pavilions, a race-control tower, a conference lobby, a garage canopy, glazing mullions and solar panels. Covered grandstand bays have curved roofs, white canopies, exposed seating, rear fins and front rails. The end-cap tiers stop inside their end wall to prevent flickering.

Hall tiles have roof ridges and skylights. The Expo Centre has a separate glazed concourse and lake-facing entrance. Hotels have stepped floors, balcony ledges, room divisions and roof pools. Retail, research and apartments each have three variants. The lake footbridge, restaurant decks and terrace pergolas have dedicated models.

The secondary-building update adds:

- **Driving Academy:** two teaching floors glazed on both long facades, mullions, a projecting floor band, a recessed entrance, a canopy on posts, and a teal roof volume.
- **Automotive Hub:** eight workshop bays behind projecting piers, divided doors, clerestory glazing, a navy fascia, and three roof vents.
- **Townhouses:** five homes per row with separate timber doors, window reveals, porches, and alternating roof heights and colours. Ten existing residential blocks now use this model, six facing west toward the eastern estate's street and four facing north toward the southern estate's street. Previously they were plain extrusions, and the kit's townhouse model was unused.

A structural comparison with the preceding layout confirms that only `model` entries changed. Footprints, heights, existing facing directions, roads, grading, circuit geometry and event data are preserved. Models fit their existing placement envelopes, including the academy's 12 m placement height and the townhouses' 13 m placement height. Catalog heights are 9 m and 10 m respectively, so the map scales them vertically.

## Current triangle counts

These counts come from `public/models/manifest.json` after `node tools/assets/generate.mjs`. Counts include skirts where applicable and describe one catalog model, not a whole placed building or the rendered scene.

| Model | Triangles per copy | Budget |
| --- | ---: | ---: |
| `pit-conference-building` | 3,930 | 15,000 |
| `grandstand-bay-covered` | 614 | 1,500 |
| `grandstand-end-cap` | 518 | 1,500 |
| `conference-hall` | 258 | 4,000 |
| `amphitheatre` | 2,426 | 15,000 |
| `hotel-tower` | 1,282 | 4,000 |
| `hotel-low` | 1,042 | 4,000 |
| `lake-footbridge` | 532 | 1,500 |
| `timber-deck` | 744 | 1,500 |
| `pergola` | 684 | 1,500 |
| `retail-block` | 522 | 4,000 |
| `retail-block-2` | 530 | 4,000 |
| `retail-block-3` | 522 | 4,000 |
| `research-block` | 290 | 4,000 |
| `residential-trackside` | 386 | 4,000 |
| `paddock-support-unit` | 218 | 4,000 |
| `paddock-equipment-awning` | 74 | 4,000 |
| `expo-concourse` | 402 | 4,000 |
| `expo-entrance` | 74 | 4,000 |
| `conference-entrance-canopy` | 86 | 4,000 |
| `karting-garage-row` | 410 | 4,000 |
| `driving-academy` | 598 | 4,000 |
| `automotive-hub` | 614 | 4,000 |
| `townhouse-row` | 810 | 4,000 |

Research and apartment variants share their base model's triangle count. All 82 procedural assets pass their budget checks.

### Cost of the secondary-building update

| Model | Before per copy | Current per copy | Placed copies | Change in placed triangles |
| --- | ---: | ---: | ---: | ---: |
| Driving Academy | 154 | 598 | 1 | +444 |
| Automotive Hub | 290 | 614 | 1 | +324 |
| Townhouse row | 12 as a plain extrusion | 810 | 10 | +7,980 |

The placement change adds **8,748 triangles** across these buildings. The townhouse kit asset itself increased from 210 to 810 triangles, but it had no placements before this update. This arithmetic excludes shadows, scenery, culling and draw-call costs. The three changed GLBs add 120,412 bytes. Every other procedural GLB is byte-identical to the preceding kit.

## Visual review

All eight contact sheets in `previews/` were regenerated from the exported GLBs and opened for inspection. The hospitality sheet now includes the footbridge, timber deck and pergola, and shows the current hotel facades. The racing sheet shows the current pit mullions and grandstand details. The preview's full 82-asset grid and orbit inspector pass without browser errors.

A follow-up geometry review found gaps below the academy and workshop roofs. Their walls and workshop piers now meet the roofs. Raycasts through the former gaps hit supporting geometry, and the models and contact sheets were regenerated.

The academy's entrance and glazing rhythm are distinct from the workshop's recessed bay frontage. The townhouse doors and porches separate the five homes in each row. At whole-site distance, roof silhouettes and colour variation carry more of this difference than windows or door divisions.

`review-map.mjs` captures overview and fly-to views in Whole site, Race weekend and Conference day modes. It includes the academy, automotive hub and both residential estates as well as the existing signature-building views. It opens selections through location links so the review works with the sidebar collapsed. Captures are written to `/tmp/bmr-map-review`, or `MAP_REVIEW_DIR` when set.

## Verification

Run from the repository root:

- `node tools/assets/generate.mjs`: 82 models generated.
- `node tools/assets/validate.mjs`: 82 assets passed, with zero Khronos errors or warnings.
- `node tools/assets/determinism.mjs`: all 83 generated files, including the manifest, are byte-identical after regeneration.
- `node tools/assets/render.mjs`: eight contact sheets, the full grid, and the orbit inspector pass.
- `node tools/assets/review-map.mjs`: 42 map captures across all three modes complete without browser errors. The changed buildings were inspected in each mode.
- `node tools/check-layout.mjs`: 4,800 m lap, 693 m start-finish straight, separate 1,061 m straight, 15 m width, and all 42 referenced model files exist.
- `node --test 'tests/*.test.mjs'`: all 56 tests pass.
- `node node_modules/@biomejs/biome/bin/biome check .`: lint and formatting pass.
- `node node_modules/typescript/bin/tsc` and `node node_modules/vite/bin/vite.js build`: production checks pass, with Vite's existing large-chunk advisory.

The crowd figures are outside the procedural validator and determinism command. Their build and provenance are documented in [README.md](README.md#crowd-figures).

## Rendered scene cost

`node tools/perf.mjs --compare tools/perf/baseline.json --out /tmp/bmr-assets-perf.json` measured these fixed views on 12 November 2026. Changes are against the saved baseline from before this update. The low tier uses an emulated phone viewport on a desktop GPU.

| Tier and viewport | View | Draw calls | Change | Triangles | Change |
| --- | --- | ---: | ---: | ---: | ---: |
| high desktop | opening | 833 | +7 | 697,500 | +8,748 |
| high desktop | opening, race weekend | 932 | +7 | 1,027,766 | +8,748 |
| high desktop | pit building | 378 | +1 | 590,838 | +4,788 |
| high desktop | grandstand A | 320 | +1 | 554,342 | +4,788 |
| high desktop | lake | 575 | +4 | 624,356 | +8,304 |
| high desktop | car park | 341 | +0 | 514,716 | +0 |
| low phone | opening | 606 | +5 | 451,089 | +8,424 |
| low phone | opening, race weekend | 687 | +5 | 589,703 | +8,424 |
| low phone | pit building | 241 | +0 | 369,648 | +0 |
| low phone | grandstand A | 195 | +0 | 342,524 | +0 |
| low phone | lake | 427 | +7 | 379,445 | +8,748 |
| low phone | car park | 155 | +0 | 297,046 | +0 |

The largest increase is 8,748 triangles and seven draw calls. Culling hides some or all of the changed buildings in other views. Median main-pass times ranged from 4.4 to 7.7 ms on the high tier and 3.1 to 5.1 ms on the low tier in this run. These are desktop benchmark timings, not frame rates on a phone.

## Remaining opportunities and limits

The karting clubhouse, lakeside pavilions and residents' clubhouse remain simpler than the improved buildings. The Automotive Hub's adjoining secondary volume remains a plain extrusion. Station furniture and aerodrome details could make arrival locations more recognisable. Retail and research variants still share similar silhouettes.

The southern townhouses face their street to the north, so their porches are hidden from the initial fly-to bearing. Small details disappear at whole-site distance, and inactive precincts lose contrast in event modes. Further work needs review at the map's actual fly-to distance. No real-phone frame-time measurement has been made.
