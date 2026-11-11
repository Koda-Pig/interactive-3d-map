import type { Camera, Object3D } from "three";
import { Box3, Scene, Vector3 } from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Location } from "../layout/locations.ts";
import { resolvePath, samplePath } from "../layout/path.ts";
import { MAP_HALF_SIZE } from "../site.ts";
import { heightAt } from "../terrain/height.ts";
import type { Box } from "../ui/overlays.ts";
import type { Precincts } from "./precincts.ts";

/** How close the camera must be before a minor label shows, in metres. */
const MINOR_LABEL_RANGE = 1500;
const ANCHOR_LIFT = 4;
const PATH_STEP = 20;
/** Clear space kept around each label, in pixels. */
const LABEL_MARGIN = 3;
/** Clear space kept around the selected thing on screen, in pixels. */
const SELECTION_CLEARANCE = 10;
/** Matches the fade in `style.css`, with a frame or two to spare, in milliseconds. */
const FADE_TIME = 200;

interface Label {
  readonly location: Location;
  readonly element: HTMLElement;
  readonly marker: CSS2DObject;
  readonly object: Object3D;
  /** When the label last stopped showing, so it can leave the page once it has faded. */
  hiddenAt: number;
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

function isUnder(label: Label, box: Box): boolean {
  return (
    label.left < box.right + LABEL_MARGIN &&
    box.left < label.left + label.width + LABEL_MARGIN &&
    label.top < box.bottom + LABEL_MARGIN &&
    box.top < label.top + label.height + LABEL_MARGIN
  );
}

/** Floating name labels, thinned out on screen so that none overlap. */
export class SiteLabels {
  /** Render this with a `CSS2DRenderer`. */
  readonly root = new Scene();

  private readonly labels: Label[];
  private active: ReadonlySet<Location> = new Set();
  /**
   * The selected thing's bounds, which minor labels keep clear of so they
   * don't sit on its outline. Tracks and roads span the site, so they have none.
   */
  private selectedBounds: Box3 | null = null;

  /** `container` must be the `CSS2DRenderer`'s element. */
  constructor(
    site: Object3D,
    container: HTMLElement,
    private readonly precincts: Precincts,
  ) {
    const unordered = site.children.map((object) => {
      const location = object.userData.location as Location;
      const element = document.createElement("div");
      element.className = location.major
        ? "label label--major label--hidden"
        : "label label--hidden";
      element.textContent = location.name;
      container.append(element);

      const marker = new CSS2DObject(element);
      marker.center.set(0.5, 1);
      // Until a label shows it stays off the page, where it costs nothing to move.
      marker.visible = false;
      const anchor = anchorFor(location, object);
      marker.position.copy(anchor);
      this.root.add(marker);

      return {
        location,
        element,
        marker,
        object,
        hiddenAt: Number.NEGATIVE_INFINITY,
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

  /**
   * The labels of these locations are marked, and shown ahead of all others.
   * The selected one takes the colour of the line around it.
   */
  setActive(locations: ReadonlySet<Location>, selected: Location | null): void {
    this.active = locations;
    const label = this.labels.find((candidate) => candidate.location === selected);
    this.selectedBounds =
      label && label.location.type !== "track" && label.location.type !== "road"
        ? new Box3().setFromObject(label.object)
        : null;
    for (const { element, location } of this.labels) {
      element.classList.toggle("label--active", locations.has(location));
      element.classList.toggle("label--selected", location === selected);
    }
  }

  /**
   * Decides which labels show for this view. Call after the camera has moved.
   * `blocked` holds the panels and buttons that labels mustn't sit under.
   * Returns whether it needs calling again next frame, to fade a label in.
   */
  layout(
    camera: Camera,
    viewWidth: number,
    viewHeight: number,
    blocked: readonly Box[],
    now: number,
  ): boolean {
    const placed: Label[] = [];
    const projected = new Vector3();
    let again = false;
    const clearOfSelection = this.selectionBox(camera, viewWidth, viewHeight);

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
      const wanted =
        this.precincts.isShown(label.location.category) &&
        (active || !this.precincts.isMuted(label.location)) &&
        onScreen &&
        inRange &&
        !blocked.some((box) => isUnder(label, box)) &&
        (active ||
          label.location.major === true ||
          !clearOfSelection ||
          !isUnder(label, clearOfSelection)) &&
        !placed.some((other) => overlaps(label, other));

      if (wanted) {
        placed.push(label);
      }
      // A label coming back onto the page needs a frame there before it can fade in.
      const shown = wanted && label.marker.visible;
      if (wanted && !label.marker.visible) {
        label.marker.visible = true;
        again = true;
      }
      if (shown !== label.shown) {
        label.shown = shown;
        label.hiddenAt = now;
        label.element.classList.toggle("label--hidden", !shown);
      }
      if (!wanted && !label.shown && now - label.hiddenAt > FADE_TIME) {
        label.marker.visible = false;
      }
    };

    // Within each rank, labels that are already up go first. Otherwise two
    // that overlap swap places as the camera moves.
    const passes: readonly ((label: Label) => boolean)[] = [
      (label) => this.active.has(label.location),
      (label) => !this.active.has(label.location) && label.location.major === true && label.shown,
      (label) => !this.active.has(label.location) && label.location.major === true && !label.shown,
      (label) => !this.active.has(label.location) && label.location.major !== true && label.shown,
      (label) => !this.active.has(label.location) && label.location.major !== true && !label.shown,
    ];
    const ranked = passes.map((pass) => this.labels.filter(pass));
    ranked.forEach((labels, rank) => {
      for (const label of labels) {
        place(label, rank === 0);
      }
    });
    return again;
  }

  /** The selected thing's outline on screen, with room around it, or `null` if there's none to keep clear of. */
  private selectionBox(camera: Camera, viewWidth: number, viewHeight: number): Box | null {
    const bounds = this.selectedBounds;
    if (!bounds) {
      return null;
    }
    const corner = new Vector3();
    let left = Number.POSITIVE_INFINITY;
    let top = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    let bottom = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          i & 1 ? bounds.max.x : bounds.min.x,
          i & 2 ? bounds.max.y : bounds.min.y,
          i & 4 ? bounds.max.z : bounds.min.z,
        )
        .project(camera);
      // Part of it is behind the camera, so its outline on screen is unbounded.
      if (corner.z > 1) {
        return null;
      }
      const x = ((corner.x + 1) / 2) * viewWidth;
      const y = ((1 - corner.y) / 2) * viewHeight;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return {
      left: left - SELECTION_CLEARANCE,
      top: top - SELECTION_CLEARANCE,
      right: right + SELECTION_CLEARANCE,
      bottom: bottom + SELECTION_CLEARANCE,
    };
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
