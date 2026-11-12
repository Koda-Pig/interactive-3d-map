import { MathUtils, Vector3 } from "three";
import type { TrackLocation } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import { joinRoutes, routeAlong, routeOf } from "../layout/route.ts";
import { heightAt } from "../terrain/height.ts";
import type { CameraFlight } from "./flight.ts";
import type { TourPlan } from "./tour.ts";

export const LAP_TOUR = "lap";
export const ARRIVAL_TOUR = "arrival";

/** The arrival route the camera rides: from Cape Town up the N7 to the main grandstands. */
const ARRIVAL_ROUTE = "from-cape-town";

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

/** One lap of the circuit, from just before the start-finish line. */
export function lapTour(flight: CameraFlight): TourPlan {
  const circuit = layout.locations.find((location) => location.id === "circuit") as TrackLocation;
  const route = routeOf("circuit");
  const [lineX, lineZ] = circuit.startFinish ?? [route.samples[0].x, route.samples[0].z];
  let line = route.samples[0];
  for (const sample of route.samples) {
    if (
      Math.hypot(sample.x - lineX, sample.z - lineZ) < Math.hypot(line.x - lineX, line.z - lineZ)
    ) {
      line = sample;
    }
  }
  const length = route.length + LAP_LEAD_IN + LAP_RUN_OUT;
  return {
    id: LAP_TOUR,
    route,
    start: line.distance - LAP_LEAD_IN,
    length,
    stages: [{ until: length, speed: 150, height: 70, back: 80, ahead: 140 }],
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
  let until = 0;
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
    start: 0,
    length: route.length,
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
