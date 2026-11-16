import type { Camera, Scene, WebGLRenderer } from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
export const inspection = new WeakMap<
  HTMLElement,
  { renderer: WebGLRenderer; scene: Scene; camera: Camera; controls: OrbitControls }
>();
