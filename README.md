# Interactive 3D Map

An interactive 3D concept map of the planned **Blue Mountain Racing** motorsport destination in the Swartland, north of Cape Town, built with [Three.js](https://threejs.org). Part of Protium's partnership proposal to BMR. Visitors can orbit, zoom and pan around the circuit and precinct, click a building to see what it is, and search for a place to fly the camera to it.

The layout is illustrative. There's no published masterplan yet.

**Status:** Phases 1 to 4 of the build plan are done: the whole concept site, drawn from [src/data/locations.json](src/data/locations.json), on farmland you can move around, with name labels, details for everything on the map, and a searchable sidebar with precinct filters.

## Docs

- [docs/overview.md](docs/overview.md): what we're building, the reference we're improving on, and the feature list
- [docs/plan.md](docs/plan.md): the simplified build plan, phase by phase

## Planned stack

| Piece | Choice |
| --- | --- |
| Rendering | Three.js |
| Language | TypeScript |
| Dev server / build | Vite |
| Camera | `MapControls` (from `three/addons`) |
| Labels | `CSS2DRenderer` (HTML labels pinned to 3D positions) |
| 3D models (later) | glTF / `.glb`, made in Blender |
| Map content | A JSON file describing every location |

## Running it

```bash
npm install
npm run dev
```

`npm run build` checks the circuit, type-checks and writes a production build to `dist/`.

`npm run check:layout` measures the circuit in the layout data and fails if it misses BMR's length, straight or width targets.

Left-drag pans, right-drag rotates and scrolling zooms. On touch, one finger pans and two fingers zoom and rotate.

Pointing at a location or its label highlights it. Clicking or tapping opens its details and moves the camera to it. Clicking empty ground, the close button or Escape closes the details.

The sidebar lists every location by precinct. Typing in the search box filters the list, and Enter goes to the first match. Each precinct's switch fades it and its labels in or out. Picking a location in a hidden precinct brings that precinct back. "Reset view" closes the details and returns to the opening view. On a phone the sidebar is a sheet along the bottom: tap or drag its top strip to open it.
