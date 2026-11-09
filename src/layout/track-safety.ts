import type { TrackLocation } from "./locations.ts";
import type { PathSample } from "./path.ts";
import { pathLength, resolvePath, samplePath } from "./path.ts";
import type { Point } from "./polygon.ts";

/** Resolve authoring anchors once; all trackside geometry shares this envelope. */
export function createTrackSafety(track: TrackLocation) {
  const segments = resolvePath(track.path, track.closed ?? false);
  const length = pathLength(segments);
  const samples = samplePath(segments, 4, track.closed ?? false);
  const closest = ([x, z]: Point): PathSample =>
    samples.reduce((best, sample) =>
      Math.hypot(sample.x - x, sample.z - z) < Math.hypot(best.x - x, best.z - z) ? sample : best,
    );
  const vergeOffset = track.width / 2 + (track.runoff ?? 0);
  const catchments = (track.runoffCatchments ?? []).map((catchment) => {
    const from = closest(catchment.from);
    const to = closest(catchment.to);
    const endpoint = (sample: PathSample): Point => [
      sample.x - sample.dirZ * vergeOffset * catchment.side,
      sample.z + sample.dirX * vergeOffset * catchment.side,
    ];
    const edge = samplePath(
      resolvePath([endpoint(from), ...catchment.boundary, endpoint(to)], false),
      4,
      false,
    );
    return {
      ...catchment,
      start: from.distance,
      span: (to.distance - from.distance + length) % length,
      edge,
    };
  });
  const zones = (track.safetyZones ?? []).map((zone) => ({
    ...zone,
    distance: samples.reduce((best, sample) =>
      Math.hypot(sample.x - zone.at[0], sample.z - zone.at[1]) <
      Math.hypot(best.x - zone.at[0], best.z - zone.at[1])
        ? sample
        : best,
    ).distance,
  }));
  return (sample: PathSample, side: number) => {
    const verge = track.runoff ?? 0;
    let width = verge;
    let color = track.runoffColor ?? "#8C9860";
    for (const zone of zones) {
      if (zone.side !== side) continue;
      const delta = Math.abs(sample.distance - zone.distance);
      const distance = track.closed ? Math.min(delta, length - delta) : delta;
      if (distance >= zone.reach) continue;
      const blend = (1 + Math.cos((distance / zone.reach) * Math.PI)) / 2;
      const local = verge + (zone.width - verge) * blend;
      if (local > width) {
        width = local;
        color = zone.color;
      }
    }
    for (const catchment of catchments) {
      if (
        catchment.side !== side ||
        (sample.distance - catchment.start + length) % length > catchment.span
      )
        continue;
      const nx = -sample.dirZ * side;
      const nz = sample.dirX * side;
      for (let index = 0; index < catchment.edge.length - 1; index += 1) {
        const a = catchment.edge[index];
        const b = catchment.edge[index + 1];
        const ex = b.x - a.x;
        const ez = b.z - a.z;
        const determinant = nx * ez - nz * ex;
        if (Math.abs(determinant) < 1e-8) continue;
        const ax = a.x - sample.x;
        const az = a.z - sample.z;
        const distance = (ax * ez - az * ex) / determinant;
        const alongEdge = (ax * nz - az * nx) / determinant;
        if (distance > track.width / 2 + width && alongEdge >= 0 && alongEdge <= 1) {
          width = distance - track.width / 2;
          color = catchment.color;
        }
      }
    }
    return {
      width,
      paved: Math.max(0, (width - verge) * 0.62),
      color,
      barrier: track.width / 2 + width + 2,
    };
  };
}
