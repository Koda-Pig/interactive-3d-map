import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";

export const MIN_ZOOM_DISTANCE = 120;
export const MAX_ZOOM_DISTANCE = 4500;
const MAX_TILT = MathUtils.degToRad(80);
const GROUND_CLEARANCE = 5;
const FIELD_OF_VIEW = 40;
/** How far an arrow key moves the map, in pixels. */
const KEY_PAN_SPEED = 40;

// The opening view looks north-north-east over the circuit and the lake.
const HOME_CENTRE = { x: 90, z: 40 };
/** The opening view holds a circle of this radius around its centre, in metres. */
const HOME_RADIUS = 900;
const HOME_TILT = MathUtils.degToRad(46);
const HOME_BEARING = MathUtils.degToRad(-22);

/** A camera position: the orbit point, and where the camera sits around it. */
export interface View {
  readonly target: Vector3;
  readonly radius: number;
  readonly phi: number;
  readonly theta: number;
}

/** The opening view, pulled back far enough to hold the site in a view this shape. */
export function homeView(aspect: number): View {
  const halfHeight = MathUtils.degToRad(FIELD_OF_VIEW) / 2;
  const halfWidth = Math.atan(Math.tan(halfHeight) * aspect);
  const { x, z } = HOME_CENTRE;
  return {
    target: new Vector3(x, heightAt(x, z), z),
    radius: MathUtils.clamp(
      HOME_RADIUS / Math.sin(Math.min(halfHeight, halfWidth)),
      MIN_ZOOM_DISTANCE,
      MAX_ZOOM_DISTANCE,
    ),
    phi: HOME_TILT,
    theta: HOME_BEARING,
  };
}

export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, 10, 26000);
  const { target, radius, phi, theta } = homeView(aspect);
  camera.position.setFromSphericalCoords(radius, phi, theta).add(target);
  return camera;
}

export function createControls(camera: PerspectiveCamera, element: HTMLElement): MapControls {
  // MapControls defaults to left-drag pan, right-drag rotate and wheel zoom,
  // with one-finger pan and two-finger zoom and rotate on touch.
  const controls = new MapControls(camera, element);
  controls.target.copy(homeView(camera.aspect).target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = MIN_ZOOM_DISTANCE;
  controls.maxDistance = MAX_ZOOM_DISTANCE;
  controls.maxPolarAngle = MAX_TILT;
  // The wheel zooms towards the pointer, so the place under it stays put.
  controls.zoomToCursor = true;
  // Arrow keys move the map while it has focus, and turn it with Shift held.
  controls.keyPanSpeed = KEY_PAN_SPEED;
  controls.listenToKeyEvents(element);
  return controls;
}

const shift = new Vector3();

/**
 * Keeps the view over the map, after `controls.update()` has moved it. The
 * orbit point stays on the ground and inside the pan limit. The camera moves
 * with it, so reaching a limit stops the pan instead of turning the view.
 */
export function constrainView(camera: PerspectiveCamera, controls: MapControls): void {
  const { target } = controls;
  const x = MathUtils.clamp(target.x, -MAP_HALF_SIZE, MAP_HALF_SIZE);
  const z = MathUtils.clamp(target.z, -MAP_HALF_SIZE, MAP_HALF_SIZE);
  shift.set(x, heightAt(x, z), z).sub(target);
  target.add(shift);
  camera.position.add(shift);

  const lowest = heightAt(camera.position.x, camera.position.z) + GROUND_CLEARANCE;
  if (camera.position.y < lowest) {
    camera.position.y = lowest;
    camera.lookAt(target);
  }
}
