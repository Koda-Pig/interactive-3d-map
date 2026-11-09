import { layout, levelledOutline } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import { boundsOf, centreOf, signedDistance } from "../layout/polygon.ts";
import type { Bounds, Point } from "../layout/polygon.ts";

// The ground mesh has 20 m cells, so the flat part of a pad runs past the
// outline by more than one cell's diagonal to be flat under the whole outline.
const FLAT_MARGIN = 30;
const BLEND_WIDTH = 70;
const ZONE_BLEND_WIDTH = 120;
const LEVEL_SAMPLE_STEP = 30;

interface Pad {
  readonly polygon: readonly Point[];
  readonly bounds: Bounds;
  readonly level: number;
  readonly blendWidth: number;
}

function rectangleOf({ minX, minZ, maxX, maxZ }: Bounds): Point[] {
  return [
    [minX, minZ],
    [maxX, minZ],
    [maxX, maxZ],
    [minX, maxZ],
  ];
}

function meanHeight(
  polygon: readonly Point[],
  bounds: Bounds,
  height: (x: number, z: number) => number,
): number {
  let total = 0;
  let count = 0;
  for (let x = bounds.minX; x <= bounds.maxX; x += LEVEL_SAMPLE_STEP) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += LEVEL_SAMPLE_STEP) {
      if (signedDistance(x, z, polygon) <= 0) {
        total += height(x, z);
        count += 1;
      }
    }
  }
  if (count > 0) {
    return total / count;
  }
  const [x, z] = centreOf(polygon);
  return height(x, z);
}

function createPad(
  polygon: readonly Point[],
  blendWidth: number,
  height: (x: number, z: number) => number,
): Pad {
  const bounds = boundsOf(polygon);
  return { polygon, bounds, level: meanHeight(polygon, bounds, height), blendWidth };
}

/** Builds one pad per grading zone and per location standing outside a zone. */
export function buildPads(height: (x: number, z: number) => number): readonly Pad[] {
  const zones = layout.grading.map((zone) =>
    createPad(resolveOutline(zone.footprint), ZONE_BLEND_WIDTH, height),
  );

  const singles: Pad[] = [];
  for (const location of layout.locations) {
    const outline = levelledOutline(location);
    if (!outline) {
      continue;
    }
    const [x, z] = centreOf(outline);
    if (zones.some((zone) => signedDistance(x, z, zone.polygon) <= 0)) {
      continue;
    }
    const isSingleShape = location.type !== "building" || !location.parts;
    const polygon = isSingleShape ? outline : rectangleOf(boundsOf(outline));
    singles.push(createPad(polygon, BLEND_WIDTH, height));
  }
  return [...zones, ...singles];
}

/** Blends natural ground towards any pads near this position. */
export function applyPads(
  pads: readonly Pad[],
  x: number,
  z: number,
  natural: number,
): number {
  let strongest = 0;
  let totalWeight = 0;
  let totalLevel = 0;

  for (const pad of pads) {
    const reach = FLAT_MARGIN + pad.blendWidth;
    const { minX, minZ, maxX, maxZ } = pad.bounds;
    if (x < minX - reach || x > maxX + reach || z < minZ - reach || z > maxZ + reach) {
      continue;
    }

    const distance = signedDistance(x, z, pad.polygon);
    if (distance >= reach) {
      continue;
    }

    const t = Math.max(0, (distance - FLAT_MARGIN) / pad.blendWidth);
    const influence = 1 - t * t * (3 - 2 * t);
    // Weighted so a pad's flat area isn't tilted by its neighbour's blend.
    const weight = influence / (1 - influence + 1e-3);
    strongest = Math.max(strongest, influence);
    totalWeight += weight;
    totalLevel += weight * pad.level;
  }

  if (totalWeight === 0) {
    return natural;
  }
  return natural + (totalLevel / totalWeight - natural) * strongest;
}
