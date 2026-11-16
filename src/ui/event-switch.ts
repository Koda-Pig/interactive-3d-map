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
  destroy(): void;
}

/** Buttons for viewing the site as a whole, or as it's used for each kind of event. */
export function createEventSwitch(
  root: HTMLElement,
  onChange: (mode: EventMode | null) => void,
): EventSwitch {
  const events = new AbortController();
  const buttons = requirePart(root, ".event-switch__buttons");
  const summary = requirePart(root, ".event-switch__summary");
  const info = requirePart<HTMLButtonElement>(root, ".event-switch__info");
  const select = requirePart<HTMLSelectElement>(root, ".event-switch__select");
  const closeInfo = (): void => {
    summary.hidden = true;
    info.setAttribute("aria-expanded", "false");
  };
  info.addEventListener("click", () => {
    summary.hidden = !summary.hidden;
    info.setAttribute("aria-expanded", String(!summary.hidden));
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target instanceof Node && !root.contains(event.target)) closeInfo();
    },
    { signal: events.signal },
  );
  (root.closest<HTMLElement>(".bmr-map") ?? root).addEventListener(
    "keydown",
    (event) => {
      if (event instanceof KeyboardEvent && event.key === "Escape" && !summary.hidden) {
        closeInfo();
        info.focus();
      }
    },
    { signal: events.signal },
  );

  const choices: Choice[] = [
    { mode: null, name: "Whole site" },
    ...layout.events.map((mode) => ({ mode, name: mode.name })),
  ];

  const choose = (mode: EventMode | null): void => {
    for (const [index, element] of elements.entries()) {
      element.setAttribute("aria-pressed", String(choices[index].mode === mode));
    }
    summary.textContent = mode?.summary ?? "";
    closeInfo();
    info.hidden = mode === null;
    select.value = mode?.id ?? "";
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
  for (const { mode, name } of choices) {
    const option = document.createElement("option");
    option.value = mode?.id ?? "";
    option.textContent = name;
    select.append(option);
  }
  select.addEventListener("change", () => {
    const choice = choices.find(({ mode }) => (mode?.id ?? "") === select.value);
    if (choice) choose(choice.mode);
  });

  return {
    destroy() {
      events.abort();
    },
    select(id) {
      const choice = choices.find(({ mode }) => (mode?.id ?? null) === id);
      if (choice) {
        choose(choice.mode);
      }
    },
  };
}
