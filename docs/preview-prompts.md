# Sidebar preview images: prompts and wiring

Prompts for the 57 sidebar preview images (`public/images/locations/*.webp`) and the
wiring plan to connect them. The first set of images (November 2026) are renders of the
map itself, one camera view per file, so they match the scene by construction; the
prompts below are for generating illustrated replacements with an image tool, one prompt
per file, using the style paragraph word for word in every request. Same file names,
so a replacement needs no re-wiring.

Rules the prompts already carry, repeated so they survive any tool's drift:

- No text of any kind: no signs, logos, banners with lettering, sponsor boards or watermarks.
- No F1, MotoGP, FIA or FIM branding, no real or real-looking company names or liveries.
- The sea is never visible. Table Mountain only as a tiny silhouette on the far southern horizon.
- Nothing that isn't in the location's description or visible on the map.
- People and vehicles small and simplified, no recognisable faces.

If the image tool accepts reference images, pass a screenshot of the running map with
each request. Output: 1280×720, saved as `.webp` under about 150 KB, subject kept away
from the edges (the sidebar crops with `object-fit: cover`).

## Status (12 November 2026)

All 57 previews are now illustrations in `public/images/locations/`, and every
location's `image` field is set. The final ten transport previews were generated
with the unchanged style paragraph, their subject and mood, fresh map screenshots,
and `n7`, `gate` and `lake` as style references. Each is 1280×720 WebP under 150 KB.
The station fan walk uses plain flags and bare posts without signs or lettering;
the aerodrome helipad circles have no letters.

**Finished illustrations (57). Don't regenerate these without a reason.**

- Racing: `circuit`, `pit-lane`, `pit-conference-building`, `grandstands-main-straight`,
  `grandstand-d`, `grandstand-e`, `ga-bank`, `paddock`, `team-logistics-yard`
- Conference and events: `arrival-plaza`, `gateway-arch`, `plaza-tower`,
  `grandstand-fan-walk`, `exhibition-hall`, `expo-centre`, `expo-loading-yard`,
  `amphitheatre`, `conference-footbridge`, `conference-entrance`, `infield-reserve`
- Hospitality and waterfront: `lake`, `promenade`, `lake-fountain`, `paddle-boats`,
  `fireworks-barge`, `lakeside-restaurant`, `hotel-waterfront`, `hotel-lakeside`,
  `hotel-promenade`, `infield-hospitality`
- Academy and automotive: `karting-track`, `karting-clubhouse`, `karting-garages`,
  `driving-academy`, `skid-pan`, `academy-handling-ground`, `automotive-hub`,
  `automotive-test-pad`, `automotive-demonstration-court`
- Residential and commercial: `trackside-residences`, `residents-club`, `tennis-courts`,
  `swimming-pool`, `retail-quarter`, `research-park`
- Parking and transport: `n7`, `ring-road`, `infield-checkpoint`, `car-park`,
  `shuttle-drop-off`, `kalbaskraal-station`, `station-fan-walk`, `aerodrome-runway`,
  `aerodrome-terminal`, `aerodrome-hangars`, `aerodrome-control-tower`
- Entrances: `gate`

**To check among the finished ones**

- `infield-reserve`: the saved draft is almost all empty grass with a strip of track.
  It should show the drainage swale and open reserve behind the team compound, with no
  added trees. The prompt below now reflects this requirement.
- `grandstand-d` and `grandstand-e`: assigned from generation order. Confirm D shows the
  hairpin at the end of the long straight and E the braking zone into Turn 1; swap the
  two files if not.
- None of the original 25 has been checked against the running map since being saved.

## Style paragraph

Use exactly this, unchanged, at the start of every prompt:

