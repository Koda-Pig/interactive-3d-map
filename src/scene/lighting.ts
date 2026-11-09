import { Color, DirectionalLight, Fog, HemisphereLight, MathUtils, Scene, Vector3 } from "three";
import { GROUND_HALF_SIZE } from "../site.ts";

const SKY_COLOR = 0xd9e2e0;

// Late afternoon in the southern hemisphere: low in the north-west.
const SUN_BEARING = MathUtils.degToRad(292);
const SUN_ELEVATION = MathUtils.degToRad(24);
const SUN_DISTANCE = 5000;

const SHADOW_HALF_WIDTH = 1800;
const SHADOW_HALF_DEPTH = 2500;
const SHADOW_MAP_SIZE = 2048;

function createSun(): DirectionalLight {
  const sun = new DirectionalLight(0xffd7a3, 5.2);
  sun.position.copy(
    new Vector3(
      Math.sin(SUN_BEARING) * Math.cos(SUN_ELEVATION),
      Math.sin(SUN_ELEVATION),
      -Math.cos(SUN_BEARING) * Math.cos(SUN_ELEVATION),
    ).multiplyScalar(SUN_DISTANCE),
  );

  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.camera.left = -SHADOW_HALF_WIDTH;
  sun.shadow.camera.right = SHADOW_HALF_WIDTH;
  sun.shadow.camera.top = SHADOW_HALF_WIDTH;
  sun.shadow.camera.bottom = -SHADOW_HALF_WIDTH;
  sun.shadow.camera.near = SUN_DISTANCE - SHADOW_HALF_DEPTH;
  sun.shadow.camera.far = SUN_DISTANCE + SHADOW_HALF_DEPTH;
  sun.shadow.normalBias = 2;
  return sun;
}

export function addLighting(scene: Scene): void {
  scene.background = new Color(SKY_COLOR);
  // The fog has to finish before the edge of the ground comes into view.
  scene.fog = new Fog(SKY_COLOR, GROUND_HALF_SIZE * 0.45, GROUND_HALF_SIZE * 0.95);
  scene.add(new HemisphereLight(0xc4dcf0, 0xb89a6a, 1.5), createSun());
}
