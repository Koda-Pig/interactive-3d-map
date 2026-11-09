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
- **Free camera.** Rotate, tilt and zoom within limits that keep the view sensible.
- **Interactive objects.** Pointing at something highlights it. Clicking it opens an info panel and moves the camera to it.
- **Sidebar and search.** Picking "Grandstand B" from the list moves the camera to Grandstand B.
- **Category filters.** Turn a precinct on or off (Racing, Conference, Hospitality, Parking and transport, and so on).
- **Labels in the scene.** Names float above places and stay readable while you move.
- **Content from a data file.** Every location is described in JSON, so the layout can change without code changes.

### Nice to have (it would make the pitch land harder)

- **Race weekend / conference day toggle** (built). The same site in two modes: grandstands and gates active, or halls and the amphitheatre highlighted. It shows the "one venue, used all year" point from the deck.
- **A lap of the circuit.** The camera follows the track once round.
- **Arrival routes.** Animated lines from the N7, the car parks and Kalbaskraal station to the gates.

## What goes on the map

| Category | Things on the map | How it's drawn at first |
| --- | --- | --- |
| Racing | Circuit, pit lane, pit / conference building, grandstands, general admission banks | The track is a ribbon along a closed curve that follows the ground. The buildings are footprint shapes raised to a height |
| Conference and events | Exhibition halls, amphitheatre, arrival plaza and gateway arch | Raised shapes. The amphitheatre is a stepped curved bowl |
| Hospitality and waterfront | Hotels, lake, promenade, lakeside restaurants | Raised shapes, with a flat water surface |
| Academy and automotive | Driving academy, karting track, automotive hub | Simple buildings, and a second smaller track ribbon |
| Residential and commercial | Trackside housing, retail, research and technology | Groups of simple blocks |
| Parking and transport | Car parks, shuttle drop-off, the N7 and its interchanges, Kalbaskraal station and fan walk, the aerodrome | Flat areas, road strips, a dotted path |
| Entrances | Gates 1 to 14 (a placeholder count, from the deck's demo data) | Small markers |
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
  "id": "grandstand-b",
  "name": "Grandstand B",
  "category": "racing",
  "type": "building",
  "footprint": [[120, 40], [200, 40], [200, 62], [120, 62]],
  "height": 18,
  "color": "#E8ECEF",
  "description": "Covered grandstand on the main straight. Illustrative."
}
```

The layout lives in `src/data/locations.json`, as a `locations` list, `grading` zones (terraces levelled as one, so everything standing on them shares a ground height) and `events`: the ways the venue is used, each naming the precincts and locations in use.

- `type`: `building`, `area`, `water`, `track`, `road` or `gate`
- `major`: set to `true` to keep the name label up when zoomed out. Other labels only appear within about 1.5 km of the camera
- `footprint`: the outline's corners, in metres on the ground. A corner is `[x, z]`, or `[x, z, radius]` to round it
- `height`: how tall a building is, in metres
- `parts`: used instead of `footprint` and `height` by buildings with several volumes. Each part has its own `footprint` and `height`, and can add `base` (how far above the ground it starts) and `color`
- `model`: on a building or one of its `parts`, a `.glb` from `public/models` that replaces the simple shape and is fitted to its footprint. It has a `file`, a `facing` (`north`, `east`, `south` or `west`), and optionally a `grid` of `[columns, rows]`, or an `endCap` file that makes `file` a tile repeated between two end pieces. If the file can't be loaded, the simple shape is drawn
- `planting`: on an area, `park` scatters trees through it and `edge` lines its edge with them
- Tracks and roads use `path` (a list of points, rounded the same way) instead of `footprint`, plus `width`. Optional: `closed`, `branches` (more paths in the same location), `median`, `dashed`, `kerbs`, `runoff`
- Gates use `position`: one `[x, z]` point

## Not in scope yet

- Indoor plans of buildings
- Turn-by-turn directions
- Live data (gate status, crowd levels)
- A visual editor for the layout
