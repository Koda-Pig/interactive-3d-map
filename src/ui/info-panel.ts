import type { Location } from "../layout/locations.ts";
import { PRECINCT_NAMES } from "../layout/locations.ts";
import { relatedPlaces } from "../layout/related.ts";
import { publicUrl, requirePart } from "./dom.ts";

export interface InfoPanel {
  /** Shows a location's details, or hides the panel when given `null`. */
  show(location: Location | null): void;
}

/**
 * `onClose` runs when the close button is pressed, and `onPick` when one of
 * the nearby places is picked.
 */
export function createInfoPanel(
  panel: HTMLElement,
  onClose: () => void,
  onPick: (location: Location) => void,
): InfoPanel {
  const precinct = requirePart(panel, ".info-panel__precinct");
  const name = requirePart(panel, ".info-panel__name");
  const description = requirePart(panel, ".info-panel__description");
  const image = requirePart<HTMLImageElement>(panel, ".info-panel__image");
  const related = requirePart(panel, ".info-panel__related");
  const relatedList = requirePart(panel, ".info-panel__related-list");
  requirePart(panel, ".info-panel__close").addEventListener("click", onClose);

  const showRelated = (location: Location): void => {
    const places = relatedPlaces(location);
    relatedList.replaceChildren(
      ...places.map(({ location: place, role }) => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "info-panel__related-link";
        const name = document.createElement("span");
        name.textContent = place.name;
        const label = document.createElement("span");
        label.className = "info-panel__related-role";
        label.textContent = role;
        button.append(name, label);
        button.addEventListener("click", () => onPick(place));
        item.append(button);
        return item;
      }),
    );
    related.hidden = places.length === 0;
  };

  return {
    show(location) {
      panel.hidden = location === null;
      if (location) {
        precinct.textContent = PRECINCT_NAMES[location.category];
        name.textContent = location.name;
        description.textContent = location.description;
        showRelated(location);
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
