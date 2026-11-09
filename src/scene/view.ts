import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";

const MIN_ZOOM_DISTANCE = 120;
export const MAX_ZOOM_DISTANCE = 4500;
const MAX_TILT = MathUtils.degToRad(80);
const GROUND_CLEARANCE = 5;

export function createCamera(aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(40, aspect, 10, 26000);
  camera.position.set(-1000, heightAt(0, 0) + 950, 2900);
  return camera;
}

export function createControls(camera: PerspectiveCamera, element: HTMLElement): MapControls {
  // MapControls defaults to left-drag pan, right-drag rotate and wheel zoom,
  // with one-finger pan and two-finger zoom and rotate on touch.
  const controls = new MapControls(camera, element);
  controls.target.set(0, heightAt(0, 0), 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = MIN_ZOOM_DISTANCE;
  controls.maxDistance = MAX_ZOOM_DISTANCE;
  controls.maxPolarAngle = MAX_TILT;
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
