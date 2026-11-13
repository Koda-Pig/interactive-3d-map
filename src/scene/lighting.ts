import { DirectionalLight, Fog, HemisphereLight, MathUtils, type Scene, Vector3 } from "three";
import { GROUND_HALF_SIZE } from "../site.ts";
import type { Quality } from "./quality.ts";
import { HORIZON_COLOR } from "./sky.ts";
import { SunShadow } from "./sun-shadow.ts";

// Late afternoon in the southern hemisphere: low in the north-west.
const SUN_BEARING = MathUtils.degToRad(292);
const SUN_ELEVATION = MathUtils.degToRad(19);
const SUN_DISTANCE = 5000;

const SHADOW_HALF_DEPTH = 2500;

/** Unit vector from the middle of the site towards the sun. */
export const SUN_DIRECTION = new Vector3(
  Math.sin(SUN_BEARING) * Math.cos(SUN_ELEVATION),
  Math.sin(SUN_ELEVATION),
  -Math.cos(SUN_BEARING) * Math.cos(SUN_ELEVATION),
);

function createSun(quality: Quality): DirectionalLight {
  const sun = new DirectionalLight(0xffd3a1, 5);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);

  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(quality.shadowMapSize);
  sun.shadow.camera.near = SUN_DISTANCE - SHADOW_HALF_DEPTH;
  sun.shadow.camera.far = SUN_DISTANCE + SHADOW_HALF_DEPTH;
  return sun;
}

export function addLighting(scene: Scene, quality: Quality): SunShadow {
  // The fog has to finish before the edge of the ground comes into view.
  scene.fog = new Fog(HORIZON_COLOR, GROUND_HALF_SIZE * 0.45, GROUND_HALF_SIZE * 0.95);
  const sun = createSun(quality);
  scene.add(new HemisphereLight(0xa9c6ee, 0xa98a5c, 1.1), sun);
  return new SunShadow(sun, quality.shadowRadius);
}