> Clean, simplified low-poly 3D illustration matching a well-made game map: simple geometry, flat or softly shaded matte surfaces, faceted trees, no photoreal textures or lens effects. Warm wheat-gold and dry-green Swartland farmland, low rolling hills and big open sky; no sea. Off-white and light-grey buildings with navy #004272 and teal #00678C accents; dark asphalt and red-and-white kerbs where track is present. Low three-quarter aerial or raised eye-level camera, subject comfortably inside a wide 16:9 frame with enough surrounding ground to place it. People and vehicles are tiny simplified forms with no recognisable faces or liveries. No text, letters, numbers, signs, logos, watermarks or branding anywhere. Preserve the referenced map's building shapes and spatial relationships; add no facilities.

## Mood lines

Append the mood line that matches the image's tag, adjusted only to fit the subject:

- **R**: Warm late-afternoon race-day mood: crowds, flags and food stalls, race cars on the track, stands full.
- **C**: Bright, calm conference-day mood: delegates arriving, orderly exhibition traffic, clear daylight.
- **G**: Quiet golden-hour mood: few people, long warm light.
- **E**: Evening mood: deep dusk sky, building and path lighting switched on.

## Pilots first

Generate `pit-conference-building`, `lake` and `gate` first (one E, one G, one R).
Put them side by side with a screenshot of the running map (`pnpm dev`, port 5173) and
adjust the style paragraph until the three match each other and the map: same building
colours, same ground colours, same level of detail. Only then do the rest.

## The prompts

Each entry is the subject and mood to append to the style paragraph.

### Racing

**circuit.webp** — R — `circuit`
The whole racing circuit from a higher three-quarter aerial so the full track shape reads: a long dark asphalt ribbon with red and white kerbs following the lie of the land through wheat fields, the start-finish straight lined with covered grandstands, the pit building along it, race cars spread around the lap. Warm late-afternoon race-day mood.

**pit-lane.webp** — R — `pit-lane`, `pit-working-apron`
The pit lane close up: the pit entry peeling off the track before the final western bend, the low pit wall, race cars queued in the lane, and beside it the pit building's garage doors opening onto a paved working apron where mechanics and equipment bays sit. Race-day mood. Composed so it reads both as the lane itself and as the working apron in front of the garages.

**pit-conference-building.webp** — E — `pit-conference-building`
The long pit and conference building seen across its infield side: west-facing garage doors closed for the night onto the pit apron, stacked glass conference floors above under a wide canopy, the public entrance at the south end lit, the pedestrian bridge beside it. Evening mood, warm light in the glass.

**grandstands-main-straight.webp** — R — `grandstand-a`, `grandstand-b`, `grandstand-c`
The row of covered grandstands along the start-finish straight, seen from the track side: dark curved roofs and white fabric canopies over tiered seats full of crowds, opposite the pit garages and start line, race cars on the straight in front. Race-day mood.

**grandstand-d.webp** — R — `grandstand-d`
A single covered grandstand outside the hairpin at the end of the long straight, crowds in the seats, race cars braking into the hairpin in front of it, runoff and kerbs between. Race-day mood.

**grandstand-e.webp** — R — `grandstand-e`
A covered grandstand overlooking the heavy braking zone into Turn 1, full of crowds, race cars braking hard in front of it with the track curving away beyond. Race-day mood.

**ga-bank.webp** — R — `ga-bank-1` to `ga-bank-8`
A curved grass viewing bank wrapped along the outside of a corner, crowds sitting and standing on the turf with flags, a strip of runoff and red and white kerbs between the bank and the track, race cars sweeping past. Race-day mood. Generic enough to stand for any of the general admission banks.

**paddock.webp** — R — `paddock`, `paddock-service-aisles`, `team-support-rows`
The team compound directly behind the pit garages: two rows of support units with equipment awnings, loading courts between them, transverse lanes and a rear service spine, transporters and team crew at work. Race-day mood. Composed so it reads as the paddock, its service aisles and the support rows together.

