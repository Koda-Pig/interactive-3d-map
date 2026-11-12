import type { PerspectiveCamera } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import type { ArrivalMode } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import { resolvePath, samplePath } from "../layout/path.ts";
import type { GroundSurface } from "../terrain/ground.ts";

/** Spacing of the points the lines are built from, in metres. */
const STEP = 4;
/** How far the line's middle sits above the ground, in metres. */
const LIFT = 0.6;
/** How long the lines take to fade in or out, in milliseconds. */
const FADE = 450;

interface Look {
  /** Half the line's width on screen, in pixels. */
  readonly halfPixels: number;
  /** The narrowest half-width it gets close up, in metres. */
  readonly minHalf: number;
  readonly band: string;
  readonly mark: string;
  readonly bandOpacity: number;
  /** How far apart the arrows or dots are, in pixels at the orbit point. */
  readonly spacingPixels: number;
  /** How many marks pass a point each second. */
  readonly speed: number;
  /** 0 draws arrows, 1 draws dots. */
  readonly dots: number;
}

// Driving routes are BMR cyan with white arrows. Walking routes are white with
// navy dots, so the two read apart from each other and from the amber selection.
const LOOKS: Readonly<Record<ArrivalMode, Look>> = {
  drive: {
    halfPixels: 5,
    minHalf: 2.5,
    band: "#1CA7EC",
    mark: "#FFFFFF",
    bandOpacity: 0.85,
    spacingPixels: 26,
    speed: 1.4,
    dots: 0,
  },
  walk: {
    halfPixels: 4.2,
    minHalf: 1.6,
    band: "#FFFFFF",
    mark: "#004272",
    bandOpacity: 0.9,
    spacingPixels: 16,
    speed: 1.2,
    dots: 1,
  },
};

