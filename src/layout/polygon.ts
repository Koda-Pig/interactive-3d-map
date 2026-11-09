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

/** Twice a polygon's area, positive or negative depending on which way it's wound. */
function windingArea(polygon: readonly Point[]): number {
  let area = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    area += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
  }
  return area;
}

/** The corner of a mitred join is kept within this many offsets of the original. */
const MAX_MITRE = 2;

/** A closed outline moved outward by `distance`, whichever way round it's wound. */
export function outsetPolygon(polygon: readonly Point[], distance: number): Point[] {
  const points = polygon.filter(([x, z], index) => {
    const [previousX, previousZ] = polygon[(index + polygon.length - 1) % polygon.length];
    return x !== previousX || z !== previousZ;
  });
  const outward = windingArea(points) > 0 ? 1 : -1;
  const normal = (from: Point, to: Point): Point => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return [(outward * (to[1] - from[1])) / length, (outward * (from[0] - to[0])) / length];
  };

  return points.map((point, index) => {
    const before = normal(points[(index + points.length - 1) % points.length], point);
    const after = normal(point, points[(index + 1) % points.length]);
    const sumX = before[0] + after[0];
    const sumZ = before[1] + after[1];
    const length = Math.hypot(sumX, sumZ) || 1;
    const cosine = Math.max(1 / MAX_MITRE, (sumX * before[0] + sumZ * before[1]) / length);
    const reach = distance / cosine / length;
    return [point[0] + sumX * reach, point[1] + sumZ * reach];
  });
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
