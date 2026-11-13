import "./style.css";
import { layout } from "./layout/locations.ts";
import { mountMap } from "./map/index.ts";
import { inspection } from "./map/inspection.ts";
import { linkedLocation, showInAddress } from "./ui/address.ts";

const host = document.querySelector<HTMLElement>("#standalone-map");
if (!host) throw new Error("Missing standalone map host");
const readSelection = (): string | undefined => {
  const location = linkedLocation();
  if (!location) showInAddress(null);
  return location?.id;
};
const map = mountMap(host, {
  variant: "page",
  assetBaseUrl: import.meta.env.BASE_URL,
  initialLocationId: readSelection(),
  onLocationChange: (id) =>
    showInAddress(layout.locations.find((location) => location.id === id) ?? null),
});
window.addEventListener("popstate", () => map.selectLocation(readSelection() ?? null));
void map.ready
  .then(() => {
    if (import.meta.env.DEV) Object.assign(window, { __map: inspection.get(host) });
  })
  .catch(() => undefined);
if (import.meta.hot) import.meta.hot.dispose(() => map.destroy());
