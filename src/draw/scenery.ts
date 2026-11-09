import type { BufferGeometry, Object3D } from "three";
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  ConeGeometry,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type {
  AreaLocation,
  BuildingLocation,
  Category,
  Location,
  TrackLocation,
} from "../layout/locations.ts";
import { buildingParts, CATEGORIES, layout } from "../layout/locations.ts";
import type { Occupancy } from "../layout/occupancy.ts";
import { occupancyOf } from "../layout/occupancy.ts";
import type { PathSample } from "../layout/path.ts";
import { resolveOutline, resolvePath, samplePath } from "../layout/path.ts";
import type { Point } from "../layout/polygon.ts";
import { boundsOf, centreOf, signedDistance } from "../layout/polygon.ts";
import { createTrackSafety } from "../layout/track-safety.ts";
import type { Quality } from "../scene/quality.ts";
import { MAP_HALF_SIZE, SITE_SIZE } from "../site.ts";
import { fieldEdgeX } from "../terrain/fields.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { hash2, noise2 } from "../terrain/noise.ts";
import type { Kit } from "./kit.ts";
import { bakedGeometry } from "./kit.ts";

const TREES = {
  gum: ["nature/tree-gum-1.glb", "nature/tree-gum-2.glb", "nature/tree-gum-3.glb"],
  pine: ["nature/tree-pine-1.glb", "nature/tree-pine-2.glb", "nature/tree-pine-3.glb"],
  olive: ["nature/tree-olive-1.glb", "nature/tree-olive-2.glb", "nature/tree-olive-3.glb"],
} as const;
const SHRUBS = [
  "nature/shrub-fynbos-1.glb",
  "nature/shrub-fynbos-2.glb",
  "nature/shrub-fynbos-3.glb",
];
const ROCKS = [
  "nature/rock-outcrop-1.glb",
  "nature/rock-outcrop-2.glb",
  "nature/rock-outcrop-3.glb",
];

const BARRIER = "props/barrier-segment.glb";
const CATCH_FENCE = "props/race-fence-segment.glb";
const LIGHT_POLE = "props/light-pole.glb";
const GANTRY = "racing/start-finish-gantry.glb";
const MARSHAL_POST = "racing/marshal-post.glb";
const AIRCRAFT = "props/light-aircraft.glb";
const RACE_CAR = "props/race-car-generic.glb";
const SHUTTLE = "props/shuttle-bus.glb";
const FOOD_STALL = "props/food-stall.glb";
const MARQUEE = "hospitality/hospitality-marquee.glb";
const FARMHOUSE = "setting/farmhouse.glb";
const SILOS = "setting/farm-silo-group.glb";

/** Every model the scenery can use. */
export const SCENERY_MODELS: readonly string[] = [
  ...TREES.gum,
  ...TREES.pine,
  ...TREES.olive,
  ...SHRUBS,
  ...ROCKS,
  BARRIER,
  CATCH_FENCE,
  LIGHT_POLE,
  GANTRY,
  MARSHAL_POST,
  AIRCRAFT,
  RACE_CAR,
  SHUTTLE,
  FOOD_STALL,
  MARQUEE,
  FARMHOUSE,
  SILOS,
];

const AVENUE_ROADS = ["ring-road", "waterfront-drive"];
/** The car parks beside the halls come first in the data. */
const CONFERENCE_CAR_PARKS = 3;

const BARRIER_TILE = 10;
const BARRIER_LIFT = 0.8;
const MARSHAL_SPACING = 380;
const SPECTATOR_RANGE = 45;

const TWO_PI = Math.PI * 2;

const placedAt = new Vector3();
const placedScale = new Vector3();
const placedTurn = new Quaternion();
const placedEuler = new Euler(0, 0, 0, "YXZ");
const placedMatrix = new Matrix4();

interface Batch {
  readonly matrices: number[];
  readonly colors: number[];
}

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw?: number;
  readonly scale?: number;
  /** Tips the model's X axis up by this many radians, to follow a slope. */
  readonly tilt?: number;
  readonly tint?: Color;
}

