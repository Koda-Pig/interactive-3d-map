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
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  BLOCK_DEPTH,
  isCarPark,
  parkingBlocks,
  pointInBlock,
  stallsOf,
} from "../layout/car-parks.ts";
import type { ResolvedZone } from "../layout/land-use.ts";
import { landUseAt, landUseZones, siteOccupancy } from "../layout/land-use.ts";
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
import { boundsOf, centreOf, outsetPolygon, signedDistance } from "../layout/polygon.ts";
import { raceGrid } from "../layout/race-grid.ts";
import { createTrackSafety } from "../layout/track-safety.ts";
import type { Quality } from "../scene/quality.ts";
import { MAP_HALF_SIZE, SITE_SIZE } from "../site.ts";
import { fieldEdgeX, siteEdgeDistance, siteEdgePoint } from "../terrain/fields.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { heightAt } from "../terrain/height.ts";
import { hash2, noise2 } from "../terrain/noise.ts";
import { createContactShadows } from "./contact-shadows.ts";
import type { Kit } from "./kit.ts";
import { bakedGeometry } from "./kit.ts";
import { createTeamBranding, TEAMS, transporterColour } from "./team-branding.ts";
import { vehicleSlope } from "./vehicle-pose.ts";

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
export const RACE_CAR = "props/race-car-generic.glb";
export const SHUTTLE = "props/shuttle-bus.glb";
const FOOD_STALL = "props/food-stall.glb";
const MARQUEE = "hospitality/hospitality-marquee.glb";
const FARMHOUSE = "setting/farmhouse.glb";
const PADDLE_BOAT = "props/paddle-boat.glb";
const BOOM_GATE = "props/boom-gate.glb";
const SILOS = "setting/farm-silo-group.glb";
const BIG_SCREEN = "racing/big-screen.glb";
const BLEACHER = "racing/temporary-bleacher.glb";
/**
 * Crowd figures built from Kenney's Mini Characters (CC0) by
 * tools/assets/people.mjs. People near the camera are drawn as a mix of these;
 * further away they stay simple cones and boxes.
 */
const PEOPLE = [
  "people/person-female-a.glb",
  "people/person-female-c.glb",
  "people/person-female-e.glb",
  "people/person-male-a.glb",
  "people/person-male-c.glb",
  "people/person-male-e.glb",
];
/** Splits crowds into regions as if each person were this many triangles. */
const CROWD_REGION_WEIGHT = 20;
/** Within this distance of the camera, in metres, people are drawn as figures. */
const NEAR_PEOPLE_DISTANCE = 320;

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
  PADDLE_BOAT,
  BOOM_GATE,
  BIG_SCREEN,
  BLEACHER,
  ...PEOPLE,
];

const AVENUE_ROADS = ["ring-road", "waterfront-drive"];
/** Smaller roads and walks that get a closer row of trees each side. */
const TREE_LINED_ROADS = [
  "academy-campus-road",
  "automotive-campus-road",
  "aerodrome-road",
  "residences-east-street",
  "residences-south-street",
  "retail-street",
  "research-park-street",
  "fan-walk",
  "expo-walk",
  "waterfront-walk",
];
/** Buildings with planting around them. */
const LANDSCAPED_BUILDINGS = [
  "hotel-waterfront",
  "hotel-lakeside",
  "hotel-promenade",
  "restaurant-west",
  "restaurant-central",
  "restaurant-east",
  "expo-centre",
  "exhibition-hall-1",
  "exhibition-hall-2",
  "amphitheatre",
  "trackside-residences-east",
  "trackside-residences-south",
  "residents-club-east",
  "residents-club-south",
  "retail-quarter",
  "research-park",
  "automotive-hub",
  "driving-academy",
  "kalbaskraal-station",
];
/** The car parks beside the halls and the Expo Centre. */
const CONFERENCE_CAR_PARKS = ["car-park-1", "car-park-2", "car-park-3", "car-park-8"];

const BARRIER_TILE = 10;
const BARRIER_LIFT = 0.8;
const MARSHAL_SPACING = 380;
const SPECTATOR_RANGE = 45;
/** Car park light poles go on every this many lanes, and this far apart along them. */
const POLE_LANES = 4;
const POLE_SPACING = 90;

const TWO_PI = Math.PI * 2;
/** Length of a boom gate's arm, in metres. Two of them close a 10 m road. */
const BOOM_REACH = 5;
/** The location whose hover or selection runs the fountain show. */
export const FOUNTAIN_LOCATION = "lake-fountain";
/** Jets along the arc between the fountain's two end basins, and how tall they and the centre jet get. */
const FOUNTAIN_LINE_JETS = 41;
const FOUNTAIN_LINE_HEIGHT = 24;
const FOUNTAIN_CENTRE_HEIGHT = 46;
/** How far the paddle boats stay from the quay, and from anything built on the water. */
const BOAT_SHORE_CLEARANCE = 20;
const BOAT_STRUCTURE_CLEARANCE = 28;
/** The quay's stone coping, in metres: the length of one piece and its height. */
const COPING_PIECE = 4;
const COPING_HEIGHT = 1;
/** Spacing of the trees and lamps along the promenade's landward edge. */
const QUAY_TREE_SPACING = 24;
const QUAY_LAMP_SPACING = 48;
/** The share of the logistics yard's truck bays in use outside race weekends. */
const YARD_TRUCKS_EVERY_DAY = 0.5;
/** The share of each car park's stalls in use on any day, and on a race day. */
const STAFF_PARKING = 0.12;
const RACE_PARKING = 0.8;
const CONFERENCE_PARKING = 0.22;
/** Trees along a field edge are this far apart, in metres. */
const WINDBREAK_SPACING = 20;
/** Vine rows: how far apart, and how long each drawn piece of a row is. */
const VINE_ROW_SPACING = 3;
const VINE_PIECE = 24;
/** Every this many rows, two are left out for a tractor track. */
const VINE_ROWS_PER_TRACK = 24;
/** A camping pitch, along its row and across it. Every third row is a grass lane. */
const PITCH_LENGTH = 9;
const PITCH_DEPTH = 10;
/** Square metres of bank for each spectator drawn. A full bank holds far more. */
const BANK_AREA_PER_PERSON = 6;
const TENT_PAINTS = ["#E4572E", "#2F6DA8", "#5E8C4A", "#D9B23C", "#8E9AA6", "#C9482B"].map(
  (hex) => new Color(hex),
);
const SHIRT_PAINTS = [
  "#F4F4F0",
  "#E4572E",
  "#1C6FA8",
  "#F2C230",
  "#2E2E33",
  "#C2332F",
  "#5FA36B",
  "#E88BA5",
].map((hex) => new Color(hex));
const BOAT_PAINTS = ["#F2C230", "#E4572E", "#1CA7EC", "#F4F4F0", "#7BC47F"];
/** Where each shell bursts, from the barge, with its size and colour. */
const FIREWORK_BURSTS = [
  { east: -20, up: 82, south: -6, radius: 26, color: "#FFD45E" },
  { east: 16, up: 108, south: 8, radius: 32, color: "#3FC4FF" },
  { east: 36, up: 68, south: -14, radius: 20, color: "#FF6B8B" },
] as const;
const FIREWORK_STREAKS = 84;
/** The location whose hover or selection sets the fireworks off. */
export const FIREWORKS_LOCATION = "fireworks-barge";
/** Seconds a shell takes to climb, to open, and to droop and fade, and between launches. */
const FIREWORK_LAUNCH = 0.5;
const FIREWORK_BURST = 0.7;
const FIREWORK_FADE = 1.1;
const FIREWORK_CYCLE = 3;
const FIREWORK_STAGGER = 0.8;

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
  readonly pitch?: number;
  readonly scale?: number;
  /** Tips the model's X axis up by this many radians, to follow a slope. */
  readonly tilt?: number;
  readonly tint?: Color;
}

const WHITE = new Color(1, 1, 1);

/**
 * A batch with more triangles than this is split into regions, each drawn
 * only when it's in view. One site-wide batch is always in view, so every
 * tree on the map was drawn however close the camera was.
 */
const REGION_TRIANGLES = 5_000;
/** Regions stop splitting at this size, in metres, to keep the draw calls down. */
const MIN_REGION_SIZE = 250;
const MATRIX_SIZE = 16;

function trianglesIn(geometry: BufferGeometry): number {
  return (geometry.index ?? geometry.getAttribute("position")).count / 3;
}

/** Sorts the copies in a batch into regions, quartering any that hold too much. */
function regionsOf(
  matrices: readonly number[],
  copies: readonly number[],
  trianglesEach: number,
): (readonly number[])[] {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const copy of copies) {
    const x = matrices[copy * MATRIX_SIZE + 12];
    const z = matrices[copy * MATRIX_SIZE + 14];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  if (
    copies.length * trianglesEach <= REGION_TRIANGLES ||
    Math.max(maxX - minX, maxZ - minZ) <= MIN_REGION_SIZE
  ) {
    return [copies];
  }

  const middleX = (minX + maxX) / 2;
  const middleZ = (minZ + maxZ) / 2;
  const quarters: number[][] = [[], [], [], []];
  for (const copy of copies) {
    const east = matrices[copy * MATRIX_SIZE + 12] > middleX ? 1 : 0;
    const south = matrices[copy * MATRIX_SIZE + 14] > middleZ ? 2 : 0;
    quarters[east + south].push(copy);
  }
  return quarters
    .filter((quarter) => quarter.length > 0)
    .flatMap((quarter) => regionsOf(matrices, quarter, trianglesEach));
}

