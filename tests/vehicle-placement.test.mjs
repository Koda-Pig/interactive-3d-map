import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Euler, Vector3 } from "three";
import { vehicleSlope } from "../src/draw/vehicle-pose.ts";
import { GRID_LENGTH, GRID_WIDTH, raceGrid } from "../src/layout/race-grid.ts";

const { locations } = JSON.parse(readFileSync("src/data/locations.json", "utf8"));
test("all twenty cars fit inside separate painted starting slots", () => {
  const circuit = locations.find((location) => location.id === "circuit");
  const slots = raceGrid(circuit);
  assert.equal(slots.length, 20);
  assert(GRID_LENGTH > 5.6);
  assert(GRID_WIDTH > 2);
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index];
    assert(Math.abs(slot.x - circuit.startFinish[0]) < circuit.width / 2);
    for (const other of slots.slice(index + 1)) {
      assert(Math.hypot(slot.x - other.x, slot.z - other.z) > GRID_LENGTH);
    }
  }
});

for (const yaw of [0, Math.PI / 2, Math.PI, -0.7]) {
  test(`tyre contact plane follows uphill and crossfall at heading ${yaw}`, () => {
    const height = (x, z) => 0.03 * x + 0.05 * z;
    const slope = vehicleSlope(height, 0, 0, yaw);
    const rotation = new Euler(slope.pitch, yaw, slope.tilt, "YXZ");
    for (const x of [-0.81, 0.81]) {
      for (const z of [-1.7, 1.7]) {
        const point = new Vector3(x, 0, z).applyEuler(rotation);
        assert(Math.abs(point.y - height(point.x, point.z)) < 0.001);
      }
    }
  });
}
