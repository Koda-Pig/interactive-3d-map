import type { Group } from "three";
import type { BuildingLocation, GateLocation } from "../layout/locations.ts";
import { createBuilding } from "./buildings.ts";
import type { Kit } from "./kit.ts";
import { GATE_MODEL } from "./kit.ts";

const GATE_WIDTH = 24;
const GATE_DEPTH = 4;
const GATE_HEIGHT = 6;
const GATE_COLOR = "#004272";

/** A turnstile gate, built as a building so that it shares its model fitting and fallback. */
export function createGate(location: GateLocation, kit: Kit): Group {
  const [x, z] = location.position;
  const sideways = location.facing === "east" || location.facing === "west";
  const halfX = (sideways ? GATE_DEPTH : GATE_WIDTH) / 2;
  const halfZ = (sideways ? GATE_WIDTH : GATE_DEPTH) / 2;
  const building: BuildingLocation = {
    id: location.id,
    name: location.name,
    category: location.category,
    description: location.description,
    type: "building",
    color: GATE_COLOR,
    height: GATE_HEIGHT,
    footprint: [
      [x - halfX, z - halfZ],
      [x + halfX, z - halfZ],
      [x + halfX, z + halfZ],
      [x - halfX, z + halfZ],
    ],
    model: { file: GATE_MODEL, facing: location.facing },
  };
  return createBuilding(building, kit);
}
