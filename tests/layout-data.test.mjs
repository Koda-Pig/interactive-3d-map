import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { resolvePath } from "../src/layout/path.ts";

const { events, grading, landUse, locations } = JSON.parse(
  readFileSync(new URL("../src/data/locations.json", import.meta.url), "utf8"),
);
const ids = new Set(locations.map((location) => location.id));
const categories = new Set(locations.map((location) => location.category));

test("location ids are unique", () => {
  assert.equal(ids.size, locations.length);
});

test("every location has an image file that exists in public", () => {
  for (const location of locations) {
    assert.ok(location.image, location.id);
    assert.ok(existsSync(new URL(`../public/${location.image}`, import.meta.url)), location.id);
  }
});

test("every location has the fields its type needs", () => {
  for (const location of locations) {
    assert.ok(location.name && location.category && location.description, location.id);
    switch (location.type) {
      case "building":
        assert.ok(location.parts || (location.footprint && location.height), location.id);
        break;
      case "area":
      case "water":
        assert.ok(location.footprint, location.id);
        break;
      case "track":
      case "road":
        assert.ok(location.path && location.width, location.id);
        break;
      case "gate":
        assert.equal(location.position?.length, 2, location.id);
        break;
      default:
        assert.fail(`${location.id} has an unknown type "${location.type}"`);
    }
  }
});

test("every path can be drawn", () => {
  for (const location of locations) {
    if (location.path) {
      resolvePath(location.path, location.closed ?? false);
      for (const branch of location.branches ?? []) {
        resolvePath(branch, false);
      }
    }
  }
});

test("events only name locations and precincts that exist", () => {
  for (const event of events) {
    assert.deepEqual(
      event.locations.filter((id) => !ids.has(id)),
      [],
      event.id,
    );
    assert.deepEqual(
      event.categories.filter((category) => !categories.has(category)),
      [],
      event.id,
    );
  }
});

test("grading zones have outlines and unique ids", () => {
  assert.equal(new Set(grading.map((zone) => zone.id)).size, grading.length);
  for (const zone of grading) {
    assert.ok(zone.footprint.length >= 3, zone.id);
  }
});

test("land-use zones have known uses, outlines inside the site and unique ids", () => {
  const uses = ["wheat", "vineyard", "overflow-parking", "camping", "fan-village"];
  // Half the side of the site's square, as in `src/site.ts`.
  const siteEdge = 1225;
  assert.equal(new Set(landUse.map((zone) => zone.id)).size, landUse.length);
  for (const zone of landUse) {
    assert.ok(uses.includes(zone.use), zone.id);
    assert.ok(zone.footprint.length >= 3, zone.id);
    for (const [x, z] of zone.footprint) {
      assert.ok(Math.max(Math.abs(x), Math.abs(z)) <= siteEdge, zone.id);
    }
  }
});