const WHITE = new Color(1, 1, 1);

/** Collects copies of geometries, then draws each geometry in a single call. */
class Instances {
  private readonly batches = new Map<BufferGeometry, Batch>();

  add(
    geometry: BufferGeometry,
    { x, y, z, yaw = 0, scale = 1, tilt = 0, tint = WHITE }: Placement,
  ): void {
    let batch = this.batches.get(geometry);
    if (!batch) {
      batch = { matrices: [], colors: [] };
      this.batches.set(geometry, batch);
    }
    placedAt.set(x, y, z);
    placedEuler.set(0, yaw, tilt);
    placedTurn.setFromEuler(placedEuler);
    placedScale.setScalar(scale);
    placedMatrix.compose(placedAt, placedTurn, placedScale);
    batch.matrices.push(...placedMatrix.elements);
    batch.colors.push(tint.r, tint.g, tint.b);
  }

  build(castShadow: boolean): InstancedMesh[] {
    return [...this.batches].map(([geometry, { matrices, colors }]) => {
      const mesh = new InstancedMesh(geometry, sceneryMaterial, colors.length / 3);
      mesh.instanceMatrix.array.set(matrices);
      mesh.instanceColor = new InstancedBufferAttribute(Float32Array.from(colors), 3);
      mesh.castShadow = castShadow;
      return mesh;
    });
  }
}

const sceneryMaterial = new MeshLambertMaterial({ vertexColors: true });

function colorize(
  geometry: BufferGeometry,
  shade: (y: number) => readonly [number, number, number],
): BufferGeometry {
  const position = geometry.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    colors.set(shade(position.getY(vertex)), vertex * 3);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.deleteAttribute("uv");
  return geometry;
}

/** A tree for the far distance: eight triangles, darker towards the ground. */
function createFarTree(): BufferGeometry {
  const height = 18;
  const geometry = new OctahedronGeometry(1, 0);
  geometry.scale(6, height / 2, 6);
  geometry.translate(0, height / 2, 0);
  return colorize(geometry, (y) => {
    const light = 0.5 + (0.5 * y) / height;
    return [0.13 * light + 0.05, 0.2 * light + 0.06, 0.08 * light + 0.03];
  });
}

/** A box with no underside. */
function openBox(
  width: number,
  height: number,
  depth: number,
  y: number,
  z: number,
): BufferGeometry {
  const box = new BoxGeometry(width, height, depth);
  const index = box.getIndex();
  if (index) {
    // A box's faces are stored in order, and the fourth one faces down.
    const kept = [...index.array.slice(0, 18), ...index.array.slice(24)];
    box.setIndex(kept);
  }
  box.translate(0, y, z);
  return box;
}

/** A parked car in 20 triangles, since a race day needs thousands of them. */
function createCar(): BufferGeometry {
  const body = colorize(openBox(1.8, 0.75, 4.4, 0.55, 0), () => [1, 1, 1]);
  const cabin = colorize(openBox(1.55, 0.6, 2.2, 1.2, -0.2), () => [0.16, 0.19, 0.23]);
  const merged = mergeGeometries([body, cabin]);
  if (!merged) {
    throw new Error("The car's parts could not be merged");
  }
  return merged;
}

const CAR_PAINTS = ["#E8ECEF", "#C9D0D6", "#7C858E", "#22303C", "#8A2B2B", "#004272"].map(
  (hex) => new Color(hex),
);

/** Everything the placing rules share. */
interface Context {
  readonly surface: GroundSurface;
  readonly density: number;
  readonly model: (file: string) => BufferGeometry | undefined;
  /** Ground with anything at all on it. */
  readonly occupied: Occupancy;
  /** Ground with something built on it, not counting areas planted with trees. */
  readonly built: Occupancy;
  readonly random: () => number;
}

function placeModel(
  context: Context,
  instances: Instances,
  file: string,
  placement: Omit<Placement, "y"> & { readonly sink?: number },
): void {
  const geometry = context.model(file);
  if (geometry) {
    const { x, z, sink = 0 } = placement;
    instances.add(geometry, { ...placement, y: context.surface.heightAt(x, z) - sink });
  }
}

