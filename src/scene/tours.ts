import { MathUtils, Vector3 } from "three";
import { layout } from "../layout/locations.ts";
import { circuitRace } from "../layout/race.ts";
import { joinRoutes, routeAlong, routeOf } from "../layout/route.ts";
import { heightAt } from "../terrain/height.ts";
import type { CameraFlight } from "./flight.ts";
import type { TourLead, TourPlan } from "./tour.ts";

export const LAP_TOUR = "lap";
export const ARRIVAL_TOUR = "arrival";

/** The arrival route the camera rides: from Cape Town up the N7 to the main grandstands. */
const ARRIVAL_ROUTE = "from-cape-town";
/** Begin just before the first highway exit waypoint. */
const ARRIVAL_LEAD_IN = 120;

/** The lap starts this far before the start-finish line, and ends this far past it. */
const LAP_LEAD_IN = 220;
const LAP_RUN_OUT = 60;

/**
 * The view the arrival ends on: over the main grandstands, looking east
 * across the start-finish straight to the pits.
 */
const ARRIVAL_ENDING = {
  target: [-575, -20] as const,
  radius: 420,
  phi: MathUtils.degToRad(60),
  theta: MathUtils.degToRad(-110),
};

/** The race's time, shared with whatever draws the cars so they keep pace with the ride. */
export interface LapClock {
  seconds: number;
  held: boolean;
}

/**
 * How long before the car the lap rides with reaches the lap's start the race
 * is set to, in seconds: about as long as the camera takes to fly there.
 */
const LAP_COUNTDOWN = 1.6;
/** The chase rides low behind the car, with a wider view than the map's so the speed shows. */
const CHASE = { speed: 0, height: 6.5, back: 28, ahead: 100, fov: 58 };
/** How quickly the chase camera catches up with the car, in seconds. */
const CHASE_SMOOTHING = 0.22;

/**
 * One lap of the circuit behind a race car, from just before the start-finish
 * line. `clock` is the race's time: the ride takes it over, so slowing the
 * tour slows the whole race with it.
 */
export function lapTour(
  flight: CameraFlight,
  clock: LapClock = { seconds: 0, held: false },
): TourPlan {
  const race = circuitRace();
  const route = routeOf("circuit");
  const start = (((race.line - LAP_LEAD_IN) % route.length) + route.length) % route.length;
  const length = route.length + LAP_LEAD_IN + LAP_RUN_OUT;
  const lead: TourLead = {
    begin() {
      clock.seconds = race.timeAt(start) - LAP_COUNTDOWN;
    },
    advance(seconds) {
      clock.held = true;
      clock.seconds += seconds;
      return race.distanceAt(clock.seconds) - start;
    },
    sideways: (travelled) => race.sidewaysAt(start + travelled),
    telemetry(travelled) {
      const turn = race.turnAt(start + travelled);
      return {
        speed: race.speedAt(start + travelled) * 3.6,
        place: turn ? `Turn ${turn.number} of ${race.turns.length}` : "Flat out",
      };
    },
    release() {
      clock.held = false;
    },
  };
  return {
    id: LAP_TOUR,
    route,
    start,
    length,
    stages: [{ until: length, ...CHASE }],
    lead,
    smoothing: CHASE_SMOOTHING,
    finish: () => flight.flyHome(),
  };
}

/** The way in from the N7: driving to a car park, then walking through a gate to the grandstands. */
export function arrivalTour(flight: CameraFlight): TourPlan {
  const arrival = layout.arrivals.find((route) => route.id === ARRIVAL_ROUTE);
  if (!arrival) {
    throw new Error(`No arrival route "${ARRIVAL_ROUTE}" in the layout`);
  }
  const legs = arrival.legs.map((leg) => ({ mode: leg.mode, route: routeAlong(leg.path, false) }));
  const route = joinRoutes(legs.map((leg) => leg.route));
  const [[fromX, fromZ], [exitX, exitZ]] = arrival.legs[0].path;
  const start = Math.max(0, Math.hypot(exitX - fromX, exitZ - fromZ) - ARRIVAL_LEAD_IN);
  let until = -start;
  const stages = legs.map(({ mode, route: leg }) => {
    until += leg.length;
    return mode === "drive"
      ? { until, speed: 150, height: 75, back: 100, ahead: 170 }
      : { until, speed: 40, height: 38, back: 55, ahead: 90 };
  });
  const [x, z] = ARRIVAL_ENDING.target;
  return {
    id: ARRIVAL_TOUR,
    route,
    start,
    length: route.length - start,
    stages,
    finish: () =>
      flight.flyTo(
        {
          target: new Vector3(x, heightAt(x, z), z),
          radius: ARRIVAL_ENDING.radius,
          phi: ARRIVAL_ENDING.phi,
          theta: ARRIVAL_ENDING.theta,
        },
        2200,
      ),
  };
}
