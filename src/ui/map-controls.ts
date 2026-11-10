import { requirePart } from "./dom.ts";

export interface MapControlActions {
  zoomIn(): void;
  zoomOut(): void;
  faceNorth(): void;
}

export interface MapControlButtons {
  /** Turns the compass needle. `bearing` is the camera's turn from north, in radians. */
  showBearing(bearing: number): void;
}

/** Zoom buttons and a compass, for people without a wheel or a right mouse button. */
export function createMapControls(
  root: HTMLElement,
  actions: MapControlActions,
): MapControlButtons {
  const needle = requirePart(root, ".map-controls__needle");
  requirePart(root, ".map-controls__zoom-in").addEventListener("click", actions.zoomIn);
  requirePart(root, ".map-controls__zoom-out").addEventListener("click", actions.zoomOut);
  requirePart(root, ".map-controls__compass").addEventListener("click", actions.faceNorth);

  let shown: number | null = null;
  return {
    showBearing(bearing) {
      if (bearing !== shown) {
        shown = bearing;
        needle.style.transform = `rotate(${bearing}rad)`;
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
