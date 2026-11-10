import type { Object3D } from "three";
import { Group } from "three";
import type { Location } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { createArea } from "./areas.ts";
import { createBuilding } from "./buildings.ts";
import { createGate } from "./gates.ts";
import type { Kit } from "./kit.ts";
import { createRibbon } from "./ribbons.ts";

function drawLocation(location: Location, surface: GroundSurface, kit: Kit): Object3D {
  switch (location.type) {
    case "building":
      return createBuilding(location, kit);
    case "area":
    case "water": {
      const area = createArea(location, surface);
      if (location.markings) {
        const { color, width, lines } = location.markings;
        const [path, ...branches] = lines;
        area.add(
          createRibbon({ ...location, type: "road", color, width, path, branches }, surface),
        );
      }
      return area;
    }
    case "track":
    case "road":
      return createRibbon(location, surface);
    case "gate":
      return createGate(location, kit);
  }
}

/** Draws every location in the layout data, one named object each. */
export function createSite(surface: GroundSurface, kit: Kit): Group {
  const site = new Group();
  site.name = "site";
  for (const location of layout.locations) {
    const object = drawLocation(location, surface, kit);
    object.name = location.id;
    object.userData.location = location;
    site.add(object);
  }
  return site;
}
