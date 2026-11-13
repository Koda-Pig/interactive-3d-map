import type { TrackLocation } from "./locations.ts";
import { resolvePath, samplePath } from "./path.ts";

export const GRID_LENGTH = 6.4;
export const GRID_WIDTH = 2.4;
/** Eleven teams of two cars, the 2026 grid. */
export const GRID_SIZE = 22;

/** Shared centres for the painted slots and the cars that occupy them. */
export function raceGrid(circuit: TrackLocation) {
  if (!circuit.startFinish) return [];
  const [lineX, lineZ] = circuit.startFinish;
  const samples = samplePath(resolvePath(circuit.path, true), 2, true);
  const finish = samples.reduce((best, sample) =>
    Math.hypot(sample.x - lineX, sample.z - lineZ) < Math.hypot(best.x - lineX, best.z - lineZ)
      ? sample
      : best,
  );
  return Array.from({ length: GRID_SIZE }, (_, place) => {
    const along = -(place * 10 + 8 + GRID_LENGTH / 2);
    const across = ((place % 2 === 0 ? -1 : 1) * circuit.width) / 4;
    return {
      x: finish.x + finish.dirX * along - finish.dirZ * across,
      z: finish.z + finish.dirZ * along + finish.dirX * across,
      dirX: finish.dirX,
      dirZ: finish.dirZ,
    };
  });
}
