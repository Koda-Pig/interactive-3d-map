import type { AreaLocation, Location } from "./locations.ts";
import { resolveOutline } from "./path.ts";
import { boundsOf } from "./polygon.ts";

const STALL_WIDTH = 3;
const STALL_DEPTH = 5.5;
/** Two rows of stalls, back to back. */
export const BLOCK_DEPTH = STALL_DEPTH * 2;
const AISLE = 7;
const MODULE = BLOCK_DEPTH + AISLE;
/** Left free around the edge, for the trees and a perimeter aisle. */
const EDGE_CLEARANCE = 12;
/** Left free each side of the centre of the access spine. */
const SPINE_CLEARANCE = 9;

/** A double row of stalls, running along X or Z. */
export interface ParkingBlock {
  /** Counts across the car park, the same for both halves of a row. */
  readonly lane: number;
  readonly rowsAlongX: boolean;
  /** Where the block starts across its rows. */
  readonly across: number;
  readonly from: number;
  readonly to: number;
}

export interface Stall {
  readonly x: number;
  readonly z: number;
  /** Which of the block's two rows it's in, so cars can back onto each other. */
  readonly row: 0 | 1;
}

export function isCarPark(location: Location): location is AreaLocation {
  return location.type === "area" && location.id.startsWith("car-park-");
}

/**
 * Rows follow a car park's long side. They stop short of the middle, where the
 * access spine crosses them, so a spine has to enter at the long side's centre.
 */
export function parkingBlocks(park: AreaLocation): ParkingBlock[] {
  const { minX, minZ, maxX, maxZ } = boundsOf(resolveOutline(park.footprint));
  const rowsAlongX = maxX - minX > maxZ - minZ;
  const [acrossMin, acrossMax] = rowsAlongX ? [minZ, maxZ] : [minX, maxX];
  const [alongMin, alongMax] = rowsAlongX ? [minX, maxX] : [minZ, maxZ];

  const lanes = Math.floor((acrossMax - acrossMin - EDGE_CLEARANCE * 2 + AISLE) / MODULE);
  const first = (acrossMin + acrossMax - (lanes * MODULE - AISLE)) / 2;
  const centre = (alongMin + alongMax) / 2;
  const halfLength = (alongMax - alongMin) / 2 - EDGE_CLEARANCE - SPINE_CLEARANCE;
  const run = Math.floor(halfLength / STALL_WIDTH) * STALL_WIDTH;

  const blocks: ParkingBlock[] = [];
  for (let lane = 0; lane < lanes; lane += 1) {
    const across = first + lane * MODULE;
    blocks.push(
      {
        lane,
        rowsAlongX,
        across,
        from: centre - SPINE_CLEARANCE - run,
        to: centre - SPINE_CLEARANCE,
      },
      {
        lane,
        rowsAlongX,
        across,
        from: centre + SPINE_CLEARANCE,
        to: centre + SPINE_CLEARANCE + run,
      },
    );
  }
  return blocks;
}

/** A point in a block, from how far across its rows and along them it is. */
export function pointInBlock(block: ParkingBlock, across: number, along: number): [number, number] {
  return block.rowsAlongX
    ? [block.from + along, block.across + across]
    : [block.across + across, block.from + along];
}

export function stallsOf(block: ParkingBlock): Stall[] {
  const count = Math.round((block.to - block.from) / STALL_WIDTH);
  const stalls: Stall[] = [];
  for (let index = 0; index < count; index += 1) {
    const along = (index + 0.5) * STALL_WIDTH;
    for (const row of [0, 1] as const) {
      const [x, z] = pointInBlock(block, STALL_DEPTH * (row + 0.5), along);
      stalls.push({ x, z, row });
    }
  }
  return stalls;
}

/** How many stalls a block's texture repeats along its length. */
export function stallCount(block: ParkingBlock): number {
  return Math.round((block.to - block.from) / STALL_WIDTH);
}
