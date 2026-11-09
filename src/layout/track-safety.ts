import type { TrackLocation } from "./locations.ts";
import type { PathSample } from "./path.ts";
import { pathLength, resolvePath, samplePath } from "./path.ts";

/** Resolve authoring anchors once; all trackside geometry shares this envelope. */
export function createTrackSafety(track: TrackLocation) {
  const segments = resolvePath(track.path, track.closed ?? false);
  const length = pathLength(segments);
  const samples = samplePath(segments, 4, track.closed ?? false);
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
    return {
      width,
      paved: Math.max(0, (width - verge) * 0.62),
      color,
      barrier: track.width / 2 + width + 2,
    };
  };
}
