import type { BufferGeometry } from "three";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from "three";
import { layout } from "../layout/locations.ts";
import type { Race } from "../layout/race.ts";
import { circuitRace } from "../layout/race.ts";
import type { Route } from "../layout/route.ts";
import { pointAt, routeOf } from "../layout/route.ts";
import { MAP_HALF_SIZE } from "../site.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { trackSurface } from "./ribbons.ts";
import { seatVehicle, tyreContacts, vehicleSlope } from "./vehicle-pose.ts";

/**
 * The race cars, as seconds ahead of the first, which a lap of the circuit
 * rides with: a pair ahead of it, a pack behind, and two pairs further back. Because
 * every car brakes for the same bends, they close up into them and string out
 * along the straights.
 */
const RACE_GAPS = [0, 1.1, 0.5, -0.55, -1.25, -1.8, -3.2, -3.8, -5.9, -6.5];
/** How far each car runs off the racing line, in metres, so they don't follow in single file. */
const RACE_BIAS = [0, 0.6, -0.8, 0.9, -0.5, 0.7, -0.9, 0.4, -0.6, 0.8];
/** A car's heading is measured over this distance along its line, in metres. */
const HEADING_REACH = 1.5;
/** Shuttles running round the ring road. */
const SHUTTLES = 3;
/** About 40 km/h. */
const SHUTTLE_SPEED = 11;
/** Shuttles keep to the left-hand lane, this far from the road's middle. */
const SHUTTLE_LANE = -2.6;
/** Traffic on the N7: about 110 km/h, in the two lanes of each carriageway. */
const HIGHWAY_SPEED = 30;
const HIGHWAY_LANES = [-6.4, -10.2];
/** Cars in each direction over the stretch of the N7 that runs past the site. */
const HIGHWAY_CARS = 16;
/** The stretch reaches this far beyond the map, where the haze hides cars coming and going. */
const HIGHWAY_MARGIN = 2600;
const HIGHWAY_PAINTS = ["#E8ECEF", "#C9D0D6", "#7C858E", "#22303C", "#8A2B2B", "#004272"];

/** The view with racing in it. */
const RACE_MODE = "race";

/** The race's own time, which a lap of the circuit takes over so the cars keep pace with the camera. */
export interface RaceClock {
  /** Seconds into the race. */
  seconds: number;
  /** Set while something else is moving the clock on, so it stops following real time. */
  held: boolean;
}

const placer = new Object3D();

