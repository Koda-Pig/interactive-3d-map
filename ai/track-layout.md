# Circuit and infield layout requirements

Recorded 9 November 2026 after the user's review of eight supplied circuit photographs.

Status: implemented and visually reviewed on 9 November 2026. This document records the required relationships and the implemented arrangement below. The circuit remains an illustrative concept, not a published BMR masterplan or a homologated design.

## Why the layout needs to change

The user identified too much unused space inside the circuit. The supplied photographs show several ways circuits use that space: pit and paddock compounds, hospitality areas, access roads, landscaped ground, and shaped runoff areas. They also show substantial open areas. Filling every gap with buildings would miss the reference just as much as leaving the interior undifferentiated.

Before this correction, the layout put `pit-lane`, `pit-conference-building`, and `paddock` west of the start-finish straight, outside the circuit. `grandstand-a` and `grandstand-b` occupied its eastern, infield side. That arrangement concentrated the racing facilities outside and contributed to the empty appearance inside.

Earlier passes placed the academy, karting, and automotive facilities inside the circuit. The user subsequently asked for an infield centred on pits, team tents, and limited VIP activity. Those wider functions now occupy external campuses. Their former footprints are available for the revised circuit, runoff, and operations reserve.

The intended correction is a connected, visibly organised infield. Change the placement and use of facilities first. Reassess the track shape after that work.

## Required spatial relationships and their reasons

| Element | Intended change | Reason |
| --- | --- | --- |
| Pit complex | Move the pit lane to the eastern, infield side of the start-finish straight. Place the garage building behind it, with garages facing the lane. | Concentrates racing operations inside the circuit and gives the largest empty area a clear purpose. This is a choice for this concept, not a rule that all real circuits have infield pits. |
| Main grandstands | Move Grandstands A and B to the outside of the straight, facing the pit complex. | Preserves the view across the grid and garages while freeing the infield edge for racing operations. |
| Paddock | Place the paddock immediately behind the garages. Provide rows of team transporters, equipment awnings, support structures, loading spaces, and connected service aisles. | A paddock needs visible organisation and room for operations. A plain paved rectangle does not communicate that use. |
| Hospitality | Add a distinct infield hospitality compound near a useful track view, with marquees or pavilions, terraces, shaded courtyards, and footpaths. | Creates a second area of activity and explains how guests use the infield. Keep guest paths separate from team loading and service aisles. |
| Conference access | Retain a legible public entrance and pedestrian route to the conference floors of the pit building. | Relocating the building must preserve its year-round conference role. |
| Access | Connect the infield paddock, logistics yard, and hospitality deliveries through a visible operations bridge. Connect the external academy and automotive campuses directly to the ring road. | Restricted racing operations and year-round training traffic need distinct routes. Every circuit crossing must have visible infrastructure. |
| Open ground | Keep defined grass, planting, drainage areas, and open ground between compounds and track sections. | The references contain open space with a visible purpose. Avoid scattering unrelated buildings through every gap. |

For the pit complex, preserve this sequence from the straight into the infield:

`racing surface → pit wall → pit lane and working apron → garages → paddock → service access`

Exact footprints and offsets remain design work. Resolve conflicts with existing facilities, terrain grading, public access, and corner runoff before committing positions.

## Runoff and barriers must follow the corner geometry

Before this correction, the circuit had one `runoff` value of 12 m. `src/draw/ribbons.ts` drew that band on both sides of the entire circuit. `dressCircuit` in `src/draw/scenery.ts` placed barriers at a matching fixed offset.

Replace this uniform treatment with local runoff shapes and barrier alignments. Use broader areas beyond selected braking zones and corner exits, with smaller verges where appropriate along straights. Combine paved runoff, gravel, and grass deliberately. BMR teal and navy can distinguish selected painted areas, drawing on the visual treatment in the supplied references.

Keep occupied buildings, hospitality, and spectators behind the intended protective boundary and clear of runoff. When runoff changes, update barriers, fences, marshal placements, and nearby facilities together. Merely painting a larger area while leaving the barrier close to the racing surface does not resolve the layout.

