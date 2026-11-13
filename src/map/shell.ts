import { circuitOutline } from "./circuit-outline.ts";

const markup = `
    <aside data-part="sidebar" class="sidebar" aria-label="Locations">
      <!-- On a wide screen the shell is the one shape that is either the panel or the button. -->
      <div class="sidebar__shell">
        <div data-part="sidebar-pane" class="sidebar__inner">
          <div class="sidebar__handle">
            <button
              class="sidebar__grabber"
              type="button"
              aria-expanded="false"
              aria-label="Show locations"
            ></button>
            <div class="sidebar__bar">
              <h1 class="sidebar__title">Blue Mountain Racing</h1>
              <button class="sidebar__reset" type="button">Reset view</button>
              <button
                class="sidebar__close"
                type="button"
                aria-label="Hide locations"
              >
                &times;
              </button>
            </div>
          </div>
          <div class="sidebar__body">
            <div class="sidebar__search-row">
              <input
                class="sidebar__search"
                type="search"
                placeholder="Search locations"
                aria-label="Search locations"
                autocomplete="off"
              />
            </div>
            <p class="sidebar__empty" role="status"></p>
            <div class="sidebar__list"></div>
          </div>
        </div>
      </div>
      <!-- The shell's collapsed state. It has no background of its own. -->
      <button
        data-part="sidebar-open"
        class="sidebar-open"
        type="button"
        aria-controls="sidebar-pane"
        aria-expanded="false"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        Locations
      </button>
    </aside>
    <main class="map-canvas"></main>
    <!-- Before the details panel, so the panel covers it where they meet on a phone. -->
    <p data-part="hint" class="hint"></p>
    <aside
      data-part="info-panel"
      class="info-panel"
      aria-label="Location details"
      aria-live="polite"
      hidden
    >
      <div class="info-panel__bar">
        <p class="info-panel__precinct"></p>
        <button
          class="info-panel__close"
          type="button"
          aria-label="Close details"
        >
          &times;
        </button>
      </div>
      <img class="info-panel__image" alt="" hidden />
      <div class="info-panel__body">
        <!-- biome-ignore lint/a11y/useHeadingContent: filled in when a location is picked -->
        <h2 class="info-panel__name"></h2>
        <p class="info-panel__description"></p>
        <div class="info-panel__actions" hidden>
          <div class="info-panel__action-groups"></div>
          <p class="info-panel__actions-note">Placeholder links in this concept</p>
        </div>
        <nav class="info-panel__related" aria-label="Nearby" hidden>
          <ul class="info-panel__related-list"></ul>
        </nav>
      </div>
    </aside>
    <section
      data-part="event-switch"
      class="event-switch"
      aria-label="Show the site in use"
    >
      <div class="event-switch__buttons"></div>
      <label class="event-switch__mobile">
        <select aria-label="Site view" class="event-switch__select"></select>
      </label>
      <button class="event-switch__info" type="button" aria-label="About this event" aria-expanded="false" aria-controls="event-summary" hidden>i</button>
      <p data-part="event-summary" class="event-switch__summary" hidden></p>
    </section>
    <section class="tour-player" aria-label="Guided tours">
      <fieldset class="tours" aria-label="Tours">
        <div class="tours__choices">
          <span class="tours__heading">Explore the venue</span>
          <div class="tours__actions">
            <button class="tours__button" type="button" data-tour="lap">Lap the circuit</button>
            <button class="tours__button" type="button" data-tour="arrival">Arrive for a race</button>
          </div>
        </div>
        <div class="tours__playing" hidden>
          <div class="tours__description">
            <strong class="tours__name"></strong>
            <span class="tours__status">Getting into position…</span>
          </div>
          <p class="tours__telemetry" hidden>
            <span class="tours__speedometer"><span class="tours__kmh">0</span> km/h</span>
            <span class="tours__place"></span>
          </p>
          <div class="tours__speed">
            <label for="tour-speed">Speed</label>
            <select data-part="tour-speed" data-tour-speed>
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
              <option value="3">3×</option>
              <option value="4">4×</option>
            </select>
          </div>
          <button class="tours__stop" type="button">Stop</button>
          <progress class="tours__progress" max="1" value="0" aria-label="Tour progress"></progress>
        </div>
      </fieldset>
      <p class="route-legend" hidden>
        <span class="route-legend__item route-legend__item--drive">By road</span>
        <span class="route-legend__item route-legend__item--walk">On foot</span>
      </p>
    </section>
    <p class="notice">Concept layout, for illustration only</p>
    <section
      data-part="map-controls"
      class="map-controls"
      aria-label="Map view"
    ></section>
    <div data-part="loading" class="title">
      <!-- circuit-outline -->
      <p class="title__name">Blue Mountain Racing</p>
      <p class="title__place">Swartland &middot; Western Cape</p>
      <p class="title__status" role="status">Loading the concept map&hellip;</p>
    </div>
    `;

export function createShell(host: HTMLElement): HTMLElement {
  const root = document.createElement("div");
  root.className = "bmr-map intro sidebar-closed";
  root.innerHTML = markup.replace("<!-- circuit-outline -->", circuitOutline());
  const prefix = `bmr-${crypto.randomUUID()}`;
  for (const element of root.querySelectorAll<HTMLElement>("[data-part]")) {
    element.id = `${prefix}-${element.dataset.part}`;
  }
  for (const element of root.querySelectorAll("[aria-controls], [for]")) {
    for (const attribute of ["aria-controls", "for"]) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, `${prefix}-${value}`);
    }
  }
  const wrapper = document.createElement("div");
  wrapper.className = "bmr-map-container";
  wrapper.append(root);
  host.append(wrapper);
  return root;
}
