// Measures the circuit in src/data/locations.json against BMR's published
// targets, using the same path code the map draws it with. Exits non-zero if a
// target is missed. Run with `pnpm check:layout`.

import { readFileSync } from "node:fs";
import { pathLength, resolvePath } from "../src/layout/path.ts";

const MIN_LENGTH = 4700;
const MAX_LENGTH = 4900;
const MIN_WIDTH = 12;
const MIN_START_FINISH_STRAIGHT = 600;
const MIN_SEPARATE_STRAIGHT = 1000;

// A heavy braking zone: a straight this long into a corner this tight.
const BRAKING_MIN_STRAIGHT = 200;
const BRAKING_MAX_RADIUS = 50;

const layoutUrl = new URL("../src/data/locations.json", import.meta.url);
const { locations } = JSON.parse(readFileSync(layoutUrl, "utf8"));

const circuit = locations.find((location) => location.id === "circuit");
if (!circuit) {
  console.error('No location with the id "circuit" in locations.json');
  process.exit(1);
}

function distanceToSegment(px, pz, segment) {
  const dx = segment.endX - segment.startX;
  const dz = segment.endZ - segment.startZ;
  const t = ((px - segment.startX) * dx + (pz - segment.startZ) * dz) / (dx * dx + dz * dz);
  const clamped = Math.min(1, Math.max(0, t));
  return Math.hypot(px - segment.startX - dx * clamped, pz - segment.startZ - dz * clamped);
}

const segments = resolvePath(circuit.path, circuit.closed);
const straights = segments.filter((segment) => segment.kind === "straight");
const [lineX, lineZ] = circuit.startFinish;
const startFinish = straights.reduce((best, segment) =>
  distanceToSegment(lineX, lineZ, segment) < distanceToSegment(lineX, lineZ, best) ? segment : best,
);
const separate = straights
  .filter((segment) => segment !== startFinish)
  .reduce((best, segment) => (segment.length > best.length ? segment : best));

const length = pathLength(segments);
const results = [
  [
    `Length ${MIN_LENGTH}-${MAX_LENGTH} m`,
    `${length.toFixed(0)} m`,
    length >= MIN_LENGTH && length <= MAX_LENGTH,
  ],
  [`Width at least ${MIN_WIDTH} m`, `${circuit.width} m`, circuit.width >= MIN_WIDTH],
  [
    `Start-finish straight at least ${MIN_START_FINISH_STRAIGHT} m`,
    `${startFinish.length.toFixed(0)} m`,
    startFinish.length >= MIN_START_FINISH_STRAIGHT,
  ],
  [
    `Separate straight at least ${MIN_SEPARATE_STRAIGHT} m`,
    `${separate.length.toFixed(0)} m`,
    separate.length >= MIN_SEPARATE_STRAIGHT,
  ],
];

let failed = false;
for (const [target, measured, passed] of results) {
  failed ||= !passed;
  console.log(`${passed ? "pass" : "FAIL"}  ${target}: ${measured}`);
}

const brakingZones = segments.filter((segment, index) => {
  const before = segments[(index + segments.length - 1) % segments.length];
  return (
    segment.kind === "arc" &&
    segment.radius <= BRAKING_MAX_RADIUS &&
    before.kind === "straight" &&
    before.length >= BRAKING_MIN_STRAIGHT
  );
});
console.log(
  `note  Heavy braking zones (${BRAKING_MIN_STRAIGHT} m+ straight into a corner of ${BRAKING_MAX_RADIUS} m radius or less): ${brakingZones.length}`,
);

// Every model the layout asks for has to exist, or the map falls back to plain shapes.
const manifestUrl = new URL("../public/models/manifest.json", import.meta.url);
const known = new Set(
  JSON.parse(readFileSync(manifestUrl, "utf8")).assets.map((asset) => asset.file),
);
const modelFiles = locations.flatMap((location) =>
  [location.model, ...(location.parts ?? []).map((part) => part.model)].flatMap((model) =>
    model ? [model.file, ...(model.endCap ? [model.endCap] : [])] : [],
  ),
);
const unknown = [...new Set(modelFiles)].filter((file) => !known.has(`/models/${file}`));
failed ||= unknown.length > 0;
console.log(
  `${unknown.length === 0 ? "pass" : "FAIL"}  Layout models exist: ${unknown.length === 0 ? `${new Set(modelFiles).size} files` : unknown.join(", ")}`,
);

process.exit(failed ? 1 : 0);
