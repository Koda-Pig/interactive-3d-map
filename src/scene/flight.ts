import { Box3, MathUtils, Sphere, Spherical, Vector3 } from "three";
import type { PerspectiveCamera } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";
import { MAX_ZOOM_DISTANCE } from "./view.ts";

const FRAME_MARGIN = 1.25;
const MIN_FRAME_DISTANCE = 240;
const MIN_FRAME_TILT = MathUtils.degToRad(30);
const MAX_FRAME_TILT = MathUtils.degToRad(62);

/** How far the camera rises mid-flight, as a share of the distance covered. */
const HOP_SHARE = 0.25;

const MIN_DURATION = 700;
const MAX_DURATION = 1800;
const BASE_DURATION = 600;
const DURATION_PER_METRE = 0.4;
const DURATION_PER_ZOOM = 250;

// Long roads run off the map, so only the part you can fly to is framed.
const MAP_AREA = new Box3(
  new Vector3(-MAP_HALF_SIZE, Number.NEGATIVE_INFINITY, -MAP_HALF_SIZE),
  new Vector3(MAP_HALF_SIZE, Number.POSITIVE_INFINITY, MAP_HALF_SIZE),
);

interface Leg {
  readonly fromTarget: Vector3;
  readonly toTarget: Vector3;
  readonly from: Spherical;
  readonly toRadius: number;
  readonly toPhi: number;
  readonly hop: number;
  readonly duration: number;
  startedAt: number | null;
}

const offset = new Vector3();

/** Moves the camera smoothly to frame something. Any user input cancels it. */
export class CameraFlight {
  private leg: Leg | null = null;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: MapControls,
  ) {
    controls.addEventListener("start", () => {
      this.leg = null;
    });
  }

  /** Flies to frame a box, keeping the direction the camera is facing. */
  frame(bounds: Box3): void {
    const { camera, controls } = this;
    const reachable = bounds.clone().intersect(MAP_AREA);
    const sphere = reachable.getBoundingSphere(new Sphere());

    const halfHeight = MathUtils.degToRad(camera.fov) / 2;
    const halfWidth = Math.atan(Math.tan(halfHeight) * camera.aspect);
    const fit = (sphere.radius * FRAME_MARGIN) / Math.sin(Math.min(halfHeight, halfWidth));
    const toRadius = MathUtils.clamp(fit, MIN_FRAME_DISTANCE, MAX_ZOOM_DISTANCE);

    const { x, z } = sphere.center;
    const toTarget = new Vector3(x, heightAt(x, z), z);
    const from = new Spherical().setFromVector3(
      offset.copy(camera.position).sub(controls.target),
    );

    const travel = controls.target.distanceTo(toTarget);
    const zoom = Math.abs(Math.log(toRadius / from.radius));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.leg = {
      fromTarget: controls.target.clone(),
      toTarget,
      from,
      toRadius,
      toPhi: MathUtils.clamp(from.phi, MIN_FRAME_TILT, MAX_FRAME_TILT),
      hop: travel * HOP_SHARE,
      duration: reduceMotion
        ? 0
        : MathUtils.clamp(
            BASE_DURATION + travel * DURATION_PER_METRE + zoom * DURATION_PER_ZOOM,
            MIN_DURATION,
            MAX_DURATION,
          ),
      startedAt: null,
    };
  }

  /** Advances the flight to `now`, and says whether the camera was moved. */
  update(now: number): boolean {
    const { leg, camera, controls } = this;
    if (!leg) {
      return false;
    }

    leg.startedAt ??= now;
    const elapsed = now - leg.startedAt;
    const progress = leg.duration === 0 ? 1 : Math.min(1, elapsed / leg.duration);
    const eased = MathUtils.smootherstep(progress, 0, 1);

    const zoomed = leg.from.radius * (leg.toRadius / leg.from.radius) ** eased;
    const radius = zoomed + leg.hop * Math.sin(Math.PI * eased);
    const phi = MathUtils.lerp(leg.from.phi, leg.toPhi, eased);

    controls.target.lerpVectors(leg.fromTarget, leg.toTarget, eased);
    offset.setFromSphericalCoords(radius, phi, leg.from.theta);
    camera.position.copy(controls.target).add(offset);

    if (progress === 1) {
      this.leg = null;
    }
    return true;
  }
}
