# Visual improvements

A review of the map against high-end interactive site maps, from November 2026, and the work that would close the gap. Only item 1 is built so far. The scores are from before it.

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

**Built.** A selected building keeps its own materials under a light cyan tint, with a cyan line on the ground around its footprint ([selection-outline.ts](../src/scene/selection-outline.ts)), and the rest of the site mutes around it. Hover uses a lighter tint and doesn't mute anything. Closing the details returns to the current event mode's muting. Flat areas, roads and gates keep a strong tint, with no outline.

**Done when:** a selected building is obvious from the whole-site view and still recognisable as that building up close.

### 2. Buildings have no soft shading or contact with the ground

The light is one sun plus a hemisphere light ([lighting.ts:41](../src/scene/lighting.ts:41)), and the renderer draws straight to the screen with no post-processing ([main.ts:131](../src/main.ts:131)). Nothing darkens corners, undersides or the line where a wall meets the ground, so buildings look placed on top of the map.

Bake ambient occlusion into the kit in the model generator, as vertex colours, and draw a soft dark decal around each building from its footprint. That costs almost nothing at runtime, which a screen-space pass on phones wouldn't. Three things to handle along the way:

- The building highlight already keeps vertex colours. The strong highlight on flat shapes still turns them off
- Tiled models such as grandstand bays need to match at their seams
- The generated files change, so `pnpm assets:validate` and `pnpm assets:determinism` need to pass again

**Done when:** buildings look grounded in a screenshot with the sun's shadows turned off.

### 3. The ground around the buildings is empty

The paddock, arrival plaza and car parks are plain grey shapes, and the grass is one even tone. Cars only appear in the event modes ([scenery.ts:597](../src/draw/scenery.ts:597)), so the default view shows large empty car parks. The ground takes up more of a close view than the buildings do.

Add parking bay lines, plaza paving patterns, footpaths between the main buildings, mowed-grass variation and tree-lined edges. Show a light scatter of parked cars in the whole-site view. Drawing bays and paving into shared textures or merged geometry keeps the draw calls down.

**Done when:** the view from a fly-to has no large featureless area.

### 4. The models are plain up close

The kit is flat-shaded with no textures, and facades are strips of colour. The pit / conference building, the most important model on the map, is 1,288 triangles. Selecting something brings the camera close enough to show this.

Add detail in the generator, starting with the buildings people are most likely to select: window mullions, floor bands, roof plant, canopy edges and entrance canopies. Use a small shared texture for facades if geometry gets too expensive. Check the triangle counts against the phone budget after each batch.

**Done when:** the pit / conference building, Grandstand A and the Waterfront Hotel hold up at the distance a fly-to stops at.

### 5. Shadows are coarse

One shadow map covers 3.6 km ([lighting.ts:11](../src/scene/lighting.ts:11)). That's about 0.9 m per shadow pixel on the high tier and 1.8 m on the low tier. The end wall of Grandstand A shows blotches that look like shadow artifacts, which still needs confirming.

Tighten the shadow area to the built part of the site, or bake the static shadows. Adjust the shadow bias if the blotches come from the shadow map.

**Done when:** building shadows have clean edges at fly-to distance and the grandstand end wall is clear.

### 6. The opening view undersells the site

The opening camera ([view.ts:13](../src/scene/view.ts:13)) leaves the site in about a third of the frame, off-centre, with farmland in front and a blank haze above. The first impression is mostly wheat.

Reframe the opening so the circuit and lake fill the view, and add some cloud or atmosphere to the sky. Add a short fly-in once loading ends, skipped under `prefers-reduced-motion`.

**Done when:** a screenshot of the first frame works as a slide in the deck.

### 7. Nothing moves

The scene is completely still. A few moving things would make it feel more alive: shimmer on the lake, cars lapping on a race weekend, the shuttle running.

Render continuously only while something visible is animating, and keep moving objects out of the shadow pass. The nice-to-haves in [overview.md](overview.md#nice-to-have-it-would-make-the-pitch-land-harder), the lap of the circuit and the arrival routes, belong in this item.

**Done when:** a race weekend has visible movement and the map stays idle in the other views when nothing is happening, with the frame rate holding on a phone.

### 8. The info panels are thin

A panel shows the precinct, the name and one sentence ([info-panel.ts:17](../src/ui/info-panel.ts:17)). High-end maps use this space for images, key facts and a next step. A selection can't be shared either, because the address only carries `?quality` and `?stats`.

Add an image rendered from our own scene, room for facts BMR supplies, and links between related places such as a grandstand and its nearest gate and car park. Put the selected location in the address so a link opens on it.

**Done when:** someone can send a link to a location, and its panel says more than the label does.

## Suggested order

| Order | Item | Size | Effect |
| --- | --- | --- | --- |
| 1 | Selection highlight (built) | Small | High |
| 2 | Soft shading and ground contact | Medium | High |
| 3 | Ground dressing | Medium | High |
| 4 | Opening view and fly-in | Small | Medium |
| 5 | Shadow quality | Small | Medium |
| 6 | Model detail | Large | High |
| 7 | Info panels and links | Medium | Medium |
| 8 | Movement, lap and arrival routes | Large | Medium |

Time the map on a real mid-range phone before item 2 and again after item 3. The budget is unknown until someone does.

## Not covered by this review

- Frame rate on phones. The desktop figures are 60 fps at 1x resolution, with 85 to 133 draw calls and about 510,000 triangles in close views
- Accessibility
- A side-by-side test against live competitors. The comparison draws on general knowledge of these kinds of map and a few published examples
