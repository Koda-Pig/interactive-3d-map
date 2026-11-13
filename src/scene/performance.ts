import type { WebGLRenderer } from "three";
import type { Quality } from "./quality.ts";

const SAMPLE_FRAMES = 30;
/** Below this frame rate the picture is made coarser, in frames per second. */
const MIN_ACCEPTABLE_FPS = 28;
const MIN_PIXEL_RATIO = 1;
const PIXEL_RATIO_STEP = 0.25;
/** A longer gap than this means the tab was in the background, in milliseconds. */
const MAX_FRAME_GAP = 500;

/**
 * Watches the frame rate while the view is moving. If it's too low, it lowers
 * the pixel ratio, and with `?stats` in the address it shows the numbers.
 */
export class FrameMonitor {
  private lastFrame: number | null = null;
  private elapsed = 0;
  private frames = 0;
  private readonly stats: HTMLElement | null;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly quality: Quality,
    private readonly applyPixelRatio: (ratio: number) => void,
    /** What the scene took to draw, when passes over it would hide the renderer's own count. */
    private readonly drawn: () => { calls: number; triangles: number } = () => renderer.info.render,
  ) {
    this.stats = new URLSearchParams(window.location.search).has("stats")
      ? document.body.appendChild(document.createElement("output"))
      : null;
    if (this.stats) {
      this.stats.className = "stats";
      this.show(null);
    }
  }

  /** Call every animation frame. `drawn` says whether this one drew anything. */
  tick(now: number, drawn: boolean): void {
    if (!drawn) {
      // The map only draws when something changes, so pauses aren't slow frames.
      this.lastFrame = null;
      return;
    }
    if (this.lastFrame !== null && now - this.lastFrame < MAX_FRAME_GAP) {
      this.elapsed += now - this.lastFrame;
      this.frames += 1;
    }
    this.lastFrame = now;

    if (this.frames === SAMPLE_FRAMES) {
      const fps = (1000 * this.frames) / this.elapsed;
      this.elapsed = 0;
      this.frames = 0;
      const ratio = this.renderer.getPixelRatio();
      if (fps < MIN_ACCEPTABLE_FPS && ratio > MIN_PIXEL_RATIO) {
        this.applyPixelRatio(Math.max(MIN_PIXEL_RATIO, ratio - PIXEL_RATIO_STEP));
      }
      this.show(fps);
    }
  }

  private show(fps: number | null): void {
    if (!this.stats) {
      return;
    }
    if (fps === null) {
      this.stats.textContent = "Move the map to measure";
      return;
    }
    const { calls, triangles } = this.drawn();
    this.stats.textContent = [
      `${fps.toFixed(0)} fps`,
      `${calls} draws`,
      `${(triangles / 1000).toFixed(0)}k tris`,
      `${this.quality.tier} @${this.renderer.getPixelRatio().toFixed(2)}x`,
    ].join(" · ");
  }
}