**team-logistics-yard.webp** — R — `team-logistics-yard`, `logistics-service-aisle`, `team-equipment-tents`
The restricted team logistics yard north of the garages: marked truck bays holding transporters, a wide clear turning and loading aisle, two grouped equipment tents, crew moving between them. Race-day mood, busier than a working day but orderly.

### Conference and events

**arrival-plaza.webp** — R — `arrival-plaza`
The venue's public front door: a large paved plaza between the gateway arch, the exhibition halls and the pit and conference building, crowds crossing it, food and merchandise stalls and flags lining its edges. Race-day mood.

**gateway-arch.webp** — G — `gateway-arch`
The landmark arch at the western edge of the arrival plaza, seen from raised eye-level on the plaza side, warm low light raking across the stone, a few people walking beneath it. Golden-hour mood.

**plaza-tower.webp** — G — `plaza-tower-north`, `plaza-tower-south`
A stone-clad tower marking one side of the arrival plaza, warm low light on the stone, the plaza and its neighbours around it, a few people at its base. Golden-hour mood. Generic enough to stand for either of the twin towers.

**grandstand-fan-walk.webp** — R — `grandstand-fan-walk`, `conference-approach`
A tree-lined processional avenue running from the gateway arch through the arrival plaza towards the concourse behind the main grandstands, banners strung along it, food and merchandise stalls on both sides, crowds walking. Race-day mood. Composed so it reads both as the fan walk and as the approach concourse behind the stands.

**exhibition-hall.webp** — C — `exhibition-hall-1`, `exhibition-hall-2`
A smaller exhibition hall beside the arrival plaza, a simple white volume with a sawtooth roof carrying skylight strips and teal glazing, delegates arriving across the paved forecourt. Conference-day mood.

**expo-centre.webp** — C — `expo-centre`, `expo-forecourt`, `expo-walk`
The venue's largest exhibition space: four connected halls on a glazed central concourse facing the lake, its lake-facing forecourt in front with delegates and visitors crossing, a public walk leading in. Conference-day mood. Composed so it reads as the centre, its forecourt and the walk together.

**expo-loading-yard.webp** — C — `expo-loading-yard`
The working side of the Expo Centre: truck docks along its western side with trucks backed in, pallets and cages, a marked yard served by a road, kept separate from any visitor area. Conference-day mood, calm and orderly.

**amphitheatre.webp** — E — `amphitheatre`
A stepped open-air bowl facing the arrival plaza, stage lit against the deepening dusk sky, an audience filling the steps, path lighting on around it. Evening mood.

**conference-footbridge.webp** — C — `conference-footbridge`, `infield-guest-walk`
A public pedestrian bridge carrying a walkway over the start-finish straight and pit lane, ramped approaches at each end, delegates crossing on foot, the track quiet below. Conference-day mood. Composed so it reads both as the bridge and as the guest walk leading to it.

**conference-entrance.webp** — C — `conference-entrance`
The public south lobby of the pit and conference building: a glazed entrance under the building's canopy, delegates arriving and doors open, separate from any garage or loading side. Conference-day mood.

**infield-reserve.webp** — G — `infield-park`, `infield-drainage`
Low grass reserve ground inside the circuit: a shallow drainage swale crossing open turf behind the team compound, with no trees, the track and its protective boundary visible in the distance, no people. Golden-hour mood. Composed so it reads as both the reserve and the drainage strip.

### Hospitality and waterfront

**lake.webp** — G — `lake`
The centrepiece lake of the waterfront precinct seen across its water: calm surface, a fountain near the middle, a promenade loop around its edge, timber pavilions and hotels on the far shore, paddle boats moored. Golden-hour mood.

**promenade.webp** — G — `promenade`
The lakeside promenade: a timber-edged walking loop around the lake, a few people strolling, restaurants and hotels along it, warm low light across the water. Golden-hour mood.

**lake-fountain.webp** — G — `lake-fountain`
A fountain in the middle of the lake: a tall central jet with a ring of arcing jets around it, spray catching the low warm light, the lake and its shores around it. Golden-hour mood.

