# Visual improvements

A review of the map against high-end interactive site maps, from November 2026, and the work that would close the gap. Items 1 to 7 are built, and item 8 in part. The scores are from before them.

The map already does its job as a product. Search, precinct filters, fly-to and the event switch are as good as most maps of this kind. It falls behind on finish. From the air it reads clearly, but up close it looks like an architectural blockout, and the close view is where every click takes you.

## How it compares

The scores are a judgement from running the map and reading the code.

| Area | Score | Compared with high-end work |
| --- | --- | --- |
| Interaction | 8/10 | Competitive, and well ahead of pre-rendered images with hotspots |
| Telling the venue's story | 7/10 | The race weekend / conference day switch is the strongest idea here |
| Performance and download size | 9/10 | About 2 MB in total, 60 fps on a Mac at 1x resolution |
| Whole-site view | 6/10 | Clear, but the site is small in the frame |
| Lighting | 4/10 | Good sun direction, no soft shading |
| Close-up detail | 3/10 | The biggest gap |
| Selection highlight | 4/10 | Works, but flattens the building |

The usual alternatives each make a different trade:

| Approach | Strength | Why it isn't the model for this project |
| --- | --- | --- |
| Pre-rendered CGI with hotspots | Image quality | One fixed angle. The [Expo Centre map](overview.md#the-reference) is this kind |
| Unreal pixel streaming | The highest real-time quality | Needs a GPU server for each concurrent viewer |
| Photogrammetry, [3D Tiles](https://cloud.google.com/blog/products/maps/google-maps-platform-expands-3d-capabilities-with-photorealistic-3d-tiles) or [Gaussian splats](https://cesium.com/blog/2026/04/27/3d-gaussian-splats-lod/) | Looks like the real place | Needs a real place to capture, and BMR isn't built |
| Art-directed WebGL, such as [Meatopia](https://www.awwwards.com/sites/meatopia) or [Marseille](https://www.awwwards.com/inspiration/marseille-by-la-phase-5-3d-map-with-real-time-rendering-and-360deg-panaromas) | Simple shapes that look deliberate | This is the peer group to aim at |

## What has to stay true

- The style stays clean and simplified, as [overview.md](overview.md#look-and-feel) sets out. The goal is for it to look finished, not realistic
- Phones are the limit. The low tier already draws about 375,000 triangles in 175 draw calls, or about 430,000 triangles on a race weekend, and nobody has timed it on a real phone
- The scene renders on demand and skips the shadow pass while the camera moves ([main.ts:51](../src/main.ts:51), [main.ts:150](../src/main.ts:150)). Anything animated has to work around that
- BMR's artist's impressions are style guides. They don't go into the map without BMR's agreement
- Capacities and similar facts stay out unless BMR supplies them. The layout is invented, and made-up numbers would make it look more official than it is

## Issues and changes

### 1. The selection highlight flattens buildings

**Built.** A selected building keeps its own materials under a light tint, with an amber line drawn around its silhouette ([selection-outline.ts](../src/scene/selection-outline.ts)), and the rest of the site mutes around it. Hover uses a lighter tint and doesn't mute anything. Closing the details returns to the current event mode's muting. Flat areas, roads and gates keep a strong tint, with no outline.

**Done when:** a selected building is obvious from the whole-site view and still recognisable as that building up close.

### 2. Buildings have no soft shading or contact with the ground

The light is one sun plus a hemisphere light ([lighting.ts:41](../src/scene/lighting.ts:41)), and the renderer draws straight to the screen with no post-processing ([main.ts:131](../src/main.ts:131)). Nothing darkens corners, undersides or the line where a wall meets the ground, so buildings look placed on top of the map.

Bake ambient occlusion into the kit in the model generator, as vertex colours, and draw a soft dark decal around each building from its footprint. That costs almost nothing at runtime, which a screen-space pass on phones wouldn't. Three things to handle along the way:

- The building highlight already keeps vertex colours. The strong highlight on flat shapes still turns them off
- Tiled models such as grandstand bays need to match at their seams
- The generated files change, so `pnpm assets:validate` and `pnpm assets:determinism` need to pass again

**Built.** The generator bakes ambient occlusion into every model as vertex colours ([occlusion.mjs](../tools/assets/occlusion.mjs)). It fills a grid with the model and marches 32 fixed rays from each vertex, with the ground counting as solid, so corners, undersides and the foot of each wall darken by up to 60%. Tiled models are baked with a copy on each side, so their seams match. The shade is stored as a byte per channel, which added about 270 KB to the kit. A soft dark band lies on the ground round every building footprint, from 1.5 to 6 m wide depending on the building's height, merged into one mesh per precinct so it fades with its buildings ([contact-shadows.ts](../src/draw/contact-shadows.ts)). Raised parts, banks and buildings standing in the lake get none.

### 3. The ground around the buildings is empty

The paddock, arrival plaza and car parks are plain grey shapes, and the grass is one even tone. Cars only appear in the event modes ([scenery.ts:597](../src/draw/scenery.ts:597)), so the default view shows large empty car parks. The ground takes up more of a close view than the buildings do.

Add parking bay lines, plaza paving patterns, footpaths between the main buildings, mowed-grass variation and tree-lined edges. Show a light scatter of parked cars in the whole-site view. Drawing bays and paving into shared textures or merged geometry keeps the draw calls down.

**Done when:** the view from a fly-to has no large featureless area.

**Built.** Car parks already had stall lines. An area can now name a `surface`: `paving` (3 m slabs with a border course), `concrete` (6 m bays with joints) or `mown` (alternating mowing stripes), drawn from small generated textures in the area's metres ([textures.ts](../src/draw/textures.ts)). The plaza, forecourt, piazza and hospitality courts are paved, and the yards, aprons, paddock and drop-off are concrete. Everyday parking went from 5% to 12% of stalls, so the whole-site view shows car parks in use. No new footpaths were added, because they would change the layout that [track-layout.md](../ai/track-layout.md) fixes.

### 4. The models are plain up close

The kit is flat-shaded with no textures, and facades are strips of colour. The pit / conference building, the most important model on the map, is 1,288 triangles. Selecting something brings the camera close enough to show this.

Add detail in the generator, starting with the buildings people are most likely to select: window mullions, floor bands, roof plant, canopy edges and entrance canopies. Use a small shared texture for facades if geometry gets too expensive. Check the triangle counts against the phone budget after each batch.

**Done when:** the pit / conference building, Grandstand A and the Waterfront Hotel hold up at the distance a fly-to stops at.

**Built.** In [aerial.mjs](../tools/assets/aerial.mjs): the pit / conference building has mullions every 7.5 m through its glazing, a navy band over the garages and rows of rooftop solar panels, and is now 3,930 triangles of its 15,000 budget. The hotels have fins between rooms on every floor: the tower went from 418 to 1,282 triangles and the low hotel from 322 to 1,042. The covered grandstand bay has rear cladding fins and a front rail, at 614 triangles. Three new models replace plain extruded parts on the waterfront: the lake footbridge (ramps, piers and glass-panelled railings), the restaurants' timber decks (planks, piles and a railing open to the quay) and the terrace pergolas (posts, beams and rafters).

**People.** Added on 12 November 2026: within about 320 m of the camera, the cones and boxes standing in for people become a mix of six figures built from Kenney's Mini Characters (CC0), at about 150 triangles each ([people.mjs](../tools/assets/people.mjs)). Spectators on the banks face the nearest stretch of track, and fan village crowds face the big screen. From further away people stay as the simple shapes, so the whole-site views are unchanged except for 15 more draw calls on a race weekend (22 on the low tier). Close to a full bank, the figures add about 236,000 triangles and 15 draw calls on the high tier, which keeps that view below the race-weekend overview.

### 5. Shadows are coarse

**Built.** The shadow map is refitted to the ground in view once the camera stops ([sun-shadow.ts](../src/scene/sun-shadow.ts)), and goes back to covering the whole 3.6 km site only when a move takes the view outside the fitted area. At the distance a fly-to stops, it's about 0.3 m per shadow pixel on the high tier.

The blotches on Grandstand A's end wall weren't shadows. They stayed with shadow casting turned off. The end cap's seating tiers ran to its outer edge, so their ends shared a plane with the end wall and the two flickered through each other. The tiers now stop at the wall's inner face ([aerial.mjs](../tools/assets/aerial.mjs)), which fixes every grandstand that uses the end cap.

**Done when:** building shadows have clean edges at fly-to distance and the grandstand end wall is clear.

### 6. The opening view undersells the site

**Built.** The opening view ([view.ts](../src/scene/view.ts)) holds a 900 m circle around the circuit and lake, whatever the window's shape, and looks down steeply enough that no sky shows in the first frame. Once loading ends, the camera settles into that view from higher up and turned 30°, over 2.6 seconds ([flight.ts](../src/scene/flight.ts)). The fly-in is skipped under `prefers-reduced-motion`, and a link to a location flies straight to that location instead.

The sky got no clouds. It only shows when someone tilts the view towards the horizon, so clouds wouldn't change the first impression.

**Done when:** a screenshot of the first frame works as a slide in the deck.

### 7. Nothing moves

The scene is completely still. A few moving things would make it feel more alive: shimmer on the lake, cars lapping on a race weekend, the shuttle running.

Render continuously only while something visible is animating, and keep moving objects out of the shadow pass. The nice-to-haves in [overview.md](overview.md#nice-to-have-it-would-make-the-pitch-land-harder), the lap of the circuit and the arrival routes, belong in this item.

**Done when:** a race weekend has visible movement and the map stays idle in the other views when nothing is happening, with the frame rate holding on a phone.

**Built.** On a race weekend eight race cars lap the circuit at about 170 km/h, running down the middle of the track clear of the grid. On a race weekend or a conference day, three shuttles circle the ring road and the lake's ripples drift ([traffic.ts](../src/draw/traffic.ts)). The map draws continuously only in those two views. The whole-site view stays still, and reduced motion turns all of it off. The moving vehicles stay out of the shadow pass.

A race weekend also draws five arrival routes, from the layout data's `arrivals` list ([arrival-routes.ts](../src/draw/arrival-routes.ts)). Cyan lines with white arrows run along the roads from both directions of the N7 and from the aerodrome to the car parks. White lines with navy dots run along the walks from the car parks and Kalbaskraal station to the gates. The lines keep about the same width on screen at any distance, and their marks move. Each mode is one mesh, so the routes add 2 draw calls and about 5,000 triangles. A small legend sits under the race weekend summary. A test checks that every route stays on a road, walk or paved area and ends at a gate. The routes follow existing roads and change none of the layout that [track-layout.md](../ai/track-layout.md) fixes.

Two tour buttons sit under the event switch ([tour.ts](../src/scene/tour.ts), [tours.ts](../src/scene/tours.ts)). **Lap the circuit** flies to the grid and rides once round from just before the start-finish line, slowing through the bends, in about 41 seconds, then flies back to the opening view. **Arrive for a race** switches to race weekend and rides the Cape Town route: up the N7, off at the south interchange, round the ring road into Car Park P2, then on foot through Gate 2 and along the Grandstand Fan Walk, in about 41 seconds. It ends on a view over Grandstands A and B, looking across to the pits. Dragging, zooming, a map control or a pick from the list stops a tour where it is. Under reduced motion the buttons are hidden.

**Still to do:** checking the frame rate on a phone, now with these running too.

### 8. The info panels are thin

A panel shows the precinct, the name, one sentence and a preview picture ([info-panel.ts](../src/ui/info-panel.ts)). High-end maps use this space for key facts and a next step as well.

**Built so far:** every location has an illustrated preview, in the panel and under its sidebar row. The selected location goes into the address as `?location=<id>` ([address.ts](../src/ui/address.ts)), so a link opens the map on it.

Below the description, the panel lists the closest gate and the closest car park, measured in a straight line ([related.ts](../src/layout/related.ts)). Picking one flies to it. Roads and tracks have none.

**Still to do:** room for facts BMR supplies.

**Done when:** someone can send a link to a location, and its panel says more than the label does.

## Suggested order

| Order | Item | Size | Effect |
| --- | --- | --- | --- |
| 1 | Selection highlight (built) | Small | High |
| 2 | Soft shading and ground contact (built) | Medium | High |
| 3 | Ground dressing (built) | Medium | High |
| 4 | Opening view and fly-in (built) | Small | Medium |
| 5 | Shadow quality (built) | Small | Medium |
| 6 | Model detail (built) | Large | High |
| 7 | Info panels and links (links built, BMR facts to come) | Medium | Medium |
| 8 | Movement, lap and arrival routes (built) | Large | Medium |

The map still hasn't been timed on a real phone. `pnpm perf` counts draw calls and triangles in six fixed views, on the high tier at desktop size and the low tier at phone size, and compares them with `tools/perf/baseline.json`. Items 2 to 4 and 7 added 5 to 28 draw calls per view. Simpler far trees took 13,000 to 330,000 triangles off. For example, the opening view on the low tier at phone size went from 593,000 triangles in 588 draws to 443,000 in 601. Its timings come from this machine's GPU in headless Chrome and say nothing about a phone.

## Not covered by this review

- Frame rate on phones. The desktop figures are 60 fps at 1x resolution, with 85 to 133 draw calls and about 510,000 triangles in close views
- Accessibility. A scripted check on 12 November 2026 found every button and field named, every image with alt text, and text contrast between 5.5:1 and 12.8:1. The closed sidebar is `inert`, so it's out of the tab order. Movement and flights respect reduced motion. Nobody has tested it with a screen reader
- A side-by-side test against live competitors. The comparison draws on general knowledge of these kinds of map and a few published examples
