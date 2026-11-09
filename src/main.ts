import { NeutralToneMapping, PCFShadowMap, Scene, WebGLRenderer } from "three";
import { createSite } from "./draw/site.ts";
import { addLighting } from "./scene/lighting.ts";
import { constrainView, createCamera, createControls } from "./scene/view.ts";
import "./style.css";
import { createGround } from "./terrain/ground.ts";

const MAX_PIXEL_RATIO = 2;

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("The page is missing its #app element");
}

const renderer = new WebGLRenderer({ antialias: true });
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
host.append(renderer.domElement);

const scene = new Scene();
addLighting(scene);
const ground = createGround(renderer.capabilities.getMaxAnisotropy());
scene.add(ground.mesh, createSite(ground.surface));

const camera = createCamera(host.clientWidth / host.clientHeight);
const controls = createControls(camera, renderer.domElement);
constrainView(camera, controls);

function render(): void {
  renderer.render(scene, camera);
}

new ResizeObserver(() => {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (width === 0 || height === 0) {
    return;
  }
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
  render();
}).observe(host);

// The scene is static, so frames are only drawn when the view changes.
renderer.setAnimationLoop(() => {
  if (controls.update()) {
    constrainView(camera, controls);
    render();
  }
});