function pickOne<T>(random: () => number, options: readonly T[]): T {
  return options[Math.floor(random() * options.length)];
}

function placeTree(
  context: Context,
  instances: Instances,
  species: keyof typeof TREES,
  x: number,
  z: number,
): void {
  const { random } = context;
  const warmth = random();
  placeModel(context, instances, pickOne(random, TREES[species]), {
    x,
    z,
    sink: 0.2,
    yaw: random() * TWO_PI,
    scale: 0.85 + random() * 0.45,
    tint: new Color(0.9 + warmth * 0.25, 0.92 + warmth * 0.12, 0.85),
  });
}

function locationById<T extends Location>(id: string): T {
  const location = layout.locations.find((candidate) => candidate.id === id);
  if (!location) {
    throw new Error(`The layout has no location "${id}"`);
  }
  return location as T;
}

function plantedAreas(): AreaLocation[] {
  return layout.locations.filter(
    (location): location is AreaLocation =>
      (location.type === "area" || location.type === "water") && location.planting !== undefined,
  );
}

function plantSiteEdge(context: Context, instances: Instances): void {
  const edge = SITE_SIZE / 2 + 18;
  for (let along = -edge; along <= edge; along += 34) {
    for (const [x, z] of [
      [along, -edge],
      [along, edge],
      [-edge, along],
      [edge, along],
    ]) {
      if (
        noise2(x, z, 260, 31) > -0.25 &&
        !context.occupied.isTaken(x, z) &&
        context.random() < context.density
      ) {
        placeTree(
          context,
          instances,
          "gum",
          x + context.random() * 8 - 4,
          z + context.random() * 8 - 4,
        );
      }
    }
  }
}

function plantAvenues(context: Context, instances: Instances): void {
  for (const id of AVENUE_ROADS) {
    const road = locationById<TrackLocation>(id);
    const closed = road.closed ?? false;
    const offset = road.width / 2 + 11;
    for (const { x, z, dirX, dirZ } of samplePath(resolvePath(road.path, closed), 52, closed)) {
      for (const side of [-1, 1]) {
        const treeX = x - dirZ * offset * side;
        const treeZ = z + dirX * offset * side;
        if (!context.built.isTaken(treeX, treeZ) && context.random() < context.density) {
          placeTree(context, instances, "olive", treeX, treeZ);
        }
      }
    }
  }
}

function plantAreas(context: Context, instances: Instances): void {
  const { random, built } = context;
  for (const area of plantedAreas()) {
    const outline = resolveOutline(area.footprint);
    if (area.planting === "park") {
      const { minX, minZ, maxX, maxZ } = boundsOf(outline);
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const x = minX + random() * (maxX - minX);
        const z = minZ + random() * (maxZ - minZ);
        if (
          signedDistance(x, z, outline) < -8 &&
          !built.isTaken(x, z) &&
          noise2(x, z, 90, 32) > -0.15
        ) {
          placeTree(context, instances, "pine", x, z);
        }
      }
      continue;
    }
    outline.forEach(([ax, az], index) => {
      const [bx, bz] = outline[(index + 1) % outline.length];
      const length = Math.hypot(bx - ax, bz - az);
      const inwardX = -(bz - az) / length;
      const inwardZ = (bx - ax) / length;
      // Corners of an outline can wind either way, so look for the inside.
      const midX = (ax + bx) / 2 + inwardX * 6;
      const midZ = (az + bz) / 2 + inwardZ * 6;
      const flip = signedDistance(midX, midZ, outline) < 0 ? 1 : -1;
      for (let along = 12; along < length - 6; along += 46) {
        const x = ax + ((bx - ax) * along) / length + inwardX * flip * 5;
        const z = az + ((bz - az) * along) / length + inwardZ * flip * 5;
        if (!built.isTaken(x, z) && random() < context.density) {
          placeTree(context, instances, "olive", x, z);
        }
      }
    });
  }
}

