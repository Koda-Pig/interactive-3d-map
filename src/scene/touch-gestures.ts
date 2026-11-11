import type { PerspectiveCamera } from "three";
import { MathUtils, Plane, Raycaster, Spherical, Vector2, Vector3 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import { MAX_TILT, MAX_ZOOM_DISTANCE, MIN_TILT, MIN_ZOOM_DISTANCE } from "./view.ts";

/** How far a finger moves before two fingers are read as a tilt or a pinch, in pixels. */
const DECIDE_DISTANCE = 8;
/** How far two fingers twist before the map starts to turn, in radians. A pinch
 * to zoom always twists a little, and that shouldn't turn the map. */
const TWIST_THRESHOLD = MathUtils.degToRad(6);
/** How far dragging two fingers one pixel up or down tilts the view, in radians. */
const TILT_PER_PIXEL = MathUtils.degToRad(0.5);
/** A point under the fingers further off than this is near the horizon, and too far to turn about. */
const MAX_PIVOT_DISTANCE = MAX_ZOOM_DISTANCE * 3;

const UP = new Vector3(0, 1, 0);

interface Finger {
  x: number;
  y: number;
  readonly startX: number;
  readonly startY: number;
}

/**
 * Two fingers on the map, as phone maps have them: pinching zooms, twisting
 * turns, and dragging both up or down tilts. A pinch and a twist keep the
 * ground under the fingers, so the map moves with them. This replaces the
 * controls' own two-finger gesture, which turned the map by dragging sideways.
 */
export function addTouchGestures(
  camera: PerspectiveCamera,
  controls: MapControls,
  element: HTMLElement,
): void {
  controls.touches.TWO = null;

  const fingers = new Map<number, Finger>();
  let mode: "tilt" | "pinch" | null = null;
  let twist = 0;
  let turning = false;

  const raycaster = new Raycaster();
  const ground = new Plane();
  const ndc = new Vector2();
  const pivot = new Vector3();
  const landed = new Vector3();
  const offset = new Vector3();
  const spherical = new Spherical();

  /** The ground under a point on screen, at the height of the orbit point. */
  const groundAt = (x: number, y: number, out: Vector3): boolean => {
    const rect = element.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    ground.setFromNormalAndCoplanarPoint(UP, controls.target);
    return (
      raycaster.ray.intersectPlane(ground, out) !== null &&
      out.distanceTo(controls.target) < MAX_PIVOT_DISTANCE
    );
  };

  const tilt = (angle: number): void => {
    spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
    spherical.phi = MathUtils.clamp(spherical.phi + angle, MIN_TILT, MAX_TILT);
    camera.position.setFromSpherical(spherical).add(controls.target);
  };

  /**
   * Zooms and turns about the ground under the fingers' old midpoint, then
   * slides the map so that ground sits under their new midpoint.
   */
  const pinch = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    scale: number,
    turn: number,
  ): void => {
    const { target } = controls;
    const held = groundAt(from.x, from.y, pivot);
    if (!held) {
      pivot.copy(target);
    }
    const radius = camera.position.distanceTo(target);
    const limited = MathUtils.clamp(radius * scale, MIN_ZOOM_DISTANCE, MAX_ZOOM_DISTANCE) / radius;
    for (const point of [camera.position, target]) {
      point.sub(pivot).multiplyScalar(limited).applyAxisAngle(UP, turn).add(pivot);
    }
    camera.lookAt(target);
    if (held && groundAt(to.x, to.y, landed)) {
      offset.subVectors(pivot, landed);
      camera.position.add(offset);
      target.add(offset);
    }
  };

  const reset = (): void => {
    mode = null;
    twist = 0;
    turning = false;
  };

  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      const { clientX: x, clientY: y } = event;
      fingers.set(event.pointerId, { x, y, startX: x, startY: y });
      reset();
    }
  });

  element.addEventListener("pointermove", (event) => {
    const finger = fingers.get(event.pointerId);
    if (!finger) {
      return;
    }
    const [a, b] = [...fingers.values()];
    if (fingers.size !== 2 || !a || !b) {
      finger.x = event.clientX;
      finger.y = event.clientY;
      return;
    }
    const before = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const spanBefore = Math.hypot(b.x - a.x, b.y - a.y);
    const angleBefore = Math.atan2(b.y - a.y, b.x - a.x);
    finger.x = event.clientX;
    finger.y = event.clientY;

    if (!mode) {
      const [ax, ay, bx, by] = [a.x - a.startX, a.y - a.startY, b.x - b.startX, b.y - b.startY];
      if (Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)) < DECIDE_DISTANCE) {
        return;
      }
      // A tilt is both fingers heading the same way, up or down.
      const together =
        ay * by > 0 &&
        Math.abs(ay) > Math.abs(ax) &&
        Math.abs(by) > Math.abs(bx) &&
        Math.min(Math.abs(ay), Math.abs(by)) >= DECIDE_DISTANCE / 2;
      mode = together ? "tilt" : "pinch";
      return;
    }

    const after = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (mode === "tilt") {
      // Dragging up tips the view towards the horizon.
      tilt((before.y - after.y) * TILT_PER_PIXEL);
      return;
    }
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const twisted = MathUtils.euclideanModulo(angle - angleBefore + Math.PI, Math.PI * 2) - Math.PI;
    twist += twisted;
    const wasTurning = turning;
    turning ||= Math.abs(twist) > TWIST_THRESHOLD;
    // Seen from above, the camera swings the opposite way to the map.
    pinch(before, after, span > 0 ? spanBefore / span : 1, wasTurning ? twisted : 0);
  });

  for (const type of ["pointerup", "pointercancel"] as const) {
    element.addEventListener(type, (event) => {
      if (fingers.delete(event.pointerId)) {
        reset();
      }
    });
  }
}
