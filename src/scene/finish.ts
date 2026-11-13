import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import {
  BufferGeometry,
  DepthStencilFormat,
  DepthTexture,
  Float32BufferAttribute,
  HalfFloatType,
  Matrix4,
  Mesh,
  ShaderMaterial,
  UnsignedInt248Type,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

/** Smooths the scene's edges, since it's no longer drawn straight to the screen. */
const SAMPLES = 4;

// Only light well above a sunlit white roof glows: the sun, glints on the
// water and glass, and the fireworks.
const BLOOM_THRESHOLD = 1.9;
const BLOOM_STRENGTH = 0.32;
const BLOOM_RADIUS = 0.55;
/** The brightest a pixel can be when it's picked out to glow. */
const BLOOM_CEILING = 24;

/**
 * Picks out the light that glows. It replaces the glow pass's own, which lets
 * through a pixel too bright for the texture to hold: a glint straight off
 * glass or water, say. Blurring one of those turns the whole frame black.
 */
const BRIGHT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  varying vec2 vUv;

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;
    if (any(isnan(color))) {
      color = vec3(0.0);
    }
    color = clamp(color, 0.0, ${BLOOM_CEILING.toFixed(1)});
    float bright = smoothstep(
      luminosityThreshold,
      luminosityThreshold + smoothWidth,
      dot(color, vec3(0.2126, 0.7152, 0.0722))
    );
    gl_FragColor = vec4(color * bright, bright);
  }