function insideSite(x: number, z: number): boolean {
  return Math.max(Math.abs(x), Math.abs(z)) < SITE_SIZE / 2;
}

/** Stands of trees on the farms in view around the site. */
function plantFarmland(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  const reach = MAP_HALF_SIZE + 900;
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const x = random() * reach * 2 - reach;
    const z = random() * reach * 2 - reach;
    if (
      !insideSite(x, z) &&
      noise2(x, z, 520, 33) > 0.42 &&
      !occupied.isTaken(x, z) &&
      random() < context.density
    ) {
      placeTree(context, instances, random() < 0.6 ? "gum" : "pine", x, z);
    }
  }
}

function scatterUnderbrush(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  const reach = SITE_SIZE / 2;
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const x = random() * reach * 2 - reach;
    const z = random() * reach * 2 - reach;
    if (noise2(x, z, 180, 34) < 0.25 || occupied.isTaken(x, z) || random() > context.density) {
      continue;
    }
    placeModel(context, instances, pickOne(random, random() < 0.8 ? SHRUBS : ROCKS), {
      x,
      z,
      sink: 0.1,
      yaw: random() * TWO_PI,
      scale: 1 + random() * 1.5,
    });
  }
}

/** Windbreaks along some of the field edges, out to where the haze takes over. */
function plantWindbreaks(
  context: Context,
  near: Instances,
  far: Instances,
  farTree: BufferGeometry,
): void {
  const { random, occupied, surface } = context;
  const limit = 7600;
  const nearRange = SITE_SIZE / 2 + 500;
  for (let line = -16; line <= 16; line += 1) {
    if (hash2(line, 0, 35) < 0.6) {
      continue;
    }
    for (let z = -limit; z <= limit; z += 26) {
      const x = fieldEdgeX(line, z) + random() * 5 - 2.5;
      if (insideSite(x, z) || noise2(x, z, 1100, 36) < -0.3 || occupied.isTaken(x, z)) {
        continue;
      }
      if (Math.max(Math.abs(x), Math.abs(z)) < nearRange) {
        if (random() < context.density) {
          placeTree(context, near, "gum", x, z);
        }
      } else if (random() < context.density * 0.85 + 0.15) {
        far.add(farTree, {
          x,
          y: surface.heightAt(x, z) - 0.5,
          z,
          yaw: random() * TWO_PI,
          scale: 0.85 + random() * 0.6,
        });
      }
    }
  }
}

function placeFarmsteads(context: Context, near: Instances): void {
  const { random, occupied } = context;
  for (let farm = 0; farm < 9; farm += 1) {
    const angle = farm * 2.399963 + 0.7;
    const radius = 2500 + (farm / 9) * 3200;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (occupied.isTaken(x, z)) {
      continue;
    }
    const yaw = random() * TWO_PI;
    placeModel(context, near, FARMHOUSE, { x, z, yaw });
    placeModel(context, near, SILOS, { x: x + 34, z: z - 22, yaw: yaw + 1 });
    for (let tree = 0; tree < 7; tree += 1) {
      placeTree(context, near, "gum", x + random() * 110 - 55, z + random() * 110 - 55);
    }
  }
}

/** Yaw that lines a model's X axis up with a direction of travel. */
function yawAlong(sample: PathSample): number {
  return Math.atan2(-sample.dirZ, sample.dirX);
}

/** The outlines of everywhere people watch from. */
function spectatorOutlines(): Point[][] {
  return layout.locations
    .filter(
      (location): location is BuildingLocation =>
        location.category === "racing" &&
        location.type === "building" &&
        location.id !== "pit-conference-building",
    )
    .map((location) => buildingParts(location).flatMap((part) => resolveOutline(part.footprint)));
}

