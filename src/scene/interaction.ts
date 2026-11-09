import type { Object3D } from "three";
import { Box3 } from "three";
import type { HighlightLevel } from "../draw/materials.ts";
import { highlightLook, setHighlight } from "../draw/materials.ts";
import type { Category, Location } from "../layout/locations.ts";
import type { InfoPanel } from "../ui/info-panel.ts";
import type { Sidebar } from "../ui/sidebar.ts";
import type { CameraFlight } from "./flight.ts";
import type { SiteLabels } from "./labels.ts";
import type { Picker } from "./picking.ts";
import type { Precincts } from "./precincts.ts";
import type { SelectionOutline } from "./selection-outline.ts";

/** A press that moves further than this, in pixels, is a drag and not a click. */
const CLICK_TOLERANCE = 6;

export interface InteractionParts {
  readonly canvas: HTMLCanvasElement;
  readonly site: Object3D;
  readonly pick: Picker;
  readonly labels: SiteLabels;
  readonly flight: CameraFlight;
  readonly panel: InfoPanel;
  readonly sidebar: Sidebar;
  readonly precincts: Precincts;
  readonly outline: SelectionOutline;
  /** Called when something changed that needs a new frame. */
  readonly onChange: () => void;
}

/** Hovering and selecting locations, from the 3D view or from anywhere else. */
export class MapInteraction {
  private hovered: Location | null = null;
  private selected: Location | null = null;
  private lit: ReadonlyMap<Location, HighlightLevel> = new Map();

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

  /**
   * Opens a location's details and frames it, or closes them when given `null`.
   * A location in a hidden precinct brings that precinct back.
   */
  select(location: Location | null): void {
    if (location) {
      this.setPrecinctShown(location.category, true);
    }
    this.selected = location;
    this.parts.panel.show(location);
    this.parts.sidebar.showSelected(location);
    this.parts.precincts.setFocus(location);
    this.parts.outline.show(location);
    this.refresh();
    if (location) {
      this.parts.flight.frame(new Box3().setFromObject(this.objectOf(location)));
    }
  }

  /** Fades a precinct in or out, letting go of anything in it that's hidden. */
  setPrecinctShown(category: Category, shown: boolean): void {
    this.parts.precincts.setShown(category, shown);
    this.parts.sidebar.showPrecinct(category, shown);
    if (!shown && this.hovered?.category === category) {
      this.setHovered(null);
    }
    if (!shown && this.selected?.category === category) {
      this.select(null);
    }
    this.parts.onChange();
  }

  /** Closes any details and flies back to the opening view. */
  resetView(): void {
    this.select(null);
    this.parts.flight.flyHome();
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
    const next = new Map<Location, HighlightLevel>();
    if (this.hovered) {
      next.set(this.hovered, "hover");
    }
    if (this.selected) {
      next.set(this.selected, "selected");
    }
    for (const location of this.lit.keys()) {
      if (!next.has(location)) {
        setHighlight(this.objectOf(location), null);
      }
    }
    for (const [location, level] of next) {
      if (this.lit.get(location) !== level) {
        const look = highlightLook(location.type === "building", level);
        setHighlight(this.objectOf(location), look);
      }
    }
    this.lit = next;
    this.parts.labels.setActive(new Set(next.keys()));
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
