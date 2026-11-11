import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import { NeutralToneMapping, PCFShadowMap, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { layoutModelFiles, loadKit } from "./draw/kit.ts";
import { updateHighlights } from "./draw/materials.ts";
import { createScenery, FIREWORKS_LOCATION, SCENERY_MODELS } from "./draw/scenery.ts";
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
import { createHint, createMapControls } from "./ui/map-controls.ts";
import type { ClearArea } from "./ui/overlays.ts";
import { MapOverlays } from "./ui/overlays.ts";
import { createSidebar } from "./ui/sidebar.ts";

/** How much of the sky's light reaches materials that reflect it. */
const ENVIRONMENT_INTENSITY = 0.4;
/** How much closer or further one press of a zoom button or key takes the camera. */
const ZOOM_STEP = 0.6;
/** How far one press of an arrow moves the map, as a share of the camera's distance. */
const PAN_STEP = 0.18;
/** How far one press turns the view, in radians. */
const TURN_STEP = Math.PI / 12;
/** How far one press tilts the view, in radians. */
const TILT_STEP = Math.PI / 24;
/** Matches the phone layout in `style.css`, where the sidebar is a sheet along the bottom. */
const PHONE_LAYOUT = window.matchMedia("(max-width: 600px)");

const host = document.querySelector<HTMLElement>("#app");
const infoPanelElement = document.querySelector<HTMLElement>("#info-panel");
const sidebarElement = document.querySelector<HTMLElement>("#sidebar");
const eventSwitchElement = document.querySelector<HTMLElement>("#event-switch");
const loadingElement = document.querySelector<HTMLElement>("#loading");
const mapControlsElement = document.querySelector<HTMLElement>("#map-controls");
const hintElement = document.querySelector<HTMLElement>("#hint");
const noticeElement = document.querySelector<HTMLElement>(".notice");
const sheetHandle = document.querySelector<HTMLElement>(".sidebar__handle");
const sidebarOpenElement = document.querySelector<HTMLElement>("#sidebar-open");
if (
  !host ||
  !infoPanelElement ||
  !sidebarElement ||
  !eventSwitchElement ||
  !loadingElement ||
  !mapControlsElement ||
  !hintElement ||
  !noticeElement ||
  !sheetHandle ||
  !sidebarOpenElement
) {
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
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute(
  "aria-label",
  "Map of the site. Arrow keys move it, and plus and minus zoom.",
);
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
// Everything that sits on top of the map. Flights and labels keep clear of them.
const overlays = new MapOverlays(host, [
  () => infoPanelElement.getBoundingClientRect(),
  () => eventSwitchElement.getBoundingClientRect(),
  () => noticeElement.getBoundingClientRect(),
  () => mapControlsElement.getBoundingClientRect(),
  // On a wide screen the sidebar lies over the map's left edge: the whole
  // panel when it's open, and only its button when it's closed. It's measured
  // as it will be once it has finished opening or closing.
  () => {
    const width = sidebar.panelWidth();
    return width > 0
      ? { left: 0, top: 0, right: width, bottom: window.innerHeight }
      : sidebarOpenElement.getBoundingClientRect();
  },
  // On a phone the closed sidebar is a strip along the bottom. It's measured
  // as if closed, because picking from the open list closes it.
  () =>
    PHONE_LAYOUT.matches
      ? {
          left: 0,
          top: window.innerHeight - sheetHandle.offsetHeight,
          right: window.innerWidth,
          bottom: window.innerHeight,
        }
      : null,
]);

/** The map less the strip the open sidebar covers, which the opening view is centred in. */
const besideSidebar = (): ClearArea => {
  const viewWidth = host.clientWidth;
  const viewHeight = host.clientHeight;
  const left = Math.min(sidebar.panelWidth(), viewWidth / 2);
  return { left, top: 0, right: viewWidth, bottom: viewHeight, viewWidth, viewHeight };
};

const flight = new CameraFlight(camera, controls, () => overlays.clearArea(), besideSidebar);
const panel = createInfoPanel(infoPanelElement, () => interaction.select(null));
const sidebar = createSidebar(sidebarElement, sidebarOpenElement, {
  pick: (location) => interaction.select(location),
  togglePrecinct: (category, shown) => interaction.setPrecinctShown(category, shown),
  resetView: () => interaction.resetView(),
  shownChanged: () => {
    overlays.invalidate();
    needsRender = true;
  },
});

let needsRender = false;

// Wheel zoom is applied by the controls' own event handler, so by the time the
// loop calls `controls.update()` there's nothing left for it to report.
let viewChanged = false;
controls.addEventListener("change", () => {
  viewChanged = true;
});

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
    overlays.invalidate();
    needsRender = true;
  },
});

