import type { PerspectiveCamera } from "three";
import { Box3, MathUtils, Spherical, Vector3 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";
import type { ClearArea } from "../ui/overlays.ts";
import type { View } from "./view.ts";
import { homeView, MAX_TILT, MAX_ZOOM_DISTANCE, MIN_TILT, MIN_ZOOM_DISTANCE } from "./view.ts";

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
/** Short enough that pressing a zoom button several times feels like one move. */
const ZOOM_STEP_DURATION = 260;
const TURN_DURATION = 500;
/** Short enough that the view keeps up with a slider being dragged. */
const SLIDER_DURATION = 120;

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
  readonly toTheta: number;
  readonly hop: number;
  readonly duration: number;
  startedAt: number | null;
}

const offset = new Vector3();

/** Moves the camera smoothly to frame something. Any user input cancels it. */
export class CameraFlight {
  private leg: Leg | null = null;

  /**
   * `clearArea` says which part of the map has no panel or button over it,
   * and `homeArea` which part the opening view is centred in.
   */
  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: MapControls,
    private readonly clearArea: () => ClearArea,
    private readonly homeArea: () => ClearArea,
  ) {
    controls.addEventListener("start", () => {
      this.leg = null;
    });
  }

  /** Flies back to the opening view, as it would be for the shape of its part of the map now. */
  flyHome(): void {
    const area = this.homeArea();
    const home = homeView((area.right - area.left) / (area.bottom - area.top));
    this.fly({ ...home, target: this.aim(home.target, home, area) });
  }

  /**
   * Flies to frame a box in the clear part of the map, keeping the direction
   * the camera is facing.
   */
  frame(bounds: Box3): void {
    const { camera } = this;
    const reachable = bounds.clone().intersect(MAP_AREA);
    const centre = reachable.getCenter(new Vector3());
    const size = reachable.getSize(new Vector3());
    const clear = this.clearArea();
    const current = this.currentView();
    const phi = MathUtils.clamp(current.phi, MIN_FRAME_TILT, MAX_FRAME_TILT);
    const { theta } = current;

    // Seen at a tilt, the ground the box stands on is foreshortened up the
    // screen, and its height shows instead.
    const across = Math.hypot(size.x, size.z) / 2;
    const upScreen = across * Math.cos(phi) + (size.y / 2) * Math.sin(phi);

    // The tangent of the angle one pixel covers at the middle of the view.
    const pixel = (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / clear.viewHeight;
    const halfWidth = Math.atan((pixel * (clear.right - clear.left)) / 2);
    const halfHeight = Math.atan((pixel * (clear.bottom - clear.top)) / 2);
    const fit =
      FRAME_MARGIN * Math.max(across / Math.sin(halfWidth), upScreen / Math.sin(halfHeight));
    const radius = MathUtils.clamp(fit, MIN_FRAME_DISTANCE, MAX_ZOOM_DISTANCE);

    const target = this.aim(centre, { radius, phi, theta }, clear);
    this.fly({ target, radius, phi, theta });
  }

  /**
   * The orbit point that puts `centre` in the middle of `area`. The camera
   * looks at the middle of the map, so it aims past `centre` to do that.
   */
  private aim(centre: Vector3, view: Omit<View, "target">, area: ClearArea): Vector3 {
    const { radius, phi, theta } = view;
    const pixel = (2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)) / area.viewHeight;
    // The tangents of the angles from the middle of the view to the middle of the area.
    const right = ((area.left + area.right - area.viewWidth) / 2) * pixel;
    const down = ((area.top + area.bottom - area.viewHeight) / 2) * pixel;
    // How far beyond the centre the camera aims, along the ground, and how far
    // the centre then is from the camera along its line of sight.
    const ahead = (down * radius) / (Math.cos(phi) + down * Math.sin(phi));
    const aside = right * (radius - ahead * Math.sin(phi));
    const x = centre.x - aside * Math.cos(theta) - ahead * Math.sin(theta);
    const z = centre.z + aside * Math.sin(theta) - ahead * Math.cos(theta);
    return new Vector3(x, heightAt(x, z), z);
  }

  /** Moves the camera closer or further by a factor, from wherever it's heading. */
  zoomBy(factor: number): void {
    const { radius, phi, theta } = this.heading();
    this.fly(
      {
        target: this.leg?.toTarget ?? this.controls.target.clone(),
        radius: MathUtils.clamp(radius * factor, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE),
        phi,
        theta,
      },
      ZOOM_STEP_DURATION,
    );
  }

  /** Moves the camera to a set distance from its orbit point. */
  zoomTo(radius: number): void {
    const { phi, theta } = this.heading();
    this.fly(
      {
        target: this.leg?.toTarget ?? this.controls.target.clone(),
        radius: MathUtils.clamp(radius, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE),
        phi,
        theta,
      },
      SLIDER_DURATION,
    );
  }

  /**
   * Slides the view across the ground. `right` and `up` are shares of the
   * camera's distance, in the directions they have on screen.
   */
  panBy(right: number, up: number): void {
    const { radius, phi, theta } = this.heading();
    const from = this.leg?.toTarget ?? this.controls.target;
    const x = MathUtils.clamp(
      from.x + radius * (right * Math.cos(theta) - up * Math.sin(theta)),
      -MAP_HALF_SIZE,
      MAP_HALF_SIZE,
    );
    const z = MathUtils.clamp(
      from.z - radius * (right * Math.sin(theta) + up * Math.cos(theta)),
      -MAP_HALF_SIZE,
      MAP_HALF_SIZE,
    );
    this.fly({ target: new Vector3(x, heightAt(x, z), z), radius, phi, theta }, ZOOM_STEP_DURATION);
  }

  /**
   * Swings the camera around its orbit point. `turn` is the change in yaw and
   * `tilt` the change in pitch, in radians. A positive tilt looks more steeply down.
   */
  orbitBy(turn: number, tilt: number): void {
    const { radius, phi, theta } = this.heading();
    this.fly(
      {
        target: this.leg?.toTarget ?? this.controls.target.clone(),
        radius,
        phi: MathUtils.clamp(phi - tilt, MIN_TILT, MAX_TILT),
        theta: theta + turn,
      },
      ZOOM_STEP_DURATION,
    );
  }

  /** Turns the view so that north is at the top. */
  faceNorth(): void {
    const { radius, phi } = this.heading();
    this.fly(
      { target: this.leg?.toTarget ?? this.controls.target.clone(), radius, phi, theta: 0 },
      TURN_DURATION,
    );
  }

  /** Where the camera will be around its orbit point once any flight ends. */
  private heading(): { radius: number; phi: number; theta: number } {
    const { leg } = this;
    return leg ? { radius: leg.toRadius, phi: leg.toPhi, theta: leg.toTheta } : this.currentView();
  }

  private currentView(): Spherical {
    return new Spherical().setFromVector3(
      offset.copy(this.camera.position).sub(this.controls.target),
    );
  }

  private fly(to: View, fixedDuration?: number): void {
    const { controls } = this;
    const from = this.currentView();

    const travel = controls.target.distanceTo(to.target);
    const zoom = Math.abs(Math.log(to.radius / from.radius));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The short way round, so a view turned past south doesn't spin all the way back.
    const turn = MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) - Math.PI;

    this.leg = {
      fromTarget: controls.target.clone(),
      toTarget: to.target,
      from,
      toRadius: to.radius,
      toPhi: to.phi,
      toTheta: from.theta + turn,
      hop: travel * HOP_SHARE,
      duration: reduceMotion
        ? 0
        : (fixedDuration ??
          MathUtils.clamp(
            BASE_DURATION + travel * DURATION_PER_METRE + zoom * DURATION_PER_ZOOM,
            MIN_DURATION,
            MAX_DURATION,
          )),
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
    const theta = MathUtils.lerp(leg.from.theta, leg.toTheta, eased);

    controls.target.lerpVectors(leg.fromTarget, leg.toTarget, eased);
    offset.setFromSphericalCoords(radius, phi, theta);
    camera.position.copy(controls.target).add(offset);

    if (progress === 1) {
      this.leg = null;
    }
    return true;
  }
}
