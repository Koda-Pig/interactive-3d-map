import { ExtrudeGeometry, Group, Mesh, Shape, Vector2 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildingParts } from "../layout/locations.ts";
import type { BuildingLocation, BuildingPart } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import { centreOf } from "../layout/polygon.ts";
import { heightAt } from "../terrain/height.ts";
import { solidMaterial } from "./materials.ts";

// Walls start below the ground so a pad's edge can't leave a gap under them.
const WALL_SINK = 4;

function partGeometry(part: BuildingPart, groundY: number): ExtrudeGeometry {
  const shape = new Shape(resolveOutline(part.footprint).map(([x, z]) => new Vector2(x, -z)));
  const sink = part.base ? 0 : WALL_SINK;
  const geometry = new ExtrudeGeometry(shape, {
    depth: part.height + sink,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, groundY + (part.base ?? 0) - sink, 0);
  return geometry;
}

/** Raises a building's footprints from one ground level, merged per colour. */
export function createBuilding(location: BuildingLocation): Group {
  const parts = buildingParts(location);
  const [x, z] = centreOf(parts.flatMap((part) => resolveOutline(part.footprint)));
  const groundY = heightAt(x, z);

  const byColor = new Map<string, ExtrudeGeometry[]>();
  for (const part of parts) {
    const color = part.color ?? location.color;
    const geometries = byColor.get(color) ?? [];
    geometries.push(partGeometry(part, groundY));
    byColor.set(color, geometries);
  }

  const group = new Group();
  for (const [color, geometries] of byColor) {
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    const mesh = new Mesh(geometry, solidMaterial(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
