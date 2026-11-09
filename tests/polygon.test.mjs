import assert from "node:assert/strict";
import { test } from "node:test";
import { boundsOf, centreOf, signedDistance } from "../src/layout/polygon.ts";

const SQUARE = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

test("bounds and centre come from the extreme points", () => {
  assert.deepEqual(boundsOf(SQUARE), { minX: 0, minZ: 0, maxX: 10, maxZ: 10 });
  assert.deepEqual(centreOf(SQUARE), [5, 5]);
});

test("signed distance is negative inside a polygon", () => {
  assert.equal(signedDistance(5, 5, SQUARE), -5);
  assert.equal(signedDistance(1, 5, SQUARE), -1);
});

test("signed distance is positive outside a polygon", () => {
  assert.equal(signedDistance(15, 5, SQUARE), 5);
  assert.equal(signedDistance(13, 14, SQUARE), 5);
});
