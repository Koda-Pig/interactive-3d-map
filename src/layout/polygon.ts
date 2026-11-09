export type Point = readonly [x: number, z: number];

export interface Bounds {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

export function boundsOf(points: readonly Point[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, minZ, maxX, maxZ };
}

/** The middle of a shape's bounding box, which is close enough for placing it. */
export function centreOf(points: readonly Point[]): [number, number] {
  const { minX, minZ, maxX, maxZ } = boundsOf(points);
  return [(minX + maxX) / 2, (minZ + maxZ) / 2];
}

/** Distance from a point to a polygon's edge: negative inside, positive outside. */
export function signedDistance(x: number, z: number, polygon: readonly Point[]): number {
  let closest = Number.POSITIVE_INFINITY;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [ax, az] = polygon[i];
    const [bx, bz] = polygon[j];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const offsetX = x - ax - dx * t;
    const offsetZ = z - az - dz * t;
    closest = Math.min(closest, offsetX * offsetX + offsetZ * offsetZ);
    if (az > z !== bz > z && x < ax + ((z - az) / (bz - az)) * dx) {
      inside = !inside;
    }
  }

  const distance = Math.sqrt(closest);
  return inside ? -distance : distance;
}