**paddle-boats.webp** — G — `paddle-boats`
A jetty and small ticket kiosk on the north shore of the lake, colourful paddle boats moored alongside and one or two out on the water with a few people aboard. Golden-hour mood.

**fireworks-barge.webp** — E — `fireworks-barge`
A launch barge moored on the lake at dusk, fireworks bursting in the sky above it, their light reflected in the water, the promenade and buildings around the lake lit. Evening mood.

**lakeside-restaurant.webp** — E — `restaurant-west`, `restaurant-central`, `restaurant-east`
A timber lakeside restaurant pavilion with a dark metal roof, opening onto the promenade, warm light inside and lanterns on its deck, diners at tables, the lake behind. Evening mood. Generic enough to stand for any of the three pavilions.

**hotel-waterfront.webp** — G — `hotel-waterfront`
A tower hotel on the south shore of the lake, its facade catching the low warm light, views over the water towards the circuit beyond, the promenade at its base. Golden-hour mood.

**hotel-lakeside.webp** — G — `hotel-lakeside`
A low-rise hotel on the south shore of the lake, set along the promenade among trees, warm low light, a few guests on its walkways. Golden-hour mood.

**hotel-promenade.webp** — G — `hotel-promenade`
A mid-rise hotel at the western end of the waterfront, fronting the promenade, warm low light, the lake beside it. Golden-hour mood.

**infield-hospitality.webp** — R — `infield-hospitality`, `hospitality-pavilions`, `hospitality-terrace`, `hospitality-paths`, `hospitality-shade`
The infield hospitality compound overlooking the southern return of the circuit: three permanent pavilions opening onto a shaded courtyard with a raised shade canopy, paths linking them, an open viewing terrace looking south to the track, guests with race cars visible beyond the protective boundary. Race-day mood. Composed so it reads as the courtyard, its pavilions, terrace and paths together.

### Academy and automotive

**karting-track.webp** — G — `karting-track`, `karting-pit-apron`
A small karting circuit in its own campus: karts on the dark asphalt with red and white kerbs, a paved pit apron beside it with kart stands, low buildings at the edge. Golden-hour mood. Composed so it reads as both the track and its pit apron.

**karting-clubhouse.webp** — G — `karting-clubhouse`
The karting clubhouse: a low building with a viewing deck overlooking the karting track, a few people on the deck, warm low light. Golden-hour mood.

**karting-garages.webp** — G — `karting-garages`
Two rows of small lock-up garages beside the karting clubhouse, their doors opening onto the paved pit apron, rear access from the campus road behind. Golden-hour mood.

**driving-academy.webp** — G — `driving-academy`
The driving academy building beside the karting track: a simple low-rise block for classrooms and simulators, a few people at its entrance, the karting circuit visible nearby. Golden-hour mood.

**skid-pan.webp** — G — `skid-pan`, `skid-pad-markings`, `skid-pad-control`
An open square of low-grip tarmac with painted boundary lines and two large painted control circles, cones set out, one car mid-slide inside the circles, an instructor cabin overlooking from the edge. Golden-hour mood. Composed so it reads as the pad, its markings and the control cabin together.

**academy-handling-ground.webp** — G — `academy-handling-ground`, `academy-handling-course`, `academy-briefing-bays`
The academy's vehicle-control compound: a low-speed handling loop with a separate slalom lane marked on the tarmac, covered preparation and briefing bays at its edge, a car and a few instructors out on the course. Golden-hour mood. Composed so it reads as the ground, its course and the briefing bays together.

**automotive-hub.webp** — C — `automotive-hub`
The automotive hub in its own eastern campus: a large engineering workshop building, long and low with a dark roof and glazed doors, vehicles and engineers outside, the test pad beside it. Conference-day mood.

**automotive-test-pad.webp** — C — `automotive-test-pad`
A vehicle test apron beside the automotive hub: open paved ground with a car part way through a manoeuvre, cones and markers out, engineers watching from the edge. Conference-day mood.

