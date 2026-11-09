import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCrossing } from "../src/draw/crossings.ts";
import { resolveOutline, resolvePath, samplePath } from "../src/layout/path.ts";
import { centreOf, signedDistance } from "../src/layout/polygon.ts";
import { createTrackSafety } from "../src/layout/track-safety.ts";

const { locations } = JSON.parse(
  readFileSync(new URL("../src/data/locations.json", import.meta.url)),
);
const circuit = locations.find((location) => location.id === "circuit");
const samples = samplePath(resolvePath(circuit.path, true), 3, true);
const safety = createTrackSafety(circuit);

test("selected corner runoff expands outside while inner verges stay narrow", () => {
  for (const zone of circuit.safetyZones) {
    const sample = samples.reduce((best, point) =>
      Math.hypot(point.x - zone.at[0], point.z - zone.at[1]) <
      Math.hypot(best.x - zone.at[0], best.z - zone.at[1])
        ? point
        : best,
    );
    const outside = safety(sample, zone.side);
    assert.ok(outside.width > zone.width - 1);
    assert.equal(outside.barrier, circuit.width / 2 + outside.width + 2);
    assert.equal(safety(sample, -zone.side).width, circuit.runoff);
  }
});

test("local protection remains continuous at the lap seam", () => {
  const first = samples[0];
  const wrapped = {
    ...first,
    distance: resolvePath(circuit.path, true).reduce((sum, segment) => sum + segment.length, 0),
  };
  assert.deepEqual(safety(first, -1), safety(wrapped, -1));
});

test("occupied buildings and spectator banks remain behind the circuit protection", () => {
  for (const location of locations.filter((location) => location.type === "building")) {
    for (const part of location.parts ?? [location]) {
      const polygon = resolveOutline(part.footprint);
      const [cx, cz] = centreOf(polygon);
      for (const sample of samples) {
        const side = (cx - sample.x) * -sample.dirZ + (cz - sample.z) * sample.dirX > 0 ? 1 : -1;
        assert.ok(
          signedDistance(sample.x, sample.z, polygon) > safety(sample, side).barrier,
          `${location.id} encroaches on protection at ${sample.x}, ${sample.z}`,
        );
      }
    }
  }
});

test("crossing decks clear racing surfaces and ramps meet the ground", () => {
  // A sloping surface catches profiles that add height without levelling the deck.
  const surface = { heightAt: (x, z) => x * 0.003 + z * 0.008 };
  for (const road of locations.filter((location) => location.bridge)) {
    const crossing = createCrossing(road, surface);
    const roadSamples = samplePath(resolvePath(road.path, false), 2, false);
    assert.ok(crossing.structure.children.length <= 3, "bridge structure is batched by material");
    let crossings = 0;
    for (const sample of roadSamples) {
      if (sample.distance <= road.bridge.start || sample.distance >= road.bridge.end) {
        assert.equal(
          crossing.heightAt(sample.x, sample.z, sample.distance),
          surface.heightAt(sample.x, sample.z),
        );
      }
      for (const track of locations.filter(
        (location) => location.type === "track" && location.id !== "karting-track",
      )) {
        const trackSamples = samplePath(
          resolvePath(track.path, track.closed ?? false),
          3,
          track.closed ?? false,
        );
        const onTrack = trackSamples.some(
          (point) => Math.hypot(point.x - sample.x, point.z - sample.z) < track.width / 2 + 2,
        );
        if (onTrack) {
          crossings += 1;
          assert.ok(
            crossing.heightAt(sample.x, sample.z, sample.distance) -
              surface.heightAt(sample.x, sample.z) >
              7,
            `${road.id} has insufficient visible clearance`,
          );
        }
      }
    }
    assert.ok(crossings > 0, `${road.id} must cross a racing surface`);
  }
});

test("bridge spans avoid grandstands and other occupied footprints", () => {
  for (const road of locations.filter((location) => location.bridge)) {
    for (const sample of samplePath(resolvePath(road.path, false), 3, false)) {
      for (const building of locations.filter((location) => location.type === "building")) {
        for (const part of building.parts ?? [building]) {
          assert.ok(
            signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > road.width / 2 + 1,
            `${road.id} intersects ${building.id}`,
          );
        }
      }
    }
  }
});

test("paddock aisles leave team structures and covered loading bays clear", () => {
  const road = locations.find((location) => location.id === "paddock-service-aisles");
  const support = locations.find((location) => location.id === "team-support-rows");
  for (const path of [road.path, ...road.branches]) {
    for (const sample of samplePath(resolvePath(path, false), 2, false)) {
      for (const part of support.parts) {
        assert.ok(
          signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > road.width / 2,
          "paddock circulation intersects a team structure",
        );
      }
    }
  }
});

test("new working compounds stay behind the circuit protective boundary", () => {
  for (const id of ["academy-handling-ground", "automotive-demonstration-court"]) {
    const location = locations.find((location) => location.id === id);
    const polygon = resolveOutline(location.footprint);
    const [cx, cz] = centreOf(polygon);
    for (const sample of samples) {
      const side = (cx - sample.x) * -sample.dirZ + (cz - sample.z) * sample.dirX > 0 ? 1 : -1;
      assert.ok(
        signedDistance(sample.x, sample.z, polygon) > safety(sample, side).barrier,
        `${id} encroaches on circuit protection`,
      );
    }
  }
});
