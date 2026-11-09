# Circuit and infield layout requirements

Recorded 9 November 2026 after the user's review of eight supplied circuit photographs.

Status: implemented and visually reviewed on 9 November 2026. This document records the required relationships and the implemented arrangement below. The circuit remains an illustrative concept, not a published BMR masterplan or a homologated design.

## Why the layout needs to change

The user identified too much unused space inside the circuit. The supplied photographs show several ways circuits use that space: pit and paddock compounds, hospitality areas, access roads, landscaped ground, and shaped runoff areas. They also show substantial open areas. Filling every gap with buildings would miss the reference just as much as leaving the interior undifferentiated.

Before this correction, the layout put `pit-lane`, `pit-conference-building`, and `paddock` west of the start-finish straight, outside the circuit. `grandstand-a` and `grandstand-b` occupied its eastern, infield side. That arrangement concentrated the racing facilities outside and contributed to the empty appearance inside.

The infield contains the academy, karting facilities, automotive facilities, and `infield-park`. Retain those functions or deliberately relocate them when making room for the pit complex. They are not vacant land.

The intended correction is a connected, visibly organised infield. Change the placement and use of facilities first. Reassess the track shape after that work.

## Required spatial relationships and their reasons

| Element | Intended change | Reason |
| --- | --- | --- |
| Pit complex | Move the pit lane to the eastern, infield side of the start-finish straight. Place the garage building behind it, with garages facing the lane. | Concentrates racing operations inside the circuit and gives the largest empty area a clear purpose. This is a choice for this concept, not a rule that all real circuits have infield pits. |
| Main grandstands | Move Grandstands A and B to the outside of the straight, facing the pit complex. | Preserves the view across the grid and garages while freeing the infield edge for racing operations. |
| Paddock | Place the paddock immediately behind the garages. Provide rows of team transporters, equipment awnings, support structures, loading spaces, and connected service aisles. | A paddock needs visible organisation and room for operations. A plain paved rectangle does not communicate that use. |
| Hospitality | Add a distinct infield hospitality compound near a useful track view, with marquees or pavilions, terraces, shaded courtyards, and footpaths. | Creates a second area of activity and explains how guests use the infield. Keep guest paths separate from team loading and service aisles. |
| Conference access | Retain a legible public entrance and pedestrian route to the conference floors of the pit building. | Relocating the building must preserve its year-round conference role. |
| Infield access | Connect the paddock, hospitality, academy, and automotive facilities to a service road network. Show tunnel portals or a bridge where access crosses the circuit. | Facilities inside a closed circuit need a credible way in. A road description mentioning a tunnel is insufficient if the scene shows an unexplained crossing. |
| Open ground | Keep defined grass, planting, drainage areas, and open ground between compounds and track sections. | The references contain open space with a visible purpose. Avoid scattering unrelated buildings through every gap. |

For the pit complex, preserve this sequence from the straight into the infield:

`racing surface → pit wall → pit lane and working apron → garages → paddock → service access`

Exact footprints and offsets remain design work. Resolve conflicts with existing facilities, terrain grading, public access, and corner runoff before committing positions.

## Runoff and barriers must follow the corner geometry

Before this correction, the circuit had one `runoff` value of 12 m. `src/draw/ribbons.ts` drew that band on both sides of the entire circuit. `dressCircuit` in `src/draw/scenery.ts` placed barriers at a matching fixed offset.

Replace this uniform treatment with local runoff shapes and barrier alignments. Use broader areas beyond selected braking zones and corner exits, with smaller verges where appropriate along straights. Combine paved runoff, gravel, and grass deliberately. BMR teal and navy can distinguish selected painted areas, drawing on the visual treatment in the supplied references.

Keep occupied buildings, hospitality, and spectators behind the intended protective boundary and clear of runoff. When runoff changes, update barriers, fences, marshal placements, and nearby facilities together. Merely painting a larger area while leaving the barrier close to the racing surface does not resolve the layout.

These are requirements for a credible concept illustration. The photographs do not establish safe dimensions or regulatory compliance. Actual runoff and protective systems require specialist circuit design.

## Track geometry after the second review

The first relocation pass kept the circuit path. The user then reported that the overall layout still looked the same and approved a second pass covering both a tighter circuit and clearer infield uses. The eastern technical section and southern return now move inward. The return from the long-straight hairpin extends farther west to retain the lap length. This replaces the earlier decision to leave the circuit outline unchanged.

Preserve the project targets recorded in [the overview](../docs/overview.md): approximately 4.8 km per lap, a start-finish straight of at least 600 m, a separate full-throttle straight of at least 1 km, and at least 12 m of track width. Keep natural elevation and intended overtaking opportunities.

## Review criteria for implementation and future changes

Review every affected criterion when changing this layout:

