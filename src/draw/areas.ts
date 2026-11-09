import { BufferAttribute, BufferGeometry, Mesh, Shape, ShapeGeometry, Vector2 } from "three";
import type { AreaLocation } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import { centreOf } from "../layout/polygon.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { heightAt } from "../terrain/height.ts";
import { Layer, layerMaterial, waterMaterial } from "./materials.ts";

const LIFT = 0.3;

/** Subdivide before projection so wide grass reserves follow the terrain mesh. */
function drape(source: ShapeGeometry, surface: GroundSurface, lift: number): BufferGeometry {
  const flat = source.toNonIndexed();
  const vertices = flat.getAttribute("position");
  const positions: number[] = [];
  type Vertex = readonly [number, number];
  const midpoint = (a: Vertex, b: Vertex): Vertex => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const triangle = (a: Vertex, b: Vertex, c: Vertex): void => {
    const edge = (u: Vertex, v: Vertex): number => Math.hypot(u[0] - v[0], u[1] - v[1]);
    if (Math.max(edge(a, b), edge(b, c), edge(c, a)) > 20) {
      const ab = midpoint(a, b),
        bc = midpoint(b, c),
        ca = midpoint(c, a);
      triangle(a, ab, ca);
      triangle(ab, b, bc);
      triangle(ca, bc, c);
      triangle(ab, bc, ca);
      return;
    }
    for (const [x, z] of [a, b, c]) positions.push(x, surface.heightAt(x, z) + lift, z);
  };
  for (let i = 0; i < vertices.count; i += 3) {
    triangle(
      [vertices.getX(i), vertices.getZ(i)],
      [vertices.getX(i + 1), vertices.getZ(i + 1)],
      [vertices.getX(i + 2), vertices.getZ(i + 2)],
    );
  }
  flat.dispose();
  source.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(Float32Array.from(positions), 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createArea(location: AreaLocation, surface: GroundSurface): Mesh {
  const outline = resolveOutline(location.footprint);
  const [x, z] = centreOf(outline);

  const flat = new ShapeGeometry(new Shape(outline.map(([px, pz]) => new Vector2(px, -pz))));
  flat.rotateX(-Math.PI / 2);
  const lift = LIFT + (location.overlay ? 0.03 : 0);
  const geometry = location.followTerrain ? drape(flat, surface, lift) : flat;
  if (!location.followTerrain) geometry.translate(0, heightAt(x, z) + lift, 0);

  const material =
    location.type === "water"
      ? waterMaterial(location.color)
      : layerMaterial(location.color, Layer.area + (location.overlay ? 0.5 : 0));
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