/** Barriers along both sides of the circuit, and catch fences by the crowds. */
function dressCircuit(
  context: Context,
  instances: Instances,
  catchFences: boolean,
  roadsNearby: Occupancy,
): void {
  const circuit = locationById<TrackLocation>("circuit");
  const segments = resolvePath(circuit.path, true);
  const samples = samplePath(segments, BARRIER_TILE, true);
  const safety = createTrackSafety(circuit);
  const spectators = spectatorOutlines();
  const { surface } = context;
  const barrier = context.model(BARRIER);
  const fence = context.model(CATCH_FENCE);

  for (const side of [-1, 1]) {
    const boundary = samples.map((sample): Point => {
      const offset = safety(sample, side).barrier * side;
      return [sample.x - sample.dirZ * offset, sample.z + sample.dirX * offset];
    });
    const boundaryPath = resolvePath(boundary, true);
    const boundarySamples = samplePath(boundaryPath, BARRIER_TILE, true);
    for (let index = 0; index < boundarySamples.length; index += 1) {
      const sample = boundarySamples[index];
      const next = boundarySamples[(index + 1) % boundarySamples.length];
      const x = (sample.x + next.x) / 2;
      const z = (sample.z + next.z) / 2;
      if (roadsNearby.isTaken(x, z) || !barrier) {
        continue;
      }
      const reach = BARRIER_TILE / 2;
      const rise =
        surface.heightAt(x + sample.dirX * reach, z + sample.dirZ * reach) -
        surface.heightAt(x - sample.dirX * reach, z - sample.dirZ * reach);
      const placement = {
        x,
        y: surface.heightAt(x, z),
        z,
        yaw: Math.atan2(-(next.z - sample.z), next.x - sample.x),
        tilt: Math.atan2(rise, BARRIER_TILE),
      };
      instances.add(barrier, placement);
      if (
        catchFences &&
        fence &&
        spectators.some((outline) => signedDistance(x, z, outline) < SPECTATOR_RANGE)
      ) {
        instances.add(fence, { ...placement, y: placement.y + BARRIER_LIFT });
      }
    }
  }

  const marshals = samplePath(segments, MARSHAL_SPACING, true);
  for (const sample of marshals) {
    const offset = safety(sample, -1).barrier;
    const x = sample.x + sample.dirZ * (offset + 7);
    const z = sample.z - sample.dirX * (offset + 7);
    if (!context.built.isTaken(x, z)) {
      placeModel(context, instances, MARSHAL_POST, {
        x,
        z,
        yaw: Math.atan2(-sample.dirZ, sample.dirX),
      });
    }
  }

  const finish = startFinishSample(samples, circuit);
  placeModel(context, instances, GANTRY, {
    x: finish.x,
    z: finish.z,
    yaw: Math.atan2(-finish.dirX, -finish.dirZ),
  });
}

function startFinishSample(samples: readonly PathSample[], circuit: TrackLocation): PathSample {
  const [lineX, lineZ] = circuit.startFinish ?? [samples[0].x, samples[0].z];
  return samples.reduce((best, sample) =>
    Math.hypot(sample.x - lineX, sample.z - lineZ) < Math.hypot(best.x - lineX, best.z - lineZ)
      ? sample
      : best,
  );
}

function placeLightPoles(context: Context, instances: Instances): void {
  const ring = locationById<TrackLocation>("ring-road");
  const offset = ring.width / 2 + 4;
  for (const sample of samplePath(resolvePath(ring.path, true), 90, true)) {
    const x = sample.x - sample.dirZ * offset;
    const z = sample.z + sample.dirX * offset;
    if (!context.built.isTaken(x, z)) {
      placeModel(context, instances, LIGHT_POLE, { x, z, yaw: yawAlong(sample) + Math.PI / 2 });
    }
  }

  for (const park of carParks()) {
    const outline = resolveOutline(park.footprint);
    const { minX, minZ, maxX, maxZ } = boundsOf(outline);
    for (let z = minZ + 45; z < maxZ - 20; z += 90) {
      for (let x = minX + 45; x < maxX - 20; x += 90) {
        if (signedDistance(x, z, outline) < -12) {
          placeModel(context, instances, LIGHT_POLE, { x, z });
        }
      }
    }
  }
}

