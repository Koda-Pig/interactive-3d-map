import type { BufferGeometry, Texture } from "three";
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from "three";
import { layout } from "../layout/locations.ts";
import type { Route } from "../layout/route.ts";
import { pointAt, routeOf } from "../layout/route.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { trackSurface } from "./ribbons.ts";
import { seatVehicle, tyreContacts, vehicleSlope } from "./vehicle-pose.ts";

/** Race cars on track at once, spread round the lap. */
const RACE_CARS = 8;
/** Average lap speed, in metres per second: about 170 km/h. */
const RACE_SPEED = 47;
/** Shuttles running round the ring road. */
const SHUTTLES = 3;
/** About 40 km/h. */
const SHUTTLE_SPEED = 11;
/** Shuttles keep to the left-hand lane, this far from the road's middle. */
const SHUTTLE_LANE = 2.6;
/** How far the lake's ripples drift each second, as a share of their tile. */
const RIPPLE_DRIFT = 0.004;

/** The views that have something moving. */
const RACE_MODE = "race";
const CONFERENCE_MODE = "conference";

const placer = new Object3D();

/** Vehicles that drive along a route, drawn in one call. */
class Convoy {
  readonly mesh: InstancedMesh;
  private readonly contacts;

  constructor(
    geometry: BufferGeometry,
    private readonly route: Route,
    private readonly speed: number,
    private readonly surface: Pick<GroundSurface, "heightAt">,
    private readonly lift: number,
    private readonly lane: number,
    tints: readonly Color[],
    private readonly seatOnSurface = false,
  ) {
    this.contacts = tyreContacts(geometry);
    this.mesh = new InstancedMesh(
      geometry,
      new MeshLambertMaterial({ vertexColors: true }),
      tints.length,
    );
    for (const [index, tint] of tints.entries()) {
      this.mesh.setColorAt(index, tint);
    }
    // Moving things stay out of the shadow pass, which only runs when the view settles.
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Puts every vehicle where it is at `seconds`, evenly spaced along the route. */
  place(seconds: number): void {
    const count = this.mesh.count;
    for (let index = 0; index < count; index += 1) {
      const spacing = this.route.length / count;
      const point = pointAt(this.route, seconds * this.speed + index * spacing);
      const x = point.x - point.dirZ * this.lane;
      const z = point.z + point.dirX * this.lane;
      placer.position.set(x, this.surface.heightAt(x, z) + this.lift, z);
      const yaw = Math.atan2(point.dirX, point.dirZ);
      const slope = vehicleSlope((px, pz) => this.surface.heightAt(px, pz), x, z, yaw);
      placer.rotation.set(slope.pitch, yaw, slope.tilt, "YXZ");
      if (this.seatOnSurface)
        seatVehicle(placer, (px, pz) => this.surface.heightAt(px, pz), this.contacts);
      placer.updateMatrix();
      this.mesh.setMatrixAt(index, placer.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * What moves on the map: race cars lapping the circuit on a race weekend,
 * shuttles on the ring road and drifting ripples on the lake whenever the
 * site is shown in use. The whole-site view stays still, so the map only
 * draws when something changes there.
 */
export class Traffic {
  /** Add to the racing precinct, so it fades with it. */
  readonly raceCars: InstancedMesh;
  /** Add to the transport precinct. */
  readonly shuttles: InstancedMesh;

  private readonly cars: Convoy;
  private readonly buses: Convoy;
  private mode: string | null = null;
  private startedAt: number | null = null;

  constructor(
    raceCar: BufferGeometry,
    shuttle: BufferGeometry,
    surface: GroundSurface,
    private readonly ripples: Texture | null,
  ) {
    const carTints = Array.from({ length: RACE_CARS }, (_, index) =>
      new Color().setHSL(index / RACE_CARS, 0.55, 0.55),
    );
    const circuit = layout.locations.find((location) => location.id === "circuit");
    if (circuit?.type !== "track") throw new Error("Missing circuit");
    this.cars = new Convoy(
      raceCar,
      routeOf("circuit"),
      RACE_SPEED,
      trackSurface(circuit, surface),
      0,
      0,
      carTints,
      true,
    );
    const busTints = Array.from({ length: SHUTTLES }, () => new Color(1, 1, 1));
    this.buses = new Convoy(
      shuttle,
      routeOf("ring-road"),
      SHUTTLE_SPEED,
      surface,
      0.3,
      SHUTTLE_LANE,
      busTints,
    );
    this.raceCars = this.cars.mesh;
    this.raceCars.name = "race-traffic";
    this.shuttles = this.buses.mesh;
    this.shuttles.name = "shuttle-traffic";
  }

  /** Switches to the movement for a view: an event mode's id, or `null` for the whole site. */
  setMode(mode: string | null): void {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mode = reduced ? null : mode;
    this.cars.mesh.visible = this.mode === RACE_MODE;
    this.buses.mesh.visible = this.mode === RACE_MODE || this.mode === CONFERENCE_MODE;
    this.startedAt = null;
  }

  /** Whether anything is moving, so the map has to keep drawing. */
  get active(): boolean {
    return this.mode !== null;
  }

  /** Moves everything on to `now`. Returns whether anything moved. */
  update(now: number): boolean {
    if (!this.active) {
      return false;
    }
    this.startedAt ??= now;
    const seconds = (now - this.startedAt) / 1000;
    if (this.cars.mesh.visible) {
      this.cars.place(seconds);
    }
    if (this.buses.mesh.visible) {
      this.buses.place(seconds);
    }
    if (this.ripples) {
      this.ripples.offset.set(seconds * RIPPLE_DRIFT, seconds * RIPPLE_DRIFT * 0.6);
    }
    return true;
  }
}
