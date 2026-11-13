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
const { locationActions } = await import("../src/layout/links.ts");
hooks.deregister();

const actions = {
  tickets: { label: "Buy race tickets", audience: "visitors", url: "#t", event: "race" },
  register: { label: "Register", audience: "visitors", url: "#r", event: "conference" },
  vendor: { label: "Apply to be a vendor", audience: "business", url: "#v" },
};
const location = { id: "x", links: ["vendor", "tickets", "register"] };
const labels = (groups) =>
  groups.map((group) => [group.audience, group.actions.map((a) => a.label)]);

test("the whole site shows every action, fans first", () => {
  assert.deepEqual(labels(locationActions(location, null, actions)), [
    ["visitors", ["Buy race tickets", "Register"]],
    ["business", ["Apply to be a vendor"]],
  ]);
});

test("an event mode leaves out actions tied to another mode", () => {
  assert.deepEqual(labels(locationActions(location, "conference", actions)), [
    ["visitors", ["Register"]],
    ["business", ["Apply to be a vendor"]],
  ]);
});

test("a location without links, or with only another mode's, has no groups", () => {
  assert.deepEqual(locationActions({ id: "y" }, null, actions), []);
  assert.deepEqual(locationActions({ id: "z", links: ["tickets"] }, "conference", actions), []);
});
