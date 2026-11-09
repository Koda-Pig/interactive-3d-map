import { Mesh, Shape, ShapeGeometry, Vector2 } from "three";
import type { AreaLocation } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import { centreOf } from "../layout/polygon.ts";
import { heightAt } from "../terrain/height.ts";
import { Layer, layerMaterial, waterMaterial } from "./materials.ts";

const LIFT = 0.3;

export function createArea(location: AreaLocation): Mesh {
  const outline = resolveOutline(location.footprint);
  const [x, z] = centreOf(outline);

  const geometry = new ShapeGeometry(new Shape(outline.map(([px, pz]) => new Vector2(px, -pz))));
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, heightAt(x, z) + LIFT, 0);

  const material =
    location.type === "water"
      ? waterMaterial(location.color)
      : layerMaterial(location.color, Layer.area);
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
