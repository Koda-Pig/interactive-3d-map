import { landUseAt, siteOccupancy } from "../layout/land-use.ts";
import type { LandUse } from "../layout/locations.ts";
import { SITE_SIZE } from "../site.ts";
import { hash2, noise2 } from "./noise.ts";

const FIELD_WIDTH = 460;
const FIELD_LENGTH = 360;
const EDGE_WARP = 110;
const EDGE_SOLVE_STEPS = 3;
/** How soft the line between the site's mown grass and the wheat is, in metres. */
const GRASS_EDGE_WIDTH = 7;
/** How far the site's edge wanders out past the square, in metres, so it doesn't read as a rectangle. */
const SITE_EDGE_WANDER = 70;
/** The darker verge along the site's edge, where a hedge runs, in metres either side of it. */
const VERGE_WIDTH = 9;
const GRASS_TONE: readonly [number, number, number] = [150, 158, 96];

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

/** Ground colours for land in use inside the site. Wheat takes a field tone instead. */
const LAND_TONES: Readonly<Record<Exclude<LandUse, "wheat">, readonly [number, number, number]>> = {
  vineyard: [176, 152, 104],
  "overflow-parking": [170, 166, 104],
  camping: [166, 168, 102],
  "fan-village": [176, 168, 112],
};
/** How far apart the samples that soften a zone's edge are, in metres. */
const COVER_REACH = 4;
const COVER_TAPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * How far a point lies outside the site's grass, in metres, negative inside.
 * The edge follows the warp of the field edges and wanders outward, never in,
 * so nothing built near the edge ends up standing in the wheat.
 */
export function siteEdgeDistance(x: number, z: number): number {
  const warpedX = x + EDGE_WARP * noise2(x, z, 900, 11);
  const warpedZ = z + EDGE_WARP * noise2(x, z, 900, 12);
  const wander = (SITE_EDGE_WANDER / 2) * (1 + noise2(x, z, 420, 41));
  return Math.max(Math.abs(warpedX), Math.abs(warpedZ)) - SITE_SIZE / 2 - wander;
}

/**
 * The point on the site's edge reached by heading straight out from the
 * middle of one side. `side` is 0 to 3 for east, south, west and north, and
 * `along` is the distance along that side from its middle. Returns `null` near
 * the corners, where the neighbouring side takes over.
 */
export function siteEdgePoint(side: number, along: number): readonly [number, number] | null {
  const normalX = [1, 0, -1, 0][side];
  const normalZ = [0, 1, 0, -1][side];
  let out = SITE_SIZE / 2;
  let x = 0;
  let z = 0;
  for (let iteration = 0; iteration < EDGE_SOLVE_STEPS + 2; iteration += 1) {
    x = normalX * out + -normalZ * along;
    z = normalZ * out + normalX * along;
    out -= siteEdgeDistance(x, z);
  }
  x = normalX * out + -normalZ * along;
  z = normalZ * out + normalX * along;
  return Math.abs(siteEdgeDistance(x, z)) < 2 ? [x, z] : null;
}

/** The land-use zone at a position, and how much of the ground around it is that zone's. */
function landCover(x: number, z: number) {
  const zone = landUseAt(x, z);
  if (!zone) {
    return null;
  }
  const occupied = siteOccupancy();
  let clear = 0;
  for (const [dx, dz] of COVER_TAPS) {
    const tapX = x + dx * COVER_REACH;
    const tapZ = z + dz * COVER_REACH;
    if (landUseAt(tapX, tapZ) === zone && !occupied.isTaken(tapX, tapZ)) {
      clear += 1;
    }
  }
  return { zone, cover: clear / COVER_TAPS.length };
}

/**
 * Writes the colour of the farmland at a world position into `pixels`. Alpha
 * holds the crop rows: 0.5 for none, towards 0 for rows running one way across
 * the map and towards 1 for the other. Between two fields it passes through
 * 0.5, which leaves a strip without rows along their shared edge.
 */
export function writeFieldColor(x: number, z: number, pixels: Uint8Array, offset: number): void {
  const warpedX = x + EDGE_WARP * noise2(x, z, 900, 11);
  const warpedZ = z + EDGE_WARP * noise2(x, z, 900, 12);

  const column = Math.floor(warpedX / FIELD_WIDTH);
  const row = Math.floor(warpedZ / FIELD_LENGTH + hash2(column, 0, 13));
  const tone = FIELD_TONES[Math.floor(hash2(column, row, 14) * FIELD_TONES.length)];

  // Inside the site the wheat gives way to mown grass, behind a darker verge.
  const edge = siteEdgeDistance(x, z);
  const grass = 1 - Math.min(1, Math.max(0, edge / GRASS_EDGE_WIDTH + 0.5));
  const verge = Math.max(0, 1 - Math.abs(edge) / VERGE_WIDTH);

  const shade =
    1 +
    0.06 * noise2(x, z, 170, 15) +
    0.03 * noise2(x, z, 45, 16) +
    grass * (0.07 * noise2(x, z, 70, 18) + 0.05 * noise2(x, z, 24, 19)) -
    0.16 * verge * verge;

  // Land in use inside the site: wheat blocks get a field tone and crop rows.
  const land = grass > 0 ? landCover(x, z) : null;
  const wheat = land?.zone.use === "wheat";
  const landTone = land
    ? land.zone.use === "wheat"
      ? FIELD_TONES[Math.floor(hash2(land.zone.index, 0, 21) * 6)]
      : LAND_TONES[land.zone.use]
    : GRASS_TONE;
  const cover = (land?.cover ?? 0) * grass;

  for (let channel = 0; channel < 3; channel += 1) {
    const sown = tone[channel] + (GRASS_TONE[channel] - tone[channel]) * grass;
    const color = sown + (landTone[channel] - sown) * cover;
    pixels[offset + channel] = Math.min(255, color * shade);
  }

  const rowDirection = hash2(column, row, 17) < 0.5 ? -1 : 1;
  const landRows = wheat && land ? (hash2(land.zone.index, 1, 21) < 0.5 ? -1 : 1) * cover : 0;
  pixels[offset + 3] = 127.5 * (1 + rowDirection * (1 - grass) * (1 - cover) + landRows);
}

/** Where the field edge numbered `line` crosses a given distance north to south. */
export function fieldEdgeX(line: number, z: number): number {
  const edge = line * FIELD_WIDTH;
  let x = edge;
  for (let iteration = 0; iteration < EDGE_SOLVE_STEPS; iteration += 1) {
    x = edge - EDGE_WARP * noise2(x, z, 900, 11);
  }
  return x;
}
