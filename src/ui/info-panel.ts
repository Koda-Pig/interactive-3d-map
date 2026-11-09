import { PRECINCT_NAMES } from "../layout/locations.ts";
import type { Location } from "../layout/locations.ts";

export interface InfoPanel {
  /** Shows a location's details, or hides the panel when given `null`. */
  show(location: Location | null): void;
}

function part(panel: HTMLElement, selector: string): HTMLElement {
  const element = panel.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`The info panel is missing ${selector}`);
  }
  return element;
}

export function createInfoPanel(panel: HTMLElement, onClose: () => void): InfoPanel {
  const precinct = part(panel, ".info-panel__precinct");
  const name = part(panel, ".info-panel__name");
  const description = part(panel, ".info-panel__description");
  part(panel, ".info-panel__close").addEventListener("click", onClose);

  return {
    show(location) {
      panel.hidden = location === null;
      if (location) {
        precinct.textContent = PRECINCT_NAMES[location.category];
        name.textContent = location.name;
        description.textContent = location.description;
      }
    },
  };
}
