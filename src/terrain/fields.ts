import { hash2, noise2 } from "./noise.ts";

const FIELD_WIDTH = 460;
const FIELD_LENGTH = 360;
const EDGE_WARP = 110;

// sRGB. Wheat tones are listed more often so gold dominates the patchwork.
const FIELD_TONES: readonly (readonly [number, number, number])[] = [
  [214, 182, 108],
  [224, 194, 124],
  [205, 172, 98],
  [218, 186, 112],
  [210, 178, 104],
  [226, 198, 132],
  [230, 211, 160],
  [194, 165, 118],
  [166, 162, 102],
  [148, 150, 94],
];

/** Writes the RGB colour of the farmland at a world position into `pixels`. */
export function writeFieldColor(
  x: number,
  z: number,
  pixels: Uint8Array,
  offset: number,
): void {
  const warpedX = x + EDGE_WARP * noise2(x, z, 900, 11);
  const warpedZ = z + EDGE_WARP * noise2(x, z, 900, 12);

  const column = Math.floor(warpedX / FIELD_WIDTH);
  const row = Math.floor(warpedZ / FIELD_LENGTH + hash2(column, 0, 13));
  const tone = FIELD_TONES[Math.floor(hash2(column, row, 14) * FIELD_TONES.length)];

  const shade = 1 + 0.06 * noise2(x, z, 170, 15) + 0.03 * noise2(x, z, 45, 16);
  pixels[offset] = Math.min(255, tone[0] * shade);
  pixels[offset + 1] = Math.min(255, tone[1] * shade);
  pixels[offset + 2] = Math.min(255, tone[2] * shade);
}
