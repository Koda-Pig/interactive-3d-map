import { requirePart } from "./dom.ts";

export interface TourButtons {
  destroy(): void;
  /** Shows which tour is under way, by its id, or none with `null`. */
  showRunning(id: string | null): void;
  /**
   * Updates the ride progress; null means the camera is approaching its start.
   * `telemetry` is the speed in km/h and the place, on a ride that has them.
   */
  showProgress(progress: number | null, telemetry?: { speed: number; place: string } | null): void;
}

const PLAY =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
const STOP =
  '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill="currentColor"/></svg>';

/**
 * Buttons that start a camera tour, and stop it again while it runs. They're
 * hidden under reduced motion, because a tour is nothing but movement.
 */
export function createTourButtons(
  root: HTMLElement,
  actions: { start(id: string): void; stop(): void; setSpeed(multiplier: number): void },
): TourButtons {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-tour]")];
  const speed = root.querySelector<HTMLSelectElement>("[data-tour-speed]");
  if (!speed) {
    throw new Error("Missing tour speed selector");
  }
  speed.addEventListener("change", () => actions.setSpeed(Number(speed.value)));
  const names = new Map(buttons.map((button) => [button, button.textContent?.trim() ?? ""]));
  const choices = requirePart(root, ".tours__choices");
  const playing = requirePart(root, ".tours__playing");
  const name = requirePart(root, ".tours__name");
  const status = requirePart(root, ".tours__status");
  const progress = requirePart<HTMLProgressElement>(root, ".tours__progress");
  const telemetry = requirePart(root, ".tours__telemetry");
  const speedometer = requirePart(root, ".tours__kmh");
  const place = requirePart(root, ".tours__place");
  const stop = requirePart<HTMLButtonElement>(root, ".tours__stop");
  stop.innerHTML = `${STOP}<span>Stop</span>`;
  stop.addEventListener("click", actions.stop);
  let running: string | null = null;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const showMotion = (): void => {
    root.hidden = motion.matches;
  };
  motion.addEventListener("change", showMotion);
  showMotion();

  const show = (): void => {
    choices.hidden = running !== null;
    playing.hidden = running === null;
    const button = buttons.find((button) => button.dataset.tour === running);
    name.textContent = button ? (names.get(button) ?? "") : "";
    status.textContent = "Getting into position…";
    progress.value = 0;
    telemetry.hidden = true;
  };

  for (const button of buttons) {
    button.innerHTML = `${PLAY}<span>${names.get(button)}</span>`;
    button.addEventListener("click", () => actions.start(button.dataset.tour ?? ""));
  }

  show();

  return {
    destroy() {
      motion.removeEventListener("change", showMotion);
    },
    showRunning(id) {
      const previous = running;
      const focused = root.contains(document.activeElement);
      running = id;
      show();
      if (focused) {
        if (id) stop.focus({ preventScroll: true });
        else
          buttons
            .find((button) => button.dataset.tour === previous)
            ?.focus({ preventScroll: true });
      }
    },
    showProgress(value, reading) {
      progress.value = value ?? 0;
      const percent = value === null ? "" : `${Math.floor(value * 100)}% complete`;
      status.textContent =
        value === null ? "Getting into position…" : reading ? reading.place : percent;
      telemetry.hidden = !reading;
      if (reading) {
        // Rounded to the nearest 5, so the figure doesn't flicker.
        speedometer.textContent = String(Math.round(reading.speed / 5) * 5);
        place.textContent = percent;
      }
    },
  };
}
