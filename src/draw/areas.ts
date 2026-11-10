import { BufferAttribute, BufferGeometry, Mesh, Shape, ShapeGeometry, Vector2 } from "three";
import {
  BLOCK_DEPTH,
  isCarPark,
  parkingBlocks,
  pointInBlock,
  stallCount,
} from "../layout/car-parks.ts";
import type { AreaLocation } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import { centreOf } from "../layout/polygon.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { heightAt } from "../terrain/height.ts";
import { Layer, layerMaterial, parkingStallTexture, waterMaterial } from "./materials.ts";

const LIFT = 0.3;
const STALL_LIFT = 0.02;
/** The lines' colour. The stall texture darkens it to asphalt between them. */
const STALL_PAINT = "#EDEFF0";

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

/** The marked rows of a car park, one quad per block, just above its surface. */
function createStallBlocks(park: AreaLocation, y: number): Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const block of parkingBlocks(park)) {
    const length = block.to - block.from;
    const stalls = stallCount(block);
    const first = positions.length / 3;
    // Round in this order, so the quad faces up whichever way the rows run.
    const corners = block.rowsAlongX
      ? [
          [0, 0, 0, 0],
          [BLOCK_DEPTH, 0, 1, 0],
          [BLOCK_DEPTH, length, 1, stalls],
          [0, length, 0, stalls],
        ]
      : [
          [0, 0, 0, 0],
          [0, length, 0, stalls],
          [BLOCK_DEPTH, length, 1, stalls],
          [BLOCK_DEPTH, 0, 1, 0],
        ];
    for (const [across, along, u, v] of corners) {
      const [x, z] = pointInBlock(block, across, along);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(Float32Array.from(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new Mesh(
    geometry,
    layerMaterial(STALL_PAINT, Layer.area + 0.5, parkingStallTexture()),
  );
  mesh.receiveShadow = true;
  return mesh;
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
  if (isCarPark(location)) {
    mesh.add(createStallBlocks(location, heightAt(x, z) + lift + STALL_LIFT));
  }
  return mesh;
}
