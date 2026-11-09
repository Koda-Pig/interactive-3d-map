import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolvePath, samplePath } from "../src/layout/path.ts";
import { roadTier } from "../src/layout/road-order.ts";

const { locations } = JSON.parse(readFileSync("src/data/locations.json", "utf8"));
const CELL = 2;

/** The map cells a road's surface covers at ground level. */
function cellsOf(road) {
  const cells = new Set();
  const paths = [road.path, ...(road.branches ?? [])];
  const gap = (road.median ?? 0) / 2;
  paths.forEach((path, index) => {
    const bridge = index === 0 ? road.bridge : undefined;
    const closed = index === 0 && (road.closed ?? false);
    for (const sample of samplePath(resolvePath(path, closed), CELL, closed)) {
      if (bridge && sample.distance > bridge.start && sample.distance < bridge.end) {
        continue;
      }
      for (let offset = -road.width / 2; offset <= road.width / 2; offset += 1) {
        if (Math.abs(offset) >= gap) {
          const x = sample.x - sample.dirZ * offset;
          const z = sample.z + sample.dirX * offset;
          cells.add(`${Math.round(x / CELL)},${Math.round(z / CELL)}`);
        }
      }
    }
  });
  return cells;
}

test("wider roads sit in higher tiers", () => {
  assert.equal(roadTier(4), 0);
  assert.equal(roadTier(11), 3);
  assert.equal(roadTier(28), 4);
});

test("roads of different colours never overlap in the same tier", () => {
  const roads = locations
    .filter((location) => location.type === "road")
    .map((road) => ({ road, cells: cellsOf(road) }));
  roads.forEach(({ road, cells }, index) => {
    for (const other of roads.slice(index + 1)) {
      if (road.color === other.road.color || roadTier(road.width) !== roadTier(other.road.width)) {
        continue;
      }
      const shared = [...cells].filter((cell) => other.cells.has(cell)).length;
      assert.equal(shared, 0, `${road.id} and ${other.road.id} would flicker where they overlap`);
    }
  });
});
