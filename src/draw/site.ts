import { Group } from "three";
import type { Object3D } from "three";
import { layout } from "../layout/locations.ts";
import type { Location } from "../layout/locations.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { createArea } from "./areas.ts";
import { createBuilding } from "./buildings.ts";
import { createGate } from "./gates.ts";
import { createRibbon } from "./ribbons.ts";

function drawLocation(location: Location, surface: GroundSurface): Object3D {
  switch (location.type) {
    case "building":
      return createBuilding(location);
    case "area":
    case "water":
      return createArea(location);
    case "track":
    case "road":
      return createRibbon(location, surface);
    case "gate":
      return createGate(location);
  }
}

/** Draws every location in the layout data, one named object each. */
export function createSite(surface: GroundSurface): Group {
  const site = new Group();
  site.name = "site";
  for (const location of layout.locations) {
    const object = drawLocation(location, surface);
    object.name = location.id;
    object.userData.location = location;
    site.add(object);
  }
  return site;
}
