import { Box3, Scene, Vector3 } from "three";
import type { Camera, Object3D } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Location } from "../layout/locations.ts";
import { resolvePath, samplePath } from "../layout/path.ts";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";
import type { Precincts } from "./precincts.ts";

/** How close the camera must be before a minor label shows, in metres. */
const MINOR_LABEL_RANGE = 1500;
const ANCHOR_LIFT = 4;
const PATH_STEP = 20;
/** Clear space kept around each label, in pixels. */
const LABEL_MARGIN = 3;

interface Label {
  readonly location: Location;
  readonly element: HTMLElement;
  readonly anchor: Vector3;
  readonly width: number;
  readonly height: number;
  left: number;
  top: number;
  shown: boolean;
}

/** Where a label sits: above a shape's middle, or halfway along the mapped part of a path. */
function anchorFor(location: Location, object: Object3D): Vector3 {
  if (location.type === "track" || location.type === "road") {
    const closed = location.closed ?? false;
    const mapped = samplePath(resolvePath(location.path, closed), PATH_STEP, closed).filter(
      ({ x, z }) => Math.abs(x) <= MAP_HALF_SIZE && Math.abs(z) <= MAP_HALF_SIZE,
    );
    const { x, z } = mapped[Math.floor(mapped.length / 2)];
    return new Vector3(x, heightAt(x, z) + ANCHOR_LIFT, z);
  }
  const { min, max } = new Box3().setFromObject(object);
  return new Vector3((min.x + max.x) / 2, max.y + ANCHOR_LIFT, (min.z + max.z) / 2);
}

function overlaps(a: Label, b: Label): boolean {
  return (
    a.left < b.left + b.width + LABEL_MARGIN &&
    b.left < a.left + a.width + LABEL_MARGIN &&
    a.top < b.top + b.height + LABEL_MARGIN &&
    b.top < a.top + a.height + LABEL_MARGIN
  );
}

/** Floating name labels, thinned out on screen so that none overlap. */
export class SiteLabels {
  /** Render this with a `CSS2DRenderer`. */
  readonly root = new Scene();

  private readonly labels: Label[];
  private active: ReadonlySet<Location> = new Set();

  /** `container` must be the `CSS2DRenderer`'s element. */
  constructor(
    site: Object3D,
    container: HTMLElement,
    private readonly precincts: Precincts,
  ) {
    const unordered = site.children.map((object) => {
      const location = object.userData.location as Location;
      const element = document.createElement("div");
      element.className = location.major ? "label label--major label--hidden" : "label label--hidden";
      element.textContent = location.name;
      container.append(element);

      const marker = new CSS2DObject(element);
      marker.center.set(0.5, 1);
      const anchor = anchorFor(location, object);
      marker.position.copy(anchor);
      this.root.add(marker);

      return {
        location,
        element,
        anchor,
        width: element.offsetWidth,
        height: element.offsetHeight,
        left: 0,
        top: 0,
        shown: false,
      };
    });

    // Sorting is stable, so labels of equal rank keep their order in the data.
    this.labels = unordered.sort(
      (a, b) => Number(b.location.major ?? false) - Number(a.location.major ?? false),
    );
  }

  /** The labels of these locations are marked, and shown ahead of all others. */
  setActive(locations: ReadonlySet<Location>): void {
    this.active = locations;
    for (const { element, location } of this.labels) {
      element.classList.toggle("label--active", locations.has(location));
    }
  }

  /** Decides which labels show for this view. Call after the camera has moved. */
  layout(camera: Camera, viewWidth: number, viewHeight: number): void {
    const placed: Label[] = [];
    const projected = new Vector3();

    const place = (label: Label, active: boolean): void => {
      projected.copy(label.anchor).project(camera);
      label.left = ((projected.x + 1) / 2) * viewWidth - label.width / 2;
      label.top = ((1 - projected.y) / 2) * viewHeight - label.height;

      const onScreen =
        projected.z < 1 &&
        label.left >= 0 &&
        label.left + label.width <= viewWidth &&
        label.top >= 0 &&
        label.top + label.height <= viewHeight;
      const inRange =
        active ||
        label.location.major === true ||
        label.anchor.distanceTo(camera.position) <= MINOR_LABEL_RANGE;
      const shown =
        this.precincts.isShown(label.location.category) &&
        (active || !this.precincts.isMuted(label.location)) &&
        onScreen &&
        inRange &&
        !placed.some((other) => overlaps(label, other));

      if (shown) {
        placed.push(label);
      }
      if (shown !== label.shown) {
        label.shown = shown;
        label.element.classList.toggle("label--hidden", !shown);
      }
    };

    for (const label of this.labels) {
      if (this.active.has(label.location)) {
        place(label, true);
      }
    }
    for (const label of this.labels) {
      if (!this.active.has(label.location)) {
        place(label, false);
      }
    }
  }

  /** The location whose label is showing at a point on screen, in pixels. */
  at(x: number, y: number): Location | null {
    const label = this.labels.find(
      ({ shown, left, top, width, height }) =>
        shown && x >= left && x <= left + width && y >= top && y <= top + height,
    );
    return label?.location ?? null;
  }
}