`;

/** How far the top and bottom of the view are blurred at most, in CSS pixels. */
const TILT_SHIFT_RADIUS = 3.2;
/** The band across the middle of the view that stays sharp, as a share of its height either side. */
const FOCUS_BAND = 0.2;
/** How much the corners of the view darken. */
const VIGNETTE = 0.2;
/** How much richer the colours are than as lit. */
const SATURATION = 1.1;

/** How much a cloud's shadow darkens the ground under it. */
const CLOUD_SHADE = 0.3;
/** The size of the largest clouds, in metres. */
const CLOUD_SIZE = 950;
/** The clouds' drift, in metres per second east and south. Faster than real, so it shows from the air. */
const CLOUD_DRIFT = new Vector2(21, 9);
/** Shadows fade out over this distance from the camera, into the haze, in metres. */
const CLOUD_FADE = [5200, 9500] as const;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D scene;
  uniform sampler2D depth;
  uniform mat4 projectionInverse;
  uniform mat4 viewInverse;
  uniform vec2 texel;
  uniform float blurRadius;
  uniform float seconds;
  uniform float cloudShade;
  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 within = fract(point);
    vec2 ease = within * within * (3.0 - 2.0 * within);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), ease.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), ease.x),
      ease.y
    );
  }

  /** How much cloud is overhead, from 0 to 1. */
  float cloudCover(vec2 point) {
    float cover = noise(point) * 0.58 + noise(point * 2.3 + 7.3) * 0.3 + noise(point * 5.1 + 3.1) * 0.12;
    return smoothstep(0.5, 0.74, cover);
  }

  /** The scene's colour, without the odd pixel too bright for the texture to hold. */
  vec3 sceneColor(vec2 at) {
    vec3 color = texture2D(scene, at).rgb;
    if (any(isnan(color))) {
      return vec3(0.0);
    }
    return clamp(color, 0.0, 64.0);
  }

  void main() {
    // The miniature look: sharp across the middle, softer towards the top and bottom.
    float blur = blurRadius * smoothstep(${FOCUS_BAND.toFixed(2)}, 0.5, abs(vUv.y - 0.5));
    vec3 color = sceneColor(vUv);
    if (blur > 0.25) {
      for (int tap = 0; tap < 12; tap++) {
        // Points spread evenly over a disc.
        float angle = float(tap) * 2.399963;
        float reach = sqrt((float(tap) + 0.5) / 12.0) * blur;
        color += sceneColor(vUv + vec2(cos(angle), sin(angle)) * reach * texel);
      }
      color /= 13.0;
    }

    float deep = texture2D(depth, vUv).x;
    if (cloudShade > 0.0 && deep < 1.0) {
      vec4 view = projectionInverse * vec4(vUv * 2.0 - 1.0, deep * 2.0 - 1.0, 1.0);
      view /= view.w;
      vec3 world = (viewInverse * view).xyz;
      vec2 drift = vec2(${CLOUD_DRIFT.x.toFixed(1)}, ${CLOUD_DRIFT.y.toFixed(1)}) * seconds;
      float cover = cloudCover((world.xz - drift) / ${CLOUD_SIZE.toFixed(1)});
      float near = 1.0 - smoothstep(${CLOUD_FADE[0].toFixed(1)}, ${CLOUD_FADE[1].toFixed(1)}, length(view.xyz));
      // Shade is cooler than sunlight, as the sky still lights the ground.
      color *= mix(vec3(1.0), vec3(0.9, 0.96, 1.08) * (1.0 - cloudShade), cover * near);
    }

    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = max(mix(vec3(grey), color, ${SATURATION.toFixed(2)}), 0.0);
    float corner = smoothstep(0.45, 1.0, length((vUv - 0.5) * 1.5));
    color *= 1.0 - ${VIGNETTE.toFixed(2)} * corner;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One triangle that covers the whole view. */
function fullScreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return geometry;
}

/** What one frame is drawn with. */
export interface FinishLook {
  /** Seconds the clouds have been drifting. */
  readonly seconds: number;
  /** How strong the miniature blur is, from 0 to 1. */
  readonly tiltShift: number;
}

/**
 * The finish over the drawn scene, on devices that can afford it: a glow
 * round the brightest light, cloud shadows drifting over the land, a soft
 * blur towards the top and bottom of the view that makes the site look like a
 * model, and a little more colour and a darker corner. The scene is drawn
 * into a texture first, and one pass puts it on screen.
 */
export class Finish {
  /** What the scene itself took to draw in the last frame, before the passes over it. */
  readonly drawn = { calls: 0, triangles: 0 };

  // Roads and markings use the stencil buffer to cover each pixel once where
  // they cross, so the texture needs one as the screen has.
  private readonly target = new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    samples: SAMPLES,
    stencilBuffer: true,
    depthTexture: new DepthTexture(
      1,
      1,
      UnsignedInt248Type,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DepthStencilFormat,
    ),
  });

  private readonly bloom = new UnrealBloomPass(
    new Vector2(1, 1),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  );

  private readonly material = new ShaderMaterial({
    uniforms: {
      scene: { value: this.target.texture },
      depth: { value: this.target.depthTexture },
      projectionInverse: { value: new Matrix4() },
      viewInverse: { value: new Matrix4() },
      texel: { value: new Vector2(1, 1) },
      blurRadius: { value: 0 },
      seconds: { value: 0 },
      cloudShade: { value: CLOUD_SHADE },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });

  private readonly screen = new Mesh(fullScreenTriangle(), this.material);
  private readonly size = new Vector2();

  constructor(private readonly renderer: WebGLRenderer) {
    this.screen.frustumCulled = false;
    this.bloom.materialHighPassFilter.fragmentShader = BRIGHT_FRAGMENT_SHADER;
  }

  /** Draws the scene from `camera` to the screen. */
  render(scene: Scene, camera: PerspectiveCamera, look: FinishLook): void {
    const { renderer } = this;
    renderer.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target.setSize(this.size.x, this.size.y);
      this.bloom.setSize(this.size.x, this.size.y);
    }

    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    this.drawn.calls = renderer.info.render.calls;
    this.drawn.triangles = renderer.info.render.triangles;
    // The glow is added to the scene's own texture.
    this.bloom.render(renderer, this.target, this.target, 0, false);
    renderer.setRenderTarget(null);

    const { uniforms } = this.material;
    uniforms.projectionInverse.value.copy(camera.projectionMatrixInverse);
    uniforms.viewInverse.value.copy(camera.matrixWorld);
    uniforms.texel.value.set(1 / this.size.x, 1 / this.size.y);
    uniforms.blurRadius.value = TILT_SHIFT_RADIUS * renderer.getPixelRatio() * look.tiltShift;
    uniforms.seconds.value = look.seconds;
    renderer.render(this.screen, camera);
  }
}
