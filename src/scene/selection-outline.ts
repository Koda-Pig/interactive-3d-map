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
/** Matches the highlight fade in `materials.ts`, in milliseconds. */
const FADE_TIME = 150;

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
  private readonly material = new LineMaterial({
    color: HIGHLIGHT.getHex(),
    linewidth: WIDTH_PIXELS,
    transparent: true,
    opacity: 0,
    ...offsetParameters(Layer.outline),
  });

  readonly object = new LineSegments2(new LineSegmentsGeometry(), this.material);

  /** 0 is invisible and 1 fully shown; the direction says which way it's heading. */
  private strength = 0;
  private direction: 0 | 1 | -1 = 0;
  private at: number | null = null;

  constructor(private readonly surface: GroundSurface) {
    this.object.visible = false;
  }

  /** Draws around a building. Anything else, or `null`, clears the line. */
  show(location: Location | null): void {
    if (location?.type !== "building") {
      if (this.strength > 0) {
        this.direction = -1;
      }
      return;
    }
    const positions: number[] = [];
    for (const part of buildingParts(location)) {
      addLoop(positions, outsetPolygon(resolveOutline(part.footprint), OUTSET), this.surface);
    }
    this.object.geometry.dispose();
    this.object.geometry = new LineSegmentsGeometry().setPositions(positions);
    this.object.visible = true;
    this.direction = 1;
  }

  /** Advances the fade. Call once a frame, with the render loop's clock. */
  update(now: number): boolean {
    if (this.direction === 0) {
      return false;
    }
    this.at ??= now;
    const step = (now - this.at) / FADE_TIME;
    this.at = now;
    const goal = this.direction === 1 ? 1 : 0;
    this.strength =
      goal > this.strength ? Math.min(this.strength + step, 1) : Math.max(this.strength - step, 0);
    const eased = this.strength * this.strength * (3 - 2 * this.strength);
    this.material.opacity = eased;
    if (this.strength === 0) {
      this.object.visible = false;
      this.direction = 0;
      this.at = null;
      return false;
    }
    if (this.strength === 1) {
      this.direction = 0;
      this.at = null;
    }
    return true;
  }
}