**automotive-demonstration-court.webp** — C — `automotive-demonstration-court`, `automotive-demonstration-loop`, `vehicle-display-courts`, `automotive-preparation-bays`, `vehicle-display-markings`
The automotive demonstration compound: a marked low-speed loop around light-paved display bays with their painted markings, preparation pavilions grouped along the service edge, cars circulating and on display. Conference-day mood. Composed so it reads as the court, its loop, display bays and preparation bays together.

### Residential and commercial

**trackside-residences.webp** — G — `trackside-residences-east`, `trackside-residences-south`, `residences-east-street`, `residences-south-street`
Trackside housing: apartments and townhouses in white and grey blocks with warm timber accents, either side of their own quiet residential street, the circuit visible in the distance beyond. Golden-hour mood. Generic enough to stand for either residential estate and its street.

**residents-club.webp** — G — `residents-club-east`, `residents-club-south`
A residents' clubhouse with a pool deck and courts beside it, a low timber-and-white building, a few residents on the deck, warm low light. Golden-hour mood. Generic enough to stand for either estate's club.

**tennis-courts.webp** — G — `tennis-courts-east`, `tennis-courts-south`
Two tennis courts side by side with their lighting poles up, painted court markings, one or two players, fencing around them, warm low light. Golden-hour mood. Generic enough to stand for either estate's courts.

**swimming-pool.webp** — G — `swimming-pool-east`, `swimming-pool-south`
A 25 metre residents' swimming pool beside the tennis courts, clear blue water, deck chairs, a low fence, warm low light. Golden-hour mood. Generic enough to stand for either estate's pool.

**retail-quarter.webp** — G — `retail-quarter`, `retail-street`
A small retail quarter: two rows of shops and offices facing each other across a shared shopping street, awnings and trees, a few shoppers, warm low light. Golden-hour mood. Composed so it reads as both the quarter and its street.

**research-park.webp** — C — `research-park`, `research-park-street`
The research and technology park at the south-eastern edge of the site: two rows of simple research blocks with an access street between them, people walking between buildings. Conference-day mood. Composed so it reads as both the park and its street.

### Parking and transport

**n7.webp** — G — `n7`, `n7-north-interchange`, `n7-south-interchange`
The N7 highway running along the site's western edge through wheat fields, with a diamond interchange's slip roads curving down to meet the ring road, light traffic, big open sky. Golden-hour mood. Generic enough to stand for the highway and either interchange.

**ring-road.webp** — G — `ring-road`, `waterfront-drive`, `academy-campus-road`, `automotive-campus-road`, `aerodrome-road`, `circuit-response-road`
The venue's circulation road: a two-lane road running around the outside of the circuit precinct, fencing and gates along it, the circuit and its banks visible beyond, a car or two passing, wheat fields around. Golden-hour mood. Generic enough to stand for the ring road and the site's other access roads.

**infield-checkpoint.webp** — C — `infield-checkpoint`, `infield-road`
The infield security checkpoint: a small guard hut and boom gates on the infield road where it approaches the circuit, an accredited vehicle passing through, the operations bridge visible beyond. Conference-day mood, quiet and controlled.

**car-park.webp** — R — `car-park-1` to `car-park-8`
A large flat car park with marked rows, full of cars on a race day, crowds walking between the rows towards the gates in the distance, flags above. Race-day mood. Generic enough to stand for any of the car parks.

**shuttle-drop-off.webp** — R — `shuttle-drop-off`
A shuttle drop-off area: buses set down at a marked kerb with queues of passengers boarding and stepping off, barriers and staff, the venue beyond. Race-day mood.

**kalbaskraal-station.webp** — R — `kalbaskraal-station`, `railway-line`
The small Kalbaskraal railway station: a modest station building on a single line, a train stopped at its platform, crowds stepping off and streaming away along the fan walk, flags. Race-day mood. Composed so it reads as both the station and the line through it.

