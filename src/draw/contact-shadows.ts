import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { BuildingLocation, Category } from "../layout/locations.ts";
import { buildingParts, layout } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import type { Point } from "../layout/polygon.ts";
import { centreOf, outsetPolygon, signedDistance } from "../layout/polygon.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { Layer, offsetParameters } from "./materials.ts";

/** How dark the ground is right against a wall, from 0 to 1. */
const DARKNESS = 0.3;
/** How far the darkening reaches from a wall, as a share of the wall's height, in metres. */
const REACH_PER_HEIGHT = 0.3;
const MIN_REACH = 1.5;
const MAX_REACH = 6;
/** Long walls are split so the band can follow the ground between their corners. */
const MAX_SEGMENT = 16;
/** Lifts the band just clear of the ground, in metres. */
const LIFT = 0.06;

/** Material flag that keeps a fade from making the material opaque at full opacity. */
export const ALWAYS_TRANSPARENT = "alwaysTransparent";

/** Extra points along each edge, so no edge is longer than `MAX_SEGMENT`. */
function densify(outline: readonly Point[]): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < outline.length; index += 1) {
    const [ax, az] = outline[index];
    const [bx, bz] = outline[(index + 1) % outline.length];
    const pieces = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / MAX_SEGMENT));
    for (let piece = 0; piece < pieces; piece += 1) {
      const t = piece / pieces;
      points.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  return points;
}

/**
 * A band around an outline, dark at the outline and clear at its outer edge,
 * laid on the ground.
 */
function band(outline: readonly Point[], reach: number, surface: GroundSurface): BufferGeometry {
  const inner = densify(outline);
  const outer = outsetPolygon(inner, reach);
  const count = inner.length;
  const positions = new Float32Array(count * 2 * 3);
  const colors = new Float32Array(count * 2 * 4);
  for (let index = 0; index < count; index += 1) {
    const [ix, iz] = inner[index];
    const [ox, oz] = outer[index];
    positions.set([ix, surface.heightAt(ix, iz) + LIFT, iz], index * 6);
    positions.set([ox, surface.heightAt(ox, oz) + LIFT, oz], index * 6 + 3);
    colors.set([0, 0, 0, DARKNESS, 0, 0, 0, 0], index * 8);
  }
  const indices: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = index * 2;
    const b = ((index + 1) % count) * 2;
    // Both windings, as outlines are listed either way round and the band faces up.
    indices.push(a, a + 1, b, b, a + 1, b + 1, a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  return geometry;
}

/** Whether the building stands in the lake, where the band would show through the water. */
function inWater(building: BuildingLocation, water: readonly (readonly Point[])[]): boolean {
  const [x, z] = centreOf(
    buildingParts(building).flatMap((part) => resolveOutline(part.footprint)),
  );
  return water.some((outline) => signedDistance(x, z, outline) < 0);
}

/**
 * The darker ground where each building meets it, one mesh per precinct so
 * that it fades with the precinct's buildings. Raised parts such as roofs and
 * arch beams, and smooth banks, cast none.
 */
export function createContactShadows(surface: GroundSurface): Map<Category, Mesh> {
  const water = layout.locations.flatMap((location) =>
    location.type === "water" ? [resolveOutline(location.footprint)] : [],
  );
  const byCategory = new Map<Category, BufferGeometry[]>();
  for (const location of layout.locations) {
    if (location.type !== "building" || inWater(location, water)) {
      continue;
    }
    for (const part of buildingParts(location)) {
      if ((part.base ?? 0) > 0 || part.slope) {
        continue;
      }
      const reach = Math.min(MAX_REACH, Math.max(MIN_REACH, part.height * REACH_PER_HEIGHT));
      const geometries = byCategory.get(location.category) ?? [];
      geometries.push(band(resolveOutline(part.footprint), reach, surface));
      byCategory.set(location.category, geometries);
    }
  }

  const material = new MeshBasicMaterial({
    color: 0x000000,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    ...offsetParameters(Layer.marking),
  });
  material.userData[ALWAYS_TRANSPARENT] = true;

  const meshes = new Map<Category, Mesh>();
  for (const [category, geometries] of byCategory) {
    const merged = mergeGeometries(geometries);
    if (merged) {
      const mesh = new Mesh(merged, material);
      mesh.name = `contact-shadows-${category}`;
      mesh.renderOrder = -1;
      meshes.set(category, mesh);
    }
  }
  return meshes;
}
