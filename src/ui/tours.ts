export interface TourButtons {
  /** Shows which tour is under way, by its id, or none with `null`. */
  showRunning(id: string | null): void;
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
  actions: { start(id: string): void; stop(): void },
): TourButtons {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-tour]")];
  const names = new Map(buttons.map((button) => [button, button.textContent ?? ""]));
  let running: string | null = null;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const showMotion = (): void => {
    root.hidden = motion.matches;
  };
  motion.addEventListener("change", showMotion);
  showMotion();

  const show = (): void => {
    for (const button of buttons) {
      const on = button.dataset.tour === running;
      // The name says what a press does, so it carries the state on its own.
      button.toggleAttribute("data-running", on);
      button.innerHTML = `${on ? STOP : PLAY}<span>${on ? "Stop" : names.get(button)}</span>`;
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const id = button.dataset.tour ?? "";
      if (running === id) {
        actions.stop();
      } else {
        actions.start(id);
      }
    });
  }
  show();

  return {
    showRunning(id) {
      running = id;
      show();
    },
  };
}