- From above, the pit lane and garages occupy the infield side of the start-finish straight. The main grandstands face them from outside.
- The paddock connects directly to the rear of the garages. Team rows, loading areas, and usable service aisles remain visible.
- Hospitality has a connected pedestrian route and is separated from team service traffic and runoff.
- The conference entrance remains accessible in conference mode.
- Infield access has visible crossing infrastructure and connects to the facilities it serves. Roads do not appear to cross an active racing surface at grade.
- The academy, karting, and automotive functions remain accounted for, with no overlapping footprints or blocked access after relocation.
- Open areas have identifiable uses. Runoff shapes and barrier positions vary with local track geometry.
- Buildings, roads, and tunnels meet the terrain coherently. Update grading zones with relocated facilities.
- The default view shows the permanent organisation of the venue. Race mode adds temporary team and guest activity without being the only mode that explains the infield.
- Inspect an overhead view and close views of the pit complex, hospitality, and access crossing in the running app. Check both race and conference modes.
- Run `pnpm check:layout` and `pnpm build` after implementation. Their success does not establish realistic access, usable paddock circulation, or suitable runoff. Those require the visual review above.

When revising these decisions, record the replacement arrangement and its reason here in the same change. Use new user direction or better site evidence to justify a revision. Earlier coordinates and screenshots alone are not evidence that the earlier arrangement was correct.

## Implemented arrangement

The second pass changes the circuit outline as well as the facilities. The rounded centreline encloses about 84.3 hectares, down from 98.0 hectares in the first relocation pass. That is approximately 14% less enclosed land.

- The start-finish straight remains at `x = -600`. The pit lane runs east of it at `x = -566`, followed by a working apron and west-facing garages. The paddock sits immediately behind the garages, from `x = -482` to `-325`.
- Grandstands A and B sit west of the straight and face east. Grandstands C and D and the affected spectator banks move clear of the enlarged runoff. Banks 2 to 5 follow the revised eastern and southern sections.
- Two permanent team rows contain support units and covered equipment bays. Longitudinal aisles and transverse lanes connect loading courts to the rear service spine. Race mode adds transporters beneath the awnings.
- Hospitality occupies a separate compound west of the vehicle route, with three permanent pavilions, a shade court, a southern viewing terrace, and connected paths. Deliveries reach the northern edge. The public walk reaches the western edge without entering team service aisles.
- A public footbridge crosses the straight and pit exit at `z = 175`, south of Grandstand A. Its eastern ground-level landing connects to the south conference lobby and hospitality walk. The bridge moved south during visual review because its initial position intersected the grandstand roof.
- A separate service bridge at `x = -100` crosses the southern return. Visible decks, parapets, abutments, and ramps replace the unexplained at-grade crossing. Its branches serve the paddock, academy, karting clubhouse, automotive hub, and hospitality delivery entrance.
- The eastern technical section now turns through `x = 390` to `500`, rather than extending to `705`. The long-straight return reaches `x = 280`, and the southern return reaches `z = 115` rather than `170`. The start-finish straight, long straight, pit complex, and western return retain their positions.
- The academy, karting track, and existing automotive facilities retain their footprints. A connected handling loop and slalom compound fill the ground north of the skid pan, with covered briefing bays. The service spur passes between karting and the skid pan, and also connects the skid pan.
- A separate automotive demonstration court occupies part of the central infield, with a low-speed loop, preparation bays, marked display spaces, and permanent display cars. Guest paths remain west of the vehicle route. The park remains as planted grass buffers around the court, with a drainage strip along its northern edge.
- Grading zones level the pit compound, hospitality, handling compound, and park while roads follow the rendered terrain. The opening camera is higher and points towards the infield so these relationships are visible without first rotating the map.
- Four-metre grass verges replace the uniform 12 m band. Six local outside runoff profiles widen selected corners, with teal or navy paving and gravel. `src/layout/track-safety.ts` supplies the same widths to the ribbons, protective boundary, marshal placements, and scenery exclusion rules. Elevated crossings do not remove the barriers beneath them.

### Implementation review

The revised running app was inspected from above and in close views of the pits, hospitality, both bridges, the eastern technical section, and the new handling compound. All views were checked in whole-site, race weekend, and conference day modes. Permanent facilities remain visible in the default view. Conference mode retains the public bridge, south lobby, and guest walk. Race mode adds team and guest activity.

`pnpm check:layout` measures a 4,802 m lap, a 693 m start-finish straight, a separate 1,067 m straight, and 15 m width. `pnpm build` passes. Geometry tests cover local runoff, the lap seam, occupied footprint clearances, bridge deck height and building conflicts, clear paddock aisles, and the new working compounds. These checks support the concept illustration and do not establish engineering compliance.

## Evidence and limits

The evidence is the user's eight supplied photographs and the layout code reviewed on 9 November 2026. The aerial references show pit and support compounds alongside open land. The close corner references show shaped painted runoff, barriers, nearby stands, and hospitality. These observations guide the composition rather than provide measured engineering dimensions.

This document is the source of truth for the correction. [The overview](../docs/overview.md) remains the source for the wider venue scope and illustrative status.
