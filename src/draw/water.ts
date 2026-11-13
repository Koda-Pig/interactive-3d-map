import type {
  MeshStandardMaterialParameters,
  Texture,
  WebGLProgramParametersWithUniforms,
} from "three";
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  NoColorSpace,
  Vector3,
} from "three";
import { boundsOf, type Point, signedDistance } from "../layout/polygon.ts";
import { sliceOver, sliceStart, yieldToBrowser } from "../pace.ts";

/** How far from the shore the water reaches its deepest colour, in metres. */
const SHORE_DEPTH = 60;
/** How wide the foam line along the quay is, in metres. */
const FOAM_WIDTH = 3.5;
/** The finest the shore map gets, and the most pixels along its long side. */
const SHORE_MIN_PIXEL = 0.25;
const SHORE_MAX_SIDE = 900;
/** The two ripple layers' tile sizes, in metres. Unrelated sizes hide the repeat. */
const FINE_TILE = 37;
const BROAD_TILE = 151;
/** How big the patches of calm and breezy water are, in metres. */
const GUST_SIZE = 95;
/** Bodies of water smaller than this, such as pools, get small ripples and no foam. */
const POOL_SIDE = 60;

/**
 * A map of how far each point is from the shore, as a share of `SHORE_DEPTH`,
 * with the box it covers. 0 is the water's edge and 1 is deep water.
 */
async function shoreMap(
  outline: readonly Point[],
): Promise<{ texture: DataTexture; box: number[] }> {
  const bounds = boundsOf(outline);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const pixel = Math.max(SHORE_MIN_PIXEL, Math.max(width, depth) / SHORE_MAX_SIDE);
  const columns = Math.ceil(width / pixel) + 2;
  const rows = Math.ceil(depth / pixel) + 2;
  const minX = bounds.minX - pixel;
  const minZ = bounds.minZ - pixel;
  const pixels = new Uint8Array(columns * rows * 4);
  // One distance test per texel per outline point, which for a big lake runs
  // to millions, so the rows pause to keep the loading screen animating.
  let slice = sliceStart();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const inside = -signedDistance(
        minX + (column + 0.5) * pixel,
        minZ + (row + 0.5) * pixel,
        outline,
      );
      const offset = (row * columns + column) * 4;
      pixels[offset] = Math.round(Math.min(1, Math.max(0, inside / SHORE_DEPTH)) * 255);
      pixels[offset + 3] = 255;
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }
  const texture = new DataTexture(pixels, columns, rows);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return {
    texture,
    box: [minX, minZ, 1 / (columns * pixel), 1 / (rows * pixel)],
  };
}

const VERTEX_HEAD = /* glsl */ `
varying vec2 vWaterXZ;
`;

const VERTEX_BODY = /* glsl */ `
#include <begin_vertex>
vWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
`;

const FRAGMENT_HEAD = /* glsl */ `
varying vec2 vWaterXZ;
uniform float uWaterTime;
uniform sampler2D uRipples;
uniform sampler2D uShore;
uniform vec4 uShoreBox;
uniform vec3 uShallowTint;
uniform vec3 uDeepTint;
uniform float uFoam;
uniform float uRippleScale;
uniform float uRippleStrength;

vec2 waterSlope(vec2 uv) {
  return texture2D(uRipples, uv).xy * 2.0 - 1.0;
}

float waterHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth value noise between 0 and 1.
float waterNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 along = fract(point);
  along = along * along * (3.0 - 2.0 * along);
  return mix(
    mix(waterHash(cell), waterHash(cell + vec2(1.0, 0.0)), along.x),
    mix(waterHash(cell + vec2(0.0, 1.0)), waterHash(cell + vec2(1.0, 1.0)), along.x),
    along.y
  );
}
`;

