/**
 * Hands the main thread back to the browser partway through building the map,
 * so the loading screen keeps animating while the heavy work runs. Long
 * stretches of synchronous work freeze every main-thread animation, the
 * title screen's circuit included.
 */

/**
 * Pauses the current async task until the browser has drawn the next frame.
 * A timer alone doesn't do it: a zero timer fires long before the next vsync,
 * so a loop that yields to one keeps the main thread saturated and animations
 * still crawl. Waiting for the frame itself is what lets one be drawn.
 */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (): void => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    requestAnimationFrame(settle);
    // The timer only covers documents that never draw, such as a hidden tab.
    setTimeout(settle, 64);
  });
}

/**
 * How long one uninterrupted slice of building may run before the next yield,
 * in milliseconds. Short enough that the loading screen keeps moving; long
 * enough that the waits between slices don't stretch the load out.
 */
const SLICE_MS = 16;

/** True when a slice of work that started at `startedAt` has run long enough. */
export function sliceOver(startedAt: number): boolean {
  return performance.now() - startedAt >= SLICE_MS;
}

/** Marks the start of a slice of work for `sliceOver`. */
export function sliceStart(): number {
  return performance.now();
}
