import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
} from "three";
import { hash2 } from "../terrain/noise.ts";

const DETAIL_SIZE = 256;
const ROWS_PER_TILE = 8;
const TRAMLINE_EVERY = 4;

const ASPHALT_SIZE = 128;

const RIPPLE_SIZE = 256;
const RIPPLE_WAVES = 26;
const RIPPLE_SLOPE = 0.022;

const STALL_TEXTURE_ACROSS = 176;
const STALL_TEXTURE_ALONG = 48;
const STALL_LINE_PIXELS = 3;
/** The asphalt between the lines, as a share of the paint's colour. */
const STALL_ASPHALT = 62;

function repeatingTexture(pixels: Uint8Array, size: number, height = size): DataTexture {
  const texture = new DataTexture(pixels, size, height);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Crop rows in red and speckle in green, around a middle value of 0.5 so that
 * doubling them leaves the colour alone once mipmaps have averaged them out.
 */
export function createFieldDetailTexture(anisotropy: number): DataTexture {
  const pixels = new Uint8Array(DETAIL_SIZE * DETAIL_SIZE * 4);
  for (let row = 0; row < DETAIL_SIZE; row += 1) {
    const across = (row / DETAIL_SIZE) * ROWS_PER_TILE;
    const crop = Math.sin(across * Math.PI * 2);
    const tramline = Math.floor(across) % TRAMLINE_EVERY === 0 ? -0.5 : 0.17;
    for (let column = 0; column < DETAIL_SIZE; column += 1) {
      const offset = (row * DETAIL_SIZE + column) * 4;
      const fleck = hash2(column, row, 41) - 0.5;
      const rows = 0.28 * crop + 0.22 * tramline + 0.16 * fleck;
      const speck = 0.5 * (hash2(column, row, 42) - 0.5);
      pixels[offset] = 127.5 * (1 + rows);
      pixels[offset + 1] = 127.5 * (1 + speck);
      pixels[offset + 3] = 255;
    }
  }
  const texture = repeatingTexture(pixels, DETAIL_SIZE);
  texture.anisotropy = anisotropy;
  return texture;
}

/** Grain along the road, lighter at the edges than down the worn middle. */
export function createAsphaltTexture(anisotropy: number): DataTexture {
  const pixels = new Uint8Array(ASPHALT_SIZE * ASPHALT_SIZE * 4);
  for (let row = 0; row < ASPHALT_SIZE; row += 1) {
    for (let column = 0; column < ASPHALT_SIZE; column += 1) {
      const across = ((column + 0.5) / ASPHALT_SIZE) * 2 - 1;
      const worn = 1 - 0.3 * Math.exp(-((across / 0.42) ** 2));
      const grain = 0.09 * (hash2(column, row, 51) - 0.5);
      const value = 255 * Math.min(1, Math.max(0, worn + grain));
      const offset = (row * ASPHALT_SIZE + column) * 4;
      pixels.fill(value, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }
  const texture = repeatingTexture(pixels, ASPHALT_SIZE);
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * One stall of a back-to-back double row: a divider along it and the line
 * between the two rows. Mipmaps keep the lines from shimmering at a distance.
 */
export function createParkingStallTexture(anisotropy: number): DataTexture {
  const pixels = new Uint8Array(STALL_TEXTURE_ACROSS * STALL_TEXTURE_ALONG * 4);
  const middle = Math.floor((STALL_TEXTURE_ACROSS - STALL_LINE_PIXELS) / 2);
  for (let row = 0; row < STALL_TEXTURE_ALONG; row += 1) {
    for (let column = 0; column < STALL_TEXTURE_ACROSS; column += 1) {
      const painted =
        row < STALL_LINE_PIXELS || (column >= middle && column < middle + STALL_LINE_PIXELS);
      const offset = (row * STALL_TEXTURE_ACROSS + column) * 4;
      pixels.fill(painted ? 255 : STALL_ASPHALT, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }
  const texture = repeatingTexture(pixels, STALL_TEXTURE_ACROSS, STALL_TEXTURE_ALONG);
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

/** A normal map of gentle, seamless ripples. */
export function createRippleTexture(anisotropy: number): DataTexture {
  const pixels = new Uint8Array(RIPPLE_SIZE * RIPPLE_SIZE * 4);
  // Whole waves per tile, so the pattern repeats without a seam.
  const waves = Array.from({ length: RIPPLE_WAVES }, (_, index) => {
    const turn = hash2(index, 1, 61) * Math.PI * 2;
    const frequency = 9 + hash2(index, 2, 61) * 40;
    return {
      u: Math.round(Math.cos(turn) * frequency),
      v: Math.round(Math.sin(turn) * frequency),
      height: 1 / frequency,
      phase: hash2(index, 3, 61) * Math.PI * 2,
    };
  });
  for (let row = 0; row < RIPPLE_SIZE; row += 1) {
    for (let column = 0; column < RIPPLE_SIZE; column += 1) {
      const u = (column / RIPPLE_SIZE) * Math.PI * 2;
      const v = (row / RIPPLE_SIZE) * Math.PI * 2;
      let slopeU = 0;
      let slopeV = 0;
      for (const wave of waves) {
        const slope = wave.height * Math.cos(wave.u * u + wave.v * v + wave.phase);
        slopeU += slope * wave.u;
        slopeV += slope * wave.v;
      }
      const normalX = -slopeU * RIPPLE_SLOPE;
      const normalY = -slopeV * RIPPLE_SLOPE;
      const length = Math.hypot(normalX, normalY, 1);
      const offset = (row * RIPPLE_SIZE + column) * 4;
      pixels[offset] = 127.5 * (normalX / length + 1);
      pixels[offset + 1] = 127.5 * (normalY / length + 1);
      pixels[offset + 2] = 127.5 * (1 / length + 1);
      pixels[offset + 3] = 255;
    }
  }
  const texture = repeatingTexture(pixels, RIPPLE_SIZE);
  texture.anisotropy = anisotropy;
  return texture;
}

/** What a paved or mown area is finished with. */
export type SurfaceFinish = "paving" | "concrete" | "mown";

const SURFACE_SIZE = 128;

/** How many metres one tile of each finish covers. */
export const SURFACE_TILE_METRES: Readonly<Record<SurfaceFinish, number>> = {
  paving: 12,
  concrete: 12,
  mown: 16,
};

/** Joints between slabs, darker than the slab, in pixels wide. */
const JOINT_PIXELS = 2;

function shadeAt(finish: SurfaceFinish, column: number, row: number): number {
  const fleck = 0.04 * (hash2(column, row, 81) - 0.5);
  if (finish === "mown") {
    // Two passes of a mower, light and dark, with soft edges between them.
    const across = (row / SURFACE_SIZE) * Math.PI * 2;
    return 0.93 + 0.07 * Math.tanh(3 * Math.sin(across)) + fleck;
  }
  // Paving is laid in 3 m slabs, concrete poured in 6 m bays.
  const slabs = finish === "paving" ? 4 : 2;
  const slab = SURFACE_SIZE / slabs;
  const jointX = column % slab < JOINT_PIXELS;
  const jointY = row % slab < JOINT_PIXELS;
  if (jointX || jointY) {
    return finish === "paving" ? 0.84 : 0.88;
  }
  // Each slab weathered a little differently.
  const tone = 0.05 * (hash2(Math.floor(column / slab), Math.floor(row / slab), 82) - 0.5);
  // Paving has a darker border course round each 12 m square.
  const border =
    finish === "paving" && (Math.floor(column / slab) === 0 || Math.floor(row / slab) === 0)
      ? -0.05
      : 0;
  return 0.98 + tone + border + fleck;
}

/**
 * A pale pattern that multiplies an area's colour: slab joints for paving and
 * concrete, light and dark stripes for mown grass.
 */
export function createSurfaceTexture(finish: SurfaceFinish, anisotropy: number): DataTexture {
  const pixels = new Uint8Array(SURFACE_SIZE * SURFACE_SIZE * 4);
  for (let row = 0; row < SURFACE_SIZE; row += 1) {
    for (let column = 0; column < SURFACE_SIZE; column += 1) {
      const value = 255 * Math.min(1, Math.max(0, shadeAt(finish, column, row)));
      const offset = (row * SURFACE_SIZE + column) * 4;
      pixels.fill(value, offset, offset + 3);
      pixels[offset + 3] = 255;
    }
  }
  const texture = repeatingTexture(pixels, SURFACE_SIZE);
  texture.anisotropy = anisotropy;
  texture.repeat.setScalar(1 / SURFACE_TILE_METRES[finish]);
  return texture;
}
