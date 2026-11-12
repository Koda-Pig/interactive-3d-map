import type { Location } from "../layout/locations.ts";
import { layout } from "../layout/locations.ts";

/** The query parameter that names the selected location, so a link opens on it. */
const PARAMETER = "location";

/** The location the address names, if it names one that exists. */
export function linkedLocation(): Location | null {
  const id = new URLSearchParams(window.location.search).get(PARAMETER);
  return (id && layout.locations.find((location) => location.id === id)) || null;
}

/**
 * Puts the selected location in the address, or takes it out. The entry is
 * replaced, not added, so the back button leaves the map instead of stepping
 * through every selection. Other parameters, such as `?quality`, are kept.
 */
export function showInAddress(location: Location | null): void {
  const url = new URL(window.location.href);
  if (location) {
    url.searchParams.set(PARAMETER, location.id);
  } else {
    url.searchParams.delete(PARAMETER);
  }
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
}
