import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { Box3, BoxGeometry, MeshStandardMaterial } from "three";

// Vite accepts the layout JSON import without an attribute; Node requires one.
const hooks = registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(
      url,
      url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context,
    );
  },
});
const { createBuilding } = await import("../src/draw/buildings.ts");
const { heightAt } = await import("../src/terrain/height.ts");
hooks.deregister();

const kiosk = {
  id: "raised-kiosk",
  name: "Raised kiosk",
  type: "building",
  category: "hospitality",
  color: "#E8ECEF",
  description: "Raised model placement check",
  parts: [
    {
      footprint: [
        [-3, -2],
        [3, -2],
        [3, 2],
        [-3, 2],
      ],
      height: 3.8,
      base: 0.9,
      model: { file: "hospitality/jetty-kiosk.glb", facing: "south" },
    },
  ],
};

test("a raised kit model keeps its height and stands at the part base", () => {
  const model = {
    width: 6,
    depth: 4,
    height: 3.8,
    pieces: [
      {
        geometry: new BoxGeometry(6, 3.8, 4).translate(0, 1.9, 0),
        material: new MeshStandardMaterial(),
      },
    ],
  };
  const kit = new Map([["hospitality/jetty-kiosk.glb", model]]);
  const bounds = new Box3().setFromObject(createBuilding(kiosk, kit));
  assert.ok(Math.abs(bounds.min.y - heightAt(0, 0) - 0.9) < 0.00001);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 3.8) < 0.00001);
});

test("a missing raised model draws its plain shape at the same base", () => {
  const object = createBuilding(kiosk, new Map());
  const bounds = new Box3().setFromObject(object);
  assert.ok(object.children.length > 0);
  assert.ok(Math.abs(bounds.min.y - heightAt(0, 0) - 0.9) < 0.00001);
  assert.ok(Math.abs(bounds.max.y - bounds.min.y - 3.8) < 0.00001);
});
