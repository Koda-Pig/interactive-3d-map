import type { Location } from "../layout/locations.ts";
import { PRECINCT_NAMES } from "../layout/locations.ts";
import { publicUrl, requirePart } from "./dom.ts";

export interface InfoPanel {
  /** Shows a location's details, or hides the panel when given `null`. */
  show(location: Location | null): void;
}

export function createInfoPanel(panel: HTMLElement, onClose: () => void): InfoPanel {
  const precinct = requirePart(panel, ".info-panel__precinct");
  const name = requirePart(panel, ".info-panel__name");
  const description = requirePart(panel, ".info-panel__description");
  const image = requirePart<HTMLImageElement>(panel, ".info-panel__image");
  requirePart(panel, ".info-panel__close").addEventListener("click", onClose);

  return {
    show(location) {
      panel.hidden = location === null;
      if (location) {
        precinct.textContent = PRECINCT_NAMES[location.category];
        name.textContent = location.name;
        description.textContent = location.description;
        image.hidden = !location.image;
        if (location.image) {
          image.src = publicUrl(location.image);
          image.alt = location.name;
        } else {
          image.removeAttribute("src");
        }
      }
    },
  };
}
