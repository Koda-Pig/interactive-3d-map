import { isCarPark } from "./car-parks.ts";
import type { Location } from "./locations.ts";
import { buildingParts, layout } from "./locations.ts";
import { resolveOutline } from "./path.ts";
import type { Point } from "./polygon.ts";
import { centreOf } from "./polygon.ts";

/** A place worth going to next from a location, and why. */
export interface RelatedPlace {
  readonly location: Location;
  /** What the place is to the location, such as "Closest gate". */
  readonly role: string;
}

/** Where a location stands, or `null` for roads and tracks, which run across the site. */
export function centreOfLocation(location: Location): Point | null {
  switch (location.type) {
    case "building":
      return centreOf(buildingParts(location).flatMap((part) => resolveOutline(part.footprint)));
    case "area":
    case "water":
      return centreOf(resolveOutline(location.footprint));
    case "gate":
      return location.position;
    default:
      return null;
  }
}

function closest(
  from: Point,
  self: Location,
  candidates: readonly Location[],
): Location | undefined {
  let best: Location | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const centre = candidate === self ? null : centreOfLocation(candidate);
    if (!centre) {
      continue;
    }
    const distance = Math.hypot(centre[0] - from[0], centre[1] - from[1]);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

const gates = layout.locations.filter((location) => location.type === "gate");
const carParks = layout.locations.filter(isCarPark);

/**
 * The closest gate and car park to a location, measured in a straight line
 * between their centres. They're a visitor's way in, so the map can offer
 * them as the next step. Roads and tracks have none.
 */
export function relatedPlaces(location: Location): RelatedPlace[] {
  const from = centreOfLocation(location);
  if (!from) {
    return [];
  }
  const related: RelatedPlace[] = [];
  const gate = closest(from, location, gates);
  if (gate) {
    related.push({ location: gate, role: "Closest gate" });
  }
  const park = closest(from, location, carParks);
  if (park) {
    related.push({ location: park, role: "Closest car park" });
  }
  return related;
}