/** A repeatable number from 0 to 1 for a whole number. */
function scatter(index: number): number {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function instancedVehicles(geometry: BufferGeometry, tints: readonly Color[]): InstancedMesh {
  const mesh = new InstancedMesh(
    geometry,
    new MeshLambertMaterial({ vertexColors: true }),
    tints.length,
  );
  for (const [index, tint] of tints.entries()) {
    mesh.setColorAt(index, tint);
  }
  // Moving things stay out of the shadow pass, which only runs when the view settles.
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

/** One vehicle on a stretch of a route: where it starts, and its lane. */
interface Slot {
  /** Metres along the stretch at time 0. */
  readonly offset: number;
  /** Metres from the road's middle, towards `(-dirZ, dirX)`: the right of the route's direction. */
  readonly lane: number;
  /** Travels against the route's direction. */
  readonly reverse?: boolean;
}

/** Vehicles that drive along a stretch of a route at a steady speed, drawn in one call. */
class Convoy {
  readonly mesh: InstancedMesh;

  constructor(
    geometry: BufferGeometry,
    private readonly route: Route,
    /** The stretch they drive, in metres along the route. They go round it again from its start. */
    private readonly stretch: { from: number; length: number },
    private readonly speed: number,
    private readonly surface: Pick<GroundSurface, "heightAt">,
    private readonly lift: number,
    private readonly slots: readonly Slot[],
    tints: readonly Color[],
  ) {
    this.mesh = instancedVehicles(geometry, tints);
  }

  /** Puts every vehicle where it is at `seconds`. */
  place(seconds: number): void {
    const { from, length } = this.stretch;
    for (const [index, slot] of this.slots.entries()) {
      const travelled = (slot.offset + seconds * this.speed) % length;
      const point = pointAt(this.route, from + (slot.reverse ? length - travelled : travelled));
      const facing = slot.reverse ? -1 : 1;
      const x = point.x - point.dirZ * slot.lane;
      const z = point.z + point.dirX * slot.lane;
      placer.position.set(x, this.surface.heightAt(x, z) + this.lift, z);
      const yaw = Math.atan2(point.dirX * facing, point.dirZ * facing);
      const slope = vehicleSlope((px, pz) => this.surface.heightAt(px, pz), x, z, yaw);
      placer.rotation.set(slope.pitch, yaw, slope.tilt, "YXZ");
      placer.updateMatrix();
      this.mesh.setMatrixAt(index, placer.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** The race cars: each follows the racing line at the pace the circuit allows. */
class Pack {
  readonly mesh: InstancedMesh;
  private readonly contacts;

  constructor(
    geometry: BufferGeometry,
    private readonly route: Route,
    private readonly race: Race,
    private readonly surface: Pick<GroundSurface, "heightAt">,
    tints: readonly Color[],
  ) {
    this.contacts = tyreContacts(geometry);
    this.mesh = instancedVehicles(geometry, tints);
  }

  /** Puts every car where it is `seconds` into the race. */
  place(seconds: number): void {
    const height = (x: number, z: number): number => this.surface.heightAt(x, z);
    for (const [index, gap] of RACE_GAPS.entries()) {
      const distance = this.race.distanceAt(seconds + gap);
      const [x, z] = this.onLine(distance, RACE_BIAS[index]);
      const [aheadX, aheadZ] = this.onLine(distance + HEADING_REACH, RACE_BIAS[index]);
      const [behindX, behindZ] = this.onLine(distance - HEADING_REACH, RACE_BIAS[index]);
      placer.position.set(x, height(x, z), z);
      const yaw = Math.atan2(aheadX - behindX, aheadZ - behindZ);
      const slope = vehicleSlope(height, x, z, yaw);
      placer.rotation.set(slope.pitch, yaw, slope.tilt, "YXZ");
      seatVehicle(placer, height, this.contacts);
      placer.updateMatrix();
      this.mesh.setMatrixAt(index, placer.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private onLine(distance: number, bias: number): [x: number, z: number] {
    const point = pointAt(this.route, distance);
    const sideways = this.race.sidewaysAt(distance, bias);
    return [point.x - point.dirZ * sideways, point.z + point.dirX * sideways];
  }
}

/**
 * What moves on the map. Shuttles circle the ring road, traffic runs along the
 * N7 and the water ripples in every view, so the site never looks frozen. On a
 * race weekend the race cars lap the circuit as well. Under reduced motion
 * none of it is shown, and the map only draws when something changes.
 */
export class Traffic {
  /** Add to the racing precinct, so it fades with it. */
  readonly raceCars: InstancedMesh;
  /** Add to the transport precinct. */
  readonly shuttles: InstancedMesh;
  /** Add to the transport precinct. */
  readonly highway: InstancedMesh;
  /** The race's time. A lap of the circuit holds it and moves it on at the ride's pace. */
  readonly raceClock: RaceClock = { seconds: 0, held: false };

  private readonly cars: Pack;
  private readonly buses: Convoy;
  private readonly motorists: Convoy;
  private readonly moving = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private racing = false;
  private startedAt: number | null = null;
  private lastTime: number | null = null;

  constructor(
    raceCar: BufferGeometry,
    shuttle: BufferGeometry,
    roadCar: BufferGeometry,
    surface: GroundSurface,
  ) {
    const carTints = RACE_GAPS.map((_, index) =>
      new Color().setHSL(index / RACE_GAPS.length, 0.55, 0.55),
    );
    const circuit = layout.locations.find((location) => location.id === "circuit");
    if (circuit?.type !== "track") throw new Error("Missing circuit");
    this.cars = new Pack(
      raceCar,
      routeOf("circuit"),
      circuitRace(),
      trackSurface(circuit, surface),
      carTints,
    );

    const ringRoad = routeOf("ring-road");
    this.buses = new Convoy(
      shuttle,
      ringRoad,
      { from: 0, length: ringRoad.length },
      SHUTTLE_SPEED,
      surface,
      0.3,
      Array.from({ length: SHUTTLES }, (_, index) => ({
        offset: (index * ringRoad.length) / SHUTTLES,
        lane: SHUTTLE_LANE,
      })),
      Array.from({ length: SHUTTLES }, () => new Color(1, 1, 1)),
    );

    const highway = routeOf("n7");
    const reach = MAP_HALF_SIZE + HIGHWAY_MARGIN;
    const inReach = highway.samples.filter((sample) => Math.abs(sample.z) <= reach);
    const from = inReach[0]?.distance ?? 0;
    const length = (inReach.at(-1)?.distance ?? highway.length) - from;
    const motorists: Slot[] = [];
    for (let index = 0; index < HIGHWAY_CARS * 2; index += 1) {
      const reverse = index % 2 === 1;
      const lane = HIGHWAY_LANES[Math.floor(scatter(index) * HIGHWAY_LANES.length)];
      motorists.push({
        // Spread along the stretch, and nudged so the gaps between them vary.
        offset: ((Math.floor(index / 2) + scatter(index + 50) * 0.8) * length) / HIGHWAY_CARS,
        lane: reverse ? -lane : lane,
        reverse,
      });
    }
    this.motorists = new Convoy(
      roadCar,
      highway,
      { from, length },
      HIGHWAY_SPEED,
      surface,
      0.25,
      motorists,
      motorists.map(
        (_, index) =>
          new Color(HIGHWAY_PAINTS[Math.floor(scatter(index + 100) * HIGHWAY_PAINTS.length)]),
      ),
    );

    this.raceCars = this.cars.mesh;
    this.raceCars.name = "race-traffic";
    this.shuttles = this.buses.mesh;
    this.shuttles.name = "shuttle-traffic";
    this.highway = this.motorists.mesh;
    this.highway.name = "highway-traffic";
    this.shuttles.visible = this.moving;
    this.highway.visible = this.moving;
  }

  /** Switches to the movement for a view: an event mode's id, or `null` for the whole site. */
  setMode(mode: string | null): void {
    this.racing = this.moving && mode === RACE_MODE;
    this.cars.mesh.visible = this.racing;
  }

  /** Whether the race cars are out, which needs every frame drawn to look smooth. */
  get busy(): boolean {
    return this.racing;
  }

  /** Moves everything on to `now`. Returns whether anything moved. */
  update(now: number): boolean {
    if (!this.moving) {
      return false;
    }
    this.startedAt ??= now;
    const seconds = (now - this.startedAt) / 1000;
    if (!this.raceClock.held && this.lastTime !== null) {
      this.raceClock.seconds += (now - this.lastTime) / 1000;
    }
    this.lastTime = now;
    if (this.racing) {
      this.cars.place(this.raceClock.seconds);
    }
    this.buses.place(seconds);
    this.motorists.place(seconds);
    return true;
  }
}
