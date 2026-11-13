import type { Plugin } from "vite";
import { defineConfig } from "vite";
import layout from "./src/data/locations.json" with { type: "json" };
import type { PathPoint } from "./src/layout/path.ts";
import { resolvePath, samplePath } from "./src/layout/path.ts";

/** Where the title screen's drawing of the circuit goes in `index.html`. */
const OUTLINE_MARK = "<!-- circuit-outline -->";
/** The drawing's size, in its own units, and the room left round the line. */
const OUTLINE_SIZE = 300;
const OUTLINE_MARGIN = 12;
/** Spacing of the points along the line, in metres. */
const OUTLINE_STEP = 10;

/**
 * The circuit as an SVG drawing, north up. The title screen shows it before
 * any script has loaded, so it's written into the page when the page is built
 * and always matches the layout data.
 */
function circuitOutline(): string {
  const circuit = layout.locations.find((location) => location.id === "circuit");
  if (!circuit || !("path" in circuit)) {
    return "";
  }
  const samples = samplePath(resolvePath(circuit.path as PathPoint[], true), OUTLINE_STEP, true);
  const xs = samples.map((sample) => sample.x);
  const zs = samples.map((sample) => sample.z);
  const left = Math.min(...xs);
  const top = Math.min(...zs);
  const scale =
    (OUTLINE_SIZE - 2 * OUTLINE_MARGIN) / Math.max(Math.max(...xs) - left, Math.max(...zs) - top);
  const width = (Math.max(...xs) - left) * scale + 2 * OUTLINE_MARGIN;
  const height = (Math.max(...zs) - top) * scale + 2 * OUTLINE_MARGIN;
  const line = samples
    .map(
      (sample, index) =>
        `${index === 0 ? "M" : "L"}${((sample.x - left) * scale + OUTLINE_MARGIN).toFixed(1)} ${((sample.z - top) * scale + OUTLINE_MARGIN).toFixed(1)}`,
    )
    .join("");
  return [
    `<svg class="title__circuit" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" aria-hidden="true">`,
    `<path class="title__track" pathLength="1" d="${line}Z"/>`,
    `<path class="title__car" pathLength="1" d="${line}Z"/>`,
    "</svg>",
  ].join("");
}

function titleScreen(): Plugin {
  return {
    name: "title-screen",
    transformIndexHtml: (html) => html.replace(OUTLINE_MARK, circuitOutline()),
  };
}

export default defineConfig({ plugins: [titleScreen()] });
