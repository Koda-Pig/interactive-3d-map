# Interaction issues

A review of how the map behaves in use, from November 2026. [improvements.md](improvements.md) covers how it looks. This covers the camera, clicking, labels and frame cost.

## Fixed

| Issue | What changed | Where |
| --- | --- | --- |
| The wheel zoomed towards the middle of the view, not the pointer | The wheel zooms towards the pointer | [view.ts](../src/scene/view.ts) |
| Turning the view needed a right-drag or Shift-drag, and nothing said so | A compass and zoom buttons, a hint that goes after the first move, arrow keys to pan, and plus and minus to zoom while the map has focus | [map-controls.ts](../src/ui/map-controls.ts), [main.ts](../src/main.ts) |
| Flying to a selection centred it in the whole map, so the details panel covered part of it | Flights frame the selection in the largest part of the map with nothing over it | [overlays.ts](../src/ui/overlays.ts), [flight.ts](../src/scene/flight.ts) |
| The opening view suited one window shape. On a phone it cut off the circuit | The opening view pulls back to hold a 900 m circle around the circuit and lake, whatever the shape. Reset view does the same | [view.ts](../src/scene/view.ts) |
| A stray click on a road or the ground flew the camera away | Only buildings, gates and name labels move the camera when clicked. Roads, tracks, flat areas and water open their details where they are. Picking from the sidebar still flies | [interaction.ts](../src/scene/interaction.ts) |
| Muting turned the lake grey, like paving | Water never mutes, around a selection or in an event mode | [precincts.ts](../src/scene/precincts.ts), [event-modes.ts](../src/scene/event-modes.ts) |
| Selecting the circuit turned its runoff bright cyan | The highlight leaves runoff alone and tints the track | [ribbons.ts](../src/draw/ribbons.ts), [materials.ts](../src/draw/materials.ts) |
| Turning off "Parking and transport" removed every road | That precinct's roads stay drawn. While it's off they can't be clicked and have no labels | [precincts.ts](../src/scene/precincts.ts) |
| Labels showed under the details panel, event switch and notice | A label hides when it would sit under anything on top of the map | [labels.ts](../src/scene/labels.ts) |
| Two overlapping labels could swap as the camera moved | Within each rank, a label that's already up keeps its place | [labels.ts](../src/scene/labels.ts) |
| Every label was repositioned on every frame, shown or not | Hidden labels leave the page once they've faded. In a close view that was 9 of 114 on the page | [labels.ts](../src/scene/labels.ts) |
| A precinct fade redrew the shadow map on every frame | Shadows are redrawn once, when the precinct's objects appear or go | [precincts.ts](../src/scene/precincts.ts) |

## Still open

- **Labels vanish when they touch the map's edge.** Letting them run off the edge was tried. Half a name at the edge looked worse, so they still fade out over 150 ms.
- **Shadows change after the camera stops.** The shadow pass waits 180 ms and then refits to the view ([sun-shadow.ts](../src/scene/sun-shadow.ts)). This comes from reading the code. Nobody has confirmed how visible it is.
- **Nothing is culled.** A view of an empty field still drew 525,000 triangles, because the scenery is merged into a few large meshes.
- **Selecting a road still mutes the whole site** and scrolls the sidebar to its row, even though the camera now stays put.
- **In a small window, a large selection sits low.** The clear part of the map is the strip under the details panel, so the circuit is framed in the lower half.

## Not measured

Frame times, the cost of picking on hover, and anything on a real phone. The checks ran in a desktop browser at 1024 by 768 and at an emulated 375 by 812.