**station-fan-walk.webp** — R — `fan-walk`
The station fan walk: a marked walking route from the station around the outside of the automotive campus towards the eastern ring-road entrance, crowds walking it, flags and signage posts, wheat fields on one side. Race-day mood.

**aerodrome-runway.webp** — G — `aerodrome-runway`, `aerodrome-apron`, `aerodrome-helipad`
The adjacent aerodrome: a runway with its taxiway and a small apron in front of the hangars and terminal, a helipad with a painted circle without lettering at the apron's eastern end, a few light aircraft parked, dry grass around. Golden-hour mood. Composed so it reads as both the runway and the apron.

**aerodrome-terminal.webp** — G — `aerodrome-terminal`
The aerodrome's small terminal for arrivals by light aircraft: a simple low building beside the apron, a light aircraft at the stand, a few passengers. Golden-hour mood.

**aerodrome-hangars.webp** — G — `aerodrome-hangars`
The aerodrome hangars beside the apron: long low hangars with one door open showing a light aircraft inside, warm low light. Golden-hour mood.

**aerodrome-control-tower.webp** — G — `aerodrome-control-tower`
The aerodrome control tower: a slim tower with a glazed cab on top beside the runway and apron, warm low light, one or two light aircraft below. Golden-hour mood.

### Entrances

**gate.webp** — R — `gate-1` to `gate-14`
A spectator entrance gate at the venue perimeter: turnstile gates under a simple canopy, crowds streaming through, flags above, the circuit precinct opening up beyond. Race-day mood. Generic enough to stand for any of the gates.

## Wiring plan

The `sidebar.ts` change (resolving `location.image` against `import.meta.env.BASE_URL`,
the way `src/draw/kit.ts` loads models) is already applied. The rest lands once the
images exist, so the map never shows broken previews and the test stays green:

1. Save the images as `public/images/locations/<file>.webp`, 1280×720, under about 150 KB.
2. Set each location's `image` field to `images/locations/<file>.webp` (no leading slash)
   using the mapping below.
