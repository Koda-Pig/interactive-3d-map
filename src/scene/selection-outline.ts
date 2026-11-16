import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from "three";
import { SELECTION } from "../draw/materials.ts";

/** The line's width on screen, in CSS pixels, whatever the zoom. */
const WIDTH = 3;
/** A dark rim outside the line, in CSS pixels, so it holds up on pale paving and roofs. */
const RIM_WIDTH = 1.25;
const RIM_COLOR = new Color("#00243F");
const RIM_OPACITY = 0.55;
/** Matches the highlight fade in `materials.ts`, in milliseconds. */
const FADE_TIME = 150;
/** Only the selection is on this layer, so a camera set to it draws nothing else. */
const MASK_LAYER = 1;
const MASK_SAMPLES = 4;
/** Directions sampled around each pixel. Fewer leaves flats on the line's corners. */
const TAPS = 12;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D mask;
  uniform vec2 texel;
  uniform float lineRadius;
  uniform float rimRadius;
  uniform vec3 lineColor;
  uniform vec3 rimColor;
  uniform float rimOpacity;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    float inside = texture2D(mask, vUv).r;
    float line = 0.0;
    float rim = 0.0;
    for (int i = 0; i < ${TAPS}; i++) {
      float angle = float(i) * ${((Math.PI * 2) / TAPS).toFixed(6)};
      vec2 direction = vec2(cos(angle), sin(angle)) * texel;
      line = max(line, texture2D(mask, vUv + direction * lineRadius).r);
      line = max(line, texture2D(mask, vUv + direction * lineRadius * 0.5).r);
      rim = max(rim, texture2D(mask, vUv + direction * rimRadius).r);
    }
    float outside = 1.0 - inside;
    float lineAlpha = line * outside;
    float rimAlpha = max(rim, line) * outside * rimOpacity;
    float alpha = max(lineAlpha, rimAlpha) * opacity;
    if (alpha <= 0.0) {
      discard;
    }
    gl_FragColor = vec4(mix(rimColor, lineColor, lineAlpha), alpha);
    #include <colorspace_fragment>
  }
`;

/** One triangle that covers the whole view. */
function fullScreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return geometry;
}

/**
 * A line around the silhouette of the selection, drawn over the finished
 * frame. The selection keeps its own colours, and the line shows through
 * anything standing in front of it.
 */
export class SelectionOutline {
  private readonly target = new WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    samples: MASK_SAMPLES,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });

  private readonly maskMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    fog: false,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  private readonly material = new ShaderMaterial({
    uniforms: {
      mask: { value: this.target.texture },
      texel: { value: new Vector2(1, 1) },
      lineRadius: { value: WIDTH },
      rimRadius: { value: WIDTH + RIM_WIDTH },
      lineColor: { value: SELECTION },
      rimColor: { value: RIM_COLOR },
      rimOpacity: { value: RIM_OPACITY },
      opacity: { value: 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  private readonly overlay = new Mesh(fullScreenTriangle(), this.material);

  private outlined: Object3D | null = null;
  /** 0 is invisible and 1 fully shown; the direction says which way it's heading. */
  private strength = 0;
  private direction: 0 | 1 | -1 = 0;
  private at: number | null = null;
  private readonly size = new Vector2();

  constructor() {
    this.overlay.frustumCulled = false;
  }

  /** Draws around everything in `object` but its surrounding ground, or clears the line with `null`. */
  show(object: Object3D | null): void {
    if (!object) {
      if (this.strength > 0) {
        this.direction = -1;
      }
      return;
    }
    if (object !== this.outlined) {
      this.setMasked(false);
      this.outlined = object;
      this.setMasked(true);
    }
    this.direction = 1;
  }

  /** Advances the fade. Call once a frame, with the render loop's clock. */
  update(now: number): boolean {
    if (this.direction === 0) {
      return false;
    }
    this.at ??= now;
    const step = (now - this.at) / FADE_TIME;
    this.at = now;
    const goal = this.direction === 1 ? 1 : 0;
    this.strength =
      goal > this.strength ? Math.min(this.strength + step, 1) : Math.max(this.strength - step, 0);
    this.material.uniforms.opacity.value = this.strength * this.strength * (3 - 2 * this.strength);
    if (this.direction === -1 && this.strength === 0) {
      this.setMasked(false);
      this.outlined = null;
      this.direction = 0;
      this.at = null;
      // One more frame, without the line.
      return true;
    }
    if (this.direction === 1 && this.strength === 1) {
      this.direction = 0;
      this.at = null;
    }
    return true;
  }

  /** Draws the line over the frame just rendered from `camera`. */
  render(renderer: WebGLRenderer, scene: Scene, camera: Camera): void {
    if (!this.outlined || this.strength === 0) {
      return;
    }
    renderer.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target.setSize(this.size.x, this.size.y);
    }
    const pixelRatio = renderer.getPixelRatio();
    const { uniforms } = this.material;
    uniforms.texel.value.set(1 / this.size.x, 1 / this.size.y);
    uniforms.lineRadius.value = WIDTH * pixelRatio;
    uniforms.rimRadius.value = (WIDTH + RIM_WIDTH) * pixelRatio;

    const cameraLayers = camera.layers.mask;
    const { overrideMaterial, background } = scene;
    const { autoClear } = renderer;
    const clearAlpha = renderer.getClearAlpha();
    const clearColor = renderer.getClearColor(new Color());

    // The selection alone, in white on black.
    camera.layers.set(MASK_LAYER);
    scene.overrideMaterial = this.maskMaterial;
    scene.background = null;
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    scene.overrideMaterial = overrideMaterial;
    scene.background = background;
    camera.layers.mask = cameraLayers;

    renderer.autoClear = false;
    renderer.render(this.overlay, camera);
    renderer.autoClear = autoClear;
  }

  dispose(): void {
    this.setMasked(false);
    this.target.dispose();
    this.material.dispose();
    this.maskMaterial.dispose();
    this.overlay.geometry.dispose();
  }

  private setMasked(masked: boolean): void {
    this.outlined?.traverse((child) => {
      if (child.userData.surround) {
        return;
      }
      if (masked) {
        child.layers.enable(MASK_LAYER);
      } else {
        child.layers.disable(MASK_LAYER);
      }
    });
  }
}
