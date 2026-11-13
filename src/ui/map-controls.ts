import { MathUtils } from "three";
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
  /** Swings the view at once, as a drag does. `turn` is yaw and `tilt` is pitch, in radians. */
  dragOrbit(turn: number, tilt: number): void;
  faceNorth(): void;
  resetView(): void;
}

export interface MapControlButtons {
  /**
   * Turns and tips the compass. `bearing` is the camera's turn from north and
   * `tilt` its angle from straight down, in radians.
   */
  showOrbit(bearing: number, tilt: number): void;
  /** Moves the zoom slider to match the camera's distance, in metres. */
  showDistance(distance: number): void;
}

/** How often a held button repeats, in milliseconds. */
const REPEAT_INTERVAL = 180;
const SLIDER_STEPS = 100;
const ZOOM_RANGE = Math.log(MAX_ZOOM_DISTANCE / MIN_ZOOM_DISTANCE);
/** How far the pointer moves on the compass before a press becomes a drag, in pixels. */
const DRAG_THRESHOLD = 3;
/** How far dragging the compass one pixel turns and tilts the view, in radians. */
const TURN_PER_PIXEL = MathUtils.degToRad(0.8);
const TILT_PER_PIXEL = MathUtils.degToRad(0.5);
/** The compass tips by this share of the camera's tilt, so it never goes edge-on. */
const DIAL_TILT_SHARE = 0.75;

const CHEVRON =
  '<path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
const HOME =
  '<path d="M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
const DIAL =
  '<circle cx="24" cy="24" r="22" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.5"/>' +
  '<path d="M40 24h4M24 40v4M4 24h4" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/>' +
  '<text x="24" y="10.5" fill="#fff" font-size="8" font-weight="500" text-anchor="middle">N</text>' +
  '<path d="M24 13.5 28 24h-8z" fill="#ff6b6b"/><path d="M24 34.5 20 24h8z" fill="#fff" opacity="0.75"/>';

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
 * A compass that is also the handle for turning the view. Dragging it sideways
 * turns the map and dragging it up or down tilts it, as a right-drag on the
 * map does. A press without a drag faces north. With focus, the arrow keys
 * turn and tilt in steps.
 */
function createCompass(actions: MapControlActions): { button: HTMLElement; dial: SVGElement } {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "map-controls__button map-controls__compass";
  button.setAttribute("aria-label", "Compass. Drag to turn and tilt, or press to face north");
  button.title = "Drag to turn and tilt. Click to face north.";
  button.innerHTML = `<svg class="map-controls__dial" viewBox="0 0 48 48" aria-hidden="true">${DIAL}</svg>`;

  let pointer: { id: number; x: number; y: number; startX: number; startY: number } | null = null;
  let dragged = false;
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const { pointerId: id, clientX: x, clientY: y } = event;
    pointer = { id, x, y, startX: x, startY: y };
    dragged = false;
    button.setPointerCapture(id);
  });
  button.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer?.id) {
      return;
    }
    const { clientX: x, clientY: y } = event;
    if (!dragged && Math.hypot(x - pointer.startX, y - pointer.startY) < DRAG_THRESHOLD) {
      return;
    }
    dragged = true;
    button.classList.add("map-controls__compass--dragging");
    actions.dragOrbit((pointer.x - x) * TURN_PER_PIXEL, (y - pointer.y) * TILT_PER_PIXEL);
    pointer.x = x;
    pointer.y = y;
  });
  for (const type of ["pointerup", "pointercancel"]) {
    button.addEventListener(type, () => {
      pointer = null;
      button.classList.remove("map-controls__compass--dragging");
    });
  }
  button.addEventListener("click", (event) => {
    // The click that ends a drag isn't a press. One from the keyboard always is.
    if (event.detail === 0 || !dragged) {
      actions.faceNorth();
    }
  });
  button.addEventListener("keydown", (event) => {
    const step = COMPASS_KEYS[event.key];
    if (step) {
      event.preventDefault();
      actions.orbit(step[0], step[1]);
    }
  });

  const dial = button.querySelector<SVGElement>(".map-controls__dial");
  if (!dial) {
    throw new Error("The compass has no dial");
  }
  return { button, dial };
}

/** The turn and tilt each arrow key gives the compass, matching Shift and an arrow on the map. */
const COMPASS_KEYS: Readonly<Record<string, readonly [turn: number, tilt: number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * On-screen controls for everything the mouse and touch gestures do: a zoom
 * slider, a compass to drag that turns and tilts the map, and arrows that move
 * it. For people without a wheel or a right mouse button.
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

  const compass = createCompass(actions);

  const pads = createGroup("map-controls__pads", "Turn, tilt and move", [
    compass.button,
    createGroup("map-controls__pad", "Move the map", [
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

  let shownOrbit = "";
  let shownStep: number | null = null;
  return {
    showOrbit(bearing, tilt) {
      const orbit = `rotateX(${(tilt * DIAL_TILT_SHARE).toFixed(3)}rad) rotate(${bearing.toFixed(3)}rad)`;
      if (orbit !== shownOrbit) {
        shownOrbit = orbit;
        compass.dial.style.transform = orbit;
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

const TOUCH_HINT = "Drag to move. Pinch to zoom and twist to turn. Drag two fingers up to tilt.";
const MOUSE_HINT = "Drag to move. Right-drag, or drag the compass, to turn. Scroll to zoom.";
/** How long the hint stays up after the first move, in milliseconds. */
const HINT_LINGER = 2500;

/** Says how to move the map, until the visitor has started doing it. */
export function createHint(element: HTMLElement): { dismiss(): void } {
  element.textContent = window.matchMedia("(pointer: coarse), (max-width: 600px)").matches
    ? TOUCH_HINT
    : MOUSE_HINT;
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
