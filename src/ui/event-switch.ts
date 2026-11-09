import type { EventMode } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";
import { requirePart } from "./dom.ts";

interface Choice {
  readonly mode: EventMode | null;
  readonly name: string;
}

/** Buttons for viewing the site as a whole, or as it's used for each kind of event. */
export function createEventSwitch(
  root: HTMLElement,
  onChange: (mode: EventMode | null) => void,
): void {
  const buttons = requirePart(root, ".event-switch__buttons");
  const summary = requirePart(root, ".event-switch__summary");

  const choices: Choice[] = [
    { mode: null, name: "Whole site" },
    ...layout.events.map((mode) => ({ mode, name: mode.name })),
  ];

  const elements = choices.map(({ mode, name }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-switch__button";
    button.textContent = name;
    button.setAttribute("aria-pressed", String(mode === null));
    button.addEventListener("click", () => {
      for (const [index, element] of elements.entries()) {
        element.setAttribute("aria-pressed", String(choices[index].mode === mode));
      }
      summary.textContent = mode?.summary ?? "";
      summary.hidden = mode === null;
      onChange(mode);
    });
    return button;
  });
  buttons.append(...elements);
}