/** Collects copies of geometries, then draws each geometry in one call per region. */
class Instances {
  private readonly batches = new Map<BufferGeometry, Batch>();

  add(
    geometry: BufferGeometry,
    { x, y, z, yaw = 0, pitch = 0, scale = 1, tilt = 0, tint = WHITE }: Placement,
  ): void {
    let batch = this.batches.get(geometry);
    if (!batch) {
      batch = { matrices: [], colors: [] };
      this.batches.set(geometry, batch);
    }
    placedAt.set(x, y, z);
    placedEuler.set(pitch, yaw, tilt, "YXZ");
    placedTurn.setFromEuler(placedEuler);
    placedScale.setScalar(scale);
    placedMatrix.compose(placedAt, placedTurn, placedScale);
    batch.matrices.push(...placedMatrix.elements);
    batch.colors.push(tint.r, tint.g, tint.b);
  }

  /**
   * One instanced mesh per geometry and region. Where `farVersion` gives a
   * simpler geometry, each region also gets a hidden twin drawn with it,
   * sharing the copies' positions, recorded in `levels` to switch between.
   * Where `figuresFor` gives figures for a stand-in person, each region of
   * people gets a hidden mix of those figures for when the camera is close.
   */
  build(
    castShadow: boolean,
    farVersion?: (geometry: BufferGeometry) => BufferGeometry | undefined,
    levels?: TreeLevel[],
    figuresFor?: (geometry: BufferGeometry) => readonly BufferGeometry[] | undefined,
  ): Object3D[] {
    return [...this.batches].flatMap(([geometry, { matrices, colors }]): Object3D[] => {
      const all = Array.from({ length: colors.length / 3 }, (_, copy) => copy);
      const far = farVersion?.(geometry);
      const figures = figuresFor?.(geometry);
      if (figures && figures.length > 0 && levels) {
        return this.buildCrowd(geometry, figures, matrices, colors, castShadow, levels);
      }
      return regionsOf(matrices, all, trianglesIn(geometry)).flatMap((copies) => {
        const mesh = new InstancedMesh(geometry, sceneryMaterial, copies.length);
        const tints = new Float32Array(copies.length * 3);
        copies.forEach((copy, index) => {
          for (let part = 0; part < MATRIX_SIZE; part += 1) {
            mesh.instanceMatrix.array[index * MATRIX_SIZE + part] =
              matrices[copy * MATRIX_SIZE + part];
          }
          tints.set(colors.slice(copy * 3, copy * 3 + 3), index * 3);
        });
        mesh.instanceColor = new InstancedBufferAttribute(tints, 3);
        mesh.castShadow = castShadow;
        if (!far || !levels) {
          return [mesh];
        }
        const twin = new InstancedMesh(far, sceneryMaterial, copies.length);
        twin.instanceMatrix = mesh.instanceMatrix;
        twin.instanceColor = mesh.instanceColor;
        twin.castShadow = castShadow;
        twin.visible = false;
        mesh.computeBoundingSphere();
        const sphere = mesh.boundingSphere;
        levels.push({
          near: mesh,
          far: twin,
          centre: sphere ? sphere.center.clone() : new Vector3(),
          radius: sphere?.radius ?? 0,
          distance: FAR_TREE_DISTANCE,
        });
        return [mesh, twin];
      });
    });
  }

