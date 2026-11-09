import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { HIGHLIGHT, Layer, offsetParameters } from "../draw/materials.ts";
import type { Location } from "../layout/locations.ts";
import { buildingParts } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import type { Point } from "../layout/polygon.ts";
import { outsetPolygon } from "../layout/polygon.ts";
import type { GroundSurface } from "../terrain/ground.ts";

/** A constant width on screen, so it reads from the whole-site view as well as up close. */
const WIDTH_PIXELS = 3;
/** Clear of the walls, in metres, so that the line doesn't run into them. */
const OUTSET = 3;
/** Above the flat layers, which lie within about 0.4 m of the ground. */
const LIFT = 0.8;
/** How often the line touches down on the terrain, in metres. */
const STEP = 12;

function addLoop(positions: number[], loop: readonly Point[], surface: GroundSurface): void {
  const addPoint = (x: number, z: number): void => {
    positions.push(x, surface.heightAt(x, z) + LIFT, z);
  };
  loop.forEach(([ax, az], index) => {
    const [bx, bz] = loop[(index + 1) % loop.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP));
    for (let step = 0; step < steps; step += 1) {
      addPoint(ax + ((bx - ax) * step) / steps, az + ((bz - az) * step) / steps);
      addPoint(ax + ((bx - ax) * (step + 1)) / steps, az + ((bz - az) * (step + 1)) / steps);
    }
  });
}

/** A cyan line on the ground around the selected building. */
export class SelectionOutline {
  readonly object = new LineSegments2(
    new LineSegmentsGeometry(),
    new LineMaterial({
      color: HIGHLIGHT.getHex(),
      linewidth: WIDTH_PIXELS,
      ...offsetParameters(Layer.outline),
    }),
  );

  constructor(private readonly surface: GroundSurface) {
    this.object.visible = false;
  }

  /** Draws around a building. Anything else, or `null`, clears the line. */
  show(location: Location | null): void {
    if (location?.type !== "building") {
      this.object.visible = false;
      return;
    }
    const positions: number[] = [];
    for (const part of buildingParts(location)) {
      addLoop(positions, outsetPolygon(resolveOutline(part.footprint), OUTSET), this.surface);
    }
    this.object.geometry.dispose();
    this.object.geometry = new LineSegmentsGeometry().setPositions(positions);
    this.object.visible = true;
  }
}
