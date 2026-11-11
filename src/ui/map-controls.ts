import { MAX_ZOOM_DISTANCE, MIN_ZOOM_DISTANCE } from "../scene/view.ts";

export interface MapControlActions {
  zoomIn(): void;
  zoomOut(): void;
  /** Sets the camera's distance from the point it looks at, in metres. */
  zoomTo(distance: number): void;
  /** Slides the map one step. Each of `right` and `up` is -1, 0 or 1. */
  pan(right: number, up: number): void;
  /** Swings the view one step. `turn` is yaw and `tilt` is pitch, each -1, 0 or 1. */
  orbit(turn: number, tilt: number): void;
  faceNorth(): void;
  resetView(): void;
}

export interface MapControlButtons {
  /** Turns the compass needle. `bearing` is the camera's turn from north, in radians. */
  showBearing(bearing: number): void;
  /** Moves the zoom slider to match the camera's distance, in metres. */
  showDistance(distance: number): void;
}

/** How often a held button repeats, in milliseconds. */
const REPEAT_INTERVAL = 180;
const SLIDER_STEPS = 100;
const ZOOM_RANGE = Math.log(MAX_ZOOM_DISTANCE / MIN_ZOOM_DISTANCE);

const CHEVRON =
  '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const TURN =
  '<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5v3.6h-3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
const HOME =
  '<path d="M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
const NEEDLE =
  '<path d="M12 2.5 16 12H8z" fill="#ff6b6b"/><path d="M12 21.5 8 12h8z" fill="#fff" opacity="0.75"/>';

interface ButtonSpec {
  /** Added to `map-controls__`, and where the button sits in its pad. */
  readonly part: string;
  readonly label: string;
  readonly icon: string;
  readonly action: () => void;
  /** Keeps acting while held down. */
  readonly repeats?: boolean;
}

function icon(paths: string): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${paths}</svg>`;
}

function createButton({ part, label, icon: content, action, repeats }: ButtonSpec): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `map-controls__button map-controls__${part}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = content;

  if (!repeats) {
    button.addEventListener("click", action);
    return button;
  }

  let timer: number | undefined;
  const stop = (): void => {
    window.clearInterval(timer);
    timer = undefined;
  };
  button.addEventListener("pointerdown", (event) => {
    if (event.button === 0) {
      action();
      stop();
      timer = window.setInterval(action, REPEAT_INTERVAL);
    }
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel", "blur"]) {
    button.addEventListener(type, stop);
  }
  // A press from the keyboard has no pointer, and arrives as a click on its own.
  button.addEventListener("click", (event) => {
    if (event.detail === 0) {
      action();
    }
  });
  return button;
}

function createGroup(className: string, label: string, children: readonly HTMLElement[]) {
  const group = document.createElement("div");
  group.className = className;
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  group.append(...children);
  return group;
}

/**
 * On-screen controls for everything the mouse and touch gestures do: a zoom
 * slider, arrows that move the map, and arrows that turn and tilt it around a
 * compass. For people without a wheel or a right mouse button.
 */
