import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolvePath, samplePath } from "../src/layout/path.ts";
import { signedDistance } from "../src/layout/polygon.ts";

const { arrivals, locations } = JSON.parse(
  readFileSync(new URL("../src/data/locations.json", import.meta.url), "utf8"),
);

/** Leeway either side of a road's edge, for a route that crosses a verge to a gate. */
const ROAD_LEEWAY = 4;
/** A route may pass this close to a gate, or to its own start or end, off the roads. */
const DESTINATION_REACH = 25;

const roads = locations
  .filter((location) => location.type === "road" || location.type === "track")
  .flatMap((location) =>
    [location.path, ...(location.branches ?? [])].map((path, index) => ({
      id: location.id,
      reach: location.width / 2 + (location.median ?? 0) / 2 + ROAD_LEEWAY,
      samples: samplePath(
        resolvePath(path, index === 0 && (location.closed ?? false)),
        2,
        index === 0 && (location.closed ?? false),
      ),
    })),
  );
const areas = locations.filter((location) => location.type === "area" && location.footprint);
const gates = locations.filter((location) => location.type === "gate");

function onRoad(x, z) {
  return roads.some(({ reach, samples }) =>
    samples.some((sample) => Math.hypot(sample.x - x, sample.z - z) <= reach),
  );
}

function inArea(x, z) {
  return areas.some(
    (area) =>
      signedDistance(
        x,
        z,
        area.footprint.map(([px, pz]) => [px, pz]),
      ) <= 0,
  );
}

/** Near a gate, or near the start or end of this route, such as the station or a grandstand. */
function nearDestination(x, z, ends) {
  return [...gates.map(({ position }) => position), ...ends].some(
    ([px, pz]) => Math.hypot(px - x, pz - z) <= DESTINATION_REACH,
  );
}

test("arrival route ids are unique and every route has legs", () => {
  assert.equal(new Set(arrivals.map((route) => route.id)).size, arrivals.length);
  for (const route of arrivals) {
    assert.ok(route.name && route.legs.length > 0, route.id);
    for (const leg of route.legs) {
      assert.ok(leg.mode === "drive" || leg.mode === "walk", route.id);
    }
  }
});

test("arrival routes stay on roads, walks and paved areas", () => {
  for (const route of arrivals) {
    const ends = [route.legs[0].path[0], route.legs.at(-1).path.at(-1)];
    for (const leg of route.legs) {
      const samples = samplePath(resolvePath(leg.path, false), 5, false);
      for (const { x, z } of samples) {
        assert.ok(
          onRoad(x, z) || inArea(x, z) || nearDestination(x, z, ends),
          `${route.id} leaves the roads at [${Math.round(x)}, ${Math.round(z)}]`,
        );
      }
    }
  }
});

test("every arrival route ends at a gate", () => {
  for (const route of arrivals) {
    const last = route.legs.at(-1).path.at(-1);
    const nearest = Math.min(
      ...gates.map(({ position }) => Math.hypot(position[0] - last[0], position[1] - last[1])),
    );
    // The Cape Town route carries on through the gate to the grandstands.
    const reach = route.id === "from-cape-town" ? 400 : DESTINATION_REACH;
    assert.ok(nearest <= reach, `${route.id} ends ${Math.round(nearest)} m from a gate`);
  }
});

test("each route's legs join up, so the line has no gaps", () => {
  for (const route of arrivals) {
    for (let index = 1; index < route.legs.length; index += 1) {
      const [x, z] = route.legs[index - 1].path.at(-1);
      const [nextX, nextZ] = route.legs[index].path[0];
      assert.ok(Math.hypot(nextX - x, nextZ - z) < 1, `${route.id} leg ${index} starts apart`);
    }
  }
});
