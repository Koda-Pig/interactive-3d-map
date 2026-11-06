# Interactive 3D Map

An interactive 3D concept map of the planned **Blue Mountain Racing** motorsport destination in the Swartland, north of Cape Town, built with [Three.js](https://threejs.org). Part of Protium's partnership proposal to BMR. Visitors can orbit, zoom and pan around the circuit and precinct, click a building to see what it is, and search for a place to fly the camera to it.

The layout is illustrative. There's no published masterplan yet.

**Status:** planning. No code yet.

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

Not set up yet. Once Phase 1 of the plan lands this will be:

```bash
npm install
npm run dev
```