const VERTEX = /* glsl */ `
  attribute vec2 across;
  attribute float side;
  attribute float along;
  uniform float pixel;
  uniform float halfPixels;
  uniform float minHalf;
  varying float vAlong;
  varying float vSide;
  varying float vHalf;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // The line keeps about the same width on screen however far away it is.
    float halfWidth = max(minHalf, distance(cameraPosition, world.xyz) * pixel * halfPixels);
    world.xz += across * side * halfWidth;
    // Wider lines rise a little more, so the ground under their edges stays below them.
    world.y += halfWidth * 0.3;
    vAlong = along;
    vSide = side;
    vHalf = halfWidth;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 band;
  uniform vec3 mark;
  uniform float bandOpacity;
  uniform float spacing;
  uniform float time;
  uniform float speed;
  uniform float dots;
  uniform float opacity;
  varying float vAlong;
  varying float vSide;
  varying float vHalf;

  void main() {
    float across = abs(vSide);
    float aa = fwidth(across) * 1.5;
    // A soft dark edge keeps the line clear of pale wheat and paving.
    float inside = 1.0 - smoothstep(1.0 - aa, 1.0, across);
    float edge = smoothstep(0.72 - aa, 0.72, across);
    vec3 colour = mix(band, vec3(0.0, 0.16, 0.28), edge * 0.6);
    float alpha = bandOpacity * inside;

    float phase = vAlong / spacing - time * speed;
    float marked;
    if (dots > 0.5) {
      vec2 local = vec2(vSide * vHalf, (fract(phase) - 0.5) * spacing);
      float radius = vHalf * 0.62;
      float blur = fwidth(local.y) * 1.5;
      marked = 1.0 - smoothstep(radius - blur, radius, length(local));
    } else {
      // Chevrons pointing the way to go, at 45 degrees to the line.
      // The middle leads, so each chevron points along the line.
      float chevron = fract(phase + across * vHalf / spacing);
      float blur = fwidth(phase) * 1.5;
      marked = smoothstep(0.0, blur, chevron) * (1.0 - smoothstep(0.32, 0.32 + blur, chevron));
      marked *= 1.0 - smoothstep(0.62, 0.7, across);
    }
    colour = mix(colour, mark, marked);
    alpha = max(alpha, marked * inside);
    gl_FragColor = vec4(colour, alpha * opacity);
    // The colours are given in linear space, like every other material's.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function lineGeometry(mode: ArrivalMode, surface: GroundSurface): BufferGeometry | null {
  const positions: number[] = [];
  const across: number[] = [];
  const sides: number[] = [];
  const along: number[] = [];
  const indices: number[] = [];
  for (const route of layout.arrivals) {
    for (const leg of route.legs) {
      if (leg.mode !== mode) {
        continue;
      }
      const first = positions.length / 3;
      const samples = samplePath(resolvePath(leg.path, false), STEP, false);
      for (const [index, sample] of samples.entries()) {
        const y = surface.heightAt(sample.x, sample.z) + LIFT;
        for (const side of [-1, 1]) {
          positions.push(sample.x, y, sample.z);
          across.push(-sample.dirZ, sample.dirX);
          sides.push(side);
          along.push(sample.distance);
        }
        if (index > 0) {
          const a = first + (index - 1) * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
  }
  if (indices.length === 0) {
    return null;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("across", new BufferAttribute(new Float32Array(across), 2));
  geometry.setAttribute("side", new BufferAttribute(new Float32Array(sides), 1));
  geometry.setAttribute("along", new BufferAttribute(new Float32Array(along), 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function lineMaterial(look: Look): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      pixel: { value: 0 },
      halfPixels: { value: look.halfPixels },
      minHalf: { value: look.minHalf },
      band: { value: new Color(look.band) },
      mark: { value: new Color(look.mark) },
      bandOpacity: { value: look.bandOpacity },
      spacing: { value: 20 },
      time: { value: 0 },
      speed: { value: look.speed },
      dots: { value: look.dots },
      opacity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
}

const toTarget = new Vector3();

/**
 * Animated lines along the ways into the venue on an event day: arrows along
 * the roads from the N7 and the aerodrome to the car parks, and dots along the
 * walks from the car parks and Kalbaskraal station to the gates.
 */
export class ArrivalRoutes {
  readonly object = new Group();

  private readonly materials: { material: ShaderMaterial; look: Look }[] = [];
  private shown = false;
  private opacity = 0;
  private lastUpdate: number | null = null;
  private startedAt: number | null = null;

  constructor(surface: GroundSurface) {
    this.object.name = "arrival-routes";
    for (const mode of ["drive", "walk"] as const) {
      const geometry = lineGeometry(mode, surface);
      if (!geometry) {
        continue;
      }
      const material = lineMaterial(LOOKS[mode]);
      const mesh = new Mesh(geometry, material);
      mesh.name = `arrival-${mode}`;
      // Drawn after the ground and the roads, and never in the shadow pass.
      mesh.renderOrder = 2;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // The lines widen in the vertex shader, past their geometry's bounds.
      mesh.frustumCulled = false;
      this.materials.push({ material, look: LOOKS[mode] });
      this.object.add(mesh);
    }
    this.object.visible = false;
  }

  /** Fades the lines in or out. Under reduced motion they appear without moving. */
  setShown(shown: boolean): void {
    this.shown = shown;
  }

  /** Whether the lines are on screen or fading, so the map has to keep drawing. */
  get active(): boolean {
    return this.shown || this.opacity > 0;
  }

  /** Moves the marks along and fits them to the camera. Returns whether anything changed. */
  update(now: number, camera: PerspectiveCamera, target: Vector3, viewHeight: number): boolean {
    const elapsed = this.lastUpdate === null ? 0 : now - this.lastUpdate;
    this.lastUpdate = now;
    if (!this.active) {
      this.startedAt = null;
      return false;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduced ? 1 : elapsed / FADE;
    const before = this.opacity;
    this.opacity = MathUtils.clamp(this.opacity + (this.shown ? step : -step), 0, 1);
    this.object.visible = this.opacity > 0;

    this.startedAt ??= now;
    const seconds = reduced ? 0 : (now - this.startedAt) / 1000;
    const pixel = (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / Math.max(viewHeight, 1);
    const reach = toTarget.subVectors(camera.position, target).length() * pixel;
    for (const { material, look } of this.materials) {
      // Marks are spaced for the distance to the orbit point, in steps of a
      // power of two, so zooming doesn't keep sliding them along the line.
      const wanted = Math.max(reach * look.spacingPixels, 4);
      material.uniforms.pixel.value = pixel;
      material.uniforms.spacing.value = 2 ** Math.round(Math.log2(wanted));
      material.uniforms.time.value = seconds;
      material.uniforms.opacity.value = this.opacity;
    }
    // Under reduced motion the marks stand still, so only a fade needs a new frame.
    return this.opacity !== before || (!reduced && this.opacity > 0);
  }
}
