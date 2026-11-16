import { layout } from "../layout/locations.ts";
import { resolvePath, samplePath } from "../layout/path.ts";

const OUTLINE_SIZE = 300;
const OUTLINE_MARGIN = 12;
const OUTLINE_STEP = 10;
export function circuitOutline(): string {
  const circuit = layout.locations.find((location) => location.id === "circuit");
  if (!circuit || (circuit.type !== "track" && circuit.type !== "road")) {
    return "";
  }
  const samples = samplePath(resolvePath(circuit.path, true), OUTLINE_STEP, true);
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
