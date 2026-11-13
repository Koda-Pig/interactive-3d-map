import type { PerspectiveCamera } from "three";
import { MathUtils, Spherical, Vector3 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import type { PathSample } from "../layout/path.ts";
import type { Route } from "../layout/route.ts";
import { pointAt } from "../layout/route.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import type { CameraFlight } from "./flight.ts";

/**
 * How the camera follows one stretch of a tour. Keep `height` large enough for
 * `back + ahead`: the controls cap the view at 80 degrees from straight down on
 * every frame, and the walk settings already sit near 75 degrees on flat
 * ground. A stretch that climbs towards its look point would hit the cap and
 * jerk, so raise `height` before running a walk uphill.
 */
export interface TourStage {
  /** Where the stretch ends, in metres from the start of the tour. */
  readonly until: number;
  /** Top speed, in metres per second. */
  readonly speed: number;
  /** How high the camera rides above the route, in metres. */
  readonly height: number;
  /** How far behind the current point the camera rides, in metres. */
  readonly back: number;
  /** How far ahead along the route the camera looks, in metres. */
  readonly ahead: number;
}

/** A camera ride along a route, from `start` metres along it for `length` metres. */
export interface TourPlan {
  readonly id: string;
  readonly route: Route;
  readonly start: number;
  readonly length: number;
  readonly stages: readonly TourStage[];
  /** What happens once the ride reaches the end, such as flying to a closing view. */
  readonly finish: () => void;
}

/** Stretches blend into each other over this distance, in metres. */
const STAGE_BLEND = 120;
/** The tour speeds up from a crawl over this distance, and slows down over it at the end. */
const RAMP = 160;
/** The slowest the tour goes at its ends, as a share of top speed. */
const RAMP_FLOOR = 0.12;
/** How far either side of a point its bend is measured over, in metres. */
const BEND_REACH = 35;
/** How much the tour slows through the tightest bends, as a share of top speed. */
const BEND_SLOWING = 0.45;
/** How quickly the camera catches up with where it should be, in seconds. */
const SMOOTHING = 0.45;
/** The camera keeps at least this far above the ground under it, in metres. */
const CLEARANCE = 15;
/**
 * The longest step taken in one frame, in seconds, so a stalled tab doesn't
 * jump. Below 10 frames a second the ride slows down rather than skipping.
 */
const MAX_STEP = 0.1;

const direction = new Vector3();
const spherical = new Spherical();

/**
 * Rides the camera along a route: a lap of the circuit, or the way in from the
 * N7. It first flies to the start, then follows the route, slowing for bends,
 * and hands back to the map at the end. Dragging, zooming or any other flight
 * interrupts it where it is. Pressing Stop returns to the home view.
 */
export class CameraTour {
  private plan: TourPlan | null = null;
  private phase: "approach" | "ride" = "approach";
  /** The flight to the start of the tour, so another flight can be told apart from it. */
  private approach: number | null = null;
  private travelled = 0;
  private lastTime: number | null = null;
  private readonly target = new Vector3();
  private readonly position = new Vector3();
  private readonly wantedTarget = new Vector3();
  private readonly wantedPosition = new Vector3();

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: MapControls,
    private readonly flight: CameraFlight,
    private readonly surface: GroundSurface,
    private readonly onChange: (id: string | null) => void,
  ) {
    controls.addEventListener("start", () => this.cancel());
  }

  /** The id of the tour under way, if any. */
  get running(): string | null {
    return this.plan?.id ?? null;
  }

  start(plan: TourPlan): void {
    this.plan = plan;
    this.phase = "approach";
    this.travelled = 0;
    this.lastTime = null;
    this.pose(0, this.wantedTarget, this.wantedPosition);
    const offset = direction.subVectors(this.wantedPosition, this.wantedTarget);
    spherical.setFromVector3(offset);
    this.flight.flyTo({
      target: this.wantedTarget.clone(),
      radius: spherical.radius,
      phi: spherical.phi,
      theta: spherical.theta,
    });
    this.approach = this.flight.currentLeg;
    this.onChange(plan.id);
  }

  /** Stops the tour and returns home, including on its way to the start. */
  stop(): void {
    if (!this.plan) {
      return;
    }
    this.cancel();
    this.flight.flyHome();
  }

  /** Hands the camera back to the interaction that interrupted the tour. */
  private cancel(): void {
    if (!this.plan) {
      return;
    }
    if (this.phase === "approach" && this.flight.currentLeg === this.approach) {
      this.flight.stop();
    }
    this.plan = null;
    this.onChange(null);
  }

  /** Moves the camera on to `now`. Returns whether it moved. */
  update(now: number): boolean {
    const { plan } = this;
    if (!plan) {
      return false;
    }
    if (this.phase === "approach") {
      const leg = this.flight.currentLeg;
      if (leg !== null && leg !== this.approach) {
        // Something else, such as a zoom button or a pick from the list, took the camera.
        this.cancel();
        return false;
      }
      if (leg !== null) {
        return false;
      }
      this.phase = "ride";
      this.target.copy(this.controls.target);
      this.position.copy(this.camera.position);
    } else if (this.flight.flying) {
      // Something else, such as a zoom button or a pick from the list, took the camera.
      this.cancel();
      return false;
    }

    const step = this.lastTime === null ? 0 : Math.min((now - this.lastTime) / 1000, MAX_STEP);
    this.lastTime = now;
    this.travelled = Math.min(plan.length, this.travelled + this.speedAt(this.travelled) * step);

    this.pose(this.travelled, this.wantedTarget, this.wantedPosition);
    const follow = 1 - Math.exp(-step / SMOOTHING);
    this.target.lerp(this.wantedTarget, follow);
    this.position.lerp(this.wantedPosition, follow);
    this.controls.target.copy(this.target);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);

    if (this.travelled >= plan.length) {
      this.plan = null;
      this.onChange(null);
      plan.finish();
    }
    return true;
  }

  /** The way the camera follows the route at this point, blended between stretches. */
  private stageAt(travelled: number): Omit<TourStage, "until"> {
    const { stages } = this.plan as TourPlan;
    const index = stages.findIndex((stage) => travelled < stage.until);
    const current = stages[index === -1 ? stages.length - 1 : index];
    const next = stages[index + 1];
    if (!next || index === -1) {
      return current;
    }
    const t = MathUtils.smoothstep(
      travelled,
      current.until - STAGE_BLEND / 2,
      current.until + STAGE_BLEND / 2,
    );
    return {
      speed: MathUtils.lerp(current.speed, next.speed, t),
      height: MathUtils.lerp(current.height, next.height, t),
      back: MathUtils.lerp(current.back, next.back, t),
      ahead: MathUtils.lerp(current.ahead, next.ahead, t),
    };
  }

  private sample(travelled: number): PathSample {
    const plan = this.plan as TourPlan;
    return pointAt(plan.route, plan.start + travelled);
  }

  private speedAt(travelled: number): number {
    const plan = this.plan as TourPlan;
    const { speed } = this.stageAt(travelled);
    const ramp = MathUtils.clamp(
      Math.min(travelled, plan.length - travelled) / RAMP,
      RAMP_FLOOR,
      1,
    );
    const before = this.sample(travelled - BEND_REACH);
    const after = this.sample(travelled + BEND_REACH);
    const bend = Math.acos(
      MathUtils.clamp(before.dirX * after.dirX + before.dirZ * after.dirZ, -1, 1),
    );
    const slowing = 1 - BEND_SLOWING * Math.min(1, bend / (Math.PI / 2));
    return Math.max(speed * ramp * slowing, speed * RAMP_FLOOR);
  }

  /** Where the camera should look and be at this point of the tour. */
  private pose(travelled: number, target: Vector3, position: Vector3): void {
    const { height, back, ahead } = this.stageAt(travelled);
    const here = this.sample(travelled);
    const look = this.sample(travelled + ahead);
    const behind = this.sample(travelled - back);
    // The way ahead, measured over a long stretch so that bends turn the view gently.
    direction.set(look.x - behind.x, 0, look.z - behind.z);
    if (direction.lengthSq() < 1) {
      direction.set(here.dirX, 0, here.dirZ);
    }
    direction.normalize();
    target.set(look.x, this.surface.heightAt(look.x, look.z), look.z);
    const x = here.x - direction.x * back;
    const z = here.z - direction.z * back;
    const y = Math.max(
      this.surface.heightAt(here.x, here.z) + height,
      this.surface.heightAt(x, z) + CLEARANCE,
    );
    position.set(x, y, z);
  }
}