function placeAircraft(context: Context, instances: Instances): void {
  const apron = locationById<AreaLocation>("aerodrome-apron");
  const { minX, maxX } = boundsOf(resolveOutline(apron.footprint));
  const [, centreZ] = centreOf(resolveOutline(apron.footprint));
  for (let plane = 0; plane < 4; plane += 1) {
    placeModel(context, instances, AIRCRAFT, {
      x: minX + ((maxX - minX) * (plane + 0.8)) / 5,
      z: centreZ,
      yaw: Math.PI,
    });
  }
}

function carParks(): AreaLocation[] {
  return layout.locations.filter(
    (location): location is AreaLocation =>
      location.type === "area" && location.id.startsWith("car-park-"),
  );
}

/** Rows of cars, thick and thin, back to back across aisles. */
function parkCars(
  context: Context,
  instances: Instances,
  car: BufferGeometry,
  park: AreaLocation,
  fill: number,
): void {
  const outline = resolveOutline(park.footprint);
  const { minX, minZ, maxX, maxZ } = boundsOf(outline);
  const rowsAlongX = maxX - minX > maxZ - minZ;
  const { random, surface } = context;

  for (let across = 4; across < (rowsAlongX ? maxZ - minZ : maxX - minX) - 4; across += 18) {
    for (const facing of [0, 1]) {
      const rowOffset = across + facing * 5.5;
      for (let along = 4; along < (rowsAlongX ? maxX - minX : maxZ - minZ) - 4; along += 3) {
        const x = rowsAlongX ? minX + along : minX + rowOffset;
        const z = rowsAlongX ? minZ + rowOffset : minZ + along;
        const crowding = 0.5 + 0.5 * noise2(x, z, 120, 37);
        if (signedDistance(x, z, outline) > -3 || random() > fill * (0.25 + 1.5 * crowding)) {
          continue;
        }
        instances.add(car, {
          x,
          y: surface.heightAt(x, z) + 0.3,
          z,
          yaw: (rowsAlongX ? 0 : Math.PI / 2) + (facing ? Math.PI : 0),
          tint: pickOne(random, CAR_PAINTS),
        });
      }
    }
  }
}

function placeRaceGrid(context: Context, instances: Instances): void {
  const circuit = locationById<TrackLocation>("circuit");
  const samples = samplePath(resolvePath(circuit.path, true), 4, true);
  const finish = samples.indexOf(startFinishSample(samples, circuit));
  for (let place = 0; place < 20; place += 1) {
    const sample = samples[(finish - 3 - place * 2 + samples.length) % samples.length];
    const side = place % 2 === 0 ? -3.2 : 3.2;
    placeModel(context, instances, RACE_CAR, {
      x: sample.x - sample.dirZ * side,
      z: sample.z + sample.dirX * side,
      sink: -0.35,
      yaw: Math.atan2(sample.dirX, sample.dirZ),
      tint: new Color().setHSL(context.random(), 0.45, 0.6),
    });
  }
}

function placeFoodStalls(context: Context, instances: Instances): void {
  for (const location of layout.locations) {
    if (location.type !== "building" || !location.model?.endCap) {
      continue;
    }
    const outline = buildingParts(location).flatMap((part) => resolveOutline(part.footprint));
    const { minX, minZ, maxX, maxZ } = boundsOf(outline);
    const { facing } = location.model;
    const sideways = facing === "east" || facing === "west";
    const from = sideways ? minZ : minX;
    const to = sideways ? maxZ : maxX;
    for (let along = from + 8; along < to - 4; along += 18) {
      const behind = 14;
      const x = sideways ? (facing === "west" ? maxX + behind : minX - behind) : along;
      const z = sideways ? along : facing === "north" ? maxZ + behind : minZ - behind;
      if (!context.built.isTaken(x, z)) {
        placeModel(context, instances, FOOD_STALL, { x, z, yaw: context.random() * 0.2 });
      }
    }
  }
}

