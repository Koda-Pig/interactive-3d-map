import { MathUtils, Mesh, NeutralToneMapping, PCFShadowMap, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { ArrivalRoutes } from "../draw/arrival-routes.ts";
import { bakedGeometry, layoutModelFiles, loadKit } from "../draw/kit.ts";
import { disposeHighlights, updateHighlights, withMaterialScope } from "../draw/materials.ts";
import {
  createCar,
  createScenery,
  FIREWORKS_LOCATION,
  FOUNTAIN_LOCATION,
  RACE_CAR,
  SCENERY_MODELS,
  SHUTTLE,
} from "../draw/scenery.ts";
import { createSite } from "../draw/site.ts";
import { Traffic } from "../draw/traffic.ts";
import { WaterMaterial } from "../draw/water.ts";
import { layout } from "../layout/locations.ts";
import { setEventMode } from "../scene/event-modes.ts";
import { Finish } from "../scene/finish.ts";
import { CameraFlight } from "../scene/flight.ts";
import { MapInteraction } from "../scene/interaction.ts";
import { SiteLabels } from "../scene/labels.ts";
import { addLighting, SUN_DIRECTION } from "../scene/lighting.ts";
import { FrameMonitor } from "../scene/performance.ts";
import { createPicker } from "../scene/picking.ts";
import { Precincts } from "../scene/precincts.ts";
import { detectQuality } from "../scene/quality.ts";
import { SelectionOutline } from "../scene/selection-outline.ts";
import { createSky, TABLE_MOUNTAIN_MODEL } from "../scene/sky.ts";
import { addTouchGestures } from "../scene/touch-gestures.ts";
import { CameraTour } from "../scene/tour.ts";
import { ARRIVAL_TOUR, arrivalTour, lapTour } from "../scene/tours.ts";
import { constrainView, createCamera, createControls, MAX_TILT } from "../scene/view.ts";
import { createGround } from "../terrain/ground.ts";
import { requirePart } from "../ui/dom.ts";
import { createEventSwitch } from "../ui/event-switch.ts";
import { createInfoPanel } from "../ui/info-panel.ts";
import { createHint, createMapControls } from "../ui/map-controls.ts";
import type { ClearArea } from "../ui/overlays.ts";
import { MapOverlays } from "../ui/overlays.ts";
import { createSidebar } from "../ui/sidebar.ts";
import { createTourButtons } from "../ui/tours.ts";
import type { MapHandle, MapOptions } from "./index.ts";
import { inspection } from "./inspection.ts";
import { MapResources } from "./resources.ts";
import { createShell } from "./shell.ts";

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
/**
 * The miniature blur is at full strength while the view looks down on the
 * site, and gone by the time it looks along the ground, where blurring the
 * top of the view would blur the horizon.
 */
const MINIATURE_TILT = [MAX_TILT - MathUtils.degToRad(14), MAX_TILT - MathUtils.degToRad(2)];
/** The title screen stays up at least this long after the page opens, in milliseconds. */

/** How long the title screen takes to clear, which matches its transition in `index.html`. */
const TITLE_FADE = 1100;
/** How long before the opening flight ends the interface starts to appear, in milliseconds. */
const INTERFACE_LEAD = 1300;
const INTERFACE_FADE = 800;
/** The event mode that shows the arrival routes. */
const ARRIVAL_MODE = "race";
/** Matches the phone layout in `style.css`, where the sidebar is a sheet along the bottom. */
export function mountMap(container: HTMLElement, options: MapOptions): MapHandle {
  const root = createShell(container);
  const resources = new MapResources(root);
  let selectedId: string | null = options.initialLocationId ?? null;
  let select: ((id: string | null) => void) | undefined;
  let activity: (() => void) | undefined;
  let active = options.active ?? true;
  root.dataset.variant = options.variant;
  const validId = (id: string | null): string | null =>
    id && layout.locations.some((location) => location.id === id) ? id : null;
  selectedId = validId(selectedId);
  const ready = withMaterialScope(start, (cleanup) => resources.add(cleanup)).catch((error) => {
    if (resources.destroyed) return;
    resources.dispose();
    const status = root.querySelector(".title__status");
    if (status)
      status.textContent =
        "The map couldn't start. Check that WebGL is turned on, or try another browser.";
    root.classList.remove("intro");
    throw error;
  });
  return {
    ready,
    setActive(value) {
      if (resources.destroyed) return;
      active = value;
      activity?.();
    },
    selectLocation(id) {
      if (!resources.destroyed) {
        selectedId = validId(id);
        select?.(selectedId);
      }
    },
    destroy() {
      resources.dispose();
      root.parentElement?.remove();
    },
  };

  async function start(): Promise<void> {
    resources.check();
    const PHONE_LAYOUT = {
      get matches() {
        return root.clientWidth <= 600;
      },
    };
    const host = requirePart(root, ".map-canvas");
    const infoPanelElement = requirePart(root, '[data-part="info-panel"]');
    const sidebarElement = requirePart(root, '[data-part="sidebar"]');
    const eventSwitchElement = requirePart(root, '[data-part="event-switch"]');
    const loadingElement = requirePart(root, '[data-part="loading"]');

    const mapControlsElement = requirePart(root, '[data-part="map-controls"]');
    const hintElement = requirePart(root, '[data-part="hint"]');
    const noticeElement = requirePart(root, ".notice");
    const sheetHandle = requirePart(root, ".sidebar__handle");
    const sidebarOpenElement = requirePart(root, '[data-part="sidebar-open"]');
    const toursElement = requirePart(root, ".tours");
    const legendElement = requirePart(root, ".route-legend");
    const tourPlayerElement = requirePart(root, ".tour-player");
    const eventSummaryElement = requirePart(root, ".event-switch__summary");

    const quality = detectQuality();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new WebGLRenderer({ antialias: true, stencil: true });
    resources.add(() => {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
    });
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
    const finish = quality.finish ? new Finish(renderer) : null;
    resources.add(() => finish?.dispose());

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.classList.add("labels");
    host.append(labelRenderer.domElement);

    // Labels measure their text once, so their font has to be ready first. If it
    // can't be fetched, they use the fallback font.
    const labelFont = document.fonts.load("500 12px Roboto").catch(() => []);
    const [kit] = await Promise.all([
      loadKit(
        [...layoutModelFiles(), ...SCENERY_MODELS, TABLE_MOUNTAIN_MODEL],
        options.assetBaseUrl,
        () => {
          if (!resources.destroyed)
            noticeElement.textContent =
              "Concept layout, for illustration only. Some models are unavailable.";
        },
      ),
      labelFont,
    ]);

    resources.ownKit(kit);
    resources.check();
    const scene = new Scene();
    resources.add(() => {
      disposeHighlights(scene);
      resources.disposeObject(scene);
    });
    const sunShadow = addLighting(scene, quality);
    const sky = createSky(renderer, SUN_DIRECTION, kit.get(TABLE_MOUNTAIN_MODEL));
    resources.add(() => sky.dispose());
    scene.add(sky.object);
    scene.environment = sky.environment;
    scene.environmentIntensity = ENVIRONMENT_INTENSITY;
    const ground = await createGround(
      renderer.capabilities.getMaxAnisotropy(),
      quality.fieldTextureSize,
    );
    resources.ownObject(ground.mesh);
    resources.check();
    const site = await createSite(ground.surface, kit);
    resources.ownObject(site);
    resources.check();
    const scenery = await createScenery(kit, ground.surface, quality);
    resources.ownObject(scenery.setting);
    for (const group of scenery.precincts.values()) resources.ownObject(group);
    resources.check();
    const outline = new SelectionOutline();
    resources.add(() => outline.dispose());
    const raceCarModel = kit.get(RACE_CAR);
    const shuttleModel = kit.get(SHUTTLE);
    // Without either model there's nothing to drive, and the map just stays still.
    const traffic =
      raceCarModel && shuttleModel
        ? new Traffic(
            bakedGeometry(raceCarModel),
            bakedGeometry(shuttleModel),
            createCar(),
            ground.surface,
          )
        : null;
    if (traffic) {
      scenery.precincts.get("racing")?.add(traffic.raceCars);
      scenery.precincts.get("transport")?.add(traffic.shuttles, traffic.highway);
    }
    const arrivals = new ArrivalRoutes(ground.surface);
    scene.add(
      sky.object,
      ground.mesh,
      site,
      scenery.setting,
      ...scenery.precincts.values(),
      arrivals.object,
    );

    const camera = createCamera(host.clientWidth / Math.max(1, host.clientHeight));
    const controls = createControls(camera, renderer.domElement);
    let interactive = options.variant === "page";
    const engage = document.createElement("button");
    engage.type = "button";
    engage.className = "map-engage";
    engage.textContent = "Interact with the map";
    const leave = document.createElement("button");
    leave.type = "button";
    leave.className = "map-leave";
    leave.textContent = "Stop interacting";
    const syncInteraction = (): void => {
      engage.hidden = interactive;
      leave.hidden = !interactive;
      host.style.pointerEvents = interactive ? "" : "none";
      if (activity) activity();
    };
    if (options.variant === "section") {
      root.append(engage, leave);
      engage.addEventListener("click", () => {
        interactive = true;
        syncInteraction();
        renderer.domElement.focus({ preventScroll: true });
      });
      leave.addEventListener("click", () => {
        interactive = false;
        syncInteraction();
        engage.focus({ preventScroll: true });
      });
      syncInteraction();
    }

    resources.add(() => controls.dispose());
    resources.add(addTouchGestures(camera, controls, renderer.domElement));
    inspection.set(container, { renderer, scene, camera, controls });
    resources.add(() => inspection.delete(container));
    constrainView(camera, controls);

    const precincts = new Precincts(site, scenery.precincts);
    resources.add(() => precincts.dispose());
    const waters = new Set<WaterMaterial>();
    site.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof WaterMaterial)
        waters.add(child.material);
    });
    const labels = new SiteLabels(site, labelRenderer.domElement, precincts);
    // Everything that sits on top of the map. Flights and labels keep clear of them.
    const overlays = new MapOverlays(host, [
      () => infoPanelElement.getBoundingClientRect(),
      () => eventSwitchElement.getBoundingClientRect(),
      () => eventSummaryElement.getBoundingClientRect(),
      () => tourPlayerElement.getBoundingClientRect(),
      () => noticeElement.getBoundingClientRect(),
      () => mapControlsElement.getBoundingClientRect(),
      // On a wide screen the sidebar lies over the map's left edge: the whole
      // panel when it's open, and only its button when it's closed. It's measured
      // as it will be once it has finished opening or closing.
      () => {
        const width = sidebar.panelWidth();
        return width > 0
          ? {
              left: host.getBoundingClientRect().left,
              top: host.getBoundingClientRect().top,
              right: host.getBoundingClientRect().left + width,
              bottom: host.getBoundingClientRect().bottom,
            }
          : sidebarOpenElement.getBoundingClientRect();
      },
      // On a phone the closed sidebar is a strip along the bottom. It's measured
      // as if closed, because picking from the open list closes it.
      () =>
        PHONE_LAYOUT.matches
          ? {
              left: host.getBoundingClientRect().left,
              top: host.getBoundingClientRect().bottom - sheetHandle.offsetHeight,
              right: host.getBoundingClientRect().right,
              bottom: host.getBoundingClientRect().bottom,
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

    const flight = new CameraFlight(camera, controls, () => overlays.clearAreas(), besideSidebar);
    const panel = createInfoPanel(
      infoPanelElement,
      () => interaction.select(null),
      (location) => interaction.select(location),
      options.assetBaseUrl,
    );
    const sidebar = createSidebar(
      sidebarElement,
      sidebarOpenElement,
      {
        pick: (location) => interaction.select(location),
        togglePrecinct: (category, shown) => interaction.setPrecinctShown(category, shown),
        resetView: () => interaction.resetView(),
        shownChanged: () => {
          // The panel covers the map's left edge, so the view slides by half its
          // width to keep what was in the middle in the middle of what's left.
          const width = sidebar.panelWidth();
          flight.shiftBy(-(width - sidebarWidth) / 2, host.clientHeight);
          sidebarWidth = width;
          overlays.invalidate();
          needsRender = true;
        },
      },
      options.assetBaseUrl,
    );
    resources.add(() => sidebar.destroy());
    let sidebarWidth = sidebar.panelWidth();

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
      onSelect: (location) => {
        const id = location?.id ?? null;
        if (id !== selectedId) {
          selectedId = id;
          options.onLocationChange?.(id);
        }
      },
    });

    resources.add(() => interaction.destroy());
    select = (id) =>
      interaction.select(layout.locations.find((location) => location.id === id) ?? null);

    const eventSwitch = createEventSwitch(eventSwitchElement, (mode) => {
      setEventMode(mode, precincts, scenery.events);
      panel.setMode(mode?.id ?? null);
      traffic?.setMode(mode?.id ?? null);
      const arriving = mode?.id === ARRIVAL_MODE;
      arrivals.setShown(arriving);
      legendElement.hidden = !arriving;
      renderer.shadowMap.needsUpdate = true;
      overlays.invalidate();
      needsRender = true;
    });

    resources.add(() => eventSwitch.destroy());

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

    // The details panel stops above the map controls, so it needs their height.
    resources.observe(() => {
      root.style.setProperty("--map-controls-height", `${mapControlsElement.offsetHeight}px`);
      overlays.invalidate();
    }, mapControlsElement);

    const hint = createHint(hintElement);
    resources.add(() => hint.destroy());

    const tourButtons = createTourButtons(toursElement, {
      start: (id) => {
        hint.dismiss();
        interaction.select(null);
        eventSwitch.select(ARRIVAL_MODE);
        if (id === ARRIVAL_TOUR) {
          tour.start(arrivalTour(flight));
        } else {
          tour.start(lapTour(flight, traffic?.raceClock));
        }
      },
      stop: () => tour.stop(),
      setSpeed: (multiplier) => tour.setSpeed(multiplier),
    });
    resources.add(() => tourButtons.destroy());
    const tour = new CameraTour(camera, controls, flight, ground.surface, (id) => {
      tourButtons.showRunning(id);
      labels.setTouring(id !== null);
      needsRender = true;
      overlays.invalidate();
    });
    const playerResize = resources.observer(() => {
      root.style.setProperty("--tour-player-height", `${tourPlayerElement.offsetHeight}px`);
      overlays.invalidate();
      needsRender = true;
    });
    playerResize.observe(tourPlayerElement);
    playerResize.observe(eventSwitchElement);
    playerResize.observe(eventSummaryElement);
    controls.addEventListener("start", () => hint.dismiss());
    // Using anything at all, the sidebar or a button included, means the visitor has found their way.
    root.addEventListener("pointerdown", () => hint.dismiss(), { once: true });
    root.addEventListener("keydown", () => hint.dismiss(), { once: true });

    resources.add(() => tour.stop());
    resources.add(() => mapControls.destroy());
    let pixelRatio = Math.min(window.devicePixelRatio, quality.maxPixelRatio);

    const setPixelRatio = (ratio: number): void => {
      pixelRatio = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(host.clientWidth, host.clientHeight, false);
    };

    const frames = new FrameMonitor(
      renderer,
      quality,
      (ratio) => {
        setPixelRatio(ratio);
        // Resizing the canvas clears it, and the view may have just stopped moving.
        needsRender = true;
      },
      finish ? () => finish.drawn : undefined,
      root,
    );

    function render(now: number): void {
      sky.follow(camera);
      if (finish) {
        const [full, none] = MINIATURE_TILT;
        finish.render(scene, camera, {
          // Under reduced motion the cloud shadows stay where they are.
          seconds: reducedMotion ? 0 : now / 1000,
          tiltShift: 1 - MathUtils.smoothstep(controls.getPolarAngle(), full, none),
        });
      } else {
        renderer.render(scene, camera);
      }
      outline.render(renderer, scene, camera);
      const { width, height } = labelRenderer.getSize();
      if (labels.layout(camera, width, height, overlays.boxes(), now)) {
        needsRender = true;
      }
      labelRenderer.render(labels.root, camera);
      mapControls.showOrbit(controls.getAzimuthalAngle(), controls.getPolarAngle());
      mapControls.showDistance(camera.position.distanceTo(controls.target));
    }

    resources.observe(() => {
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
      if (running) render(clock);
    }, host);

    // Frames are drawn when something has changed. The everyday movement (the
    // water, shuttles, N7 traffic and cloud shadows) keeps that going in every
    // view, but less often on a phone, where it's the only thing moving.
    let frame = 0;
    let clock = performance.now();
    let previous: number | null = null;
    let visible = true;
    let running = false;
    const updateActivity = (): void => {
      const next =
        active &&
        visible &&
        !document.hidden &&
        host.clientWidth > 0 &&
        host.clientHeight > 0 &&
        !resources.destroyed;
      controls.enabled = next && interactive;
      root.inert = !next;
      if (next === running) return;
      running = next;
      previous = null;
      if (!next)
        for (const button of mapControlsElement.querySelectorAll("button"))
          button.dispatchEvent(new Event("bmr-stop"));
      renderer.setAnimationLoop(next ? animate : null);
    };
    activity = updateActivity;
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      updateActivity();
    });
    intersection.observe(root);
    resources.add(() => intersection.disconnect());
    resources.listen(document, "visibilitychange", updateActivity);
    resources.observe(updateActivity, host);
    function animate(timestamp: number): void {
      if (!running) return;
      clock += previous === null ? 0 : timestamp - previous;
      previous = timestamp;
      const now = clock;
      frame += 1;
      const flying = flight.update(now);
      const touring = tour.update(now);
      if (touring) tourButtons.showProgress(tour.progress, tour.telemetry);
      controls.update();
      const moved = viewChanged || flying || touring;
      viewChanged = false;
      if (moved) {
        constrainView(camera, controls);
        if (scenery.trees.update(camera.position)) {
          renderer.shadowMap.needsUpdate = true;
        }
      }
      interaction.update(moved);
      const highlightsFading = updateHighlights(now, scene);
      if (outline.update(now) || highlightsFading) {
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
      // The two things that move: the fireworks and the fountain show each play
      // while their location is hovered or selected.
      scenery.fireworks.setActive(interaction.isLit(FIREWORKS_LOCATION));
      scenery.fountain.setActive(interaction.isLit(FOUNTAIN_LOCATION));
      // Both are updated, so neither is left mid-pose when the other is playing.
      const fireworksMoved = scenery.fireworks.update(now);
      if (scenery.fountain.update(now) || fireworksMoved) {
        needsRender = true;
      }
      if (arrivals.update(now, camera, controls.target, host.clientHeight)) {
        needsRender = true;
      }
      if (!reducedMotion) for (const water of waters) water.setTime(now / 1000);
      const ambient = traffic?.update(now) ?? false;
      const everyFrame =
        moved || changes.redraw || needsRender || (ambient && traffic?.busy === true);
      const drawing = everyFrame || (ambient && frame % quality.ambientFrames === 0);
      if (drawing) {
        needsRender = false;
        render(now);
      }
      // Frames drawn at the slower everyday rate say nothing about how fast the device is.
      frames.tick(now, drawing && (everyFrame || quality.ambientFrames === 1));
    }
    updateActivity();
    /** Clears the title screen, then brings the interface in once the camera has nearly arrived. */
    const openMap = (flightTime: number): void => {
      const fade = reducedMotion ? 0 : TITLE_FADE;
      loadingElement.classList.add("title--leaving");
      resources.timeout(() => loadingElement.remove(), fade);
      resources.timeout(
        () => {
          root.classList.replace("intro", "intro-done");
          resources.timeout(() => root.classList.remove("intro-done"), INTERFACE_FADE);
        },
        Math.max(fade * 0.6, flightTime - INTERFACE_LEAD),
      );
    };

    // A link to a location opens on it. Otherwise the title screen has its moment,
    // and the camera settles into the opening view as it clears.
    resources.check();
    if (selectedId) {
      select(selectedId);
      openMap(0);
    } else {
      openMap(flight.flyIn());
    }
  }
}
