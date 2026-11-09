// Paths are polylines whose corners can be rounded. A point is `[x, z]` for a
// sharp corner or `[x, z, radius]` for a circular arc of that radius, so a path
// is made of true straights and true arcs and both can be measured exactly.

export type PathPoint = readonly [x: number, z: number, radius?: number];

export interface StraightSegment {
  readonly kind: "straight";
  readonly startX: number;
  readonly startZ: number;
  readonly endX: number;
  readonly endZ: number;
  readonly length: number;
}

export interface ArcSegment {
  readonly kind: "arc";
  readonly centreX: number;
  readonly centreZ: number;
  readonly radius: number;
  readonly startAngle: number;
  /** Signed sweep in radians. */
  readonly sweep: number;
  readonly length: number;
}

export type PathSegment = StraightSegment | ArcSegment;

export interface PathSample {
  readonly x: number;
  readonly z: number;
  /** Unit direction of travel. */
  readonly dirX: number;
  readonly dirZ: number;
  /** Distance from the start of the path. */
  readonly distance: number;
  /** Index into the segments the sample came from. */
  readonly segment: number;
}

const MIN_ARC_CHORD = 1.5;
const MAX_ARC_STEP_ANGLE = 0.18;

function pushStraight(
  segments: PathSegment[],
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): void {
  const length = Math.hypot(endX - startX, endZ - startZ);
  if (length > 1e-6) {
    segments.push({ kind: "straight", startX, startZ, endX, endZ, length });
  }
}

interface Corner {
  readonly entryX: number;
  readonly entryZ: number;
  readonly exitX: number;
  readonly exitZ: number;
  readonly tangent: number;
  readonly arc: ArcSegment | null;
}

function buildCorner(previous: PathPoint, point: PathPoint, next: PathPoint): Corner {
  const [x, z, radius = 0] = point;
  const sharp: Corner = { entryX: x, entryZ: z, exitX: x, exitZ: z, tangent: 0, arc: null };
  if (radius <= 0) {
    return sharp;
  }

  const inLength = Math.hypot(x - previous[0], z - previous[1]);
  const outLength = Math.hypot(next[0] - x, next[1] - z);
  const inX = (x - previous[0]) / inLength;
  const inZ = (z - previous[1]) / inLength;
  const outX = (next[0] - x) / outLength;
  const outZ = (next[1] - z) / outLength;

  const turn = Math.atan2(inX * outZ - inZ * outX, inX * outX + inZ * outZ);
  if (Math.abs(turn) < 1e-6) {
    return sharp;
  }

  const tangent = radius * Math.tan(Math.abs(turn) / 2);
  const entryX = x - inX * tangent;
  const entryZ = z - inZ * tangent;
  const side = Math.sign(turn);
  const centreX = entryX - inZ * radius * side;
  const centreZ = entryZ + inX * radius * side;

  return {
    entryX,
    entryZ,
    exitX: x + outX * tangent,
    exitZ: z + outZ * tangent,
    tangent,
    arc: {
      kind: "arc",
      centreX,
      centreZ,
      radius,
      startAngle: Math.atan2(entryZ - centreZ, entryX - centreX),
      sweep: turn,
      length: radius * Math.abs(turn),
    },
  };
}

/** Turns a list of points into straights and arcs. Throws if two corners overlap. */
export function resolvePath(points: readonly PathPoint[], closed: boolean): PathSegment[] {
  const count = points.length;
  if (count < 2 || (closed && count < 3)) {
    throw new Error(`A path needs more points than ${count}`);
  }

  const corners = points.map((point, index) => {
    const isEnd = !closed && (index === 0 || index === count - 1);
    if (isEnd) {
      return buildCorner(point, [point[0], point[1]], point);
    }
    return buildCorner(points[(index + count - 1) % count], point, points[(index + 1) % count]);
  });

  const segments: PathSegment[] = [];
  const edges = closed ? count : count - 1;
  for (let index = 0; index < edges; index += 1) {
    const from = corners[index];
    const to = corners[(index + 1) % count];
    const start = points[index];
    const end = points[(index + 1) % count];
    if (from.tangent + to.tangent > Math.hypot(end[0] - start[0], end[1] - start[1]) + 1e-6) {
      throw new Error(`Rounded corners overlap between [${start.join(", ")}] and [${end.join(", ")}]`);
    }
    if (from.arc && (closed || index > 0)) {
      segments.push(from.arc);
    }
    pushStraight(segments, from.exitX, from.exitZ, to.entryX, to.entryZ);
  }
  return segments;
}

export function pathLength(segments: readonly PathSegment[]): number {
  return segments.reduce((total, segment) => total + segment.length, 0);
}

/**
 * Evenly spaced points along a path, no further than `step` metres apart. Each
 * segment's end is included, so corners are never cut. A closed path doesn't
 * repeat its first point.
 */
export function samplePath(
  segments: readonly PathSegment[],
  step: number,
  closed: boolean,
): PathSample[] {
  const samples: PathSample[] = [];
  let travelled = 0;

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    if (segment.kind === "straight") {
      const divisions = Math.max(1, Math.ceil(segment.length / step));
      const dirX = (segment.endX - segment.startX) / segment.length;
      const dirZ = (segment.endZ - segment.startZ) / segment.length;
      const emitted = isLast && !closed ? divisions + 1 : divisions;
      for (let i = 0; i < emitted; i += 1) {
        const along = (i / divisions) * segment.length;
        samples.push({
          x: segment.startX + dirX * along,
          z: segment.startZ + dirZ * along,
          dirX,
          dirZ,
          distance: travelled + along,
          segment: index,
        });
      }
    } else {
      const absSweep = Math.abs(segment.sweep);
      const stepAngle = Math.min(
        MAX_ARC_STEP_ANGLE,
        Math.max(MIN_ARC_CHORD, Math.min(step, segment.length)) / segment.radius,
      );
      const divisions = Math.max(1, Math.ceil(absSweep / stepAngle));
      const direction = Math.sign(segment.sweep);
      const emitted = isLast && !closed ? divisions + 1 : divisions;
      for (let i = 0; i < emitted; i += 1) {
        const t = i / divisions;
        const angle = segment.startAngle + segment.sweep * t;
        samples.push({
          x: segment.centreX + Math.cos(angle) * segment.radius,
          z: segment.centreZ + Math.sin(angle) * segment.radius,
          dirX: -Math.sin(angle) * direction,
          dirZ: Math.cos(angle) * direction,
          distance: travelled + segment.length * t,
          segment: index,
        });
      }
    }
    travelled += segment.length;
  });

  return samples;
}

/** The outline of a shape, with rounded corners turned into short chords. */
export function resolveOutline(points: readonly PathPoint[]): [number, number][] {
  if (points.every((point) => !point[2])) {
    return points.map(([x, z]) => [x, z]);
  }
  return samplePath(resolvePath(points, true), Number.POSITIVE_INFINITY, true).map(
    (sample) => [sample.x, sample.z],
  );
}