function placeShuttles(context: Context, instances: Instances, count: number): void {
  const outline = resolveOutline(locationById<AreaLocation>("shuttle-drop-off").footprint);
  const { minX, minZ, maxX, maxZ } = boundsOf(outline);
  for (let bus = 0; bus < count; bus += 1) {
    placeModel(context, instances, SHUTTLE, {
      x: minX + ((maxX - minX) * ((bus % 4) + 0.5)) / 4,
      z: minZ + ((maxZ - minZ) * (Math.floor(bus / 4) + 0.5)) / 2,
      sink: -0.3,
    });
  }
}

function placeMarquees(context: Context, instances: Instances): void {
  const outline = resolveOutline(locationById<AreaLocation>("arrival-plaza").footprint);
  const { minX, minZ, maxX, maxZ } = boundsOf(outline);
  for (let column = 0; column < 3; column += 1) {
    for (const row of [0.26, 0.74]) {
      placeModel(context, instances, MARQUEE, {
        x: minX + ((maxX - minX) * (column + 1.2)) / 4.2,
        z: minZ + (maxZ - minZ) * row,
        sink: -0.3,
      });
    }
  }
}

/** Temporary race activity sits inside the permanent compound organisation. */
function placeTeamActivity(context: Context, teams: Instances, guests: Instances): void {
  const trailer = colorize(openBox(3, 3.7, 14, 2.1, 0), () => [0.9, 0.93, 0.95]);
  const cab = colorize(openBox(3, 3, 3.5, 1.7, 8.5), () => [0.02, 0.26, 0.45]);
  const truck = mergeGeometries([trailer, cab]);
  if (!truck) throw new Error("The transporter parts could not be merged");
  const support = locationById<BuildingLocation>("team-support-rows");
  for (const part of buildingParts(support).filter((part) => part.base === 5)) {
    const [x, z] = centreOf(resolveOutline(part.footprint));
    for (const offset of [-6, 6]) {
      teams.add(truck, { x: x + offset, z, y: context.surface.heightAt(x, z) });
    }
  }
  for (const x of [-225, -170]) {
    placeModel(context, guests, MARQUEE, { x, z: -93, scale: 0.65 });
  }
  const person = colorize(openBox(0.6, 1.7, 0.6, 0.85, 0), () => [0.05, 0.4, 0.55]);
  for (let index = 0; index < 36; index += 1) {
    const x = -243 + (index % 12) * 8;
    const z = -124 + Math.floor(index / 12) * 5;
    guests.add(person, { x, z, y: context.surface.heightAt(x, z) + 0.3 });
  }
}

/** Training equipment and display cars explain the working infield in every mode. */
function placeAcademyActivity(context: Context, instances: Instances, car: BufferGeometry): void {
  const court = locationById<AreaLocation>("vehicle-display-courts");
  const { minX, maxX, minZ, maxZ } = boundsOf(resolveOutline(court.footprint));
  for (let bay = 0; bay < 6; bay += 1) {
    const x = minX + ((bay + 0.5) * (maxX - minX)) / 6;
    const z = (minZ + maxZ) / 2;
    instances.add(car, { x, z, y: context.surface.heightAt(x, z) + 0.3, tint: CAR_PAINTS[bay] });
  }
  const cone = colorize(new ConeGeometry(0.5, 1.1, 6).translate(0, 0.55, 0), () => [1, 0.35, 0.05]);
  const course = locationById<TrackLocation>("academy-handling-course");
  for (const [x, z] of course.branches?.[0] ?? []) {
    for (const side of [-1, 1]) {
      instances.add(cone, { x, z: z + side * 4, y: context.surface.heightAt(x, z) + 0.35 });
    }
  }
}

/** Scenery in the map, sorted by what has to control it. */
export interface Scenery {
  /** Farmland and trees, which stay put whatever else is switched off. */
  readonly setting: Group;
  /** Dressing that fades with a precinct. */
  readonly precincts: ReadonlyMap<Category, Group>;
  /** Dressing that only appears for one way of using the site, by event id. */
  readonly events: ReadonlyMap<string, readonly Object3D[]>;
}

