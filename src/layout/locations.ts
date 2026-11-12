import data from "../data/locations.json";
import type { PathPoint } from "./path.ts";
import { resolveOutline } from "./path.ts";
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
  /** Leads its precinct's list in the sidebar, ahead of "Show more". */
  readonly featured?: boolean;
  /** A picture for the sidebar, as a URL. A placeholder is shown without one. */
  readonly image?: string;
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
  /** Draws the part as a smooth earth bank in place of a flat-topped block. */
  readonly slope?: BankSlope;
}

/**
 * A bank's surface: it falls from each crest point, at that point's height,
 * to the ground at the toe point with the same index.
 */
export interface BankSlope {
  readonly crest: readonly (readonly [x: number, z: number, height: number])[];
  readonly toe: readonly Point[];
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
  /** Natural grass and drainage follow the ground without creating a terrace. */
  readonly followTerrain?: boolean;
  /** Paving inset over another area, drawn above its base surface. */
  readonly overlay?: boolean;
  /** Lines painted on the area, such as the lines of a sports court. */
  readonly markings?: AreaMarkings;
  /** A pattern on the surface: slabs, poured concrete bays or mowing stripes. */
  readonly surface?: "paving" | "concrete" | "mown";
}

export interface AreaMarkings {
  readonly color: string;
  readonly width: number;
  readonly lines: readonly (readonly PathPoint[])[];
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
  /** Local outer runoff catchments; both rendering and protection use these. */
  readonly safetyZones?: readonly TrackSafetyZone[];
  /** Authored outer edges of corner catchments, in direction of travel. */
  readonly runoffCatchments?: readonly RunoffCatchment[];
  /** Raised crossing, measured along this road, with ramps at both ends. */
  readonly bridge?: BridgeProfile;
}

export interface TrackSafetyZone {
  readonly at: Point;
  readonly reach: number;
  readonly side: -1 | 1;
  readonly width: number;
  readonly color: string;
}

export interface RunoffCatchment {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
  readonly side: -1 | 1;
  readonly boundary: readonly PathPoint[];
  readonly color: string;
}

export interface BridgeProfile {
  readonly start: number;
  readonly end: number;
  readonly ramp: number;
  readonly clearance: number;
}

export interface GateLocation extends LocationBase {
  readonly type: "gate";
  readonly position: Point;
  /** Which way the gate's front points, towards the people arriving at it. */
  readonly facing: Facing;
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

/** What a stretch of open ground inside the boundary is used for. */
export type LandUse = "wheat" | "vineyard" | "overflow-parking" | "camping" | "fan-village";

/**
 * Open ground with a use. It isn't a location: it has no label or sidebar
 * entry, and scenery only fills the parts of it that nothing else stands on.
 */
export interface LandUseZone {
  readonly id: string;
  readonly use: LandUse;
  readonly footprint: readonly PathPoint[];
}

export interface Layout {
  readonly events: readonly EventMode[];
  readonly landUse: readonly LandUseZone[];
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
      return location.followTerrain ? null : resolveOutline(location.footprint);
    default:
      return null;
  }
}
