import { locationActions } from "../layout/links.ts";
import type { Location } from "../layout/locations.ts";
import { PRECINCT_NAMES } from "../layout/locations.ts";
import { relatedPlaces } from "../layout/related.ts";
import { publicUrl, requirePart } from "./dom.ts";

export interface InfoPanel {
  /** Shows a location's details, or hides the panel when given `null`. */
  show(location: Location | null): void;
  /** Shows the links for an event mode, by id, or for the whole site with `null`. */
  setMode(mode: string | null): void;
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
  const actions = requirePart(panel, ".info-panel__actions");
  const actionGroups = requirePart(panel, ".info-panel__action-groups");
  const related = requirePart(panel, ".info-panel__related");
  const relatedList = requirePart(panel, ".info-panel__related-list");
  requirePart(panel, ".info-panel__close").addEventListener("click", onClose);

  let shown: Location | null = null;
  let mode: string | null = null;

  const showActions = (location: Location): void => {
    const groups = locationActions(location, mode);
    actionGroups.replaceChildren(
      ...groups.map((group, index) => {
        const section = document.createElement("section");
        section.className = "info-panel__action-group";
        const heading = document.createElement("h3");
        heading.className = "info-panel__action-heading";
        heading.textContent = group.heading;
        const list = document.createElement("ul");
        list.className = "info-panel__action-list";
        list.append(
          ...group.actions.map((action, position) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = action.url;
            link.textContent = action.label;
            // The first fan action leads as a filled button, the rest are outlined.
            link.className =
              index === 0 && position === 0 && group.audience === "visitors"
                ? "info-panel__action info-panel__action--primary"
                : "info-panel__action";
            if (action.url.startsWith("#")) {
              // A placeholder goes nowhere yet, and shouldn't change the address.
              link.addEventListener("click", (event) => event.preventDefault());
            } else {
              link.target = "_blank";
              link.rel = "noopener";
            }
            item.append(link);
            return item;
          }),
        );
        section.append(heading, list);
        return section;
      }),
    );
    actions.hidden = groups.length === 0;
  };

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
      shown = location;
      if (location) {
        precinct.textContent = PRECINCT_NAMES[location.category];
        name.textContent = location.name;
        description.textContent = location.description;
        showActions(location);
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
    setMode(id) {
      mode = id;
      if (shown) {
        showActions(shown);
      }
    },
  };
}
