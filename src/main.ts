import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import { NeutralToneMapping, PCFShadowMap, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { layoutModelFiles, loadKit } from "./draw/kit.ts";
import { createScenery, SCENERY_MODELS } from "./draw/scenery.ts";
import { createSite } from "./draw/site.ts";
import { setEventMode } from "./scene/event-modes.ts";
import { CameraFlight } from "./scene/flight.ts";
import { MapInteraction } from "./scene/interaction.ts";
import { SiteLabels } from "./scene/labels.ts";
import { addLighting, SUN_DIRECTION } from "./scene/lighting.ts";
import { FrameMonitor } from "./scene/performance.ts";
import { createPicker } from "./scene/picking.ts";
import { Precincts } from "./scene/precincts.ts";
import { detectQuality } from "./scene/quality.ts";
import { SelectionOutline } from "./scene/selection-outline.ts";
import { createSky, TABLE_MOUNTAIN_MODEL } from "./scene/sky.ts";
import { constrainView, createCamera, createControls } from "./scene/view.ts";
import "./style.css";
import { createGround } from "./terrain/ground.ts";
import { createEventSwitch } from "./ui/event-switch.ts";
import { createInfoPanel } from "./ui/info-panel.ts";
import { createSidebar } from "./ui/sidebar.ts";

/** How much of the sky's light reaches materials that reflect it. */
const ENVIRONMENT_INTENSITY = 0.4;

const host = document.querySelector<HTMLElement>("#app");
const infoPanelElement = document.querySelector<HTMLElement>("#info-panel");
const sidebarElement = document.querySelector<HTMLElement>("#sidebar");
const eventSwitchElement = document.querySelector<HTMLElement>("#event-switch");
const loadingElement = document.querySelector<HTMLElement>("#loading");
if (!host || !infoPanelElement || !sidebarElement || !eventSwitchElement || !loadingElement) {
  throw new Error("The page is missing one of its main elements");
}

// Anything that stops the map starting would otherwise leave the loading message up for good.
const showStartupFailure = (): void => {
  loadingElement.textContent =
    "The map couldn't start. Check that WebGL is turned on, or try another browser.";
};
window.addEventListener("error", showStartupFailure);
window.addEventListener("unhandledrejection", showStartupFailure);

const quality = detectQuality();

const renderer = new WebGLRenderer({ antialias: true });
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
// Shadows only change when something appears or disappears, so the shadow pass
// is skipped while the camera moves, which is most of the work on a phone.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
host.append(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.classList.add("labels");
host.append(labelRenderer.domElement);

// Labels measure their text once, so their font has to be ready first. If it
// can't be fetched, they use the fallback font.
const labelFont = document.fonts.load("500 12px Roboto").catch(() => []);
const [kit] = await Promise.all([
  loadKit([...layoutModelFiles(), ...SCENERY_MODELS, TABLE_MOUNTAIN_MODEL]),
  labelFont,
]);

const scene = new Scene();
const sunShadow = addLighting(scene, quality);
const sky = createSky(renderer, SUN_DIRECTION, kit.get(TABLE_MOUNTAIN_MODEL));
scene.environment = sky.environment;
scene.environmentIntensity = ENVIRONMENT_INTENSITY;
const ground = createGround(renderer.capabilities.getMaxAnisotropy(), quality.fieldTextureSize);
const site = createSite(ground.surface, kit);
const scenery = createScenery(kit, ground.surface, quality);
const outline = new SelectionOutline(ground.surface);
scene.add(
  sky.object,
  ground.mesh,
  site,
  scenery.setting,
  outline.object,
  ...scenery.precincts.values(),
);

const camera = createCamera(host.clientWidth / host.clientHeight);
const controls = createControls(camera, renderer.domElement);
constrainView(camera, controls);

const precincts = new Precincts(site, scenery.precincts);
const labels = new SiteLabels(site, labelRenderer.domElement, precincts);
const flight = new CameraFlight(camera, controls);
const panel = createInfoPanel(infoPanelElement, () => interaction.select(null));
const sidebar = createSidebar(sidebarElement, {
  pick: (location) => interaction.select(location),
  togglePrecinct: (category, shown) => interaction.setPrecinctShown(category, shown),
  resetView: () => interaction.resetView(),
});

let needsRender = false;

const interaction = new MapInteraction({
  canvas: renderer.domElement,
  site,
  pick: createPicker(precincts, camera, ground.surface),
  labels,
  flight,
  panel,
  sidebar,
  precincts,
  outline,
  onChange: () => {
    needsRender = true;
  },
});

createEventSwitch(eventSwitchElement, (mode) => {
  setEventMode(mode, precincts, scenery.events);
  renderer.shadowMap.needsUpdate = true;
  needsRender = true;
});

let pixelRatio = Math.min(window.devicePixelRatio, quality.maxPixelRatio);

const setPixelRatio = (ratio: number): void => {
  pixelRatio = ratio;
  renderer.setPixelRatio(ratio);
  renderer.setSize(host.clientWidth, host.clientHeight, false);
};

const frames = new FrameMonitor(renderer, quality, (ratio) => {
  setPixelRatio(ratio);
  // Resizing the canvas clears it, and the view may have just stopped moving.
  needsRender = true;
});

function render(): void {
  sky.follow(camera);
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
  setPixelRatio(pixelRatio);
  labelRenderer.setSize(width, height);
  sunShadow.refit();
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
  const changes = precincts.update(now);
  if (changes.shadows) {
    renderer.shadowMap.needsUpdate = true;
  }
  if (sunShadow.update(now, camera, controls.target, moved)) {
    renderer.shadowMap.needsUpdate = true;
    needsRender = true;
  }
  const drawing = moved || changes.redraw || needsRender;
  if (drawing) {
    needsRender = false;
    render();
  }
  frames.tick(now, drawing);
});

window.removeEventListener("error", showStartupFailure);
window.removeEventListener("unhandledrejection", showStartupFailure);
loadingElement.remove();
