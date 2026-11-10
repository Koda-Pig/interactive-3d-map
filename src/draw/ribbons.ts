import { BufferAttribute, BufferGeometry, Color, Group, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TrackLocation } from "../layout/locations.ts";
import type { PathSample, PathSegment } from "../layout/path.ts";
import { resolvePath, samplePath } from "../layout/path.ts";
import { roadTier } from "../layout/road-order.ts";
import { createTrackSafety } from "../layout/track-safety.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { createCrossing } from "./crossings.ts";
import {
  asphaltTexture,
  Layer,
  layerMaterial,
  markSurround,
  vertexColorMaterial,
} from "./materials.ts";

const ASPHALT_TILE_LENGTH = 9;
const DEFAULT_STEP = 6;
const CROSS_SPACING = 8;
const LIFT = 0.35;
const ROAD_TIER_STEP = 0.5;

const DASH_LENGTH = 14;

const KERB_STEP = 3;
const KERB_WIDTH = 2.5;
const KERB_STRIPE = 6;
const KERB_RED = new Color("#C8202B");
const KERB_WHITE = new Color("#F2F2F2");

const FINISH_DEPTH = 3;
const FINISH_COLOR = "#F2F2F2";

/** Paved runoff is asphalt, so that it can't be mistaken for the water nearby. */
const PAVED_RUNOFF = "#70757A";
const GRAVEL_RUNOFF = "#CFC4A6";
const GRASS_VERGE = "#8C9860";
/** Width of the band of brand colour painted along the track's edge. */
const RUNOFF_PAINT_WIDTH = 5;

interface Band {
  readonly from: number;
  readonly to: number;
}

type RunoffEdge = ReturnType<ReturnType<typeof createTrackSafety>>;

/** One band of a runoff area, with distances measured out from the track's edge. */
interface RunoffSurface {
  readonly from: (edge: RunoffEdge) => number;
  readonly to: (edge: RunoffEdge) => number;
  readonly color: (edge: RunoffEdge) => string;
}

const paintEdge = (edge: RunoffEdge): number => Math.min(RUNOFF_PAINT_WIDTH, edge.paved);

function isDashOn(sample: PathSample): boolean {
  return Math.floor(sample.distance / DASH_LENGTH) % 2 === 0;
}

/**
 * A strip of ground-hugging quads between two offsets from the centreline.
 * Offsets are measured across the direction of travel.
 */
