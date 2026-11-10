import type { Object3D } from "three";
import type { EventMode, Location } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import type { Precincts } from "./precincts.ts";

function inUse(mode: EventMode, location: Location): boolean {
  return (
    // Muted water turns grey and reads as paving, so it's always left in.
    location.type === "water" ||
    mode.categories.includes(location.category) ||
    mode.locations.includes(location.id)
  );
}

/** Shows the site as it's used for one kind of event, or as a whole. */
export function setEventMode(
  mode: EventMode | null,
  precincts: Precincts,
  dressing: ReadonlyMap<string, readonly Object3D[]>,
): void {
  precincts.setMuted(
    new Set(mode ? layout.locations.filter((location) => !inUse(mode, location)) : []),
  );
  for (const [id, objects] of dressing) {
    for (const object of objects) {
      object.visible = id === mode?.id;
    }
  }
}
