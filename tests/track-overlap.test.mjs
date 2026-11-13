import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { NotEqualStencilFunc } from "three";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(
      url,
      url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context,
    );
    return url.endsWith(".ts")
      ? {
          ...loaded,
          format: "module",
          source: stripTypeScriptTypes(String(loaded.source), { mode: "transform" }),
        }
      : loaded;
  },
});
const { createRibbon } = await import("../src/draw/ribbons.ts");
hooks.deregister();
const { locations } = JSON.parse(readFileSync("src/data/locations.json", "utf8"));

test("pit merge asphalt and markings cannot overwrite circuit coverage", () => {
  // Dashed ribbons avoid browser-only texture creation; the same production
  // material and overlap policy is used for both solid and dashed ribbons.
  const draw = (id) =>
    createRibbon(
      { ...locations.find((item) => item.id === id), dashed: true },
      { heightAt: () => 0 },
    );
  const circuit = draw("circuit");
  const pit = draw("pit-lane");
  const mainAsphalt = circuit.children[0];
  const pitAsphalt = pit.children[0];
  assert(
    mainAsphalt.material.stencilWrite,
    "circuit must reserve its pixels before the pit lane draws",
  );
  assert(mainAsphalt.renderOrder < pitAsphalt.renderOrder);
  assert.equal(mainAsphalt.material.stencilWriteMask, 128);
  for (const mesh of [pitAsphalt, pit.children.at(-1)]) {
    assert(mesh.material.stencilWrite);
    assert.equal(mesh.material.stencilFunc, NotEqualStencilFunc);
    assert.equal(mesh.material.stencilRef, 128);
    assert.equal(mesh.material.stencilFuncMask, 128);
  }
  assert.equal(pit.children.at(-1).material.stencilWriteMask, 0);
});
