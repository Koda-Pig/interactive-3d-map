# Overview

## What we're building

An interactive 3D map of the planned **Blue Mountain Racing** motorsport destination. It runs in the browser and renders in real time with Three.js. Instead of looking at a fixed picture, people can move around the site and look at it from any angle.

It's a concept piece for Protium's software partnership proposal to Blue Mountain Racing (BMR). The proposal lives in the `Protium.PitchDecks` repo, under `apps/web-base/src/clients/blue-mountain-racing`. The deck's fan app and operations dashboard concepts both include a venue map. This project turns that idea into something you can actually use. It's a standalone site that lives only in this repo, separate from the deck.

## About the site

What we know, from the pitch deck, [bluemountainracing.com](https://www.bluemountainracing.com/the-vision.html) (checked November 2026) and press coverage:

**The land**

- A **600-hectare** site in the **Swartland, near Malmesbury**, about an hour north of Cape Town. That's roughly 2.5 km by 2.5 km
- **Direct frontage onto the N7**, with multiple highway interchanges
- **Kalbaskraal station** within walking distance, connected by a "fan walk"
- Three airports within about 40 minutes, including an **adjacent aerodrome**

**The circuit** (published targets, which we should match)

- About **4.8 km** long
- A start-finish straight of **at least 600 m**
- A full-throttle straight of **at least 1 km**
- At least **12 m** wide throughout
- **Natural elevation**: the track follows the lie of the land
- Multiple overtaking spots
- About **125,000 spectators a day**, across grandstands and general admission
- Proposed to FIA Grade 1 and FIM standard

**The precinct**, in BMR's own terms

- Proposed FIA Grade 1 and FIM circuit
- Pit / conference building, used for conventions and exhibitions all year
- Amphitheatre and entertainment
- Waterfront and promenade
- Hotels and hospitality
- Trackside and residential
- Commercial and retail
- Research and technology
- Public realm and outdoor space
- Automotive hub with engineering and testing facilities
- Driving academy and karting pathway

**Timing:** construction from 2029, homologation in 2030, first event targeted for 2031. BMR is clear that no Formula 1 or MotoGP race has been secured.

**The circuit shape has not been published.** BMR says it's "developed from a layout with an established motorsport foundation", but nobody names that layout. There's no public track map or masterplan either. Our layout is invented to fit the published targets above, and the map has to say so on screen (for example, "Concept layout, for illustration only").

[Circuit and infield layout requirements](../ai/track-layout.md) records the required correction to the current concept, including infield pits, paddock organisation, access, and local runoff. Read it before changing the circuit or its surrounding facilities.

BMR's [gallery](https://www.bluemountainracing.com/gallery.html) has 11 artist's impressions, marked as indicative. None is an aerial view, so they tell us what things look like but not where they go. We use them as style guides and don't copy them into the map.

### Setting rules

- Rolling **Swartland farmland**: golden wheat fields, low hills, big open sky
- The sea is never in view. **Table Mountain** appears only as a small silhouette on the far southern horizon, as in BMR's fan walk image, because it's about 50 km away
- BMR's Cape Town beachfront fan zone is off site, so it isn't on the map
- No F1, MotoGP, FIA or FIM logos or official branding
- Use the plain text "Blue Mountain Racing" as the wordmark, unless BMR supplies its logo
- No real or real-sounding company names. Use generic ones, such as "Catering partner" or "Hotel"

## The reference

The Johannesburg Expo Centre map (https://expocentre.co.za/map/) shows the kind of interaction we want. It's built with Mapplic, a WordPress plugin:

- One pre-rendered isometric image with clickable spots on top
- A sidebar listing every location, with search
- Category filters (parking, entrances, halls and so on)
- Zoom and pan from one fixed angle only

We keep the list, search, filters and info panels, and replace the flat picture with a real 3D scene you can rotate.

## What it does

- **Real geometry.** The circuit, buildings, grandstands, car parks, roads and water are all 3D objects.
- **Free camera.** Rotate, tilt and zoom within limits that keep the view sensible. The opening view uses the standard isometric angles: turned 45° from north and looking down at about 35°, through a perspective camera.
- **On-screen controls.** A zoom slider, arrows that move the map, and a compass to drag that rotates and tilts it, for people without a wheel or a right mouse button. Pressing the compass faces north. On a phone only the compass shows, because gestures do the rest.
- **Interactive objects.** Pointing at something highlights it. Clicking it opens an info panel and moves the camera to it.
- **Sidebar and search.** The sidebar starts put away on a wide screen and opens from a "Locations" button. Picking "Grandstand B" from the list moves the camera to Grandstand B.
- **Category filters.** Turn a precinct on or off (Racing, Conference, Hospitality, Parking and transport, and so on).
- **Labels in the scene.** Names float above places and stay readable while you move.
- **Content from a data file.** Every location is described in JSON, so the layout can change without code changes.

### Nice to have (it would make the pitch land harder)

- **Race weekend / conference day toggle** (built). The same site in two modes: grandstands and gates active, or halls and the amphitheatre highlighted. It shows the "one venue, used all year" point from the deck.
- **A lap of the circuit.** The camera follows the track once round.
- **Arrival routes.** Animated lines from the N7, the car parks and Kalbaskraal station to the gates.

## What goes on the map

| Category | Things on the map | How it's drawn |
| --- | --- | --- |
| Racing | Circuit, pit lane, pit / conference building, grandstands, general admission banks | The track is a ribbon along a closed curve that follows the ground. The pit / conference building and grandstands are kit models. The banks are footprint shapes raised to a height, curved where the track beside them is |
| Conference and events | Expo Centre, exhibition halls, amphitheatre, arrival plaza, gateway arch and Grandstand Fan Walk | Kit models, with flat areas for the plaza and forecourt and a road strip for the walk |
| Hospitality and waterfront | Hotels, a man-made lake of two basins with a quay promenade, piazza and terraces, footbridge, marina cove with paddle boats, over-water restaurants, fountain show, fireworks barge | Kit models, with a flat water surface. The terraces, footbridge and restaurant decks are plain shapes. The quay's coping, the fountain's jets and the fireworks are drawn in code, and the fountain and fireworks play while hovered or selected |
| Academy and automotive | Driving academy, karting track and garages, skid pad, automotive hub | Kit models, a second smaller track ribbon, and a marked flat area for the skid pad |
| Residential and commercial | Trackside housing with its streets, tennis courts and pools, retail, research and technology | Groups of kit models, with painted court lines and small water surfaces |
| Parking and transport | Car parks, shuttle drop-off, the N7 and its interchanges, Kalbaskraal station and Station Fan Walk, the aerodrome and its helipad | Flat areas with marked parking rows, road strips and a dotted path, with kit models for the station and aerodrome buildings |
| Entrances | Gates 1 to 14 (a placeholder count, from the deck's demo data) | Kit models of turnstile gates |
| Setting | Farmland, hills, trees, distant Table Mountain silhouette | Gently rolling ground with wheat-coloured fields |

## Look and feel

A **clean, simplified** style, like a well-made game map, not realistic. Nothing has been built and the design isn't final, so a simplified style looks good much sooner and doesn't pretend to show the real place.

Details worth borrowing from BMR's artist's impressions:

- A long pit / conference building with stacked glass floors, slanted columns and a wide canopy
- Grandstands with dark, curved roofs and white fabric canopies
- Timber lakeside pavilions with dark metal roofs
- Stone-clad towers around the arrival plaza
- Warm late-afternoon light across the track and grass banks

Colours:

- Ground: warm wheat golds and dry greens, with low hills around and through the site
- Track: dark asphalt with red and white kerbs
- Buildings: off-white and light grey, with BMR navy `#004272` and teal `#00678C` as accents
- Highlight and selection: cyan `#1CA7EC`, Protium's accent colour for this client
- Interface (sidebar, panels): BMR's style from the deck. Roboto, navy bars, teal buttons, 8px corners

## Location data

```json
{
  "id": "driving-academy",
  "name": "Driving Academy",
  "category": "academy",
  "type": "building",
  "model": { "file": "mixed-use/driving-academy.glb", "facing": "north" },
  "description": "Classrooms and simulators for the academy and karting pathway.",
  "color": "#E8ECEF",
  "footprint": [[-190, -305], [-150, -305], [-150, -283], [-190, -283]],
  "height": 12
}
```

The layout lives in `src/data/locations.json`, as a `locations` list, `grading` zones (terraces levelled as one, so everything standing on them shares a ground height), `landUse` zones (open ground with a use: `wheat`, `vineyard`, `overflow-parking`, `camping` or `fan-village`, which scenery fills wherever nothing else stands) and `events`: the ways the venue is used, each naming the precincts and locations in use.

- Every location has an `id`, a `name`, a `category`, a `type` and a `description`. All but gates also need a `color`
- `category`: `racing`, `conference`, `hospitality`, `academy`, `commercial`, `transport` or `entrances`
- `type`: `building`, `area`, `water`, `track`, `road` or `gate`
- `major`: set to `true` to keep the name label up when zoomed out. Other labels only appear within about 1.5 km of the camera
- `featured`: set to `true` to list the location at the top of its precinct in the sidebar. The rest sit behind "Show more". A precinct with none featured lists everything
- `footprint`: the outline's corners, in metres on the ground. A corner is `[x, z]`, or `[x, z, radius]` to round it
- `height`: how tall a building is, in metres
- `parts`: used instead of `footprint` and `height` by buildings with several volumes. Each part has its own `footprint` and `height`, and can add `base` (how far above the ground it starts) and `color`
- `model`: on a building or one of its `parts`, a `.glb` from `public/models` that replaces the simple shape and is fitted to its footprint. It has a `file`, a `facing` (`north`, `east`, `south` or `west`), and optionally a `grid` of `[columns, rows]`, or an `endCap` file that makes `file` a tile repeated between two end pieces. If the file can't be loaded, the simple shape is drawn
- `image`: a path relative to `public/`, such as `images/locations/lake.webp`, with no leading slash. It's shown in the details card and under the location in the sidebar. Both resolve it against the site's base URL, so images also work when hosted under a sub-path. Without one, a placeholder is shown
- `markings`: on an area, lines painted on it, such as a tennis court's. It has a `color`, a `width` and a list of `lines`, each a path
- `planting`: on an area, `park` scatters trees through it and `edge` lines its edge with them
- Tracks and roads use `path` (a list of points, rounded the same way) instead of `footprint`, plus `width`. Optional: `closed`, `branches` (more paths in the same location), `median`, `dashed`, `kerbs`, `runoff`, `runoffColor`, `step` (spacing of the ribbon's cross-sections, for very long roads)
- The location with the id `circuit` also needs `startFinish`: an `[x, z]` point on the start-finish line, which `pnpm check:layout` uses to find that straight
- Gates use `position`, one `[x, z]` point, and `facing`, the direction people arrive from
- A location whose id starts with `car-park-` gets marked rows, generated from its footprint. It needs a road branch entering through the middle of its long side

## Not in scope yet

- Indoor plans of buildings
- Turn-by-turn directions
- Live data (gate status, crowd levels)
- A visual editor for the layout
