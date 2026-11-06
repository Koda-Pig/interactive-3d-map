# Overview

## What we're building

An interactive 3D map of the planned **Blue Mountain Racing** motorsport destination. It runs in the browser and renders in real time with Three.js. Instead of looking at a fixed picture, people can move around the site and look at it from any angle.

It's a concept piece for Protium's software partnership proposal to Blue Mountain Racing (BMR). The proposal lives in the `Protium.PitchDecks` repo, under `apps/web-base/src/clients/blue-mountain-racing`. The deck's fan app and operations dashboard concepts both include a venue map. This project turns that idea into something you can actually use. It's a standalone site that lives only in this repo, separate from the deck.

## About the site

What we know, from the pitch deck and bluemountainracing.com:

- A planned year-round motorsport destination in the **Swartland, near Malmesbury**, about an hour north of Cape Town
- Reached by the **N7**. **Kalbaskraal station** is within walking distance, and three airports are within about 40 minutes
- First event targeted for **2031**. The wider development is reported at R6.7 billion
- A proposed **FIA Grade 1 and FIM-standard circuit**, developed from an existing layout
- Planned for up to **125,000 people a day** on a race weekend
- The circuit is surrounded by a permanent precinct:
  - **Pit and paddock** building, which doubles as convention and exhibition space
  - **Conferences and exhibitions**
  - **Entertainment and amphitheatre**
  - **Hospitality and waterfront**
  - **Residential and lifestyle**
  - **Business and innovation**
  - **Driving academy and karting**, plus track days

**There is no published masterplan and there are no reference photos.** The layout on our map is invented. It's a believable arrangement of the pieces above, not BMR's real plan, and the map has to say so on screen (for example, "Concept layout, for illustration only").

### Setting rules (carried over from the deck)

- Rolling **Swartland farmland**: golden wheat fields, low hills, big open sky
- **Never** put the circuit next to Table Mountain or the sea
- No F1, MotoGP, FIA or FIM logos or official branding
- No invented BMR logo. Use the plain text "Blue Mountain Racing" as the wordmark
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

- **Race weekend / conference day toggle.** The same site in two modes: grandstands and gates active, or halls and the amphitheatre highlighted. It shows the "one venue, used all year" point from the deck.
- **A lap of the circuit.** The camera follows the track once round.
- **Arrival routes.** Animated lines from the N7, the car parks and Kalbaskraal station to the gates.

## What goes on the map

| Category | Things on the map | How it's drawn at first |
| --- | --- | --- |
| Racing | Circuit, pit lane, pit and paddock building, grandstands, race control tower | The track is a ribbon along a closed curve. The buildings are footprint shapes raised to a height |
| Conference and events | Exhibition halls, amphitheatre | Raised shapes. The amphitheatre is a stepped curved bowl |
| Hospitality and waterfront | Hotel, paddock suites, waterfront terrace, a dam or lake | Raised shapes, with a flat water surface |
| Academy | Driving academy, karting track | A small building, and a second smaller track ribbon |
| Residential and business | Housing, business park | Groups of simple blocks |
| Parking and transport | Car parks, shuttle drop-off, the N7 link road, the walking route from Kalbaskraal | Flat areas, road strips, a dotted path |
| Entrances | Gates 1 to 14 | Small markers |
| Setting | Farmland, hills, trees | Gently rolling ground with wheat-coloured fields |

## Look and feel

A **clean, simplified** style, like a well-made game map, not realistic. With no photos to work from, a simplified style looks good much sooner and doesn't pretend to show the real place.

- Ground: warm wheat golds and dry greens, with the hills rising gently towards the edges
- Track: dark asphalt with red and white kerbs
- Buildings: off-white and light grey, with BMR navy `#004272` and teal `#00678C` as accents
- Highlight and selection: cyan `#1CA7EC`, Protium's accent colour for this client
- Interface (sidebar, panels): BMR's style from the deck. Roboto, navy bars, teal buttons, 8px corners

## Location data (first draft)

```json
{
  "id": "grandstand-b",
  "name": "Grandstand B",
  "category": "racing",
  "type": "building",
  "footprint": [[120, 40], [200, 40], [200, 62], [120, 62]],
  "height": 18,
  "color": "#E8ECEF",
  "model": null,
  "description": "Covered grandstand on the main straight. Illustrative."
}
```

- `footprint`: the outline's corners, in metres on the ground
- `height`: how tall a building is, in metres
- `model`: optional `.glb` file that replaces the simple shape
- Tracks and roads use `path` (a list of points) instead of `footprint`. For tracks, add `closed: true` and `width`

## Not in scope yet

- Indoor plans of buildings
- Turn-by-turn directions
- Live data (gate status, crowd levels)
- A visual editor for the layout