/** The water's colour, by depth, with foam along the shore. */
const FRAGMENT_COLOUR = /* glsl */ `
#include <color_fragment>
float shore = texture2D(uShore, (vWaterXZ - uShoreBox.xy) * uShoreBox.zw).r;
// Gusts: drifting patches of calm, glassy water and breezier, choppier water.
vec2 gustPoint = vWaterXZ / (${GUST_SIZE.toFixed(1)} * uRippleScale) + vec2(0.011, -0.007) * uWaterTime;
float wind = waterNoise(gustPoint) * 0.65 + waterNoise(gustPoint * 2.7 + 17.0) * 0.35;
wind = smoothstep(0.2, 0.8, wind);
// A gentle warp, so the ripple tiles never line up the same way twice.
vec2 warp = vec2(waterNoise(gustPoint * 1.3 + 5.0), waterNoise(gustPoint * 1.3 + 41.0)) - 0.5;
vec2 fineSlope = waterSlope(vWaterXZ / (${FINE_TILE.toFixed(1)} * uRippleScale) + warp * 0.35 + vec2(0.021, 0.013) * uWaterTime);
vec2 broadSlope = waterSlope(vWaterXZ / (${BROAD_TILE.toFixed(1)} * uRippleScale) + warp * 0.12 + vec2(-0.006, 0.009) * uWaterTime);
float deepness = smoothstep(0.0, 1.0, shore);
// Tints on the material's own colour, so precincts can still mute and fade it.
vec3 waterColour = diffuseColor.rgb * mix(uShallowTint, uDeepTint, deepness);
// Broad swells lighten and darken the water a little, so it isn't one flat tone.
waterColour *= 1.0 + 0.5 * dot(broadSlope, vec2(0.7, 0.5));
// Ruffled water scatters a little more light than calm water.
waterColour *= mix(0.94, 1.07, wind);
float edge = shore * ${SHORE_DEPTH.toFixed(1)};
float foamBreak = (0.7 + 0.5 * sin(dot(fineSlope, vec2(9.0, 7.0)) + edge * 2.3 - uWaterTime * 0.8)) * mix(0.55, 1.15, wind);
float foam = uFoam * (1.0 - smoothstep(0.0, ${FOAM_WIDTH.toFixed(1)}, edge)) * clamp(foamBreak, 0.0, 1.0);
diffuseColor.rgb = mix(waterColour, vec3(0.92, 0.95, 0.95), foam);
`;

const FRAGMENT_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor * mix(0.6, 1.4, wind), 0.85, foam);
`;

/** The surface is level, so the ripples bend a straight-up normal and are carried into view space. */
const FRAGMENT_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
vec2 slope = (fineSlope * 0.3 * mix(0.3, 1.6, wind) + broadSlope * mix(0.6, 1.25, wind)) * uRippleStrength * (1.0 - foam);
normal = normalize(mat3(viewMatrix) * normalize(vec3(-slope.x, 1.0, -slope.y)));
`;

interface WaterUniforms {
  readonly [name: string]: { value: unknown };
}

/**
 * Water that's lighter along the shore and deeper in the middle, with two
 * layers of ripples drifting across each other, sun glints, and a broken
 * line of foam where it meets the quay. A class rather than a hooked standard
 * material, so the precincts' copies keep the shader.
 */
export class WaterMaterial extends MeshStandardMaterial {
  private waterUniforms: WaterUniforms = {};

  constructor(parameters?: MeshStandardMaterialParameters, uniforms?: WaterUniforms) {
    super(parameters);
    if (uniforms) this.waterUniforms = uniforms;
  }

  setTime(seconds: number): void {
    if (this.waterUniforms.uWaterTime) this.waterUniforms.uWaterTime.value = seconds;
  }

  override copy(source: this): this {
    super.copy(source);
    this.waterUniforms = source.waterUniforms;
    return this;
  }

  override onBeforeCompile(shader: WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, this.waterUniforms);
    shader.vertexShader =
      VERTEX_HEAD + shader.vertexShader.replace("#include <begin_vertex>", VERTEX_BODY);
    shader.fragmentShader =
      FRAGMENT_HEAD +
      shader.fragmentShader
        .replace("#include <color_fragment>", FRAGMENT_COLOUR)
        .replace("#include <roughnessmap_fragment>", FRAGMENT_ROUGHNESS)
        .replace("#include <normal_fragment_maps>", FRAGMENT_NORMAL);
  }

  // One program for every water surface: only the uniforms differ.
  override customProgramCacheKey(): string {
    return "water";
  }
}

export interface WaterOptions {
  readonly color: string;
  readonly outline: readonly Point[];
  readonly ripples: Texture;
  readonly polygonOffset: MeshStandardMaterialParameters;
}

/** A water surface for an outline. Pools get small ripples and no foam. */
export async function createWaterMaterial({
  color,
  outline,
  ripples,
  polygonOffset,
}: WaterOptions): Promise<WaterMaterial> {
  const base = new Color(color);
  const bounds = boundsOf(outline);
  const pool = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) < POOL_SIDE;
  const { texture, box } = await shoreMap(outline);
  const shallow = base.clone().lerp(new Color("#7ED6CF"), pool ? 0.25 : 0.4);
  return new WaterMaterial(
    { color, roughness: 0.07, metalness: 0, ...polygonOffset },
    {
      uWaterTime: { value: 0 },
      uRipples: { value: ripples },
      uShore: { value: texture },
      uShoreBox: { value: box },
      uShallowTint: {
        value: new Vector3(shallow.r / base.r, shallow.g / base.g, shallow.b / base.b),
      },
      uDeepTint: { value: new Vector3().setScalar(pool ? 0.8 : 0.55) },
      uFoam: { value: pool ? 0 : 1 },
      uRippleScale: { value: pool ? 0.12 : 1 },
      uRippleStrength: { value: pool ? 1.2 : 1.6 },
    },
  );
}