  /**
   * People in regions, each a group of the stand-in shapes, tinted as placed,
   * and a hidden set of figures in their own colours, one batch per figure.
   */
  private buildCrowd(
    standIn: BufferGeometry,
    figures: readonly BufferGeometry[],
    matrices: readonly number[],
    colors: readonly number[],
    castShadow: boolean,
    levels: TreeLevel[],
  ): Object3D[] {
    const all = Array.from({ length: colors.length / 3 }, (_, copy) => copy);
    // Regions of about 250 people: few enough draws far away, and few enough
    // figures when the camera comes close to one.
    return regionsOf(matrices, all, CROWD_REGION_WEIGHT).map((copies) => {
      const far = new InstancedMesh(standIn, sceneryMaterial, copies.length);
      const tints = new Float32Array(copies.length * 3);
      copies.forEach((copy, index) => {
        far.instanceMatrix.array.set(
          matrices.slice(copy * MATRIX_SIZE, (copy + 1) * MATRIX_SIZE),
          index * MATRIX_SIZE,
        );
        tints.set(colors.slice(copy * 3, copy * 3 + 3), index * 3);
      });
      far.instanceColor = new InstancedBufferAttribute(tints, 3);
      far.castShadow = castShadow;

      // Each person keeps the same figure every time the map loads.
      const byFigure = figures.map(() => [] as number[]);
      for (const copy of copies) {
        const x = matrices[copy * MATRIX_SIZE + 12];
        const z = matrices[copy * MATRIX_SIZE + 14];
        const pick = Math.floor(hash2(Math.round(x * 10), Math.round(z * 10), 81) * figures.length);
        byFigure[Math.min(pick, figures.length - 1)].push(copy);
      }
      const near = new Group();
      near.visible = false;
      byFigure.forEach((chosen, figure) => {
        if (chosen.length === 0) {
          return;
        }
        const mesh = new InstancedMesh(figures[figure], sceneryMaterial, chosen.length);
        chosen.forEach((copy, index) => {
          mesh.instanceMatrix.array.set(
            matrices.slice(copy * MATRIX_SIZE, (copy + 1) * MATRIX_SIZE),
            index * MATRIX_SIZE,
          );
        });
        mesh.castShadow = castShadow;
        near.add(mesh);
      });

      far.computeBoundingSphere();
      const sphere = far.boundingSphere;
      levels.push({
        near,
        far,
        centre: sphere ? sphere.center.clone() : new Vector3(),
        radius: sphere?.radius ?? 0,
        // People switch the other way round from trees: simple until the camera comes close.
        distance: NEAR_PEOPLE_DISTANCE,
      });
      const region = new Group();
      region.add(far, near);
      return region;
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

/**
 * A stand-in for a tree model seen from far away: one eight-triangle shape
 * the size of the model's crown, coloured like the far windbreak trees.
 */
function farVersionOf(geometry: BufferGeometry): BufferGeometry {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const width = box ? box.max.x - box.min.x : 8;
  const depth = box ? box.max.z - box.min.z : 8;
  const height = box ? box.max.y : 12;
  // The crown starts about a third of the way up the trunk.
  const crownBase = height * 0.3;
  const far = new OctahedronGeometry(1, 0);
  far.scale(width / 2, (height - crownBase) / 2, depth / 2);
  far.translate(0, (height + crownBase) / 2, 0);
  // The model's own colours, averaged over its crown, so the swap barely shows.
  const colors = geometry.getAttribute("color");
  const position = geometry.getAttribute("position");
  const crown = [0, 0, 0];
  let counted = 0;
  for (let vertex = 0; colors && vertex < colors.count; vertex += 1) {
    if (position.getY(vertex) > crownBase) {
      crown[0] += colors.getX(vertex);
      crown[1] += colors.getY(vertex);
      crown[2] += colors.getZ(vertex);
      counted += 1;
    }
  }
  const [red, green, blue] = counted > 0 ? crown.map((sum) => sum / counted) : [0.1, 0.16, 0.06];
  return colorize(far, (y) => {
    const light = 0.75 + (0.35 * (y - crownBase)) / (height - crownBase);
    return [red * light, green * light, blue * light];
  });
}

/**
 * A batch of trees or people drawn either as their models or, far from the
 * camera, as simple shapes.
 */
interface TreeLevel {
  readonly near: Object3D;
  readonly far: Object3D;
  readonly centre: Vector3;
  readonly radius: number;
  /** Beyond this distance from the camera, in metres, the simple shapes are drawn. */
  readonly distance: number;
}

/** Beyond this distance from the camera, in metres, a batch of trees is drawn simply. */
const FAR_TREE_DISTANCE = 1500;

/** Switches batches of trees and people between their models and simple shapes by distance. */
export class TreeLevels {
  constructor(private readonly levels: readonly TreeLevel[]) {}

  /** Call when the camera has moved. Returns whether any batch switched. */
  update(camera: Vector3): boolean {
    let changed = false;
    for (const level of this.levels) {
      const far = camera.distanceTo(level.centre) - level.radius > level.distance;
      if (level.far.visible !== far) {
        level.far.visible = far;
        level.near.visible = !far;
        changed = true;
      }
    }
    return changed;
  }
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

/** A team or exhibition transporter, long axis on Z. */
function createTransporter(): BufferGeometry {
  const trailer = colorize(openBox(3, 3.7, 14, 2.1, 0), () => [0.9, 0.93, 0.95]);
  const cab = colorize(openBox(3, 3, 3.5, 1.7, 8.5), () => [0.02, 0.26, 0.45]);
  const truck = mergeGeometries([trailer, cab]);
  if (!truck) throw new Error("The transporter parts could not be merged");
  return truck;
}

/** A centred fallback matching the kit gate, with its arm reaching along +X. */
function createBoomFallback(): BufferGeometry {
  const parts = [colorize(openBox(0.6, 1.4, 0.6, 0.7, 0), () => [0.13, 0.19, 0.24])];
  for (let stripe = 0; stripe < BOOM_REACH; stripe += 1) {
    const arm = openBox(1, 0.3, 0.3, 1.2, 0);
    arm.translate(stripe + 0.8, 0, 0);
    parts.push(colorize(arm, () => (stripe % 2 === 0 ? [0.85, 0.12, 0.1] : [0.96, 0.96, 0.94])));
  }
  const boom = mergeGeometries(parts);
  if (!boom) throw new Error("The boom gate's parts could not be merged");
  return boom.translate(-2.5, 0, 0);
}

/** A two-seat pedal boat with a sun canopy. The hull and canopy take the tint. */
function createPaddleBoatFallback(): BufferGeometry {
  const dark = (): readonly [number, number, number] => [0.16, 0.19, 0.23];
  const parts = [
    colorize(openBox(2.2, 0.7, 3.4, 0.35, 0), () => [1, 1, 1]),
    colorize(openBox(1.8, 0.45, 0.8, 0.9, 0.5), dark),
    colorize(openBox(2.1, 0.12, 2.3, 2, 0.2), () => [1, 1, 1]),
  ];
  for (const [x, z] of [
    [-0.95, -0.85],
    [0.95, -0.85],
    [-0.95, 1.25],
    [0.95, 1.25],
  ]) {
    const post = openBox(0.1, 1.3, 0.1, 1.35, z);
    post.translate(x, 0, 0);
    parts.push(colorize(post, dark));
  }
  const boat = mergeGeometries(parts);
  if (!boat) throw new Error("The paddle boat's parts could not be merged");
  return boat;
}

/** One fountain jet, a metre tall and a metre in radius, to be scaled to its height. */
function createFountainJet(): BufferGeometry {
  const cone = new ConeGeometry(1, 1, 6);
  cone.translate(0, 0.5, 0);
  return colorize(cone, (y) => [0.72 + 0.26 * y, 0.88 + 0.1 * y, 1]);
}

function createPerson(): BufferGeometry {
  return colorize(openBox(0.6, 1.7, 0.6, 0.85, 0), () => [0.05, 0.4, 0.55]);
}

/** A person seen from afar, in a crowd. Close up, the crowd figures replace it. */
const PERSON = createPerson();

/** A turn for a person at this spot, the same on every load and without using up the random stream. */
function personYaw(x: number, z: number, facing?: number): number {
  const turn = hash2(Math.round(x * 10), Math.round(z * 10), 82);
  return facing === undefined ? turn * Math.PI * 2 : facing + (turn - 0.5) * 1.2;
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
  fallback?: BufferGeometry,
): void {
  const geometry = context.model(file) ?? fallback;
  if (geometry) {
    const { x, z, sink = 0 } = placement;
    instances.add(geometry, { ...placement, y: context.surface.heightAt(x, z) - sink });
  }
}

/** A repeatable stream of numbers from 0 to 1, different for each seed. */
function seededRandom(seed: number): () => number {
  let draw = 0;
  return () => {
    draw += 1;
    return hash2(draw, 7, seed);
  };
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
  return Math.max(Math.abs(x), Math.abs(z)) < SITE_SIZE / 2 || siteEdgeDistance(x, z) < 0;
}

/** How far apart the trees in the hedge around the site are, in metres. */
const HEDGE_SPACING = 22;

/**
 * A broken line of trees just outside the site's edge, so the mown grass ends
 * at a hedge instead of fading into the wheat.
 */
function plantSiteHedge(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  const reach = SITE_SIZE / 2 + 200;
  for (let side = 0; side < 4; side += 1) {
    for (let along = -reach; along <= reach; along += HEDGE_SPACING) {
      const point = siteEdgePoint(side, along + random() * 6 - 3);
      if (!point) {
        continue;
      }
      // Out past the verge, onto the wheat side.
      const x = point[0] + [1, 0, -1, 0][side] * 7;
      const z = point[1] + [0, 1, 0, -1][side] * 7;
      if (
        noise2(x, z, 260, 42) < -0.35 ||
        occupied.isTaken(x, z) ||
        random() > context.density * 0.9
      ) {
        continue;
      }
      placeTree(context, instances, random() < 0.7 ? "gum" : "pine", x, z);
    }
  }
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
  return layout.locations.flatMap((location) => {
    if (
      location.type === "building" &&
      location.id !== "pit-conference-building" &&
      (location.category === "racing" || location.category === "hospitality")
    ) {
      return buildingParts(location).map((part) => resolveOutline(part.footprint));
    }
    if (location.type === "area" && location.id === "infield-hospitality") {
      return [resolveOutline(location.footprint)];
    }
    return [];
  });
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

  // On the line between back-to-back stalls, where a pole doesn't block an aisle.
  for (const park of carParks()) {
    for (const block of parkingBlocks(park).filter(({ lane }) => lane % POLE_LANES === 1)) {
      for (let along = POLE_SPACING / 3; along < block.to - block.from; along += POLE_SPACING) {
        const [x, z] = pointInBlock(block, BLOCK_DEPTH / 2, along);
        placeModel(context, instances, LIGHT_POLE, { x, z });
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
  return layout.locations.filter(isCarPark);
}

/** One set of parked cars, and the share of the stalls it fills. */
interface Parking {
  readonly instances: Instances;
  readonly share: number;
}

/**
 * Cars in the marked stalls, thick and thin, parked back to back. The cars
 * there every day keep their stalls, and each event fills more around them.
 */
function parkCars(
  context: Context,
  car: BufferGeometry,
  park: Pick<AreaLocation, "footprint">,
  everyDay: Parking,
  events: readonly Parking[],
  lift = 0.3,
): void {
  const { random, surface, occupied } = context;
  const marked = "id" in park;
  for (const block of parkingBlocks(park)) {
    for (const { x, z, row } of stallsOf(block)) {
      // Rows on open grass give way to whatever stands in the field.
      if (!marked && occupied.isTaken(x, z)) {
        continue;
      }
      const crowding = 0.5 + 0.5 * noise2(x, z, 120, 37);
      const chance = random() / (0.25 + 1.5 * crowding);
      const placement = {
        x,
        y: surface.heightAt(x, z) + lift,
        z,
        yaw: (block.rowsAlongX ? 0 : Math.PI / 2) + (row ? Math.PI : 0),
      };
      if (chance < everyDay.share) {
        everyDay.instances.add(car, { ...placement, tint: pickOne(random, CAR_PAINTS) });
        continue;
      }
      for (const { instances, share } of events) {
        if (chance < share) {
          instances.add(car, { ...placement, tint: pickOne(random, CAR_PAINTS) });
        }
      }
    }
  }
}

function placeRaceGrid(context: Context, instances: Instances): void {
  const circuit = locationById<TrackLocation>("circuit");
  for (const [place, slot] of raceGrid(circuit).entries()) {
    // Two cars a team, in the paddock's order, painted in the team's colours.
    const team = TEAMS[Math.floor(place / 2) % TEAMS.length];
    const yaw = Math.atan2(slot.dirX, slot.dirZ);
    placeModel(context, instances, RACE_CAR, {
      x: slot.x,
      z: slot.z,
      sink: -0.35,
      yaw,
      ...vehicleSlope((x, z) => context.surface.heightAt(x, z), slot.x, slot.z, yaw),
      tint: team ? transporterColour(team) : undefined,
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

/** Buses in the drop-off's bays, from bay `first` up to but not including bay `end`. */
function placeShuttles(context: Context, instances: Instances, first: number, end: number): void {
  const outline = resolveOutline(locationById<AreaLocation>("shuttle-drop-off").footprint);
  const { minX, minZ, maxX, maxZ } = boundsOf(outline);
  for (let bus = first; bus < end; bus += 1) {
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

interface TruckBay {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

/**
 * Truck bays in the logistics yard, in the strips its aisles and tents leave
 * free: nose-in rows under the north aisle, and rows parked along the edges.
 */
function yardTruckBays(): TruckBay[] {
  const yard = boundsOf(
    resolveOutline(locationById<AreaLocation>("team-logistics-yard").footprint),
  );
  const aisle = locationById<TrackLocation>("logistics-service-aisle");
  const loop = boundsOf(resolveOutline(aisle.path));
  const half = aisle.width / 2;
  const spine = locationById<TrackLocation>("infield-road");
  const spineX = spine.branches?.[1]?.[0]?.[0] ?? loop.maxX;
  const crossX = aisle.branches?.[0]?.[0]?.[0] ?? loop.minX;
  const bays: TruckBay[] = [];
  // Nose-in, just south of the north aisle, between the aisles that run north to south.
  const noseInZ = loop.minZ + half + 14;
  const runs = [
    [loop.minX + half, crossX - half],
    [crossX + half, spineX - spine.width / 2],
    [spineX + spine.width / 2, loop.maxX - half],
  ];
  for (const [from, to] of runs) {
    for (let x = from + 4; x <= to - 4; x += 4.5) {
      bays.push({ x, z: noseInZ, yaw: 0 });
    }
  }
  // Parked end to end along the north edge, and along the west edge.
  for (let x = loop.minX + 12; x <= loop.maxX - 4; x += 21) {
    bays.push({ x, z: (yard.minZ + loop.minZ - half) / 2, yaw: Math.PI / 2 });
  }
  for (let z = loop.minZ + 14; z <= loop.maxZ - 12; z += 21) {
    bays.push({ x: (yard.minX + loop.minX - half) / 2, z, yaw: 0 });
  }
  // Side by side between the service spine and the east aisle.
  const eastX = (spineX + spine.width / 2 + loop.maxX - half) / 2;
  for (let z = noseInZ + 20; z <= loop.maxZ - half - 6; z += 5) {
    bays.push({ x: eastX, z, yaw: Math.PI / 2 });
  }
  return bays;
}

/** Transporters in the logistics yard: some all year, the rest on a race weekend. */
function parkYardTrucks(context: Context, everyDay: Instances, raceOnly: Instances): void {
  const truck = createTransporter();
  for (const { x, z, yaw } of yardTruckBays()) {
    const instances = context.random() < YARD_TRUCKS_EVERY_DAY ? everyDay : raceOnly;
    instances.add(truck, { x, z, yaw, y: context.surface.heightAt(x, z) + 0.3 });
  }
}

/** A pair of boom gates across the Infield Road, beside the checkpoint's hut. */
function placeCheckpointBooms(context: Context, instances: Instances): void {
  const hut = locationById<BuildingLocation>("infield-checkpoint");
  const road = locationById<TrackLocation>("infield-road");
  const [, z] = centreOf(buildingParts(hut).flatMap((part) => resolveOutline(part.footprint)));
  const roadX = road.path[0][0];
  const boom = context.model(BOOM_GATE) ? undefined : createBoomFallback();
  for (const side of [-1, 1]) {
    // The cabinet is 2.5 m left of the model origin, before rotation.
    const x = roadX + side * (road.width / 2 + 0.4 - 2.5);
    placeModel(
      context,
      instances,
      BOOM_GATE,
      {
        x,
        z,
        sink: -0.3,
        yaw: side < 0 ? 0 : Math.PI,
      },
      boom,
    );
  }
}

/** The outline of everything built in the hospitality precinct, part by part. */
function waterfrontStructures(): Point[][] {
  return layout.locations.flatMap((location) =>
    location.type === "building" && location.category === "hospitality"
      ? buildingParts(location).map((part) => resolveOutline(part.footprint))
      : [],
  );
}

/** Paddle boats moored at the jetty and out on the water. */
function placeLakeFeatures(context: Context, instances: Instances): void {
  const { random } = context;
  const lake = resolveOutline(locationById<AreaLocation>("lake").footprint);
  const structures = waterfrontStructures();

  const boat = context.model(PADDLE_BOAT) ? undefined : createPaddleBoatFallback();
  const tint = (): Color => new Color(pickOne(random, BOAT_PAINTS));
  // The jetty's third part is its head, with boats moored along the lake side.
  const jetty = buildingParts(locationById<BuildingLocation>("paddle-boats"));
  const head = boundsOf(resolveOutline(jetty[2].footprint));
  for (let x = head.minX + 3; x <= head.maxX - 3; x += 4) {
    placeModel(
      context,
      instances,
      PADDLE_BOAT,
      { x, z: head.maxZ + 2.4, sink: -0.3, tint: tint() },
      boat,
    );
  }
  // The fountain's jets run between its basins, so boats keep out of the whole stretch.
  const show = boundsOf(
    buildingParts(locationById<BuildingLocation>(FOUNTAIN_LOCATION)).flatMap((part) =>
      resolveOutline(part.footprint),
    ),
  );
  const { minX, minZ, maxX, maxZ } = boundsOf(lake);
  for (let placed = 0, tries = 0; placed < 12 && tries < 400; tries += 1) {
    const x = minX + random() * (maxX - minX);
    const z = minZ + random() * (maxZ - minZ);
    const clear =
      signedDistance(x, z, lake) < -BOAT_SHORE_CLEARANCE &&
      (x < show.minX - 40 || x > show.maxX + 40 || z < show.minZ - 40 || z > show.maxZ + 40) &&
      structures.every((outline) => signedDistance(x, z, outline) > BOAT_STRUCTURE_CLEARANCE);
    if (clear) {
      placeModel(
        context,
        instances,
        PADDLE_BOAT,
        { x, z, sink: -0.3, yaw: random() * TWO_PI, tint: tint() },
        boat,
      );
      placed += 1;
    }
  }
}

/**
 * What makes the lake's edge a built quay: a stone coping along the water, and
 * lamps, trees and people along the promenade behind it.
 */
function dressWaterfront(context: Context, trees: Instances, instances: Instances): void {
  const { random, surface } = context;
  const water = locationById<AreaLocation>("lake");
  const lake = resolveOutline(water.footprint);
  const structures = waterfrontStructures();

  // The coping stops where a deck, a jetty, the bridge or the landing meets the quay.
  const coping = colorize(
    openBox(COPING_PIECE + 0.3, COPING_HEIGHT, 0.9, COPING_HEIGHT / 2, 0),
    (y) => (y > COPING_HEIGHT - 0.01 ? [0.95, 0.93, 0.88] : [0.74, 0.72, 0.67]),
  );
  for (const sample of samplePath(resolvePath(water.footprint, true), COPING_PIECE, true)) {
    const { x, z } = sample;
    if (structures.every((outline) => signedDistance(x, z, outline) > 1)) {
      instances.add(coping, { x, z, y: surface.heightAt(x, z), yaw: yawAlong(sample) });
    }
  }

  const promenade = locationById<TrackLocation>("promenade");
  const walk = samplePath(resolvePath(promenade.path, true), 2, true);
  const half = promenade.width / 2;
  // The lake can be wound either way, so find which side of the walk is land.
  const landward = (sample: PathSample): 1 | -1 =>
    signedDistance(sample.x - sample.dirZ, sample.z + sample.dirX, lake) >
    signedDistance(sample.x + sample.dirZ, sample.z - sample.dirX, lake)
      ? 1
      : -1;
  const beside = (sample: PathSample, offset: number): Point => {
    const side = landward(sample) * offset;
    return [sample.x - sample.dirZ * side, sample.z + sample.dirX * side];
  };
  const others = occupancyOf(
    layout.locations.filter((location) => location !== promenade && location !== water),
    3,
  );
  walk.forEach((sample, index) => {
    if ((index * 2) % QUAY_LAMP_SPACING === 0) {
      const [x, z] = beside(sample, half - 1.2);
      placeModel(context, instances, LIGHT_POLE, { x, z, scale: 0.5, yaw: yawAlong(sample) });
    }
    if ((index * 2) % QUAY_TREE_SPACING === QUAY_TREE_SPACING / 2) {
      const [x, z] = beside(sample, half + 4.5);
      if (signedDistance(x, z, lake) > half && !others.isTaken(x, z)) {
        placeTree(context, trees, "olive", x, z);
      }
    }
  });

  const stand = (x: number, z: number): void => {
    instances.add(SPECTATOR, {
      x,
      z,
      y: surface.heightAt(x, z) + 0.3,
      yaw: personYaw(x, z),
      tint: pickOne(random, SHIRT_PAINTS),
    });
  };
  const strollers = Math.round(170 * context.density);
  for (let index = 0; index < strollers; index += 1) {
    const [x, z] = beside(pickOne(random, walk), (random() * 2 - 1) * (half - 2));
    if (structures.every((outline) => signedDistance(x, z, outline) > 0.5)) {
      stand(x, z);
    }
  }
  const piazza = boundsOf(resolveOutline(locationById<AreaLocation>("lake-piazza").footprint));
  for (let index = 0; index < Math.round(50 * context.density); index += 1) {
    const x = piazza.minX + 2 + random() * (piazza.maxX - piazza.minX - 4);
    const z = piazza.minZ + 2 + random() * (piazza.maxZ - piazza.minZ - 4);
    if (structures.every((outline) => signedDistance(x, z, outline) > 1.5)) {
      stand(x, z);
    }
  }
}

/** Something on the lake that plays while its location is hovered or selected. */
export interface Show {
  setActive(active: boolean): void;
  /** Moves the show on to `now`. True while it needs drawing again. */
  update(now: number): boolean;
}

/** Runs `pose` with the seconds played while active, and with null to return to rest. */
function createShow(pose: (elapsed: number | null) => void): Show {
  let active = false;
  let startedAt: number | null = null;
  let stale = false;
  return {
    setActive(next) {
      const playing = next && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (playing === active) return;
      active = playing;
      startedAt = null;
      stale = true;
      if (!active) pose(null);
    },
    update(now) {
      if (!active) {
        const redraw = stale;
        stale = false;
        return redraw;
      }
      startedAt ??= now;
      pose((now - startedAt) / 1000);
      return true;
    },
  };
}

interface Jet {
  readonly x: number;
  readonly z: number;
  readonly height: number;
  /** Where the jet is in the wave that runs along the show, in radians. */
  readonly phase: number;
  /** How much of its height the jet keeps at the bottom of the wave. */
  readonly floor: number;
}

/**
 * The fountain show: an arc of jets between the end basins, a ring round each
 * basin and a tall jet in the middle. At rest the arc stands as a still wave.
 * While active the wave runs along it and the centre jet pulses.
 */
function createFountainShow(context: Context): { object: InstancedMesh; show: Show } {
  const fountain = locationById<BuildingLocation>(FOUNTAIN_LOCATION);
  const basins = buildingParts(fountain).map((part) => ({
    centre: centreOf(resolveOutline(part.footprint)),
    top: part.height,
  }));
  const [middle, west, east] = basins;
  const jets: Jet[] = [];
  for (let index = 0; index < FOUNTAIN_LINE_JETS; index += 1) {
    const along = index / (FOUNTAIN_LINE_JETS - 1);
    const fromMiddle = along * 2 - 1;
    const endZ = west.centre[1] + (east.centre[1] - west.centre[1]) * along;
    jets.push({
      x: west.centre[0] + (east.centre[0] - west.centre[0]) * along,
      z: middle.centre[1] + (endZ - middle.centre[1]) * fromMiddle * fromMiddle,
      height: FOUNTAIN_LINE_HEIGHT * (0.7 + 0.3 * Math.abs(fromMiddle)),
      phase: along * TWO_PI * 3,
      floor: 0.2,
    });
  }
  const ring = (basin: (typeof basins)[number], count: number, radius: number, height: number) => {
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * TWO_PI;
      jets.push({
        x: basin.centre[0] + Math.cos(angle) * radius,
        z: basin.centre[1] + Math.sin(angle) * radius,
        height,
        phase: angle * 2,
        floor: 0.45,
      });
    }
  };
  ring(middle, 12, 12, 13);
  ring(west, 8, 8, 9);
  ring(east, 8, 8, 9);
  const [centreX, centreZ] = middle.centre;
  jets.push({ x: centreX, z: centreZ, height: FOUNTAIN_CENTRE_HEIGHT, phase: 0, floor: 0.35 });
  const tallest = jets.length - 1;

  const object = new InstancedMesh(
    createFountainJet(),
    new MeshLambertMaterial({ vertexColors: true }),
    jets.length,
  );
  object.name = "fountain-show";
  // The jets change height, so the bounds worked out from one pose would go stale.
  object.frustumCulled = false;
  const waterY = context.surface.heightAt(centreX, centreZ) + 0.3;
  const upright = new Quaternion();
  const pose = (elapsed: number | null): void => {
    jets.forEach((jet, index) => {
      // At rest the wave is frozen where it starts, and the centre jet is at full height.
      const wave =
        index === tallest
          ? elapsed === null
            ? 1
            : 0.5 + 0.5 * Math.cos(elapsed * 1.3)
          : 0.5 + 0.5 * Math.sin((elapsed ?? 0) * 2.4 - jet.phase);
      const height = jet.height * (jet.floor + (1 - jet.floor) * wave);
      const width = 0.7 + height * 0.05;
      placedAt.set(jet.x, index === tallest ? waterY + middle.top - 0.3 : waterY, jet.z);
      placedScale.set(width, height, width);
      object.setMatrixAt(index, placedMatrix.compose(placedAt, upright, placedScale));
    });
    object.instanceMatrix.needsUpdate = true;
  };
  pose(null);
  return { object, show: createShow(pose) };
}

interface Shell {
  readonly bloom: Mesh;
  readonly trail: Mesh;
  readonly burstY: number;
  /** How far the trail climbs before the shell bursts. */
  readonly climb: number;
  /** Seconds into the display at which this shell first launches. */
  readonly delay: number;
}

/** A burst's sparks around the origin: a white core, coloured streaks and bright tips. */
function createBloom(radius: number, color: Color): BufferGeometry {
  const pieces: BufferGeometry[] = [];
  const forward = new Vector3(0, 0, 1);
  const towards = new Vector3();
  const turn = new Quaternion();
  const white = new Color("#FFF6DC");
  const streak = (start: number, end: number, thickness: number, paint: Color): void => {
    const box = new BoxGeometry(thickness, thickness, end - start);
    box.translate(0, 0, (start + end) / 2);
    box.applyQuaternion(turn.setFromUnitVectors(forward, towards));
    pieces.push(colorize(box.toNonIndexed(), () => [paint.r, paint.g, paint.b]));
  };
  for (let index = 0; index < FIREWORK_STREAKS; index += 1) {
    // Evenly spread over a sphere, then drooping a little, as falling sparks do.
    const y = 1 - (2 * (index + 0.5)) / FIREWORK_STREAKS;
    const ring = Math.sqrt(1 - y * y);
    const angle = index * 2.399963;
    towards.set(Math.cos(angle) * ring, y - 0.12, Math.sin(angle) * ring).normalize();
    streak(radius * 0.18, radius * 0.5, 0.22, white);
    streak(radius * 0.5, radius, 0.4, color);
    const tip = new OctahedronGeometry(0.8, 0);
    tip.translate(towards.x * radius, towards.y * radius, towards.z * radius);
    pieces.push(colorize(tip, () => [white.r, white.g, white.b]));
  }
  const bloom = mergeGeometries(pieces);
  if (!bloom) throw new Error("The firework's sparks could not be merged");
  return bloom;
}

/**
 * Shells bursting over the barge. They're drawn unlit, so they stay bright
 * against the sky, and they cast no shadows. At rest every shell is shown in
 * full bloom. While active each one climbs, bursts, droops and fades in turn.
 */
function createFireworks(context: Context): { object: Group; show: Show } {
  const barge = buildingParts(locationById<BuildingLocation>(FIREWORKS_LOCATION));
  const [bargeX, bargeZ] = centreOf(barge.flatMap((part) => resolveOutline(part.footprint)));
  const launch = new Vector3(bargeX, context.surface.heightAt(bargeX, bargeZ) + 2, bargeZ);
  const forward = new Vector3(0, 0, 1);
  const smoke = new Color("#D8D2C4");
  const object = new Group();
  object.name = "fireworks";

  const shells: Shell[] = FIREWORK_BURSTS.map((burst, index) => {
    // A shell's sparks and trail share a material, so they fade as one.
    const material = new MeshBasicMaterial({ vertexColors: true });
    const centre = launch.clone().add(new Vector3(burst.east, burst.up, burst.south));
    const bloom = new Mesh(createBloom(burst.radius, new Color(burst.color)), material);
    bloom.position.copy(centre);

    // One metre long from its origin, so its Z scale is its length.
    const line = new BoxGeometry(0.18, 0.18, 1);
    line.translate(0, 0, 0.5);
    const trail = new Mesh(
      colorize(line, () => [smoke.r, smoke.g, smoke.b]),
      material,
    );
    const path = centre.clone().sub(launch);
    const climb = path.length() * 0.8;
    trail.position.copy(launch);
    trail.quaternion.setFromUnitVectors(forward, path.normalize());
    trail.scale.z = climb;

    object.add(bloom, trail);
    return { bloom, trail, burstY: centre.y, climb, delay: index * FIREWORK_STAGGER };
  });

  // The precincts swap in their own copies of the materials, so they're read from the mesh.
  const setOpacity = (shell: Shell, opacity: number): void => {
    const material = shell.bloom.material as MeshBasicMaterial;
    material.opacity = opacity;
    if (material.transparent !== opacity < 1) {
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    }
  };
  const pose = (shell: Shell, time: number | null): void => {
    const { bloom, trail } = shell;
    // At rest, and before a shell's first launch, it's shown in full bloom.
    const t = time === null || time < 0 ? FIREWORK_LAUNCH + FIREWORK_BURST : time % FIREWORK_CYCLE;
    const bursting = (t - FIREWORK_LAUNCH) / FIREWORK_BURST;
    const fading = Math.min(1, Math.max(0, (bursting - 1) * (FIREWORK_BURST / FIREWORK_FADE)));
    const gone = fading === 1;
    bloom.visible = bursting > 0 && !gone;
    trail.visible = !gone;
    trail.scale.z = shell.climb * Math.min(1, t / FIREWORK_LAUNCH);
    const spread = 1 - (1 - Math.min(1, Math.max(0.02, bursting))) ** 3;
    bloom.scale.setScalar(spread * (1 + 0.08 * fading));
    bloom.position.y = shell.burstY - 7 * fading * fading;
    setOpacity(shell, 1 - fading);
  };

  return {
    object,
    show: createShow((elapsed) => {
      for (const shell of shells) pose(shell, elapsed === null ? null : elapsed - shell.delay);
    }),
  };
}

/**
 * Temporary race activity sits inside the permanent compound organisation.
 * Each team takes a unit in turn, which carries its colours, and parks its
 * transporters in that unit's covered bay. The last unit is the spare.
 */
function placeTeamActivity(context: Context, teams: Instances, guests: Instances): Mesh {
  const truck = createTransporter();
  const support = locationById<BuildingLocation>("team-support-rows");
  const parts = buildingParts(support);
  const bays = parts.filter((part) => part.base === 5);
  for (const [index, part] of bays.entries()) {
    const [x, z] = centreOf(resolveOutline(part.footprint));
    const team = TEAMS[index];
    const tint = team ? transporterColour(team) : undefined;
    for (const offset of [-6, 6]) {
      teams.add(truck, { x: x + offset, z, y: context.surface.heightAt(x, z), tint });
    }
  }
  const units = parts
    .filter((part) => part.model?.file === "racing/paddock-support-unit.glb")
    .map((part) => {
      const bounds = boundsOf(resolveOutline(part.footprint));
      const x = (bounds.minX + bounds.maxX) / 2;
      const z = (bounds.minZ + bounds.maxZ) / 2;
      return {
        x,
        z,
        width: bounds.maxX - bounds.minX,
        depth: bounds.maxZ - bounds.minZ,
        ground: context.surface.heightAt(x, z),
      };
    });
  for (const x of [-225, -170]) {
    placeModel(context, guests, MARQUEE, { x, z: -93, scale: 0.65 });
  }
  for (let index = 0; index < 36; index += 1) {
    const x = -243 + (index % 12) * 8;
    const z = -124 + Math.floor(index / 12) * 5;
    guests.add(PERSON, { x, z, y: context.surface.heightAt(x, z) + 0.3, yaw: personYaw(x, z) });
  }
  return createTeamBranding(units);
}

/** Training equipment and display cars stay with their external campuses. */
function placeAcademyActivity(context: Context, instances: Instances, car: BufferGeometry): void {
  const court = locationById<AreaLocation>("vehicle-display-courts");
  const [a, b, , d] = court.footprint;
  const yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let bay = 0; bay < 6; bay += 1) {
    const t = (bay + 0.5) / 6;
    const x = a[0] + t * (b[0] - a[0]) + (d[0] - a[0]) / 2;
    const z = a[1] + t * (b[1] - a[1]) + (d[1] - a[1]) / 2;
    instances.add(car, {
      x,
      z,
      yaw,
      y: context.surface.heightAt(x, z) + 0.3,
      tint: CAR_PAINTS[bay],
    });
  }
  const cone = colorize(new ConeGeometry(0.5, 1.1, 6).translate(0, 0.55, 0), () => [1, 0.35, 0.05]);
  const course = locationById<TrackLocation>("academy-handling-course");
  for (const [x, z] of course.branches?.[0] ?? []) {
    for (const side of [-1, 1]) {
      instances.add(cone, { x, z: z + side * 4, y: context.surface.heightAt(x, z) + 0.35 });
    }
  }
  const pad = boundsOf(resolveOutline(locationById<AreaLocation>("skid-pan").footprint));
  const padX = (pad.minX + pad.maxX) / 2;
  const padZ = (pad.minZ + pad.maxZ) / 2;
  const padY = context.surface.heightAt(padX, padZ);
  for (let step = 0; step < 12; step += 1) {
    const angle = (step / 12) * TWO_PI;
    instances.add(cone, {
      x: padX + Math.cos(angle) * 20,
      z: padZ + Math.sin(angle) * 20,
      y: padY + 0.35,
    });
  }
  for (const [index, angle] of [0.6, 3.9].entries()) {
    instances.add(car, {
      x: padX + Math.cos(angle) * 30,
      z: padZ + Math.sin(angle) * 30,
      y: padY + 0.3,
      yaw: 0.9 - angle,
      tint: CAR_PAINTS[5 - index],
    });
  }
}

function grandstandFanWalk() {
  const walk = locationById<TrackLocation>("grandstand-fan-walk");
  // The main path is the avenue east of the plaza, which is where its label belongs.
  const [[, axisZ], [endX]] = walk.path;
  const [plazaAxis, concourse] = walk.branches ?? [];
  if (!plazaAxis || !concourse) throw new Error("The Grandstand Fan Walk needs both branches");
  const [[startX]] = plazaAxis;
  const [[concourseX, northZ], [, southZ]] = concourse;
  return { startX, endX, axisZ, concourseX, northZ, southZ, halfWidth: walk.width / 2 };
}

/** Olive trees either side of the avenue and along the concourse's outer edge. */
function plantFanWalk(context: Context, instances: Instances): void {
  const { startX, endX, axisZ, concourseX, northZ, southZ, halfWidth } = grandstandFanWalk();
  const setback = halfWidth + 6.5;
  for (let x = startX + 20; x < endX - setback; x += 24) {
    for (const side of [-1, 1]) {
      const z = axisZ + side * setback;
      if (!context.built.isTaken(x, z)) placeTree(context, instances, "olive", x, z);
    }
  }
  for (let z = northZ + 10; z < southZ; z += 28) {
    const x = concourseX - setback;
    if (!context.built.isTaken(x, z)) placeTree(context, instances, "olive", x, z);
  }
}

/** Permanent team-colour banners, so the walk reads as a route on any day. */
function placeFanWalkBanners(context: Context, instances: Instances): void {
  const { startX, endX, axisZ, halfWidth } = grandstandFanWalk();
  const banner = colorize(openBox(0.25, 7, 1.6, 5, 0), () => [1, 1, 1]);
  const colors = [new Color("#004272"), new Color("#00678C")];
  let index = 0;
  for (let x = startX + 32; x < endX - halfWidth; x += 24) {
    for (const side of [-1, 1]) {
      const z = axisZ + side * (halfWidth + 2);
      instances.add(banner, {
        x,
        z,
        y: context.surface.heightAt(x, z),
        tint: colors[index % colors.length],
      });
    }
    index += 1;
  }
}

/** Race weekend stalls and crowds along the avenue and concourse. */
function placeFanWalkCrowd(context: Context, instances: Instances): void {
  const { startX, endX, axisZ, concourseX, northZ, southZ, halfWidth } = grandstandFanWalk();
  const stallSetback = halfWidth + 15;
  for (let x = -795; x < endX - stallSetback; x += 16) {
    for (const side of [-1, 1]) {
      const z = axisZ + side * stallSetback;
      if (!context.built.isTaken(x, z)) placeModel(context, instances, FOOD_STALL, { x, z });
    }
  }
  for (let z = northZ + 8; z < southZ; z += 22) {
    const x = concourseX - stallSetback;
    if (Math.abs(z - axisZ) > stallSetback && !context.built.isTaken(x, z)) {
      placeModel(context, instances, FOOD_STALL, { x, z, yaw: Math.PI / 2 });
    }
  }
  const crowd = Math.round(320 * context.density);
  for (let index = 0; index < crowd; index += 1) {
    const onAvenue = index % 3 !== 0;
    const across = (context.random() - 0.5) * halfWidth * 1.8;
    const along = context.random();
    const x = onAvenue ? startX + along * (endX - startX) : concourseX + across;
    const z = onAvenue ? axisZ + across : northZ + along * (southZ - northZ);
    instances.add(PERSON, { x, z, y: context.surface.heightAt(x, z) + 0.3, yaw: personYaw(x, z) });
  }
}

/** Show trucks at the docks and guest marquees on the lake forecourt. */
function placeExpoActivity(context: Context, instances: Instances): void {
  const truck = createTransporter();
  const yard = boundsOf(resolveOutline(locationById<AreaLocation>("expo-loading-yard").footprint));
  const x = (yard.minX + yard.maxX) / 2;
  for (let z = yard.minZ + 18; z < yard.maxZ; z += 36) {
    instances.add(truck, { x, z, yaw: -Math.PI / 2, y: context.surface.heightAt(x, z) + 0.3 });
  }
  const forecourt = boundsOf(
    resolveOutline(locationById<AreaLocation>("expo-forecourt").footprint),
  );
  const courtX = (forecourt.minX + forecourt.maxX) / 2;
  for (const z of [forecourt.minZ + 22, forecourt.maxZ - 22]) {
    placeModel(context, instances, MARQUEE, { x: courtX, z, scale: 0.7, sink: -0.3 });
  }
}

/** A vine row piece, long axis on X, without the faces nobody sees. */
function createVineRow(): BufferGeometry {
  const box = new BoxGeometry(VINE_PIECE, 1.5, 1.1);
  const index = box.getIndex();
  if (index) {
    // A box's faces are stored in order: the top, then the two long sides.
    box.setIndex([...index.array.slice(12, 18), ...index.array.slice(24, 36)]);
  }
  box.translate(0, 0.85, 0);
  return colorize(box, (y) => (y > 1 ? [0.38, 0.52, 0.22] : [0.27, 0.38, 0.17]));
}

/** A tent as a four-sided pyramid, which takes the tint. */
function createTent(): BufferGeometry {
  const tent = new ConeGeometry(2.3, 2, 4, 1, true);
  tent.rotateY(Math.PI / 4);
  tent.translate(0, 1, 0);
  return colorize(tent.toNonIndexed(), (y) => (y > 1.5 ? [0.82, 0.82, 0.8] : [1, 1, 1]));
}

function createCaravan(): BufferGeometry {
  return colorize(openBox(2.3, 2.2, 5.6, 1.5, 0), (y) =>
    y > 2 ? [0.97, 0.97, 0.95] : [0.78, 0.8, 0.82],
  );
}

/** A spectator in three triangles, since a bank holds thousands. Takes the tint. */
function createSpectator(): BufferGeometry {
  const figure = new ConeGeometry(0.42, 1.7, 3, 1, true);
  figure.translate(0, 0.85, 0);
  return colorize(figure.toNonIndexed(), () => [1, 1, 1]);
}

/** A spectator seen from afar. Close up, the crowd figures replace it. */
const SPECTATOR = createSpectator();

function insideLand(zone: ResolvedZone, x: number, z: number, inset: number): boolean {
  return signedDistance(x, z, zone.outline) < -inset;
}

/** Rows of gums along the edges of the fields, vineyards and event fields. */
function plantFieldEdges(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  const boundary = SITE_SIZE / 2 - 25;
  for (const zone of landUseZones("wheat", "vineyard", "overflow-parking", "camping")) {
    const species = zone.use === "camping" ? "pine" : "gum";
    zone.outline.forEach(([ax, az], index) => {
      const [bx, bz] = zone.outline[(index + 1) % zone.outline.length];
      // The site's own edge already has its row of trees.
      const alongSiteEdge =
        (ax === bx && Math.abs(ax) > boundary) || (az === bz && Math.abs(az) > boundary);
      if (alongSiteEdge) {
        return;
      }
      const length = Math.hypot(bx - ax, bz - az);
      for (let along = WINDBREAK_SPACING / 2; along < length; along += WINDBREAK_SPACING) {
        const x = ax + ((bx - ax) * along) / length + random() * 4 - 2;
        const z = az + ((bz - az) * along) / length + random() * 4 - 2;
        if (!occupied.isTaken(x, z) && random() < context.density) {
          placeTree(context, instances, species, x, z);
        }
      }
    });
  }
}

/** Trellised vine rows across each vineyard block, following the slope. */
function plantVineyards(context: Context, instances: Instances): void {
  const { occupied, surface } = context;
  const vine = createVineRow();
  const reach = VINE_PIECE / 2;
  for (const zone of landUseZones("vineyard")) {
    const { minX, minZ, maxX, maxZ } = zone.bounds;
    const alongX = hash2(zone.index, 2, 72) < 0.5;
    const [acrossMin, acrossMax] = alongX ? [minZ, maxZ] : [minX, maxX];
    const [alongMin, alongMax] = alongX ? [minX, maxX] : [minZ, maxZ];
    const step = VINE_ROW_SPACING / Math.max(0.45, context.density);
    for (let row = 0, across = acrossMin + 8; across < acrossMax - 8; row += 1, across += step) {
      if (row % VINE_ROWS_PER_TRACK >= VINE_ROWS_PER_TRACK - 2) {
        continue;
      }
      const shade = 0.9 + 0.2 * hash2(row, zone.index, 73);
      const tint = new Color(shade, shade, shade);
      for (let along = alongMin + 8 + reach; along < alongMax - 8 - reach; along += VINE_PIECE) {
        const [x, z] = alongX ? [along, across] : [across, along];
        const [dx, dz] = alongX ? [reach, 0] : [0, reach];
        if (
          !insideLand(zone, x, z, 6) ||
          occupied.isTaken(x, z) ||
          occupied.isTaken(x + dx, z + dz) ||
          occupied.isTaken(x - dx, z - dz)
        ) {
          continue;
        }
        const rise = surface.heightAt(x + dx, z + dz) - surface.heightAt(x - dx, z - dz);
        instances.add(vine, {
          x,
          y: surface.heightAt(x, z),
          z,
          yaw: alongX ? 0 : -Math.PI / 2,
          tilt: Math.atan2(rise, VINE_PIECE),
          tint,
        });
      }
    }
  }
}

/** Olive trees between the rows of each car park, on the lanes without light poles. */
function plantCarParkShade(context: Context, instances: Instances): void {
  for (const park of carParks()) {
    for (const block of parkingBlocks(park).filter(({ lane }) => lane % POLE_LANES !== 1)) {
      const first = 18 + (block.lane % 2) * 24;
      for (let along = first; along < block.to - block.from - 6; along += 48) {
        if (context.random() < context.density) {
          const [x, z] = pointInBlock(block, BLOCK_DEPTH / 2, along);
          placeTree(context, instances, "olive", x, z);
        }
      }
    }
  }
}

/** Trees around the hotels, halls, residences and campuses, clear of their walls. */
function plantPrecinctGardens(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  for (const id of LANDSCAPED_BUILDINGS) {
    for (const part of buildingParts(locationById<BuildingLocation>(id))) {
      const ring = outsetPolygon(resolveOutline(part.footprint), 18);
      ring.forEach(([ax, az], index) => {
        const [bx, bz] = ring[(index + 1) % ring.length];
        const length = Math.hypot(bx - ax, bz - az);
        for (let along = 8; along < length; along += 20) {
          const x = ax + ((bx - ax) * along) / length + random() * 8 - 4;
          const z = az + ((bz - az) * along) / length + random() * 8 - 4;
          if (!occupied.isTaken(x, z) && !landUseAt(x, z) && random() < 0.7 * context.density) {
            placeTree(context, instances, random() < 0.7 ? "olive" : "pine", x, z);
          }
        }
      });
    }
  }
}

/** A row of trees each side of the smaller roads and the walks. */
function plantRoadsides(context: Context, instances: Instances, footprints: Occupancy): void {
  for (const id of TREE_LINED_ROADS) {
    const road = locationById<TrackLocation>(id);
    const offset = road.width / 2 + 9;
    for (const { x, z, dirX, dirZ } of samplePath(resolvePath(road.path, false), 34, false)) {
      for (const side of [-1, 1]) {
        const treeX = x - dirZ * offset * side;
        const treeZ = z + dirX * offset * side;
        if (
          insideSite(treeX, treeZ) &&
          !footprints.isTaken(treeX, treeZ) &&
          context.random() < context.density
        ) {
          placeTree(context, instances, "olive", treeX, treeZ);
        }
      }
    }
  }
}

/** Clumps of trees on the open ground outside the circuit that has no other use. */
function plantParkland(context: Context, instances: Instances): void {
  const { random, occupied } = context;
  const circuit = locationById<TrackLocation>("circuit");
  const infield = samplePath(resolvePath(circuit.path, true), 20, true).map(
    ({ x, z }): Point => [x, z],
  );
  const reach = SITE_SIZE / 2 - 15;
  for (let attempt = 0; attempt < 3600; attempt += 1) {
    const x = random() * reach * 2 - reach;
    const z = random() * reach * 2 - reach;
    if (
      noise2(x, z, 150, 41) < 0.12 ||
      occupied.isTaken(x, z) ||
      landUseAt(x, z) ||
      signedDistance(x, z, infield) < 0 ||
      random() > context.density
    ) {
      continue;
    }
    placeTree(context, instances, pickOne(random, ["gum", "pine", "pine", "olive"] as const), x, z);
  }
}

/** A works vehicle inside each gate, and a farm one at each vineyard. */
function parkServiceVehicles(
  context: Context,
  instances: Instances,
  car: BufferGeometry,
  footprints: Occupancy,
): void {
  const { surface } = context;
  const paint = new Color("#F4F4F0");
  const park = (x: number, z: number, yaw: number): void => {
    if (!footprints.isTaken(x, z)) {
      instances.add(car, { x, z, yaw, y: surface.heightAt(x, z), tint: paint });
    }
  };
  for (const gate of layout.locations) {
    if (gate.type !== "gate") {
      continue;
    }
    // People arrive from the way the gate faces, so the site is behind it.
    const [x, z] = gate.position;
    const sideways = gate.facing === "east" || gate.facing === "west";
    const inward = gate.facing === "west" || gate.facing === "north" ? 1 : -1;
    park(
      x + (sideways ? inward * 20 : 12),
      z + (sideways ? 12 : inward * 20),
      sideways ? Math.PI / 2 : 0,
    );
  }
  for (const { bounds } of landUseZones("vineyard")) {
    park(bounds.minX + 12, bounds.minZ + 4, Math.PI / 2);
  }
}

/** Cars in rows on the overflow fields, as full as the car parks on a race day. */
function parkOverflow(context: Context, instances: Instances, car: BufferGeometry): void {
  const nobody: Parking = { instances, share: 0 };
  const share = RACE_PARKING * context.density;
  for (const zone of landUseZones("overflow-parking")) {
    parkCars(context, car, { footprint: zone.outline }, nobody, [{ instances, share }], 0);
  }
}

/** Tents and caravans in rows of pitches, each with its car, and grass lanes between. */
function pitchCampsites(context: Context, instances: Instances, car: BufferGeometry): void {
  const { random, occupied, surface } = context;
  const tent = createTent();
  const caravan = createCaravan();
  for (const zone of landUseZones("camping")) {
    const { minX, minZ, maxX, maxZ } = zone.bounds;
    for (let row = 0, x = minX + 14; x < maxX - 14; row += 1, x += PITCH_DEPTH) {
      if (row % 3 === 2) {
        continue;
      }
      for (let z = minZ + 14; z < maxZ - 14; z += PITCH_LENGTH) {
        const busy = 0.45 + 0.55 * noise2(x, z, 140, 42);
        if (occupied.isTaken(x, z) || !insideLand(zone, x, z, 10) || random() > 0.6 + busy) {
          continue;
        }
        if (random() > context.density) {
          continue;
        }
        const y = surface.heightAt(x, z);
        const shelterZ = z - 1.8 + random() * 0.8;
        if (random() < 0.25) {
          instances.add(caravan, { x, y, z: shelterZ, yaw: Math.PI / 2 + random() * 0.2 - 0.1 });
        } else {
          instances.add(tent, {
            x: x + random() * 1.5 - 0.75,
            y,
            z: shelterZ,
            yaw: random() * TWO_PI,
            scale: 0.8 + random() * 0.5,
            tint: pickOne(random, TENT_PAINTS),
          });
        }
        instances.add(car, {
          x: x + random() - 0.5,
          y,
          z: z + 2.9,
          yaw: Math.PI / 2 + random() * 0.3 - 0.15,
          tint: pickOne(random, CAR_PAINTS),
        });
      }
    }
  }
}

/** Spectators standing on the general admission banks, thicker in some places. */
function crowdBanks(context: Context, instances: Instances, track: readonly PathSample[]): void {
  const { random } = context;
  for (const bank of layout.locations) {
    if (bank.type !== "building" || !bank.id.startsWith("ga-bank-")) {
      continue;
    }
    const outline = buildingParts(bank).flatMap((part) => resolveOutline(part.footprint));
    const { minX, minZ, maxX, maxZ } = boundsOf(outline);
    // A bank is raised from the ground at its centre, as buildings are.
    const [centreX, centreZ] = centreOf(outline);
    const y = heightAt(centreX, centreZ) + (bank.height ?? 0);
    // Spectators face the nearest stretch of track.
    const reach = Math.max(maxX - minX, maxZ - minZ) + 200;
    const nearby = track.filter(
      (sample) => Math.abs(sample.x - centreX) < reach && Math.abs(sample.z - centreZ) < reach,
    );
    const facingTrack = (x: number, z: number): number => {
      let best = nearby[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const sample of nearby) {
        const distance = (sample.x - x) ** 2 + (sample.z - z) ** 2;
        if (distance < bestDistance) {
          best = sample;
          bestDistance = distance;
        }
      }
      return best ? Math.atan2(best.x - x, best.z - z) : 0;
    };
    const tries = ((maxX - minX) * (maxZ - minZ) * context.density) / BANK_AREA_PER_PERSON;
    for (let attempt = 0; attempt < tries; attempt += 1) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      const packed = 0.35 + 0.65 * (0.5 + 0.5 * noise2(x, z, 30, 43));
      if (signedDistance(x, z, outline) < -1.2 && random() < packed) {
        instances.add(SPECTATOR, {
          x,
          y,
          z,
          yaw: personYaw(x, z, facingTrack(x, z)),
          tint: pickOne(random, SHIRT_PAINTS),
        });
      }
    }
  }
}

/**
 * A fan village in each of its zones: a big screen with a bleacher and a
 * crowd in front of it, a street of food stalls, and hospitality marquees.
 */
function placeFanVillages(context: Context, structures: Instances, crowd: Instances): void {
  const { random, occupied, surface } = context;
  for (const zone of landUseZones("fan-village")) {
    const { minX, minZ, maxX, maxZ } = zone.bounds;
    const alongX = maxX - minX >= maxZ - minZ;
    const length = alongX ? maxX - minX : maxZ - minZ;
    const width = alongX ? maxZ - minZ : maxX - minX;
    /** A point `along` the zone from its screen end, and `across` from its centre line. */
    const at = (along: number, across: number): [number, number] =>
      alongX
        ? [minX + along, (minZ + maxZ) / 2 + across]
        : [(minX + maxX) / 2 + across, minZ + along];
    /** Yaw that turns a model's front along the zone, or across it. */
    const facing = (along: number, across: number): number =>
      alongX ? Math.atan2(along, across) : Math.atan2(across, along);
    const place = (file: string, along: number, across: number, yaw: number): void => {
      const [x, z] = at(along, across);
      if (!occupied.isTaken(x, z)) {
        placeModel(context, structures, file, { x, z, yaw });
      }
    };

    place(BIG_SCREEN, 8, 0, facing(1, 0));
    const lawn = Math.min(48, length * 0.3);
    place(BLEACHER, 8 + lawn + 8, 0, facing(-1, 0));
    const watching = Math.round(lawn * (width - 8) * 0.12 * context.density);
    for (let person = 0; person < watching; person += 1) {
      const [x, z] = at(14 + random() * (lawn - 8), (random() - 0.5) * (width - 8));
      if (!occupied.isTaken(x, z)) {
        crowd.add(SPECTATOR, {
          x,
          z,
          y: surface.heightAt(x, z),
          // Watching the screen at the lawn's near end.
          yaw: personYaw(x, z, facing(-1, 0)),
          tint: pickOne(random, SHIRT_PAINTS),
        });
      }
    }

    const streetFrom = lawn + 30;
    const streetTo = length - 42;
    for (let along = streetFrom; along < streetTo; along += 9) {
      for (const side of [-1, 1]) {
        place(FOOD_STALL, along, side * (width / 2 - 6), facing(0, -side));
      }
    }
    const strolling = Math.round((streetTo - streetFrom) * 1.2 * context.density);
    for (let person = 0; person < strolling; person += 1) {
      const [x, z] = at(
        streetFrom + random() * (streetTo - streetFrom),
        (random() - 0.5) * (width - 22),
      );
      if (!occupied.isTaken(x, z)) {
        crowd.add(SPECTATOR, {
          x,
          z,
          y: surface.heightAt(x, z),
          yaw: personYaw(x, z),
          tint: pickOne(random, SHIRT_PAINTS),
        });
      }
    }

    // Marquees are 30 m long. They stand side by side where there's room.
    const marqueeYaw = alongX ? 0 : Math.PI / 2;
    if (width >= 70) {
      place(MARQUEE, length - 22, -width / 4, marqueeYaw + Math.PI / 2);
      place(MARQUEE, length - 22, width / 4, marqueeYaw + Math.PI / 2);
    } else {
      place(MARQUEE, length - 22, 0, marqueeYaw);
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
  /** The fireworks over the barge, and the fountain show. */
  readonly fireworks: Show;
  readonly fountain: Show;
  /** Switches distant trees to simple shapes. */
  readonly trees: TreeLevels;
}

function addHidden(group: Group, meshes: readonly Object3D[]): readonly Object3D[] {
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

  const notPlanted = layout.locations.filter(
    (location) => !(location.type === "area" && location.planting),
  );
  const context: Context = {
    surface,
    density: quality.sceneryDensity,
    model,
    occupied: siteOccupancy(),
    built: occupancyOf(notPlanted, 5),
    random: seededRandom(71),
  };
  // The land-use rules draw from their own stream, so adding to them leaves
  // the rest of the scenery where it was.
  const land: Context = { ...context, random: seededRandom(72) };
  /** Ground with anything on it, to within a couple of metres. */
  const footprints = occupancyOf(layout.locations, 2);

  const trees = new Instances();
  const farTrees = new Instances();
  plantSiteHedge(context, trees);
  plantAvenues(context, trees);
  plantAreas(context, trees);
  plantFanWalk(context, trees);
  plantFarmland(context, trees);
  scatterUnderbrush(context, trees);
  plantWindbreaks(context, trees, farTrees, createFarTree());
  placeFarmsteads(context, trees);
  plantFieldEdges(land, trees);
  plantCarParkShade(land, trees);
  plantPrecinctGardens(land, trees);
  plantRoadsides(land, trees, footprints);
  plantParkland(land, trees);
  const vines = new Instances();
  plantVineyards(land, vines);

  // The quay draws from its own stream too, and adds its trees to the rest.
  const waterfront = new Instances();
  dressWaterfront({ ...context, random: seededRandom(73) }, trees, waterfront);
  const setting = new Group();
  setting.name = "scenery";
  const treeModels = new Set(
    Object.values(TREES)
      .flat()
      .map(model)
      .filter((geometry) => geometry !== undefined),
  );
  const farVersions = new Map<BufferGeometry, BufferGeometry>();
  const farVersion = (geometry: BufferGeometry): BufferGeometry | undefined => {
    if (!treeModels.has(geometry)) {
      return undefined;
    }
    let far = farVersions.get(geometry);
    if (!far) {
      far = farVersionOf(geometry);
      farVersions.set(geometry, far);
    }
    return far;
  };
  const levels: TreeLevel[] = [];
  const figures = PEOPLE.map(model).filter((geometry) => geometry !== undefined);
  // Without the figures, people stay as simple shapes however close the camera is.
  const figuresFor = (geometry: BufferGeometry): readonly BufferGeometry[] | undefined =>
    geometry === SPECTATOR || geometry === PERSON ? figures : undefined;
  setting.add(
    ...trees.build(true, farVersion, levels),
    ...farTrees.build(false),
    ...vines.build(false),
  );

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
  const yardTrucks = new Instances();
  const raceYardTrucks = new Instances();
  parkYardTrucks(context, yardTrucks, raceYardTrucks);
  group("racing").add(...trackside.build(true), ...yardTrucks.build(true));

  placeLakeFeatures(context, waterfront);
  const display = createFireworks(context);
  const fountain = createFountainShow(context);
  group("hospitality").add(
    ...waterfront.build(true, undefined, levels, figuresFor),
    display.object,
    fountain.object,
  );

  const transport = new Instances();
  placeLightPoles(context, transport);
  placeCheckpointBooms(context, transport);
  placeAircraft(context, transport);
  placeShuttles(context, transport, 0, 2);
  group("transport").add(...transport.build(true));

  const car = createCar();
  const academy = new Instances();
  placeAcademyActivity(context, academy, car);
  group("academy").add(...academy.build(true));
  const banners = new Instances();
  placeFanWalkBanners(context, banners);
  group("conference").add(...banners.build(true));
  const parks = carParks();

  // Staff and residents' cars, and the works vehicles, are there every day.
  const staffCars = new Instances();
  const raceCars = new Instances();
  const conferenceCars = new Instances();
  for (const park of parks) {
    const conference = CONFERENCE_CAR_PARKS.includes(park.id) ? CONFERENCE_PARKING : 0;
    parkCars(
      land,
      car,
      park,
      { instances: staffCars, share: STAFF_PARKING * quality.sceneryDensity },
      [
        { instances: raceCars, share: RACE_PARKING * quality.sceneryDensity },
        { instances: conferenceCars, share: conference * quality.sceneryDensity },
      ],
    );
  }
  parkServiceVehicles(land, staffCars, car, footprints);
  group("transport").add(...staffCars.build(false));

  parkOverflow(land, raceCars, car);
  const raceShuttles = new Instances();
  placeShuttles(context, raceShuttles, 2, 8);
  const raceTrackside = new Instances();
  placeRaceGrid(context, raceTrackside);
  placeFoodStalls(context, raceTrackside);
  placeFanWalkCrowd(context, raceTrackside);
  const raceGuests = new Instances();
  const teamBranding = placeTeamActivity(context, raceTrackside, raceGuests);
  // Small and many, so they're drawn without shadows, as the parked cars are.
  const raceCrowds = new Instances();
  crowdBanks(
    land,
    raceCrowds,
    samplePath(resolvePath(locationById<TrackLocation>("circuit").path, true), 10, true),
  );
  pitchCampsites(land, raceCrowds, car);
  placeFanVillages(land, raceTrackside, raceCrowds);

  const conferenceShuttles = new Instances();
  placeShuttles(context, conferenceShuttles, 2, 3);
  const conferenceTents = new Instances();
  placeMarquees(context, conferenceTents);
  placeExpoActivity(context, conferenceTents);

  const events = new Map<string, readonly Object3D[]>([
    [
      "race",
      [
        ...addHidden(group("transport"), raceCars.build(false)),
        ...addHidden(group("transport"), raceShuttles.build(true)),
        ...addHidden(group("racing"), raceTrackside.build(true, undefined, levels, figuresFor)),
        ...addHidden(group("racing"), raceYardTrucks.build(true)),
        ...addHidden(group("racing"), [teamBranding]),
        ...addHidden(group("racing"), raceCrowds.build(false, undefined, levels, figuresFor)),
        ...addHidden(group("hospitality"), raceGuests.build(true, undefined, levels, figuresFor)),
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

  for (const [category, shadows] of createContactShadows(surface)) {
    group(category).add(shadows);
  }

  return {
    setting,
    precincts,
    events,
    fireworks: display.show,
    fountain: fountain.show,
    trees: new TreeLevels(levels),
  };
}
