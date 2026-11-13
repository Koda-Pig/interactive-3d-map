"use client";
import { useEffect, useRef, useState } from "react";
import { type MapHandle, type MapVariant, mountMap } from "../map/index.ts";
export interface BmrMapProps {
  assetBaseUrl: string;
  variant: MapVariant;
  active?: boolean;
  locationId?: string | null;
  onLocationChange?: (id: string | null) => void;
}
export function BmrMap({
  assetBaseUrl,
  variant,
  active = true,
  locationId,
  onLocationChange,
}: BmrMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<MapHandle | null>(null);
  const callback = useRef(onLocationChange);
  const selection = useRef(locationId);
  const activity = useRef(active);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    callback.current = onLocationChange;
  }, [onLocationChange]);
  useEffect(() => {
    selection.current = locationId;
    handle.current?.selectLocation(locationId ?? null);
  }, [locationId]);
  useEffect(() => {
    activity.current = active;
    handle.current?.setActive(active);
  }, [active]);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    setFailed(false);
    const map = mountMap(host.current, {
      assetBaseUrl,
      variant,
      active: activity.current,
      initialLocationId: selection.current ?? undefined,
      onLocationChange: (id) => callback.current?.(id),
    });
    handle.current = map;
    void map.ready.catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      handle.current = null;
      map.destroy();
    };
  }, [assetBaseUrl, variant]);
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={host} style={{ width: "100%", height: "100%" }} />
      {failed && (
        <p role="status">
          The interactive map is unavailable. Concept layout, for illustration only.
        </p>
      )}
    </div>
  );
}
