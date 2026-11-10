/** A rectangle in pixels, measured from the top left of the map. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The largest part of the map with nothing on top of it, and the map's full size. */
export interface ClearArea extends Box {
  readonly viewWidth: number;
  readonly viewHeight: number;
}

/** Where something sits on the page, or `null` when it isn't showing. */
export type OverlaySource = () => Box | null;

function area({ left, top, right, bottom }: Box): number {
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function overlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The biggest piece of `clear` left beside, above or below `box`. */
function without(clear: Box, box: Box): Box {
  if (!overlap(clear, box)) {
    return clear;
  }
  const pieces: Box[] = [
    { ...clear, right: box.left },
    { ...clear, left: box.right },
    { ...clear, bottom: box.top },
    { ...clear, top: box.bottom },
  ];
  return pieces.reduce((best, piece) => (area(piece) > area(best) ? piece : best));
}

/**
 * The panels and buttons that sit on top of the map. Measuring them makes the
 * browser lay the page out, so the result is kept until `invalidate()`.
 */
export class MapOverlays {
  private cached: Box[] | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly sources: readonly OverlaySource[],
  ) {}

  /** Call when an overlay appears, goes or changes size, or the window does. */
  invalidate(): void {
    this.cached = null;
  }

  /** Every overlay that covers part of the map. */
  boxes(): readonly Box[] {
    if (!this.cached) {
      const map = this.host.getBoundingClientRect();
      const view: Box = { left: 0, top: 0, right: map.width, bottom: map.height };
      this.cached = this.sources
        .map((source) => source())
        .filter((box): box is Box => box !== null && area(box) > 0)
        .map((box) => ({
          left: box.left - map.left,
          top: box.top - map.top,
          right: box.right - map.left,
          bottom: box.bottom - map.top,
        }))
        .filter((box) => overlap(box, view));
    }
    return this.cached;
  }

  clearArea(): ClearArea {
    const viewWidth = this.host.clientWidth;
    const viewHeight = this.host.clientHeight;
    const whole: Box = { left: 0, top: 0, right: viewWidth, bottom: viewHeight };
    const clear = this.boxes().reduce(without, whole);
    // Overlays that leave nothing usable are ignored, so there's always somewhere to aim.
    return { ...(area(clear) > 0 ? clear : whole), viewWidth, viewHeight };
  }
}
