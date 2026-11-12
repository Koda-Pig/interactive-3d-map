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
/** Below this, the middle of a clear area looks too near the horizon to frame anything in. */
const MIN_LEAN = 0.15;

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

/** Where the opening fly-in starts, relative to the opening view. */
const FLY_IN_DISTANCE = 1.9;
const FLY_IN_TILT = MathUtils.degToRad(22);
const FLY_IN_TURN = MathUtils.degToRad(-30);
const FLY_IN_DURATION = 2600;

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
   * `clearAreas` says which parts of the map have no panel or button over
   * them, and `homeArea` which part the opening view is centred in.
   */
  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly controls: MapControls,
    private readonly clearAreas: () => readonly ClearArea[],
    private readonly homeArea: () => ClearArea,
  ) {
    controls.addEventListener("start", () => {
      this.leg = null;
    });
  }

  /** Flies back to the opening view, as it would be for the shape of its part of the map now. */
  flyHome(duration?: number): void {
    const area = this.homeArea();
    const home = homeView((area.right - area.left) / (area.bottom - area.top));
    this.fly({ ...home, target: this.aim(home.target, home, area) }, duration);
  }

  /**
   * Starts the camera high above the site, turned a little, and settles it
   * into the opening view. Under reduced motion it goes straight there.
   */
  flyIn(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.flyHome();
      return;
    }
    const { camera, controls } = this;
    const view = this.currentView();
    const radius = MathUtils.clamp(
      view.radius * FLY_IN_DISTANCE,
      MIN_ZOOM_DISTANCE,
      MAX_ZOOM_DISTANCE,
    );
    const phi = MathUtils.clamp(view.phi - FLY_IN_TILT, MIN_TILT, MAX_TILT);
    offset.setFromSphericalCoords(radius, phi, view.theta + FLY_IN_TURN);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    this.flyHome(FLY_IN_DURATION);
  }

  /**
   * Flies to frame a box in whichever clear part of the map shows it largest,
   * keeping the direction the camera is facing.
   */
  frame(bounds: Box3): void {
    const reachable = bounds.clone().intersect(MAP_AREA);
    const centre = reachable.getCenter(new Vector3());
    const size = reachable.getSize(new Vector3());
    const current = this.currentView();
    const phi = MathUtils.clamp(current.phi, MIN_FRAME_TILT, MAX_FRAME_TILT);
    const { theta } = current;

    // How far the box reaches either side of its centre across the screen and
    // into it, turned to the way the camera faces. Seen at a tilt, the depth
    // is foreshortened up the screen, and the box's height shows instead.
    const cos = Math.abs(Math.cos(theta));
    const sin = Math.abs(Math.sin(theta));
    const across = (size.x / 2) * cos + (size.z / 2) * sin;
    const deep = (size.x / 2) * sin + (size.z / 2) * cos;
    const upScreen = deep * Math.cos(phi) + (size.y / 2) * Math.sin(phi);

    // How close the box can be with it inside each clear area. The closest
    // shows it largest and wins. Among equals (small things all stop at the
    // minimum distance) the larger area wins, which leaves more room around it.
    const box = { across, upScreen, deep, phi };
    const areas = this.clearAreas();
    let best: { area: ClearArea; depth: number; radius: number } | null = null;
    for (const area of areas) {
      const fit = this.fitDistance(area, box);
      if (fit && (!best || fit.depth < best.depth - 1)) {
        best = { area, ...fit };
      }
    }
    // Too big for any clear area, even from as far as the camera goes. Pushed
    // into a strip it would be cut off on one side, so it's centred in the
    // whole map instead and the panels cover a little of it. That's only
    // worth it while the middle of the map is clear, which it isn't on a
    // phone, where the details panel sits across it.
    const { viewWidth, viewHeight } = areas[0];
    const middleClear = areas.some(
      (area) =>
        area.left <= viewWidth / 2 &&
        area.right >= viewWidth / 2 &&
        area.top <= viewHeight / 2 &&
        area.bottom >= viewHeight / 2,
    );
    if ((!best || best.radius > MAX_ZOOM_DISTANCE) && middleClear) {
      const whole = {
        left: 0,
        top: 0,
        right: viewWidth,
        bottom: viewHeight,
        viewWidth,
        viewHeight,
      };
      const fit = this.fitDistance(whole, box);
      if (fit) {
        best = { area: whole, ...fit };
      }
    }
    if (!best) {
      return;
    }
    const radius = MathUtils.clamp(best.radius, MIN_FRAME_DISTANCE, MAX_ZOOM_DISTANCE);
    const target = this.aim(centre, { radius, phi, theta }, best.area);
    this.fly({ target, radius, phi, theta });
  }

  /**
   * How far the box's centre has to be from the camera, along its line of
   * sight, to fit inside `area`, and the orbit radius that puts it there. The
   * box reaches `across` either side of its centre, `upScreen` above and below
   * it, and `deep` towards and away from the camera along the ground. Returns
   * `null` for an area too high in the view to frame anything on the ground.
   */
  private fitDistance(
    area: ClearArea,
    box: { across: number; upScreen: number; deep: number; phi: number },
  ): { depth: number; radius: number } | null {
    const { across, upScreen, deep, phi } = box;
    // The tangent of the angle one pixel covers, which is the same anywhere in the view.
    const pixel = (2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)) / area.viewHeight;
    const halfWidth = (pixel * (area.right - area.left)) / 2;
    const halfHeight = (pixel * (area.bottom - area.top)) / 2;
    // The near half of the box is closer than its centre, so it looks larger.
    // Allowing for that keeps the near edge of a long selection in the frame.
    const depth =
      FRAME_MARGIN * Math.max(across / halfWidth, upScreen / halfHeight) + deep * Math.sin(phi);
    // An area low in the view looks at ground nearer the camera than the
    // orbit point, so the camera sits further back to keep the same depth.
    const down = ((area.top + area.bottom - area.viewHeight) / 2) * pixel;
    const lean = Math.cos(phi) + down * Math.sin(phi);
    if (lean < MIN_LEAN) {
      return null;
    }
    return { depth, radius: Math.max((depth * lean) / Math.cos(phi), MIN_FRAME_DISTANCE) };
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
   * Slides the view sideways by a number of pixels, measured at the orbit
   * point, in a map `viewHeight` pixels tall. Positive moves the view right,
   * so the map appears to move left.
   */
  shiftBy(pixels: number, viewHeight: number): void {
    if (pixels === 0 || viewHeight === 0) {
      return;
    }
    const pixel = (2 * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)) / viewHeight;
    this.panBy(pixels * pixel, 0);
  }

  /**
   * Swings the camera around its orbit point. `turn` is the change in yaw and
   * `tilt` the change in pitch, in radians. A positive tilt looks more steeply down.
   * A `duration` of zero moves it at once, to follow a drag.
   */
  orbitBy(turn: number, tilt: number, duration = ZOOM_STEP_DURATION): void {
    const { radius, phi, theta } = this.heading();
    this.fly(
      {
        target: this.leg?.toTarget ?? this.controls.target.clone(),
        radius,
        phi: MathUtils.clamp(phi - tilt, MIN_TILT, MAX_TILT),
        theta: theta + turn,
      },
      duration,
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
