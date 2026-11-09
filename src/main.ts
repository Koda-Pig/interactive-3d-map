import { NeutralToneMapping, PCFShadowMap, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createSite } from "./draw/site.ts";
import { CameraFlight } from "./scene/flight.ts";
import { MapInteraction } from "./scene/interaction.ts";
import { SiteLabels } from "./scene/labels.ts";
import { addLighting } from "./scene/lighting.ts";
import { createPicker } from "./scene/picking.ts";
import { constrainView, createCamera, createControls } from "./scene/view.ts";
import "./style.css";
import { createGround } from "./terrain/ground.ts";
import { createInfoPanel } from "./ui/info-panel.ts";

const MAX_PIXEL_RATIO = 2;

const host = document.querySelector<HTMLElement>("#app");
const infoPanelElement = document.querySelector<HTMLElement>("#info-panel");
if (!host || !infoPanelElement) {
  throw new Error("The page is missing its #app or #info-panel element");
}

const renderer = new WebGLRenderer({ antialias: true });
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
host.append(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.classList.add("labels");
host.append(labelRenderer.domElement);

const scene = new Scene();
addLighting(scene);
const ground = createGround(renderer.capabilities.getMaxAnisotropy());
const site = createSite(ground.surface);
scene.add(ground.mesh, site);

const camera = createCamera(host.clientWidth / host.clientHeight);
const controls = createControls(camera, renderer.domElement);
constrainView(camera, controls);

const labels = new SiteLabels(site, labelRenderer.domElement);
const flight = new CameraFlight(camera, controls);
const panel = createInfoPanel(infoPanelElement, () => interaction.select(null));

let needsRender = false;

const interaction = new MapInteraction({
  canvas: renderer.domElement,
  site,
  pick: createPicker(site, camera, ground.surface),
  labels,
  flight,
  panel,
  onChange: () => {
    needsRender = true;
  },
});

function render(): void {
  renderer.render(scene, camera);
  const { width, height } = labelRenderer.getSize();
  labels.layout(camera, width, height);
  labelRenderer.render(labels.root, camera);
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
  labelRenderer.setSize(width, height);
  render();
}).observe(host);

// The scene is static, so frames are only drawn when something has changed.
renderer.setAnimationLoop((now) => {
  const flying = flight.update(now);
  const moved = controls.update() || flying;
  if (moved) {
    constrainView(camera, controls);
  }
  interaction.update(moved);
  if (moved || needsRender) {
    needsRender = false;
    render();
  }
});