These are requirements for a credible concept illustration. The photographs do not establish safe dimensions or regulatory compliance. Actual runoff and protective systems require specialist circuit design.

## Current design direction

The user asked to commit the second pass, then improve track realism with a more limited operational infield. Commit `27d41fc` preserves that checkpoint. This revision replaces the training-filled infield with garages, paddock rows, a team logistics yard, compact VIP hospitality, and reserved grass and drainage ground.

The academy and automotive functions remain part of the venue in external campuses. They are deliberately relocated, not removed. The racing section has fewer corners and a flowing middle sequence instead of the previous series of short rectangular bends.

Preserve the project targets recorded in [the overview](../docs/overview.md): approximately 4.8 km per lap, a start-finish straight of at least 600 m, a separate full-throttle straight of at least 1 km, and at least 12 m of track width. Keep natural elevation and intended overtaking opportunities. The user's preference for this concept does not establish that every real circuit has a small infield.

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

The circuit measures about 4,800 m. Its rounded centreline encloses about 62.0 hectares, compared with 84.3 hectares at the checkpoint. The starting straight and separate long straight retain their positions. The middle section uses a 65 m braking corner, a 100 m connecting bend, and an 85 m sweeper before the southern return. The long-straight hairpin uses a continuous 42.5 m radius through its two quarter-arcs. These radii describe the illustration, not a validated speed profile.

- The start-finish straight remains at `x = -600`. The infield sequence remains pit wall, pit lane at `x = -566`, working apron, west-facing garages, paddock, and rear service access. The pit entry leaves the straight before the final western bend, and both entry and exit match the racing direction at their joins. Grandstands A, B and C face the garages and pit exit from outside.
- Two permanent team rows of six contain twelve support units and covered equipment bays, one for each of the eleven 2026 teams and a spare. Clear longitudinal and transverse aisles connect them to the service spine. A northern logistics yard adds equipment tents, truck holding, and a separate loading aisle. Race mode adds transporters in team colours to the covered bays and logistics yard, and team names and colours to each unit's roof and north fascia.
- VIP hospitality remains a compact compound west of the operations bridge, with three pavilions, a shade court, a viewing terrace, and connected paths. Deliveries reach its northern edge. Public access reaches its western edge without entering team loading aisles.
- The Grandstand Fan Walk is a 20 m avenue on the plaza axis from the Gateway Arch to a concourse along the back of Grandstands A and B. The plaza's east edge is only about 120 m from the stands, so the route starts at the arch to read as a 300 m procession. It carries olive trees and team-colour banners all year, and food stalls and crowds in race mode. It is separate from the Station Fan Walk from Kalbaskraal. The concourse stops short of the footbridge, which is still ramped overhead at that point.
- The Expo Centre stands on the west shore of the lake, between Waterfront Drive and the promenade: about 5 hectares of building, as four connected halls on an east-west glazed concourse. The user asked for an expo venue of nearly stadium surface area near the lake. The west shore was chosen over the east for Car Park P8 and proximity to the Arrival Plaza. Its entrance and forecourt face the lake and connect to the promenade. Trucks use a separate loading yard directly off Waterfront Drive, so visitors and freight do not mix. The Expo Walk crosses the public ring road and Waterfront Drive at grade, linking the arrival concourse, Car Park P8, and the forecourt. The two plaza exhibition halls stay as smaller halls. The waterfront terrace extends west under the building.
- The public footbridge crosses the straight and pit exit at `z = 175`, south of Grandstand A. Its eastern ground-level landing connects to the south conference lobby and VIP walk. The operations bridge at `x = -100` crosses the southern racing section and serves the paddock, logistics yard, and hospitality deliveries.
- Karting, classrooms, the skid pad, and the handling compound occupy the south-west academy campus, deliberately to the side of the main venue. Its access road connects to the western ring road and passes around Car Park P8. The handling course is reached from the south, avoiding a circulation road across the skid pad.
- Two rows of small karting garages flank the clubhouse, opening north onto a paved pit apron beside the track, with rear access from the campus road. The user asked for these because small garages normally sit beside a kart track.
- The 100 m skid pad stays beside karting and is now a square-cornered, dark, painted surface with a boundary, two control circles, cones, and an instructor cabin, so it reads as a car-control square rather than a blank rounded pad. The academy campus and handling compound share one terrace, because two overlapping terraces tilted the ground under it and buried its markings.
- The Automotive Hub, test pad, and demonstration compound occupy the eastern campus beside the research precinct. Its access meets the eastern ring road. The station fan walk goes around the campus's eastern side, clear of its buildings and vehicle areas.
- Defined grass and drainage remain between operations and racing surfaces. Those areas follow the terrain and do not create broad flat grading pads. Dedicated terraces remain under the working compounds and external campuses.
- Six authored runoff catchments replace the symmetric corner-width pulses. Each specifies its start and end on the circuit, the side of the track, an outer boundary, and a paint colour. Broad paved areas and gravel extend beyond selected corners. `src/layout/track-safety.ts` resolves those edges into the shared runoff and protective boundary used by rendering, barriers, fences, marshals, and scenery exclusion rules. The paved part is asphalt grey with a 5 m band of the catchment's teal or navy along the track edge. The user's review found that fully painted catchments read as ponds beside the lake, so brand colour is now limited to that band.
- Occupied spectator banks move behind the revised protection. A response road connects the eastern ring road to the middle and southern sectors behind the spectator banks. Elevated crossings do not remove the track barriers beneath them.
- Gates are 24 m turnstile structures just inside the ring road, facing the arriving public. Gate 9 moved to `z = -490` to clear the start of the response road. Gate 14 stands at `x = -450`, in the gap between General Admission Banks 5 and 6, and Gate 12 at `x = 800`, east of the southern residences' street.
- Each car park has a 12 m access spine from the ring road through the middle of its long side, drawn as a ring-road branch. P8's spine leaves the academy campus road on its west side, so it doesn't cross the Expo Walk. Marked double rows are built from those spines, and event-day cars and light poles follow the same stalls.
- Inside apex kerbs and short outside approach and exit kerbs replace continuous strips on both sides of each corner. Thin track-edge lines and staggered grid boxes clarify the racing surface.
- The opening camera frames the larger venue, including the external-campus direction, while keeping the operational infield visible. Facilities and permanent team organisation remain in the whole-site view. Race and conference modes add their relevant activity.

