import { noise2 } from "./noise.ts";

const HILLS_START = 2200;
const HILLS_FULL = 6500;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ground height in metres at a world position. This is the only source of
 * terrain height: anything that sits on the ground should call it.
 */
export function heightAt(x: number, z: number): number {
  const rolling =
    15 * noise2(x, z, 1900, 1) + 6 * noise2(x, z, 760, 2) + 1.4 * noise2(x, z, 280, 3);

  const hills =
    smoothstep(HILLS_START, HILLS_FULL, Math.hypot(x, z)) *
    (70 + 60 * noise2(x, z, 2800, 4));

  return rolling + hills;
}
