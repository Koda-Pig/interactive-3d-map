import data from "../data/locations.json";
import { resolveOutline } from "./path.ts";
import type { PathPoint } from "./path.ts";
import type { Point } from "./polygon.ts";

export type Category =
  | "racing"
  | "conference"
  | "hospitality"
  | "academy"
  | "commercial"
  | "transport"
  | "entrances";

interface LocationBase {
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly description: string;
}

export interface BuildingPart {
  readonly footprint: readonly PathPoint[];
  readonly height: number;
  /** How far above the ground the part starts, for roofs and arch beams. */
  readonly base?: number;
  /** Overrides the location's colour. */
  readonly color?: string;
}

export interface BuildingLocation extends LocationBase {
  readonly type: "building";
  readonly color: string;
  readonly footprint?: readonly PathPoint[];
  readonly height?: number;
  /** Used instead of `footprint` and `height` by buildings with several volumes. */
  readonly parts?: readonly BuildingPart[];
}

export interface AreaLocation extends LocationBase {
  readonly type: "area" | "water";
  readonly color: string;
  readonly footprint: readonly PathPoint[];
}

export interface TrackLocation extends LocationBase {
  readonly type: "track" | "road";
  readonly color: string;
  readonly width: number;
  readonly path: readonly PathPoint[];
  readonly closed?: boolean;
  /** Further paths drawn as part of the same location, such as slip roads. */
  readonly branches?: readonly (readonly PathPoint[])[];
  /** Width of the gap between two carriageways. */
  readonly median?: number;
  readonly dashed?: boolean;
  readonly kerbs?: boolean;
  /** Width of the verge along each edge of a track. */
  readonly runoff?: number;
  readonly runoffColor?: string;
  /** A point on the start-finish line. */
  readonly startFinish?: Point;
  /** Spacing of the ribbon's cross-sections, for very long roads. */
  readonly step?: number;
}

export interface GateLocation extends LocationBase {
  readonly type: "gate";
  readonly position: Point;
}

export type Location = BuildingLocation | AreaLocation | TrackLocation | GateLocation;

/** A terrace levelled as one, so everything on it shares a ground height. */
export interface GradingZone {
  readonly id: string;
  readonly footprint: readonly PathPoint[];
}

export interface Layout {
  readonly grading: readonly GradingZone[];
  readonly locations: readonly Location[];
}

export const layout = data as unknown as Layout;

/** The parts of a building, whichever way it was written in the data. */
export function buildingParts(building: BuildingLocation): readonly BuildingPart[] {
  if (building.parts) {
    return building.parts;
  }
  if (!building.footprint || building.height === undefined) {
    throw new Error(`Building "${building.id}" needs parts, or a footprint and height`);
  }
  return [{ footprint: building.footprint, height: building.height }];
}

/** Every outline point of a location that sits on levelled ground. */
export function levelledOutline(location: Location): readonly Point[] | null {
  switch (location.type) {
    case "building":
      return buildingParts(location).flatMap((part) => resolveOutline(part.footprint));
    case "area":
    case "water":
      return resolveOutline(location.footprint);
    default:
      return null;
  }
}