### Revision of 10 November 2026

The user reviewed the running map and asked for facilities to sit as close to their roads and to the track as they would in a built venue, for curved spectator banks, for more seating, and for more to do at the lake and the residences. This replaces the earlier arrangement where it differs.

- **Spectator banks follow the barrier line.** The eight general admission banks are generated from the circuit: each one's inner edge is 6 m outside the protective boundary over a stretch of the lap, and its outer edge is a fixed depth behind that. Beside a corner or a catchment a bank is therefore curved, and beside a straight it is straight. Banks 1 to 6 replace the earlier rectangles, which stood up to 150 m from the track. Banks 7 and 8 are new, on the outside of the full-throttle straight, either side of Gate 7. Bank 2 starts south of the response road's spur, which was shortened to end behind it.
- **A third main-straight grandstand** joins A and B on the outside of the start-finish straight, north of B and short of the Turn 1 catchment. It is Grandstand C, so that A, B and C stand in a row; the user asked for that order. The Turn 1 stand, formerly C, is now Grandstand E. The fan walk's concourse runs behind A, B and C.
- **Capacity.** `pnpm check:layout` prints an estimate from the stands' and banks' footprints, using planning densities recorded in that script, with an allowance for hospitality. It comes to about 127,000 against BMR's 125,000 a day, up from about 72,000 before this revision. The densities are assumptions, so the estimate is a note and not a test, and it stays off the map itself.
- **Team logistics yard.** The yard grew north and east to about 4 hectares, taking the corner of the grass reserve, with a full perimeter aisle. Transporters stand in bays along its north, west and east sides all year, and the rest of the bays fill on a race weekend.
- **Infield checkpoint.** A guard hut and a pair of boom gates stand on the Infield Road just north of the ring road, before the ramp. The Infield Road is the only road that crosses the circuit, so this is the only vehicle checkpoint.
- **Car parks** stand a 5 m verge from the road that serves them. P8 also grew west to the academy campus road.
- **Residences** have their own streets. The eastern rows moved 90 m east and the southern rows 28 m south, each with a street between the apartments and the townhouses that joins the ring road, and each with a residents' club of two tennis courts, a 25 m pool and a clubhouse. Each estate is graded as one terrace.
- **Retail and research** each gained a street off the ring road between their two rows. The Retail Quarter moved 14 m west and the Research and Technology Park 40 m north, towards the ring road.
- **Waterfront.** Superseded by the waterfront revision of 11 November 2026 below. As it stood: the lake is 10% smaller in each direction, about a fifth less water, with the promenade scaled to match. The restaurants moved onto the promenade, and Waterfront Drive's southern leg moved north to `z = 915`, 25 m behind the hotels. The lake has a fountain, a jetty with paddle boats, and a fireworks barge.
- **Protection test.** Buildings and banks are now checked against the two barrier lines the map draws, not against a radius around each point of the track, because a bank that follows an irregular catchment is closer to some parts of the track than that catchment is deep.

