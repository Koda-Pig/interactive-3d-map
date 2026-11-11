# Build Plan

Five small phases. Each one ends with something you can open in a browser and use.

## Phase 1: A scene you can move around

- A Vite + TypeScript project with Three.js
- Light the scene like late-afternoon Swartland sun, with shadows
- Gently rolling ground in wheat and dry-green colours, covering the 600-hectare site (about 2.5 km by 2.5 km) and the farmland around it. Heights come from one shared function, so the track and buildings can sit on the same ground
- Camera controls: drag to pan, right-drag to rotate, scroll to zoom
- Camera limits: you can't go below the ground or zoom so far out that the scene is lost
- Everything resizes with the window

**Done when:** you can move around empty farmland.

## Phase 2: Lay out the site and draw it from data

BMR hasn't published a track map or masterplan, so we draw our own to fit its published targets.

- Sketch the layout on a 2D grid in metres:
  - The circuit as a closed curve: about 4.8 km long, at least 12 m wide, a start-finish straight of at least 600 m, a separate straight of at least 1 km, and heavy braking zones for overtaking
  - The pit / conference building along the start-finish straight
  - Grandstands A to E and grass general admission banks, at the main straight and the best corners
  - The arrival plaza and gateway arch, with the amphitheatre and conference halls nearby
  - The lake with its promenade, restaurants and hotels
  - The academy, karting track and automotive hub
  - Trackside housing facing the circuit, with retail and research blocks further out
  - The N7 along one edge with its interchanges, plus car parks, Gates 1 to 14, Kalbaskraal station, the fan walk and the aerodrome
- Write it into `src/data/locations.json`
- Add a small check that measures the circuit and fails if it misses the length, straight or width targets
- Draw each type of thing from that file:
  - Buildings: footprint outlines raised to their height, on levelled patches of ground
  - Track and roads: ribbons along the path that follow the ground height, with kerbs on the circuit
  - Areas and water: flat shapes
  - Gates: markers
- Show "Concept layout, for illustration only" on screen

**Done when:** the whole site appears from the JSON, and the layout looks believable from above.

## Phase 3: Interaction

- Pointing at something brightens it and changes the cursor to a pointer. The selected thing gets an amber line around it
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
- Check the frame rate on a mid-range phone (open with `?stats`; see the [README](../README.md#checking-performance))

**Done when:** it's good enough to put in front of BMR.

**Status:** built, with the race weekend / conference day toggle as the nice-to-have. The kit's models replace the key buildings. The phone tier draws about 375,000 triangles in 175 draw calls, or about 430,000 on a race weekend. It hasn't been timed on a real phone yet.

## Decided

- **Site:** Blue Mountain Racing, Swartland, near Malmesbury
- **Reference material:** BMR's published specs and artist's impressions. There's no public track map or masterplan
- **Circuit shape:** invented to match BMR's published targets, and labelled as a concept
- **Style:** clean and simplified, in the BMR and Protium colours
- **Where it lives:** only in this repo, as a standalone site. It doesn't go into the pitch deck
- **First nice-to-have:** the race weekend / conference day toggle, because it tells the deck's story best
- **Wider precinct:** the residential, business and waterfront zones are on the map, drawn with the kit's models