3. Add the test to `tests/layout-data.test.mjs`.
4. Update the `image` line in `docs/overview.md`.
5. Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm check:layout`.
6. In the running map, select at least one location from every group and confirm the image
   loads, is cropped sensibly and matches the place beside it.
7. Review all 57 as a contact sheet; regenerate any with text, a broken rule or a style drift.

### Mapping

| File | Locations |
| --- | --- |
| circuit | circuit |
| pit-lane | pit-lane, pit-working-apron |
| pit-conference-building | pit-conference-building |
| grandstands-main-straight | grandstand-a, grandstand-b, grandstand-c |
| grandstand-d | grandstand-d |
| grandstand-e | grandstand-e |
| ga-bank | ga-bank-1 … ga-bank-8 |
| paddock | paddock, paddock-service-aisles, team-support-rows |
| team-logistics-yard | team-logistics-yard, logistics-service-aisle, team-equipment-tents |
| arrival-plaza | arrival-plaza |
| gateway-arch | gateway-arch |
| plaza-tower | plaza-tower-north, plaza-tower-south |
| grandstand-fan-walk | grandstand-fan-walk, conference-approach |
| exhibition-hall | exhibition-hall-1, exhibition-hall-2 |
| expo-centre | expo-centre, expo-forecourt, expo-walk |
| expo-loading-yard | expo-loading-yard |
| amphitheatre | amphitheatre |
| conference-footbridge | conference-footbridge, infield-guest-walk |
| conference-entrance | conference-entrance |
| infield-reserve | infield-park, infield-drainage |
| lake | lake |
| promenade | promenade |
| lake-fountain | lake-fountain |
| paddle-boats | paddle-boats |
| fireworks-barge | fireworks-barge |
| lakeside-restaurant | restaurant-west, restaurant-central, restaurant-east |
| hotel-waterfront | hotel-waterfront |
| hotel-lakeside | hotel-lakeside |
| hotel-promenade | hotel-promenade |
| infield-hospitality | infield-hospitality, hospitality-pavilions, hospitality-terrace, hospitality-paths, hospitality-shade |
| karting-track | karting-track, karting-pit-apron |
| karting-clubhouse | karting-clubhouse |
| karting-garages | karting-garages |
| driving-academy | driving-academy |
| skid-pan | skid-pan, skid-pad-markings, skid-pad-control |
| academy-handling-ground | academy-handling-ground, academy-handling-course, academy-briefing-bays |
| automotive-hub | automotive-hub |
| automotive-test-pad | automotive-test-pad |
| automotive-demonstration-court | automotive-demonstration-court, automotive-demonstration-loop, vehicle-display-courts, automotive-preparation-bays, vehicle-display-markings |
| trackside-residences | trackside-residences-east, trackside-residences-south, residences-east-street, residences-south-street |
| residents-club | residents-club-east, residents-club-south |
| tennis-courts | tennis-courts-east, tennis-courts-south |
| swimming-pool | swimming-pool-east, swimming-pool-south |
| retail-quarter | retail-quarter, retail-street |
| research-park | research-park, research-park-street |
| n7 | n7, n7-north-interchange, n7-south-interchange |
| ring-road | ring-road, waterfront-drive, academy-campus-road, automotive-campus-road, aerodrome-road, circuit-response-road |
| infield-checkpoint | infield-checkpoint, infield-road |
| car-park | car-park-1 … car-park-8 |
| shuttle-drop-off | shuttle-drop-off |
| kalbaskraal-station | kalbaskraal-station, railway-line |
| station-fan-walk | fan-walk |
| aerodrome-runway | aerodrome-runway, aerodrome-apron, aerodrome-helipad |
| aerodrome-terminal | aerodrome-terminal |
| aerodrome-hangars | aerodrome-hangars |
| aerodrome-control-tower | aerodrome-control-tower |
| gate | gate-1 … gate-14 |

### Setting the image fields

Run from the repo root once the `.webp` files are in `public/images/locations/`.
It only touches the `image` field and reports any location whose file is missing:

```sh
python3 - <<'PY'
import json, pathlib

root = pathlib.Path(".")
data = json.loads((root / "src/data/locations.json").read_text())

