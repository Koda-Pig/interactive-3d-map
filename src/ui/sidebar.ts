import type { Category, Location } from "../layout/locations.ts";
import { CATEGORIES, layout, PRECINCT_NAMES } from "../layout/locations.ts";
import { createBottomSheet, PHONE_LAYOUT } from "./bottom-sheet.ts";
import { publicUrl, requirePart } from "./dom.ts";

export interface SidebarActions {
  pick(location: Location): void;
  togglePrecinct(category: Category, shown: boolean): void;
  resetView(): void;
  /** Called when the panel opens or closes on a wide screen. */
  shownChanged(): void;
}

export interface Sidebar {
  /** Marks the selected location in the list, scrolling it into view unless `reveal` is off. */
  showSelected(location: Location | null, reveal?: boolean): void;
  /** Sets a precinct's toggle to match the map. */
  showPrecinct(category: Category, shown: boolean): void;
  /**
   * How far the open panel reaches over the page from the left, in pixels.
   * Zero while it's closed, and on a phone, where it's the bottom sheet.
   */
  panelWidth(): number;
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
  /** The precinct's name, which opens and closes its list. */
  readonly expand: HTMLButtonElement;
  /** Holds everything under the header, and folds away with it. */
  readonly body: HTMLElement;
  /** Holds the locations that aren't featured, and folds away on its own. */
  readonly restBody: HTMLElement;
  /** Under the featured locations, and brings in the rest. */
  readonly more: HTMLButtonElement;
  /** Featured locations first, then the rest. */
  readonly rows: readonly Row[];
  /** The locations behind "Show more". None when nothing is featured. */
  readonly rest: readonly Row[];
  open: boolean;
  /** Whether the rest are listed along with the featured locations. */
  showAll: boolean;
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

const FOLD_OPEN_CLASS = "sidebar__fold--open";

/**
 * A box that slides open and shut. Its one grid row grows from nothing to its
 * contents' height, which CSS can animate without knowing that height.
 */
function createFold(...contents: HTMLElement[]): HTMLElement {
  const inner = document.createElement("div");
  inner.className = "sidebar__fold-inner";
  inner.append(...contents);
  const fold = document.createElement("div");
  fold.className = "sidebar__fold";
  fold.append(inner);
  return fold;
}

function createGroup(
  category: Category,
  actions: SidebarActions,
  onPick: (location: Location) => void,
  onChange: () => void,
): Group {
  const count = document.createElement("span");
  count.className = "sidebar__group-count";

  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "sidebar__group-expand";
  expand.append(PRECINCT_NAMES[category], count);

  const name = document.createElement("h2");
  name.className = "sidebar__group-name";
  name.append(expand);

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
  header.append(name, switchArea);

  const all = layout.locations
    .filter((location) => location.category === category)
    .map((location) => createRow(location, header, () => onPick(location)));
  const featured = all.filter((row) => row.location.featured);
  // With nothing featured there's no short list to lead with, so all of it shows.
  const lead = featured.length > 0 ? featured : all;
  const rest = all.filter((row) => !lead.includes(row));

  const leadList = document.createElement("ul");
  leadList.className = "sidebar__items";
  leadList.append(...lead.map((row) => row.item));

  const restList = document.createElement("ul");
  restList.className = "sidebar__items";
  restList.append(...rest.map((row) => row.item));
  const restBody = createFold(restList);

  const more = document.createElement("button");
  more.type = "button";
  more.className = "sidebar__more";

  const body = createFold(leadList, restBody, more);
  body.id = `sidebar-precinct-${category}`;
  expand.setAttribute("aria-controls", body.id);

  const section = document.createElement("section");
  section.append(header, body);

  const group: Group = {
    section,
    count,
    toggle,
    expand,
    body,
    restBody,
    more,
    rows: [...lead, ...rest],
    rest,
    open: false,
    showAll: false,
  };
  expand.addEventListener("click", () => {
    group.open = !group.open;
    onChange();
  });
  more.addEventListener("click", () => {
    group.showAll = !group.showAll;
    onChange();
  });
  return group;
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

  const pane = requirePart(root, ".sidebar__inner");
  const phone = window.matchMedia(PHONE_LAYOUT);

  function isShown(): boolean {
    return !document.documentElement.classList.contains(CLOSED_CLASS);
  }

  // On a wide screen the panel and the button are one shape, and whichever
  // half is put away fades out. `inert` takes it out of the tab order and
  // away from screen readers at once, not when the fade ends. On a phone the
  // sidebar is the bottom sheet, which is always in reach.
  function syncInert(): void {
    const morphs = !phone.matches;
    pane.inert = morphs && !isShown();
    openButton.inert = morphs && isShown();
  }

  function setShown(shown: boolean): void {
    document.documentElement.classList.toggle(CLOSED_CLASS, !shown);
    openButton.setAttribute("aria-expanded", String(shown));
    // Focus moves to the half that's arriving before the other goes inert.
    (shown ? pane : openButton).inert = false;
    if (shown) {
      if (selected) {
        revealRow(list, selected);
      }
      search.focus({ preventScroll: true });
    } else {
      openButton.focus();
    }
    syncInert();
    actions.shownChanged();
  }
  syncInert();
  phone.addEventListener("change", syncInert);
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
    CATEGORIES.map((category) => [category, createGroup(category, actions, pick, render)]),
  );
  const rows = [...groups.values()].flatMap((group) => group.rows);
  list.append(...[...groups.values()].map((group) => group.section));

