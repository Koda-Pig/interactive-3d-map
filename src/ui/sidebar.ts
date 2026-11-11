import type { Category, Location } from "../layout/locations.ts";
import { CATEGORIES, layout, PRECINCT_NAMES } from "../layout/locations.ts";
import { createBottomSheet } from "./bottom-sheet.ts";
import { publicUrl, requirePart } from "./dom.ts";

export interface SidebarActions {
  pick(location: Location): void;
  togglePrecinct(category: Category, shown: boolean): void;
  resetView(): void;
}

export interface Sidebar {
  /** Marks the selected location in the list, scrolling it into view. */
  showSelected(location: Location | null): void;
  /** Sets a precinct's toggle to match the map. */
  showPrecinct(category: Category, shown: boolean): void;
}

interface Row {
  readonly location: Location;
  readonly item: HTMLLIElement;
  readonly button: HTMLButtonElement;
  readonly header: HTMLElement;
  readonly words: readonly string[];
}

interface Group {
  readonly section: HTMLElement;
  readonly count: HTMLElement;
  readonly toggle: HTMLInputElement;
  readonly rows: readonly Row[];
}

function wordsIn(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== "");
}

/** Each search word has to start a word in the location's name or precinct. */
function matches(row: Row, query: readonly string[]): boolean {
  return query.every((term) => row.words.some((word) => word.startsWith(term)));
}

function createRow(location: Location, header: HTMLElement, onPick: () => void): Row {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sidebar__item";
  button.textContent = location.name;
  button.addEventListener("click", onPick);

  const item = document.createElement("li");
  item.append(button);

  return {
    location,
    item,
    button,
    header,
    words: wordsIn(`${location.name} ${PRECINCT_NAMES[location.category]}`),
  };
}

function createGroup(
  category: Category,
  actions: SidebarActions,
  onPick: (location: Location) => void,
): Group {
  const name = document.createElement("h2");
  name.className = "sidebar__group-name";
  name.textContent = PRECINCT_NAMES[category];

  const count = document.createElement("span");
  count.className = "sidebar__group-count";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.className = "sidebar__switch";
  toggle.checked = true;
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-label", `Show ${PRECINCT_NAMES[category]} on the map`);
  toggle.addEventListener("change", () => {
    actions.togglePrecinct(category, toggle.checked);
  });

  const switchArea = document.createElement("label");
  switchArea.className = "sidebar__switch-area";
  switchArea.append(toggle);

  const header = document.createElement("div");
  header.className = "sidebar__group-header";
  header.append(name, count, switchArea);

  const rows = layout.locations
    .filter((location) => location.category === category)
    .map((location) => createRow(location, header, () => onPick(location)));

  const list = document.createElement("ul");
  list.className = "sidebar__items";
  list.append(...rows.map((row) => row.item));

  const section = document.createElement("section");
  section.append(header, list);
  return { section, count, toggle, rows };
}

const PLACEHOLDER_ICON =
  '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M21 5v14H3V5zm-2 2H5v8.6l3.5-3.5 3 3 4-5L19 15.5zM8 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3"/></svg>';

/** The picture shown under the selected row: the location's own, or a placeholder. */
function createPreview(location: Location): HTMLElement {
  const figure = document.createElement("figure");
  figure.className = "sidebar__preview";
  if (location.image) {
    const image = document.createElement("img");
    image.className = "sidebar__preview-image";
    image.src = publicUrl(location.image);
    image.alt = location.name;
    figure.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "sidebar__preview-image sidebar__preview-image--placeholder";
    placeholder.innerHTML = PLACEHOLDER_ICON;
    const note = document.createElement("span");
    note.textContent = "Image to come";
    placeholder.append(note);
    placeholder.setAttribute("role", "img");
    placeholder.setAttribute("aria-label", `Placeholder image for ${location.name}`);
    figure.append(placeholder);
  }
  return figure;
}

/** Moves the list by just enough to show a row below the sticky precinct header. */
function revealRow(list: HTMLElement, row: Row): void {
  if (row.item.hidden) {
    return;
  }
  const area = list.getBoundingClientRect();
  const box = row.button.getBoundingClientRect();
  const above = box.top - (area.top + row.header.offsetHeight);
  // The row's picture sits under its button, and should be in view with it.
  const below = row.item.getBoundingClientRect().bottom - area.bottom;
  if (above < 0) {
    list.scrollTop += above;
  } else if (below > 0) {
    list.scrollTop += Math.min(below, above);
  }
}

/** On `<html>` while the sidebar is put away. It starts there, in `index.html`. */
const CLOSED_CLASS = "sidebar-closed";

export function createSidebar(
  root: HTMLElement,
  openButton: HTMLElement,
  actions: SidebarActions,
): Sidebar {
  const search = requirePart<HTMLInputElement>(root, ".sidebar__search");
  const empty = requirePart(root, ".sidebar__empty");
  const list = requirePart(root, ".sidebar__list");
  const reset = requirePart(root, ".sidebar__reset");

  let selected: Row | null = null;
  let preview: HTMLElement | null = null;

  const sheet = createBottomSheet({
    sheet: root,
    handle: requirePart(root, ".sidebar__handle"),
    grabber: requirePart(root, ".sidebar__grabber"),
    handleAction: reset,
  });

  // On a wide screen the sidebar is put away until asked for. On a phone it's
  // the bottom sheet, which has its own way of opening.
  function setShown(shown: boolean): void {
    document.documentElement.classList.toggle(CLOSED_CLASS, !shown);
    openButton.setAttribute("aria-expanded", String(shown));
    if (shown) {
      if (selected) {
        revealRow(list, selected);
      }
      search.focus();
    } else {
      openButton.focus();
    }
  }
  openButton.addEventListener("click", () => setShown(true));
  requirePart(root, ".sidebar__close").addEventListener("click", () => setShown(false));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && search.value === "") {
      setShown(false);
    }
  });

  function pick(location: Location): void {
    actions.pick(location);
    search.blur();
    sheet.close();
  }

  const groups = new Map<Category, Group>(
    CATEGORIES.map((category) => [category, createGroup(category, actions, pick)]),
  );
  const rows = [...groups.values()].flatMap((group) => group.rows);
  list.append(...[...groups.values()].map((group) => group.section));

  function applySearch(): void {
    const query = wordsIn(search.value);
    for (const { section, count, rows: groupRows } of groups.values()) {
      let matched = 0;
      for (const row of groupRows) {
        row.item.hidden = !matches(row, query);
        matched += row.item.hidden ? 0 : 1;
      }
      section.hidden = matched === 0;
      count.textContent = String(matched);
    }
    const anyMatched = rows.some((row) => !row.item.hidden);
    empty.textContent = anyMatched ? "" : `No locations match "${search.value.trim()}"`;
  }

  search.addEventListener("input", applySearch);
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const first = rows.find((row) => !row.item.hidden);
    if (first) {
      pick(first.location);
    }
  });
  reset.addEventListener("click", () => {
    actions.resetView();
    sheet.close();
  });

  applySearch();

  return {
    showSelected(location) {
      selected?.button.removeAttribute("aria-current");
      preview?.remove();
      preview = null;
      selected = rows.find((row) => row.location === location) ?? null;
      if (selected) {
        selected.button.setAttribute("aria-current", "true");
        preview = createPreview(selected.location);
        selected.item.append(preview);
        revealRow(list, selected);
      }
    },
    showPrecinct(category, shown) {
      const group = groups.get(category);
      if (group) {
        group.toggle.checked = shown;
        group.section.classList.toggle("sidebar__group--off", !shown);
      }
    },
  };
}
