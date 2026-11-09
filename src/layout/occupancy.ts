import type { Location } from "./locations.ts";
import { buildingParts } from "./locations.ts";
import type { PathPoint } from "./path.ts";
import { resolveOutline, resolvePath, samplePath } from "./path.ts";
import type { Point } from "./polygon.ts";
import { boundsOf, signedDistance } from "./polygon.ts";

const CELL_SIZE = 8;
const PATH_STEP = 12;
const GATE_RADIUS = 8;
/** Keeps cell coordinates positive and well apart when packed into one number. */
const KEY_OFFSET = 40000;
const KEY_STRIDE = 80000;

/** The parts of the ground that have something on them. */
export class Occupancy {
  private readonly cells = new Set<number>();

  isTaken(x: number, z: number): boolean {
    return this.cells.has(this.keyAt(x, z));
  }

  private keyAt(x: number, z: number): number {
    const column = Math.floor(x / CELL_SIZE) + KEY_OFFSET;
    const row = Math.floor(z / CELL_SIZE) + KEY_OFFSET;
    return column * KEY_STRIDE + row;
  }

  addDisc(x: number, z: number, radius: number): void {
    for (let cellZ = z - radius; cellZ <= z + radius; cellZ += CELL_SIZE) {
      for (let cellX = x - radius; cellX <= x + radius; cellX += CELL_SIZE) {
        if (Math.hypot(cellX - x, cellZ - z) <= radius) {
          this.cells.add(this.keyAt(cellX, cellZ));
        }
      }
    }
  }

  addPolygon(polygon: readonly Point[], margin: number): void {
    const { minX, minZ, maxX, maxZ } = boundsOf(polygon);
    for (let z = minZ - margin; z <= maxZ + margin; z += CELL_SIZE) {
      for (let x = minX - margin; x <= maxX + margin; x += CELL_SIZE) {
        if (signedDistance(x, z, polygon) <= margin) {
          this.cells.add(this.keyAt(x, z));
        }
      }
    }
  }

  addPath(path: readonly PathPoint[], closed: boolean, radius: number): void {
    for (const { x, z } of samplePath(resolvePath(path, closed), PATH_STEP, closed)) {
      this.addDisc(x, z, radius);
    }
  }
}

/** Marks everything these locations cover, plus `margin` metres around it. */
export function occupancyOf(locations: readonly Location[], margin: number): Occupancy {
  const occupancy = new Occupancy();
  for (const location of locations) {
    switch (location.type) {
      case "building":
        for (const part of buildingParts(location)) {
          occupancy.addPolygon(resolveOutline(part.footprint), margin);
        }
        break;
      case "area":
      case "water":
        occupancy.addPolygon(resolveOutline(location.footprint), margin);
        break;
      case "track":
      case "road": {
        const radius = location.width / 2 + (location.runoff ?? 0) + margin;
        occupancy.addPath(location.path, location.closed ?? false, radius);
        for (const branch of location.branches ?? []) {
          occupancy.addPath(branch, false, radius);
        }
        break;
      }
      case "gate":
        occupancy.addDisc(location.position[0], location.position[1], GATE_RADIUS + margin);
        break;
    }
  }
  return occupancy;
}
