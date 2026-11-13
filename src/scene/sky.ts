import type { Camera, Texture, Vector3, WebGLRenderer } from "three";
import {
  BackSide,
  BufferAttribute,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { KitModel } from "../draw/kit.ts";

/** Fog fades into this, so the ground meets the sky without a seam. */
export const HORIZON_COLOR = 0xe5ddc9;

const MIDDLE_SKY_COLOR = 0xa9c9de;
const ZENITH_COLOR = 0x4f86bb;
const SUN_GLOW_COLOR = 0xffdaa6;
/** What shiny surfaces reflect from below the horizon. */
const REFLECTED_GROUND_COLOR = 0xb39a68;

const DOME_RADIUS = 22000;
const DOME_SEGMENTS = 32;

// Drawn last, so the depth test saves shading every pixel the ground covers.
const DOME_RENDER_ORDER = 1000;
const ENVIRONMENT_RESOLUTION = 128;
const ENVIRONMENT_FAR = DOME_RADIUS * 1.5;

export const TABLE_MOUNTAIN_MODEL = "setting/table-mountain-silhouette.glb";

// Table Mountain is about 50 km away, so it keeps that apparent size at this distance.
const MOUNTAIN_DISTANCE = 18000;
const MOUNTAIN_SCALE = MOUNTAIN_DISTANCE / 50000;
const MOUNTAIN_HAZE = 0.45;

function createDomeMaterial(sunDirection: Vector3): ShaderMaterial {
  const horizon = new Color(HORIZON_COLOR);
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizon: new Uniform(horizon),
      below: new Uniform(horizon.clone()),
      middle: new Uniform(new Color(MIDDLE_SKY_COLOR)),
      zenith: new Uniform(new Color(ZENITH_COLOR)),
      glowColor: new Uniform(new Color(SUN_GLOW_COLOR)),
      sunDirection: new Uniform(sunDirection.clone().normalize()),
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 horizon;
      uniform vec3 below;
      uniform vec3 middle;
      uniform vec3 zenith;
      uniform vec3 glowColor;
      uniform vec3 sunDirection;
      varying vec3 vDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        float up = max(direction.y, 0.0);
        vec3 color = mix(horizon, middle, smoothstep(0.0, 0.16, up));
        color = mix(color, zenith, smoothstep(0.08, 0.75, up));

        float toSun = max(dot(direction, sunDirection), 0.0);
        float aboveHorizon = smoothstep(0.0, 0.05, direction.y);
        color += glowColor * aboveHorizon * (0.28 * pow(toSun, 9.0) + 2.2 * pow(toSun, 900.0));

        color = mix(below, color, smoothstep(-0.005, 0.0, direction.y));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The silhouette, shaded from hazy blue at its peak to the horizon at its foot. */
function createMountain(model: KitModel): Mesh {
  const merged = mergeGeometries(model.pieces.map(({ geometry }) => geometry.clone()));
  if (!merged) {
    throw new Error("The mountain's pieces could not be merged");
  }
  const position = merged.getAttribute("position");
  const colors = new Float32Array(position.count * 3);
  const peak = new Color();
  peak.copy(model.pieces[0].material.color).lerp(new Color(HORIZON_COLOR), MOUNTAIN_HAZE);
  const foot = new Color(HORIZON_COLOR);
  const shade = new Color();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const rise = Math.min(1, position.getY(vertex) / (model.height * 0.55));
    shade.lerpColors(foot, peak, rise);
    colors.set([shade.r, shade.g, shade.b], vertex * 3);
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));

  const mesh = new Mesh(merged, new MeshBasicMaterial({ vertexColors: true, fog: false }));
  mesh.scale.setScalar(MOUNTAIN_SCALE);
  // Z runs south, and the mountain stands far to the south.
  mesh.position.z = MOUNTAIN_DISTANCE;
  mesh.rotation.y = Math.PI;
  return mesh;
}

export interface Sky {
  readonly object: Group;
  /** A blurred copy of the sky, for materials to reflect. */
  readonly environment: Texture;
  dispose(): void;
  /** Keeps the sky centred on the camera, so it seems infinitely far away. */
  follow(camera: Camera): void;
}

export function createSky(
  renderer: WebGLRenderer,
  sunDirection: Vector3,
  mountain: KitModel | undefined,
): Sky {
  const material = createDomeMaterial(sunDirection);
  const dome = new Mesh(
    new SphereGeometry(DOME_RADIUS, DOME_SEGMENTS, DOME_SEGMENTS / 2),
    material,
  );
  dome.renderOrder = DOME_RENDER_ORDER;
  dome.frustumCulled = false;

  material.uniforms.below.value = new Color(REFLECTED_GROUND_COLOR);
  const capture = new Scene();
  capture.add(dome);
  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(capture, 0, 1, ENVIRONMENT_FAR, {
    size: ENVIRONMENT_RESOLUTION,
  });
  const environment = target.texture;
  generator.dispose();
  material.uniforms.below.value = new Color(HORIZON_COLOR);

  const object = new Group();
  object.name = "sky";
  object.add(dome);
  if (mountain) {
    object.add(createMountain(mountain));
  }

  return {
    object,
    environment,
    dispose() {
      target.dispose();
    },
    follow(camera) {
      object.position.copy(camera.position);
    },
  };
}