  /**
   * Shows what belongs on screen. A search lists every match, whatever is
   * folded away. Otherwise an open precinct lists its featured locations, and
   * the rest once asked.
   */
  function render(): void {
    const query = wordsIn(search.value);
    const searching = query.length > 0;
    let anyMatched = false;
    for (const group of groups.values()) {
      let matched = 0;
      for (const row of group.rows) {
        row.item.hidden = !matches(row, query);
        matched += row.item.hidden ? 0 : 1;
      }
      anyMatched ||= matched > 0;
      group.section.hidden = matched === 0;
      group.count.textContent = String(matched);
      group.expand.disabled = searching;
      group.expand.setAttribute("aria-expanded", String(searching || group.open));
      group.body.classList.toggle(FOLD_OPEN_CLASS, searching || group.open);
      group.restBody.classList.toggle(FOLD_OPEN_CLASS, searching || group.showAll);
      group.more.hidden = searching || group.rest.length === 0;
      group.more.textContent = group.showAll ? "Show fewer" : `Show ${group.rest.length} more`;
      group.more.setAttribute("aria-expanded", String(group.showAll));
    }
    empty.textContent = anyMatched ? "" : `No locations match "${search.value.trim()}"`;
  }

  /** Runs a change to the list with its folds snapping, not sliding. */
  function withoutSliding(change: () => void): void {
    list.classList.add("sidebar__list--instant");
    change();
    // Reading the height applies the change before the slide is allowed again.
    void list.offsetHeight;
    list.classList.remove("sidebar__list--instant");
  }

  search.addEventListener("input", render);
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

  render();

  return {
    panelWidth() {
      return !phone.matches && isShown() ? pane.offsetWidth : 0;
    },
    showSelected(location, reveal = true) {
      selected?.button.removeAttribute("aria-current");
      preview?.remove();
      preview = null;
      selected = rows.find((row) => row.location === location) ?? null;
      if (selected) {
        selected.button.setAttribute("aria-current", "true");
        preview = createPreview(selected.location);
        selected.item.append(preview);
        const group = groups.get(selected.location.category);
        if (group) {
          group.open = true;
          group.showAll ||= group.rest.includes(selected);
        }
        // The row is scrolled to at once, so it has to be in its final place.
        withoutSliding(render);
        if (reveal) {
          revealRow(list, selected);
        }
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
