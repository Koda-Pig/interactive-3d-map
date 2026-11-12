import type { EventMode } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import { requirePart } from "./dom.ts";

interface Choice {
  readonly mode: EventMode | null;
  readonly name: string;
}

export interface EventSwitch {
  /** Switches to an event mode by its id, or to the whole site with `null`, as a click would. */
  select(id: string | null): void;
}

/** Buttons for viewing the site as a whole, or as it's used for each kind of event. */
export function createEventSwitch(
  root: HTMLElement,
  onChange: (mode: EventMode | null) => void,
): EventSwitch {
  const buttons = requirePart(root, ".event-switch__buttons");
  const summary = requirePart(root, ".event-switch__summary");

  const choices: Choice[] = [
    { mode: null, name: "Whole site" },
    ...layout.events.map((mode) => ({ mode, name: mode.name })),
  ];

  const choose = (mode: EventMode | null): void => {
    for (const [index, element] of elements.entries()) {
      element.setAttribute("aria-pressed", String(choices[index].mode === mode));
    }
    summary.textContent = mode?.summary ?? "";
    summary.hidden = mode === null;
    onChange(mode);
  };

  const elements = choices.map(({ mode, name }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-switch__button";
    button.textContent = name;
    button.setAttribute("aria-pressed", String(mode === null));
    button.addEventListener("click", () => choose(mode));
    return button;
  });
  buttons.append(...elements);

  return {
    select(id) {
      const choice = choices.find(({ mode }) => (mode?.id ?? null) === id);
      if (choice) {
        choose(choice.mode);
      }
    },
  };
}
