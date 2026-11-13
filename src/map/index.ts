export type MapVariant = "section" | "page";
export interface MapOptions {
  assetBaseUrl: string;
  variant: MapVariant;
  active?: boolean;
  initialLocationId?: string;
  onLocationChange?: (locationId: string | null) => void;
}
export interface MapHandle {
  readonly ready: Promise<void>;
  setActive(active: boolean): void;
  selectLocation(locationId: string | null): void;
  destroy(): void;
}
export { mountMap } from "./mount.ts";