### Waterfront revision of 11 November 2026

The user asked for the lake to read as a built waterfront, with Battery Park at the V&A Waterfront in Cape Town and the Burj Khalifa Lake in Dubai as references, at a plainer level of finish. The real lake will be man-made, so its outline is designed and no longer a rounded natural shape. The user allowed the whole waterfront precinct to change, and chose a fountain show line, a footbridge, a marina cove and over-water dining. This replaces the waterfront arrangement of 10 November.

- **Outline.** The lake is two basins joined by a 76 m neck, about 19 hectares against 17 before. The western show basin is a rounded rectangle between the Expo forecourt quay at `x = -360` and the two peninsulas. The eastern boating basin ends in a full arc. Straight quays run where buildings front the water, and the only large curves are the basin ends. A 100 m by 70 m square cove is cut into the north shore of the boating basin.
- **Edge.** The promenade is a 14 m paved walk directly on the water's edge all the way round, generated as the lake outline moved out by half its width. Scenery adds a stone coping along the quay, lamps, a row of olive trees on the landward side and people. Grass no longer meets the water anywhere. The ground and water are still drawn at one level, so the coping stands in for a quay wall.
- **Lake Piazza and Lake Terraces.** A paved square on the north quay of the show basin, with four kiosks and a low landing at the water. Stepped stone terraces and lawns flank it and rise away from the water under timber pergolas, as Battery Park's levels step down to its canal. The Waterfront Walk joins the piazza to the ring road. No skate park or basketball court was added.
- **Peninsulas and footbridge.** Pavilion Point is a park on the northern peninsula. The Waterfront Hotel tower stands on the southern one. The Lake Footbridge crosses the neck between them. It is a building of plain parts, not a `bridge` road, because the tests require every `bridge` road to cross the circuit.
- **Fountain show.** The single fountain became a 200 m arc of jets between two end basins, with a ring and a tall jet at the centre basin. It plays while hovered or selected, as the fireworks do, and stands still otherwise and under reduced motion. Paddle boats keep out of that stretch. The fireworks barge stays in the boating basin.
- **Marina cove.** The jetty, kiosk and moored paddle boats moved into the cove.
- **Dining.** Each restaurant is a pavilion on a timber deck over the water, joined to the quay: one off the south quay of the show basin and one on each side of Pavilion Point.
- **Hotels.** The Promenade Hotel and Lakeside Lodge front the promenade on the south quays, 3 m behind it, where they stood 60 to 90 m back. Waterfront Drive's southern leg moved north to `z = 880`, with a drop-off spur to each hotel. The spur to the tower stops short of the promenade, so its last 55 m are on the shared walk.
- **Expo Centre.** The halls, loading yard and Expo Walk did not move. The forecourt was widened east to meet the promenade on the west quay, which replaces the Expo Walk's branch to the old promenade.
- **Grading.** The waterfront terrace was extended north to `z = 400` and east to `x = 540` to hold the cove, piazza and terraces.
- **Models.** Added on 12 November 2026: the footbridge, the restaurant decks and the terrace pergolas are drawn with their own kit models (`lake-footbridge`, `timber-deck` and `pergola`), fitted to the same footprints. The terrace steps and the landing are still plain extruded parts, and the kiosks, pavilions and fountain basins reuse existing models.

