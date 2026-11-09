import { PRECINCT_NAMES } from "../layout/locations.ts";
import type { Location } from "../layout/locations.ts";
import { requirePart } from "./dom.ts";

export interface InfoPanel {
  /** Shows a location's details, or hides the panel when given `null`. */
  show(location: Location | null): void;
}

export function createInfoPanel(panel: HTMLElement, onClose: () => void): InfoPanel {
  const precinct = requirePart(panel, ".info-panel__precinct");
  const name = requirePart(panel, ".info-panel__name");
  const description = requirePart(panel, ".info-panel__description");
  requirePart(panel, ".info-panel__close").addEventListener("click", onClose);

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