function bandGeometry(
  samples: readonly PathSample[],
  band: Band | ((sample: PathSample) => Band),
  closed: boolean,
  surface: GroundSurface,
  keepQuad: (sample: PathSample) => boolean = () => true,
  heightAt: (x: number, z: number, distance: number) => number = (x, z) => surface.heightAt(x, z),
  colorAt?: (sample: PathSample) => string,
): BufferGeometry {
  const bands = samples.map((sample) => (typeof band === "function" ? band(sample) : band));
  const columns =
    Math.max(1, Math.ceil(Math.max(...bands.map(({ from, to }) => to - from)) / CROSS_SPACING)) + 1;
  const rows = samples.length;
  const positions = new Float32Array(rows * columns * 3);
  const uvs = new Float32Array(rows * columns * 2);
  const colors = colorAt ? new Float32Array(rows * columns * 3) : null;

  samples.forEach((sample, row) => {
    const band = bands[row];
    const color = colorAt ? new Color(colorAt(sample)) : null;
    for (let column = 0; column < columns; column += 1) {
      const across = column / (columns - 1);
      const offset = band.from + (band.to - band.from) * across;
      const x = sample.x - sample.dirZ * offset;
      const z = sample.z + sample.dirX * offset;
      const vertex = row * columns + column;
      positions[vertex * 3] = x;
      positions[vertex * 3 + 1] = heightAt(x, z, sample.distance) + LIFT;
      positions[vertex * 3 + 2] = z;
      uvs[vertex * 2] = across;
      uvs[vertex * 2 + 1] = sample.distance / ASPHALT_TILE_LENGTH;
      if (colors && color) colors.set([color.r, color.g, color.b], vertex * 3);
    }
  });

  const indices: number[] = [];
  const lastRow = closed ? rows : rows - 1;
  for (let row = 0; row < lastRow; row += 1) {
    if (!keepQuad(samples[row])) {
      continue;
    }
    const next = (row + 1) % rows;
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column;
      const b = a + 1;
      const c = next * columns + column;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  if (colors) geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function bandsFor(location: TrackLocation): Band[] {
  const half = location.width / 2;
  if (!location.median) {
    return [{ from: -half, to: half }];
  }
  const gap = location.median / 2;
  return [
    { from: -half, to: -gap },
    { from: gap, to: half },
  ];
}

/** Inside apex kerbs and short outside exits, rather than strips on every edge. */
function kerbGeometry(
  segments: readonly PathSegment[],
  location: TrackLocation,
  surface: GroundSurface,
): BufferGeometry {
  const samples = samplePath(segments, KERB_STEP, location.closed ?? false);
  const half = location.width / 2;
  const positions: number[] = [];
  const colors: number[] = [];
  let distance = 0;
  const starts = segments.map((segment) => {
    const start = distance;
    distance += segment.length;
    return start;
  });

  const pushCorner = (sample: PathSample, offset: number, color: Color): void => {
    const x = sample.x - sample.dirZ * offset;
    const z = sample.z + sample.dirX * offset;
    positions.push(x, surface.heightAt(x, z) + LIFT, z);
    colors.push(color.r, color.g, color.b);
  };

  samples.forEach((sample, index) => {
    const next = samples[(index + 1) % samples.length];
    if (sample.segment !== next.segment) return;
    const segment = segments[sample.segment];
    const sides: number[] = [];
    if (location.id !== "circuit") {
      if (segment.kind === "arc") sides.push(-1, 1);
    } else if (segment.kind === "arc") {
      sides.push(Math.sign(segment.sweep));
    } else {
      const previous = segments[(sample.segment + segments.length - 1) % segments.length];
      const after = segments[(sample.segment + 1) % segments.length];
      const along = sample.distance - starts[sample.segment];
      if (previous.kind === "arc" && along < 35) sides.push(-Math.sign(previous.sweep));
      if (after.kind === "arc" && segment.length - along < 18) {
        const side = -Math.sign(after.sweep);
        if (!sides.includes(side)) sides.push(side);
      }
    }
    const color = Math.floor(sample.distance / KERB_STRIPE) % 2 === 0 ? KERB_RED : KERB_WHITE;
    for (const side of sides) {
      const inner = side > 0 ? half : -half - KERB_WIDTH;
      const outer = side > 0 ? half + KERB_WIDTH : -half;
      pushCorner(sample, inner, color);
      pushCorner(sample, outer, color);
      pushCorner(next, inner, color);
      pushCorner(sample, outer, color);
      pushCorner(next, outer, color);
      pushCorner(next, inner, color);
    }
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function finishLineMesh(
  samples: readonly PathSample[],
  location: TrackLocation,
  surface: GroundSurface,
  [lineX, lineZ]: readonly [number, number],
): Mesh {
  let index = 0;
  let closest = Number.POSITIVE_INFINITY;
  samples.forEach((sample, candidate) => {
    const distance = Math.hypot(sample.x - lineX, sample.z - lineZ);
    if (distance < closest) {
      closest = distance;
      index = candidate;
    }
  });

  const { x, z, dirX, dirZ, distance, segment } = samples[index];
  const across = [0, FINISH_DEPTH].map((along) => ({
    x: x + dirX * along,
    z: z + dirZ * along,
    dirX,
    dirZ,
    distance: distance + along,
    segment,
  }));
  const half = location.width / 2;
  const geometry = bandGeometry(across, { from: -half, to: half }, false, surface);
  const mesh = new Mesh(geometry, layerMaterial(FINISH_COLOR, Layer.marking));
  mesh.receiveShadow = true;
  return mesh;
}

function startingGrid(
  samples: readonly PathSample[],
  location: TrackLocation,
  surface: GroundSurface,
  [lineX, lineZ]: readonly [number, number],
): Mesh {
  const finish = samples.reduce((best, sample) =>
    Math.hypot(sample.x - lineX, sample.z - lineZ) < Math.hypot(best.x - lineX, best.z - lineZ)
      ? sample
      : best,
  );
  const geometries: BufferGeometry[] = [];
  for (let row = 0; row < 10; row += 1) {
    const side = row % 2 === 0 ? -1 : 1;
    const along = -(row * 10 + 8);
    const across = (side * location.width) / 4;
    const points = [
      [along - 5, across - 1],
      [along, across - 1],
      [along, across + 1],
      [along - 5, across + 1],
    ];
    const path = points.map(([a, b]): readonly [number, number] => [
      finish.x + finish.dirX * a - finish.dirZ * b,
      finish.z + finish.dirZ * a + finish.dirX * b,
    ]);
    geometries.push(
      bandGeometry(
        samplePath(resolvePath(path, false), 2, false),
        { from: -0.1, to: 0.1 },
        false,
        surface,
      ),
    );
  }
  const mesh = new Mesh(mergeGeometries(geometries), layerMaterial(FINISH_COLOR, Layer.marking));
  mesh.receiveShadow = true;
  for (const geometry of geometries) geometry.dispose();
  return mesh;
}

/** Draws a track or road and its branches as ribbons that follow the ground. */
export function createRibbon(location: TrackLocation, surface: GroundSurface): Group {
  const closed = location.closed ?? false;
  const step = location.step ?? DEFAULT_STEP;
  const layer =
    location.type === "track"
      ? Layer.track
      : Layer.road + ROAD_TIER_STEP * roadTier(location.width);
  const keepQuad = location.dashed ? isDashOn : undefined;

  const segments = resolvePath(location.path, closed);
  const samples = samplePath(segments, step, closed);
  const crossing = createCrossing(location, surface);
  const geometries = bandsFor(location).map((band) =>
    bandGeometry(samples, band, closed, surface, keepQuad, crossing.heightAt),
  );
  for (const branch of location.branches ?? []) {
    const branchSamples = samplePath(resolvePath(branch, false), step, false);
    for (const band of bandsFor(location)) {
      geometries.push(bandGeometry(branchSamples, band, false, surface, keepQuad));
    }
  }

  const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
  const surfaceMap = location.dashed ? undefined : asphaltTexture();
  const ribbon = new Mesh(geometry, layerMaterial(location.color, layer, surfaceMap));
  ribbon.receiveShadow = true;

  const group = new Group();
  group.add(ribbon, crossing.structure);
  if (location.safetyZones || location.runoffCatchments) {
    const safety = createTrackSafety(location);
    const half = location.width / 2;
    const verge = location.runoff ?? 0;
    const surfaces: readonly RunoffSurface[] = [
      { from: () => 0, to: paintEdge, color: (edge) => edge.color },
      { from: paintEdge, to: (edge) => edge.paved, color: () => PAVED_RUNOFF },
      {
        from: (edge) => edge.paved,
        to: (edge) => edge.width,
        color: (edge) => (edge.width > verge + 1 ? GRAVEL_RUNOFF : GRASS_VERGE),
      },
    ];
    for (const side of [-1, 1]) {
      for (const { from, to, color } of surfaces) {
        const geometry = bandGeometry(
          samples,
          (sample) => {
            const edge = safety(sample, side);
            const a = half + from(edge);
            const b = half + to(edge);
            return side > 0 ? { from: a, to: b } : { from: -b, to: -a };
          },
          closed,
          surface,
          undefined,
          undefined,
          (sample) => color(safety(sample, side)),
        );
        const mesh = new Mesh(geometry, vertexColorMaterial(Layer.verge));
        mesh.receiveShadow = true;
        // Runoff is much wider than the track, and would swamp it when highlighted.
        markSurround(mesh);
        group.add(mesh);
      }
    }
  } else if (location.runoff && location.runoffColor) {
    const half = location.width / 2;
    const verge = mergeGeometries([
      bandGeometry(samples, { from: -half - location.runoff, to: -half }, closed, surface),
      bandGeometry(samples, { from: half, to: half + location.runoff }, closed, surface),
    ]);
    const mesh = new Mesh(verge, layerMaterial(location.runoffColor, Layer.verge));
    mesh.receiveShadow = true;
    markSurround(mesh);
    group.add(mesh);
  }
  if (location.kerbs) {
    const kerbs = new Mesh(kerbGeometry(segments, location, surface), vertexColorMaterial());
    kerbs.receiveShadow = true;
    group.add(kerbs);
  }
  if (location.id === "circuit" || location.id === "pit-lane") {
    const half = location.width / 2;
    const edges = mergeGeometries(
      [-1, 1].map((side) =>
        bandGeometry(
          samples,
          { from: side * (half - 0.28) - 0.1, to: side * (half - 0.28) + 0.1 },
          closed,
          surface,
        ),
      ),
    );
    const mesh = new Mesh(edges, layerMaterial("#E9E5D9", Layer.marking));
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (location.startFinish) {
    group.add(
      finishLineMesh(samples, location, surface, location.startFinish),
      startingGrid(samples, location, surface, location.startFinish),
    );
  }
  return group;
}
