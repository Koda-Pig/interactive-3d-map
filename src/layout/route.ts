import type { TrackLocation } from "./locations.ts";
import { layout } from "./locations.ts";
import type { PathPoint, PathSample } from "./path.ts";
import { resolvePath, samplePath } from "./path.ts";

/** How far apart the stored points along a route are, in metres. */
const ROUTE_STEP = 2;

/** A path measured once, so that points along it can be looked up by distance. */
export interface Route {
  readonly samples: readonly PathSample[];
  readonly length: number;
  readonly closed: boolean;
}

export function routeAlong(points: readonly PathPoint[], closed: boolean): Route {
  const segments = resolvePath(points, closed);
  const samples = samplePath(segments, ROUTE_STEP, closed);
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  return { samples, length, closed };
}

/** The route along a track or road in the layout, by its id. */
export function routeOf(id: string): Route {
  const track = layout.locations.find((location) => location.id === id) as
    | TrackLocation
    | undefined;
  if (!track?.path) {
    throw new Error(`No route "${id}" in the layout`);
  }
  return routeAlong(track.path, track.closed ?? false);
}

/**
 * The point `distance` metres along a route, between its stored points. A
 * closed route wraps round, and an open one stops at its ends.
 */
export function pointAt(route: Route, distance: number): PathSample {
  const { samples, length, closed } = route;
  const along = closed
    ? ((distance % length) + length) % length
    : Math.min(Math.max(distance, 0), length);
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (samples[middle].distance <= along) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  const from = samples[low];
  if (!closed && low === samples.length - 1) {
    return from;
  }
  const to = samples[(low + 1) % samples.length];
  const span = (to.distance > from.distance ? to.distance : length) - from.distance;
  const t = span > 0 ? (along - from.distance) / span : 0;
  return {
    ...from,
    x: from.x + (to.x - from.x) * t,
    z: from.z + (to.z - from.z) * t,
    dirX: from.dirX + (to.dirX - from.dirX) * t,
    dirZ: from.dirZ + (to.dirZ - from.dirZ) * t,
  };
}

/** Routes run one after another as one open route. Each should start where the last ends. */
export function joinRoutes(routes: readonly Route[]): Route {
  const samples: PathSample[] = [];
  let length = 0;
  for (const route of routes) {
    for (const sample of route.samples) {
      const distance = length + sample.distance;
      // A leg's first point repeats the last one's end.
      if (samples.length > 0 && distance <= samples[samples.length - 1].distance) {
        continue;
      }
      samples.push({ ...sample, distance });
    }
    length += route.length;
  }
  return { samples, length, closed: false };
}
