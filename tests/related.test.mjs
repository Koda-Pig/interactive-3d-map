import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// Vite accepts the layout JSON import without an attribute; Node requires one.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(
      url,
      url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context,
    );
  },
});
const { layout } = await import("../src/layout/locations.ts");
const { relatedPlaces } = await import("../src/layout/related.ts");
hooks.deregister();

test("every building and area offers a gate and a car park other than itself", () => {
  for (const location of layout.locations) {
    if (location.type === "track" || location.type === "road") {
      assert.deepEqual(relatedPlaces(location), [], location.id);
      continue;
    }
    const places = relatedPlaces(location);
    assert.equal(places.length, 2, location.id);
    assert.ok(
      places.every((place) => place.location !== location),
      location.id,
    );
    assert.equal(places[0].location.type, "gate", location.id);
    assert.ok(places[1].location.id.startsWith("car-park-"), location.id);
  }
});
