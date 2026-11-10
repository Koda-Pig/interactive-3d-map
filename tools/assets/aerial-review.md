# Aerial architecture review

The kit now has 72 models, up from 60. `designs.mjs` routes the redesigned buildings through `aerial.mjs`; the other 49 original models are byte-identical. No palette colours or runtime materials changed.

## Geometry and placement

The pit building has stepped glazed floors, exposed terrace bands, three roof pavilions, a north race-control tower, a south lobby and a pit-lane canopy on slanted supports. The covered grandstand keeps its curved roof over the upper seating, with white canopy sections, navy and teal tiers, a rear concourse and stairs. Its X boundaries match across tiles.

Hall tiles have four roof ridges, skylight strips and perimeter equipment. The Expo Centre adds a glazed concourse and a lake-facing entrance. Hotels have podium decks, broad balcony ledges, stepped upper floors and roof pools. Retail, research and residential each have three variants with different heights and roof arrangements. The arch has stone piers and a deep faceted span. Plaza towers have roof lanterns.

New support rooms and equipment awnings occupy the existing separate paddock footprints. The awning model replaces the raised roof part and includes its own posts. The renderer fits that part to `base + height`, so the canopy top stays at 5.6 m. Existing side supports remain. Karting garage models replace the two wall volumes; the existing roof and door parts remain because only model entries may change. The south conference entrance now has a glazed back wall and an open canopy.

Only `model` entries changed in `locations.json`. A structural comparison with the baseline confirmed that every other value, including footprints, heights, base offsets, facing directions of existing models, event data and grading, is unchanged. Circuit, access, loading aisles and protected boundaries are preserved.

The pit catalog envelope matches its combined placement at 370 × 52 × 33 m. Hall tiles use 78 × 72 m, close to the 75 × 75 m and 78 × 70 m cells. Retail uses local X × Z dimensions of 30 × 60 m because the existing placements face east or west. The Expo entrance is 44 × 24 m locally and faces east. The tower hotel keeps its 45 × 25 m envelope; its stepped massing also supports the existing 60 × 30 m placement.

## Triangle counts

Counts include building skirts. Copies come from the placement grid and the renderer's end-cap tiling rule, giving 31 covered bays and eight end caps. New models replace 12-triangle rectangular extrusions. The retail after-count is 522 for variants 1 and 3 and 530 for variant 2, placed four, three and three times respectively.

| Model or family | Before per copy | After per copy | Placed copies | Total change |
| --- | ---: | ---: | ---: | ---: |
| Pit / conference | 1,286 | 2370 | 1 | +1,084 |
| Covered grandstand bay | 394 | 506 | 31 | +3,472 |
| Grandstand end cap | 406 | 518 | 8 | +896 |
| Hall tile | 146 | 258 | 16 | +1,792 |
| Hotel tower | 1,762 | 418 | 2 | -2,688 |
| Low hotel | 754 | 322 | 1 | -432 |
| Retail variants | 274 | 522 / 530 | 10 | +2,504 |
| Research variants | 178 | 290 | 8 | +896 |
| Residential variants | 922 | 386 | 10 | -5,360 |
| Gateway arch | 178 | 94 | 1 | -84 |
| Plaza tower | 58 | 162 | 2 | +208 |
| Paddock support room | 12 | 218 | 10 | +2,060 |
| Equipment awning | 12 | 74 | 10 | +620 |
| Expo concourse | 12 | 402 | 1 | +390 |
| Expo entrance | 12 | 74 | 1 | +62 |
| Conference canopy | 12 | 86 | 1 | +74 |
| Karting garage row | 12 | 410 | 2 | +796 |

Affected placed geometry totals **37,340 → 43,630 triangles**, a net **+6,290**. All other placed geometry is unchanged. This adds about 1.2–1.7% to the previously reported 375,000–510,000 scene range. Those scene figures are context, not a fresh device measurement. Every model remains below its per-kind budget; the hero uses 2,370 of 15,000 triangles and a covered bay uses 506 of 1,500.

## Verification

- `pnpm assets`, `pnpm assets:validate` and `pnpm assets:determinism` pass. All 73 generated files are deterministic; Khronos validation has no warnings or errors.
- `pnpm assets:render` regenerates all eight contact sheets. The racing, conference, hospitality and mixed-use sheets are opened for inspection.
- `pnpm build` and `pnpm test` pass, including all 42 layout and geometry tests. Vite retains its large-bundle advisory.
- `node tools/assets/review-map.mjs`, with `pnpm dev` running, captures the overview and fly-to views in Whole site, Race weekend and Conference day modes. It also captures the stretched Promenade Hotel, karting garages and team support rows. Images are written to `/tmp/bmr-map-review` by default, or `MAP_REVIEW_DIR` when set.

## Camera limits

The broad pit terraces, hall ridges, exposed seating and hotel decks distinguish the buildings from above. Individual doors, small roof equipment and balcony divisions disappear at whole-site distance. The Gateway Arch reads as a stone-pier gateway at fly-to distance, but its fixed 40 m width limits its prominence in the overview. Retail variants differ at fly-to distance; the repeated street arrangement still dominates when zoomed out. Event-mode muting reduces colour contrast outside active precincts.

No real-phone frame-time measurement was made.
