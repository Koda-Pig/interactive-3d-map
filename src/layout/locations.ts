import data from "../data/locations.json";
import { resolveOutline } from "./path.ts";
import type { PathPoint } from "./path.ts";
import type { Point } from "./polygon.ts";

/** Every category, in the order precincts are listed to visitors. */
export const CATEGORIES = [
  "racing",
  "conference",
  "hospitality",
  "academy",
  "commercial",
  "transport",
  "entrances",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Each category's name as a precinct, as shown to visitors. */
export const PRECINCT_NAMES: Readonly<Record<Category, string>> = {
  racing: "Racing",
  conference: "Conference and events",
  hospitality: "Hospitality and waterfront",
  academy: "Academy and automotive",
  commercial: "Residential and commercial",
  transport: "Parking and transport",
  entrances: "Entrances",
};

interface LocationBase {
  readonly id: string;
  readonly name: string;
  readonly category: Category;
  readonly description: string;
  /** Keeps the name label up when zoomed out, ahead of the minor labels. */
  readonly major?: boolean;
}

export type Facing = "north" | "east" | "south" | "west";

/** A `.glb` from `public/models`, fitted to the outline it replaces. */
export interface ModelPlacement {
  /** Relative to `public/models`. */
  readonly file: string;
  /** Which way the model's front points. */
  readonly facing: Facing;
  /** Repeats the model across and front to back. */
  readonly grid?: readonly [columns: number, rows: number];
  /** Treats `file` as a tile, filling the run between a copy of this at each end. */
  readonly endCap?: string;
}

export interface BuildingPart {
  readonly footprint: readonly PathPoint[];
  readonly height: number;
  /** How far above the ground the part starts, for roofs and arch beams. */
  readonly base?: number;
  /** Overrides the location's colour. */
  readonly color?: string;
  /** Drawn in place of this part. */
  readonly model?: ModelPlacement;
}

export interface BuildingLocation extends LocationBase {
  readonly type: "building";
  readonly color: string;
  readonly footprint?: readonly PathPoint[];
  readonly height?: number;
  /** Used instead of `footprint` and `height` by buildings with several volumes. */
  readonly parts?: readonly BuildingPart[];
  /** Drawn in place of the whole building. */
  readonly model?: ModelPlacement;
}

export interface AreaLocation extends LocationBase {
  readonly type: "area" | "water";
  readonly color: string;
  readonly footprint: readonly PathPoint[];
  /** Where trees go: scattered through the area, or lining its edge. */
  readonly planting?: "park" | "edge";
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

/** One way the venue is used, and the locations in use when it is. */
export interface EventMode {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  /** Precincts in use in full. */
  readonly categories: readonly Category[];
  /** Further locations in use, by id. */
  readonly locations: readonly string[];
}

export interface Layout {
  readonly events: readonly EventMode[];
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