prefix = {
    "ga-bank": 8, "car-park": 8, "gate": 14,
}
mapping = {
    "circuit": ["circuit"],
    "pit-lane": ["pit-lane", "pit-working-apron"],
    "pit-conference-building": ["pit-conference-building"],
    "grandstands-main-straight": ["grandstand-a", "grandstand-b", "grandstand-c"],
    "grandstand-d": ["grandstand-d"],
    "grandstand-e": ["grandstand-e"],
    "paddock": ["paddock", "paddock-service-aisles", "team-support-rows"],
    "team-logistics-yard": ["team-logistics-yard", "logistics-service-aisle", "team-equipment-tents"],
    "arrival-plaza": ["arrival-plaza"],
    "gateway-arch": ["gateway-arch"],
    "plaza-tower": ["plaza-tower-north", "plaza-tower-south"],
    "grandstand-fan-walk": ["grandstand-fan-walk", "conference-approach"],
    "exhibition-hall": ["exhibition-hall-1", "exhibition-hall-2"],
    "expo-centre": ["expo-centre", "expo-forecourt", "expo-walk"],
    "expo-loading-yard": ["expo-loading-yard"],
    "amphitheatre": ["amphitheatre"],
    "conference-footbridge": ["conference-footbridge", "infield-guest-walk"],
    "conference-entrance": ["conference-entrance"],
    "infield-reserve": ["infield-park", "infield-drainage"],
    "lake": ["lake"],
    "promenade": ["promenade"],
    "lake-fountain": ["lake-fountain"],
    "paddle-boats": ["paddle-boats"],
    "fireworks-barge": ["fireworks-barge"],
    "lakeside-restaurant": ["restaurant-west", "restaurant-central", "restaurant-east"],
    "hotel-waterfront": ["hotel-waterfront"],
    "hotel-lakeside": ["hotel-lakeside"],
    "hotel-promenade": ["hotel-promenade"],
    "infield-hospitality": ["infield-hospitality", "hospitality-pavilions", "hospitality-terrace", "hospitality-paths", "hospitality-shade"],
    "karting-track": ["karting-track", "karting-pit-apron"],
    "karting-clubhouse": ["karting-clubhouse"],
    "karting-garages": ["karting-garages"],
    "driving-academy": ["driving-academy"],
    "skid-pan": ["skid-pan", "skid-pad-markings", "skid-pad-control"],
    "academy-handling-ground": ["academy-handling-ground", "academy-handling-course", "academy-briefing-bays"],
    "automotive-hub": ["automotive-hub"],
    "automotive-test-pad": ["automotive-test-pad"],
    "automotive-demonstration-court": ["automotive-demonstration-court", "automotive-demonstration-loop", "vehicle-display-courts", "automotive-preparation-bays", "vehicle-display-markings"],
    "trackside-residences": ["trackside-residences-east", "trackside-residences-south", "residences-east-street", "residences-south-street"],
    "residents-club": ["residents-club-east", "residents-club-south"],
    "tennis-courts": ["tennis-courts-east", "tennis-courts-south"],
    "swimming-pool": ["swimming-pool-east", "swimming-pool-south"],
    "retail-quarter": ["retail-quarter", "retail-street"],
    "research-park": ["research-park", "research-park-street"],
    "n7": ["n7", "n7-north-interchange", "n7-south-interchange"],
    "ring-road": ["ring-road", "waterfront-drive", "academy-campus-road", "automotive-campus-road", "aerodrome-road", "circuit-response-road"],
    "infield-checkpoint": ["infield-checkpoint", "infield-road"],
    "shuttle-drop-off": ["shuttle-drop-off"],
    "kalbaskraal-station": ["kalbaskraal-station", "railway-line"],
    "station-fan-walk": ["fan-walk"],
    "aerodrome-runway": ["aerodrome-runway", "aerodrome-apron", "aerodrome-helipad"],
    "aerodrome-terminal": ["aerodrome-terminal"],
    "aerodrome-hangars": ["aerodrome-hangars"],
    "aerodrome-control-tower": ["aerodrome-control-tower"],
}
for name, count in prefix.items():
    mapping[name] = [f"{name}-{i}" for i in range(1, count + 1)]

file_for = {id_: f"images/locations/{file}.webp" for file, ids in mapping.items() for id_ in ids}
missing = []
for location in data["locations"]:
    image = file_for.get(location["id"])
    if image is None:
        missing.append(location["id"])
        continue
    if not (root / "public" / image).exists():
        missing.append(location["id"])
        continue
    location["image"] = image

if missing:
    raise SystemExit("no image for: " + ", ".join(missing))
(root / "src/data/locations.json").write_text(json.dumps(data, indent=2) + "\n")
print("wired", len(file_for), "locations")
PY
```

### The test

Add to `tests/layout-data.test.mjs` (with `existsSync` added to the `node:fs` import):

```js
test("every location has an image file that exists in public", () => {
  for (const location of locations) {
    assert.ok(location.image, location.id);
    assert.ok(
      existsSync(new URL(`../public/${location.image}`, import.meta.url)),
      location.id,
    );
  }
});
```

### The docs line

In `docs/overview.md`, replace the `image` bullet with:

```
- `image`: path to the location's preview picture under `public/`, written as `images/locations/<file>.webp` with no leading slash. The sidebar resolves it against `import.meta.env.BASE_URL`, so it works when the site is served from a sub-path. Without one, a placeholder is shown
```