function addHidden(group: Group, meshes: readonly InstancedMesh[]): readonly InstancedMesh[] {
  for (const mesh of meshes) {
    mesh.visible = false;
    group.add(mesh);
  }
  return meshes;
}

/** Places all the scenery by rule, the same way on every load. */
export function createScenery(kit: Kit, surface: GroundSurface, quality: Quality): Scenery {
  const baked = new Map<string, BufferGeometry>();
  const model = (file: string): BufferGeometry | undefined => {
    if (!baked.has(file)) {
      const source = kit.get(file);
      if (source) {
        baked.set(file, bakedGeometry(source));
      }
    }
    return baked.get(file);
  };

  let draw = 0;
  const notPlanted = layout.locations.filter(
    (location) => !(location.type === "area" && location.planting),
  );
  const context: Context = {
    surface,
    density: quality.sceneryDensity,
    model,
    occupied: occupancyOf(layout.locations, 10),
    built: occupancyOf(notPlanted, 5),
    random: () => {
      draw += 1;
      return hash2(draw, 7, 71);
    },
  };

  const trees = new Instances();
  const farTrees = new Instances();
  plantSiteEdge(context, trees);
  plantAvenues(context, trees);
  plantAreas(context, trees);
  plantFarmland(context, trees);
  scatterUnderbrush(context, trees);
  plantWindbreaks(context, trees, farTrees, createFarTree());
  placeFarmsteads(context, trees);

  const setting = new Group();
  setting.name = "scenery";
  setting.add(...trees.build(true), ...farTrees.build(false));

  const precincts = new Map<Category, Group>(CATEGORIES.map((category) => [category, new Group()]));
  const group = (category: Category): Group => {
    const found = precincts.get(category);
    if (!found) {
      throw new Error(`Unknown precinct "${category}"`);
    }
    return found;
  };

  const trackside = new Instances();
  const roads = layout.locations.filter(
    (location) =>
      (location.type === "road" || location.type === "track") &&
      location.id !== "circuit" &&
      !location.bridge,
  );
  dressCircuit(context, trackside, quality.catchFences, occupancyOf(roads, 2));
  group("racing").add(...trackside.build(true));

  const transport = new Instances();
  placeLightPoles(context, transport);
  placeAircraft(context, transport);
  group("transport").add(...transport.build(true));

  const car = createCar();
  const academy = new Instances();
  placeAcademyActivity(context, academy, car);
  group("academy").add(...academy.build(true));
  const parks = carParks();

  const raceCars = new Instances();
  for (const park of parks) {
    parkCars(context, raceCars, car, park, 0.3 * quality.sceneryDensity);
  }
  const raceShuttles = new Instances();
  placeShuttles(context, raceShuttles, 8);
  const raceTrackside = new Instances();
  placeRaceGrid(context, raceTrackside);
  placeFoodStalls(context, raceTrackside);
  const raceGuests = new Instances();
  placeTeamActivity(context, raceTrackside, raceGuests);

  const conferenceCars = new Instances();
  for (const park of parks.slice(0, CONFERENCE_CAR_PARKS)) {
    parkCars(context, conferenceCars, car, park, 0.22 * quality.sceneryDensity);
  }
  const conferenceShuttles = new Instances();
  placeShuttles(context, conferenceShuttles, 3);
  const conferenceTents = new Instances();
  placeMarquees(context, conferenceTents);

  const events = new Map<string, readonly Object3D[]>([
    [
      "race",
      [
        ...addHidden(group("transport"), raceCars.build(false)),
        ...addHidden(group("transport"), raceShuttles.build(true)),
        ...addHidden(group("racing"), raceTrackside.build(true)),
        ...addHidden(group("hospitality"), raceGuests.build(true)),
      ],
    ],
    [
      "conference",
      [
        ...addHidden(group("transport"), conferenceCars.build(false)),
        ...addHidden(group("transport"), conferenceShuttles.build(true)),
        ...addHidden(group("conference"), conferenceTents.build(true)),
      ],
    ],
  ]);

  return { setting, precincts, events };
}
