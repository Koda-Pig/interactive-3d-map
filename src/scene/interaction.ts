import { Box3 } from "three";
import type { Object3D } from "three";
import { setHighlighted } from "../draw/materials.ts";
import type { Location } from "../layout/locations.ts";
import type { InfoPanel } from "../ui/info-panel.ts";
import type { CameraFlight } from "./flight.ts";
import type { SiteLabels } from "./labels.ts";
import type { Picker } from "./picking.ts";

/** A press that moves further than this, in pixels, is a drag and not a click. */
const CLICK_TOLERANCE = 6;

export interface InteractionParts {
  readonly canvas: HTMLCanvasElement;
  readonly site: Object3D;
  readonly pick: Picker;
  readonly labels: SiteLabels;
  readonly flight: CameraFlight;
  readonly panel: InfoPanel;
  /** Called when something changed that needs a new frame. */
  readonly onChange: () => void;
}

/** Hovering and selecting locations, from the 3D view or from anywhere else. */
export class MapInteraction {
  private hovered: Location | null = null;
  private selected: Location | null = null;
  private lit: ReadonlySet<Location> = new Set();

  private pointer: { x: number; y: number } | null = null;
  private pointerMoved = false;
  private press: { x: number; y: number } | null = null;

  constructor(private readonly parts: InteractionParts) {
    const { canvas } = parts;
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    document.addEventListener("keydown", this.onKeyDown);
  }

  /** Opens a location's details and frames it, or closes them when given `null`. */
  select(location: Location | null): void {
    this.selected = location;
    this.parts.panel.show(location);
    this.refresh();
    if (location) {
      this.parts.flight.frame(new Box3().setFromObject(this.objectOf(location)));
    }
  }

  /** Call once a frame, so that hovering costs at most one pick per frame. */
  update(viewMoved: boolean): void {
    if (this.pointer && (this.pointerMoved || viewMoved)) {
      this.setHovered(this.locationAt(this.pointer.x, this.pointer.y));
      this.pointerMoved = false;
    }
  }

  private objectOf(location: Location): Object3D {
    const object = this.parts.site.getObjectByName(location.id);
    if (!object) {
      throw new Error(`Nothing was drawn for "${location.id}"`);
    }
    return object;
  }

  private locationAt(x: number, y: number): Location | null {
    const { canvas, labels, pick } = this.parts;
    return (
      labels.at(x, y) ?? pick((x / canvas.clientWidth) * 2 - 1, 1 - (y / canvas.clientHeight) * 2)
    );
  }

  private setHovered(location: Location | null): void {
    if (location !== this.hovered) {
      this.hovered = location;
      this.parts.canvas.style.cursor = location ? "pointer" : "";
      this.refresh();
    }
  }

  private refresh(): void {
    const next = new Set<Location>();
    for (const location of [this.hovered, this.selected]) {
      if (location) {
        next.add(location);
      }
    }
    for (const location of this.lit) {
      if (!next.has(location)) {
        setHighlighted(this.objectOf(location), false);
      }
    }
    for (const location of next) {
      if (!this.lit.has(location)) {
        setHighlighted(this.objectOf(location), true);
      }
    }
    this.lit = next;
    this.parts.labels.setActive(next);
    this.parts.onChange();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "touch") {
      return;
    }
    if (event.buttons !== 0) {
      this.pointer = null;
      this.setHovered(null);
      return;
    }
    this.pointer = { x: event.offsetX, y: event.offsetY };
    this.pointerMoved = true;
  };

  private readonly onPointerLeave = (): void => {
    this.pointer = null;
    this.setHovered(null);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    // A second finger makes this a pinch, so it clears the press as well.
    this.press =
      event.isPrimary && event.button === 0 ? { x: event.offsetX, y: event.offsetY } : null;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const { press } = this;
    this.press = null;
    if (press && Math.hypot(event.offsetX - press.x, event.offsetY - press.y) <= CLICK_TOLERANCE) {
      this.select(this.locationAt(event.offsetX, event.offsetY));
    }
  };

  private readonly onPointerCancel = (): void => {
    this.press = null;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.selected) {
      this.select(null);
    }
  };
}
