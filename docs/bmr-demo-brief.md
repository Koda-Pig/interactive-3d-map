# Demo brief: showing this map to Blue Mountain Racing

Written 10 November 2026, after reviewing the project from the perspective of Protium's pitch to BMR. The map is a concept piece inside the partnership proposal (the deck lives in `Protium.PitchDecks`, under `apps/web-base/src/clients/blue-mountain-racing`). This document records who the audience is, what they would want to see, what they would push back on, what would land hardest, and what to fix before the meeting.

## Who BMR are

From public coverage of the September 2026 announcement (Business Day, TimesLIVE, IOL, Bizcommunity, 2oceansvibe):

- A consortium of business leaders chaired by **Neal Froneman**, the former Sibanye-Stillwater chief executive.
- **R6.7 billion**, fully privately financed, on the 600-hectare Swartland site. About **R2 billion** of that is the circuit; the rest is hospitality, conference, entertainment and residential development.
- FIA Grade 1 and FIM standard, targeting South Africa's first Formula 1 race since Kyalami 1993, by **2031**. No race has been secured.
- About **125,000 spectators a day** at capacity.
- Local participation is part of their public story, including recruiting and training motorsport marshals from the surrounding area.

The full picture of the site and circuit targets is in [overview.md](overview.md).

## What they would want to see

**Their own numbers, respected.** The layout checker (`pnpm check:layout`) validates the concept against BMR's published targets: about 4.8 km per lap, a start-finish straight of at least 600 m, a separate full-throttle straight of at least 1 km, at least 12 m of width. The current layout measures 4,800 m, 693 m, 1,061 m and 15 m. That tells them the brief was read properly.

**The year-round business.** The race weekend / conference day toggle is the strongest idea on the map because it demonstrates what their business case depends on: one venue earning all year, not a track used a few days a year. Roughly R4.7 billion of their plan is not the track. Demo the toggle live, not as a slide.

**The arrival story.** N7 frontage with interchanges, the Kalbaskraal station fan walk, the adjacent aerodrome. This mirrors what BMR sells publicly about accessibility and Cape Town's tourism pull.

**Scale.** Gates, car parks, grandstands and general-admission banks let the map carry the 125,000-a-day number without stating it.

**Credible racing operations.** The corrected infield (pit complex on the infield side of the straight, paddock rows, logistics yard, VIP compound, separated service crossings) is what stops a motorsport-literate audience from dismissing the whole thing in ten seconds. See [../ai/track-layout.md](../ai/track-layout.md).

## What they would have issue with

**The layout is invented, and they will know it.** BMR says their circuit is "developed from a layout with an established motorsport foundation" but has published neither the layout nor a masterplan. Anyone in the room may be sitting on the real design. A convincing track drawn by someone else can read as Protium guessing, or worse, get quoted back later as if it were theirs. The mitigation is already half-built: the on-screen "concept layout, for illustration only" notice, plus the data-driven architecture. Frame the demo around that: when BMR's masterplan lands, the map redraws from their data in days, not months. That turns the invented layout from a weakness into the product demo.

**Phone performance is unverified.** The frame rate has never been timed on a real device, and BMR executives will open this on their phones in the meeting. This is the single biggest demo risk. Time it on a mid-range phone before anything else, and know the `?quality=low` escape hatch.

**Close-up detail is the weakest visual.** The visual review scores it 3/10, and every click flies the camera into exactly that view. The pit / conference building, their centrepiece, is 1,288 triangles. Either fix the priority models first or script the demo path so it doesn't dwell on blockout views.

**The opening frame undersells.** The first impression is mostly wheat field. A demo starts there.

**Nothing moves.** A race weekend with a completely still scene undersells the mode that carries the best point.

**Made-up specifics.** Capacities and similar facts stay off the map unless BMR supplies them, per [improvements.md](improvements.md). Keep that discipline: an invented number in a pitch becomes a commitment.

## What would wow them

In rough order of payoff for the effort:

1. **A lap of the circuit and animated arrival routes** (designed as nice-to-haves in [overview.md](overview.md), not built). A camera flying from the N7 through a gate to a grandstand is literally their fan-journey story.
2. **The event toggle, live.** One venue, 365 days, shown in one click.
3. **Movement in race mode.** Cars lapping, the shuttle running. The scene stops feeling like a model and starts feeling like a place.
4. **Shareable links to a location** (not built). Froneman forwards a link to his board and the demo sells itself a second time.
5. **The engineering story underneath.** This repo is the evidence for the partnership itself: built fast, deterministic asset pipeline, tested, a checker that validates geometry against BMR's published specs. That is what separates Protium from an agency that delivers renders. The map is the proof of capability; the pitch is the partnership.

## Before the demo, in priority order

1. Time the map on a real mid-range phone. The budget is unknown until someone does.
2. Reframe the opening view so the circuit and lake fill the frame ([improvements.md](improvements.md), item 6).
3. Script the demo flight path: opening view, toggle to race weekend, fly to the pit complex, fly to a grandstand, toggle to conference day, fly to the Expo Centre. Avoid dwelling on the weakest close-ups.
4. Keep the "concept layout, for illustration only" notice visible throughout, and rehearse the one-liner that turns it into the pitch: your data in, our map redraws.
