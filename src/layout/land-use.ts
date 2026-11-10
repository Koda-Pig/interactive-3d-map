import type { LandUse, LandUseZone } from "./locations.ts";
import { layout } from "./locations.ts";
import type { Occupancy } from "./occupancy.ts";
import { occupancyOf } from "./occupancy.ts";
import { resolveOutline } from "./path.ts";
import type { Bounds, Point } from "./polygon.ts";
import { boundsOf, signedDistance } from "./polygon.ts";

/** Scenery and land in use stay this far from everything in the layout, in metres. */
const SITE_CLEARANCE = 10;

/** A land-use zone with its outline worked out. */
export interface ResolvedZone extends LandUseZone {
  /** Its place in the layout's list, for picking a colour or direction by rule. */
  readonly index: number;
  readonly outline: readonly Point[];
  readonly bounds: Bounds;
}

const zones: readonly ResolvedZone[] = layout.landUse.map((zone, index) => {
  const outline = resolveOutline(zone.footprint);
  return { ...zone, index, outline, bounds: boundsOf(outline) };
});

export function landUseZones(...uses: readonly LandUse[]): readonly ResolvedZone[] {
  return zones.filter((zone) => uses.includes(zone.use));
}

/** The zone a point is in, if any. Zones aren't meant to overlap. */
export function landUseAt(x: number, z: number): ResolvedZone | undefined {
  return zones.find(
    ({ bounds, outline }) =>
      x >= bounds.minX &&
      x <= bounds.maxX &&
      z >= bounds.minZ &&
      z <= bounds.maxZ &&
      signedDistance(x, z, outline) <= 0,
  );
}

let occupancy: Occupancy | undefined;

/**
 * Everything the layout puts on the ground, with a clearance around it. This
 * covers the circuit's runoff out past its barriers, so anything placed on
 * ground that isn't taken stands behind the protective boundary.
 */
export function siteOccupancy(): Occupancy {
  occupancy ??= occupancyOf(layout.locations, SITE_CLEARANCE);
  return occupancy;
}
