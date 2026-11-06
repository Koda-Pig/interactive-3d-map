# Build Plan

Five small phases. Each one ends with something you can open in a browser and use.

## Phase 1: A scene you can move around

- A Vite + TypeScript project with Three.js
- Light the scene like late-afternoon Swartland sun, with shadows
- Gently rolling ground: flat in the middle where the site sits, rising into low hills at the edges, in wheat and dry-green colours
- Camera controls: drag to pan, right-drag to rotate, scroll to zoom
- Camera limits: you can't go below the ground or zoom so far out that the scene is lost
- Everything resizes with the window

**Done when:** you can move around empty farmland.

## Phase 2: Lay out the site and draw it from data

There's no masterplan, so we draw one first.

- Sketch the layout on a 2D grid in metres:
  - A circuit about 5 km long, as a closed curve, with long straights, a hairpin and a fast sweeping section
  - The pit straight, with the pit and paddock building beside it
  - Grandstands A to D, placed on the main straight and at the best corners
  - The conference halls and amphitheatre, close to the paddock so they share parking
  - The hotel and waterfront terrace on a dam
  - The academy and karting track
  - Residential and business blocks on the outer edge
  - Car parks, Gates 1 to 14, the N7 link road and the walking route from Kalbaskraal station
- Write it into `src/data/locations.json`
- Draw each type of thing from that file:
  - Buildings: footprint outlines raised to their height
  - Track and roads: ribbons along the path, with kerbs on the circuit
  - Areas and water: flat shapes
  - Gates: markers
- Show "Concept layout, for illustration only" on screen

**Done when:** the whole site appears from the JSON, and the layout looks believable from above.

## Phase 3: Interaction

- Pointing at something highlights it in cyan and changes the cursor to a pointer
- Clicking opens an info panel (name, precinct, short description) and smoothly moves the camera to frame it
- Floating name labels. Minor labels hide when you're zoomed out, so they don't overlap

**Done when:** you can click anything on the map and find out what it is.

## Phase 4: Sidebar, search, filters

- A sidebar that lists every location, grouped by precinct
- A search box that filters the list as you type
- Picking an item from the list does the same as clicking it in 3D
- Precinct toggles fade those locations and their labels in or out
- A "reset view" button
- On a phone, the sidebar becomes a panel that slides up from the bottom, and the camera works with touch

**Done when:** someone can type "Grandstand B" and end up looking at it.

## Phase 5: Polish and pitch extras

- Trees, light poles, fences and a wheat-field texture, drawn efficiently enough to keep it fast
- Better materials, a sky, and softer shadows
- At least one of the nice-to-haves from [overview.md](overview.md): the race weekend / conference day toggle, a lap of the circuit, or arrival routes
- Swap in `.glb` models for the key buildings if anyone makes them
- Check the frame rate on a mid-range phone

**Done when:** it's good enough to put in front of BMR.

## Decided

- **Site:** Blue Mountain Racing, Swartland, near Malmesbury
- **Reference material:** none. The layout is invented and labelled as a concept
- **Style:** clean and simplified, in the BMR and Protium colours
- **Where it lives:** only in this repo, as a standalone site. It doesn't go into the pitch deck

## Still open

1. **Circuit shape.** BMR says the circuit is "developed from a layout with an established motorsport foundation". Do we know which layout, or do we invent one?
2. **How much detail on the wider precinct?** The residential, business and waterfront zones could be simple blocks, or left out so the circuit and venue get the attention.
3. **Which nice-to-have matters most for the pitch?** The race weekend / conference day toggle tells the deck's story best.