### Amphitheatre, 11 November 2026

The user asked for the amphitheatre to stand further back, with a grassy bank behind it. It moved 50 m north, away from Exhibition Hall 1 and the plaza. The Amphitheatre Lawn is a grass bank around the back of the bowl, 36 m deep and level with the top tier, falling away outwards and tapering to nothing towards the two ends of the seating. It is a separate location, because the amphitheatre's model replaces all of its own parts. The user found a stepped bank too tiered, so it is drawn as one smooth slope from a crest line to a toe line, which a building part can now carry as `slope`. Its inner edge follows the rim of the model as drawn, which is an ellipse inside the parts' bounding box. The arrival terrace was extended north to `z = -620` between `x = -1030` and `x = -740`, so both stand on one level.

### Land use outside the circuit, 10 November 2026

The user found that the true-scale site read as empty ground around a small developed core, and asked for believable use of the spare land without changing the scale or moving the circuit, pits, paddock, roads or buildings. Nothing in `locations` moved. The layout data gained a `landUse` list of zones, which are not locations: they have no label or sidebar entry, and scenery fills only the parts of a zone that the shared occupancy leaves free, so everything in them stands behind the protective boundary.

- **Farmland inside the boundary.** Wheat blocks run along the north edge and in the north-west, north-east, south-west and south-east corners. Vineyard blocks stand in the north-east and across the south, below Waterfront Drive and the hotels. Both are drawn every day, with gum windbreaks along their edges.
- **Event fields.** The ground between the response road and the eastern residences is a campsite. Two fields are overflow parking: north of the ring road beside Aerodrome Road, and between Car Park P8 and the academy campus. They are mown fields with windbreaks every day, and fill with tents, caravans and cars in race mode only. The campsite has no road of its own. It is a grass field reached on foot from Gates 9 and 10, which is a simplification.
- **Fan villages.** Three race-mode villages, each with a big screen, a bleacher, a street of food stalls and marquees: between Grandstand E and Bank 7 by Gate 6, east of the response road behind Bank 2, and inside Gate 13 south of Bank 3.
- **Race mode** also fills the car parks to about 80% and puts spectators on the eight banks. The crowd drawn is a sample, about one figure per 9 m², not the capacity estimate.
- **Every day** has staff cars in about 5% of the stalls, two shuttles, works vehicles inside the gates, olive trees between car park rows, trees along the campus roads, streets and walks, planting around the hotels, halls, residences and campuses, and clumps of trees on the remaining open ground outside the circuit. The infield keeps its defined grass and drainage and gained no trees.

### Implementation review

The running app is reviewed from above and in close views of the pits, VIP compound, access crossings, corner catchments, and both external campuses. Checks cover whole-site, race weekend, and conference day modes. The fan walk and campus access are inspected because relocation can create conflicts outside the main circuit.

`pnpm check:layout` measures a 4,800 m lap, a 693 m start-finish straight, a separate 1,061 m straight, and 15 m width. Geometry tests cover authored runoff edges, lap continuity, occupied footprint clearances, bridge clearance, paddock aisles, campus placement, ring-road connections, the fan walk, skid-pad access, the karting garages, the Grandstand Fan Walk, Expo Centre size and clearances, the waterfront's quay, decks, footbridge and piazza, response access, and at-grade circuit crossings.

These checks support a credible concept illustration. They do not establish suitable speeds, vehicle dynamics, impact performance, or homologation compliance. Those require specialist circuit design.

## Evidence and limits

The evidence is the user's eight supplied photographs and the layout code reviewed on 9 November 2026. The aerial references show pit and support compounds alongside open land. The close corner references show shaped painted runoff, barriers, nearby stands, and hospitality. These observations guide the composition rather than provide measured engineering dimensions.

This document is the source of truth for the correction. [The overview](../docs/overview.md) remains the source for the wider venue scope and illustrative status.