createEventSwitch(eventSwitchElement, (mode) => {
  setEventMode(mode, precincts, scenery.events);
  renderer.shadowMap.needsUpdate = true;
  overlays.invalidate();
  needsRender = true;
});

const mapControls = createMapControls(mapControlsElement, {
  zoomIn: () => flight.zoomBy(ZOOM_STEP),
  zoomOut: () => flight.zoomBy(1 / ZOOM_STEP),
  zoomTo: (distance) => flight.zoomTo(distance),
  pan: (right, up) => flight.panBy(right * PAN_STEP, up * PAN_STEP),
  orbit: (turn, tilt) => flight.orbitBy(turn * TURN_STEP, tilt * TILT_STEP),
  dragOrbit: (turn, tilt) => flight.orbitBy(turn, tilt, 0),
  faceNorth: () => flight.faceNorth(),
  resetView: () => interaction.resetView(),
});
renderer.domElement.addEventListener("keydown", (event) => {
  if (event.key === "+" || event.key === "=") {
    flight.zoomBy(ZOOM_STEP);
  } else if (event.key === "-" || event.key === "_") {
    flight.zoomBy(1 / ZOOM_STEP);
  }
});

const hint = createHint(hintElement);
controls.addEventListener("start", () => hint.dismiss());

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

function render(now: number): void {
  sky.follow(camera);
  renderer.render(scene, camera);
  const { width, height } = labelRenderer.getSize();
  if (labels.layout(camera, width, height, overlays.boxes(), now)) {
    needsRender = true;
  }
  labelRenderer.render(labels.root, camera);
  mapControls.showOrbit(controls.getAzimuthalAngle(), controls.getPolarAngle());
  mapControls.showDistance(camera.position.distanceTo(controls.target));
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
  overlays.invalidate();
  render(performance.now());
}).observe(host);

// The scene is all but static, so frames are only drawn when something has changed.
renderer.setAnimationLoop((now) => {
  const flying = flight.update(now);
  controls.update();
  const moved = viewChanged || flying;
  viewChanged = false;
  if (moved) {
    constrainView(camera, controls);
  }
  interaction.update(moved);
  if (updateHighlights(now) || outline.update(now)) {
    needsRender = true;
  }
  const changes = precincts.update(now);
  if (changes.shadows) {
    renderer.shadowMap.needsUpdate = true;
  }
  if (sunShadow.update(now, camera, controls.target, moved)) {
    renderer.shadowMap.needsUpdate = true;
    needsRender = true;
  }
  // The one thing that moves: fireworks play while their barge is hovered or selected.
  scenery.fireworks.setActive(interaction.isLit(FIREWORKS_LOCATION));
  if (scenery.fireworks.update(now)) {
    needsRender = true;
  }
  const drawing = moved || changes.redraw || needsRender;
  if (drawing) {
    needsRender = false;
    render(now);
  }
  frames.tick(now, drawing);
});

window.removeEventListener("error", showStartupFailure);
window.removeEventListener("unhandledrejection", showStartupFailure);
loadingElement.remove();

if (import.meta.env.DEV) {
  // For framing views and reading draw counts from the console while developing.
  Object.assign(window, { __map: { renderer, scene, camera, controls } });
}