export function createMapControls(
  root: HTMLElement,
  actions: MapControlActions,
): MapControlButtons {
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "map-controls__slider";
  slider.min = "0";
  slider.max = String(SLIDER_STEPS);
  slider.setAttribute("aria-label", "Zoom");
  // Each step multiplies the distance by the same amount, so the slider feels
  // as even close in as it does far out.
  slider.addEventListener("input", () => {
    const share = 1 - Number(slider.value) / SLIDER_STEPS;
    actions.zoomTo(MIN_ZOOM_DISTANCE * Math.exp(share * ZOOM_RANGE));
  });
  let dragging = false;
  slider.addEventListener("pointerdown", () => {
    dragging = true;
  });
  for (const type of ["pointerup", "pointercancel", "blur"]) {
    slider.addEventListener(type, () => {
      dragging = false;
    });
  }

  const compass = createButton({
    part: "compass",
    label: "Face north",
    icon: `<svg class="map-controls__needle" viewBox="0 0 24 24" aria-hidden="true">${NEEDLE}</svg>`,
    action: actions.faceNorth,
  });
  const needle = compass.querySelector<SVGElement>(".map-controls__needle");

  const pads = createGroup("map-controls__pads", "Move, turn and tilt", [
    createGroup("map-controls__pad", "Turn and tilt", [
      createButton({
        part: "up",
        label: "Tilt towards the horizon",
        icon: icon(CHEVRON),
        action: () => actions.orbit(0, -1),
        repeats: true,
      }),
      createButton({
        part: "left",
        label: "Rotate anticlockwise",
        icon: icon(TURN),
        action: () => actions.orbit(-1, 0),
        repeats: true,
      }),
      compass,
      createButton({
        part: "right",
        label: "Rotate clockwise",
        icon: icon(TURN),
        action: () => actions.orbit(1, 0),
        repeats: true,
      }),
      createButton({
        part: "down",
        label: "Tilt towards overhead",
        icon: icon(CHEVRON),
        action: () => actions.orbit(0, 1),
        repeats: true,
      }),
    ]),
    createGroup("map-controls__pad map-controls__pad--pan", "Move the map", [
      createButton({
        part: "up",
        label: "Move up",
        icon: icon(CHEVRON),
        action: () => actions.pan(0, 1),
        repeats: true,
      }),
      createButton({
        part: "left",
        label: "Move left",
        icon: icon(CHEVRON),
        action: () => actions.pan(-1, 0),
        repeats: true,
      }),
      createButton({
        part: "home",
        label: "Reset view",
        icon: icon(HOME),
        action: actions.resetView,
      }),
      createButton({
        part: "right",
        label: "Move right",
        icon: icon(CHEVRON),
        action: () => actions.pan(1, 0),
        repeats: true,
      }),
      createButton({
        part: "down",
        label: "Move down",
        icon: icon(CHEVRON),
        action: () => actions.pan(0, -1),
        repeats: true,
      }),
    ]),
  ]);

  const zoom = createGroup("map-controls__zoom", "Zoom", [
    createButton({
      part: "zoom-in",
      label: "Zoom in",
      icon: "+",
      action: actions.zoomIn,
      repeats: true,
    }),
    slider,
    createButton({
      part: "zoom-out",
      label: "Zoom out",
      icon: "&minus;",
      action: actions.zoomOut,
      repeats: true,
    }),
  ]);
  root.append(zoom, pads);

  let shownBearing: number | null = null;
  let shownStep: number | null = null;
  return {
    showBearing(bearing) {
      if (bearing !== shownBearing && needle) {
        shownBearing = bearing;
        needle.style.transform = `rotate(${bearing}rad)`;
      }
    },
    showDistance(distance) {
      const share = Math.log(distance / MIN_ZOOM_DISTANCE) / ZOOM_RANGE;
      const step = Math.round((1 - Math.min(1, Math.max(0, share))) * SLIDER_STEPS);
      // Left alone while it's being dragged, so it doesn't fight the pointer.
      if (step !== shownStep && !dragging) {
        shownStep = step;
        slider.value = String(step);
      }
    },
  };
}

const TOUCH_HINT = "Drag to move. Use two fingers to turn and zoom.";
const MOUSE_HINT = "Drag to move. Right-drag or Shift-drag to turn. Scroll to zoom.";
/** How long the hint stays up after the first move, in milliseconds. */
const HINT_LINGER = 2500;

/** Says how to move the map, until the visitor has started doing it. */
export function createHint(element: HTMLElement): { dismiss(): void } {
  element.textContent = window.matchMedia("(pointer: coarse)").matches ? TOUCH_HINT : MOUSE_HINT;
  let dismissed = false;
  return {
    dismiss() {
      if (!dismissed) {
        dismissed = true;
        window.setTimeout(() => element.classList.add("hint--gone"), HINT_LINGER);
      }
    },
  };
}
