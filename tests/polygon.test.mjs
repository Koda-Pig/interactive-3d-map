import assert from "node:assert/strict";
import { test } from "node:test";
import { boundsOf, centreOf, outsetPolygon, signedDistance } from "../src/layout/polygon.ts";

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

test("outsetting grows a polygon whichever way it's wound", () => {
  for (const polygon of [SQUARE, [...SQUARE].reverse()]) {
    assert.deepEqual(boundsOf(outsetPolygon(polygon, 2)), {
      minX: -2,
      minZ: -2,
      maxX: 12,
      maxZ: 12,
    });
  }
});

test("outsetting keeps a notch's edges the same distance from the original", () => {
  const notched = [
    [0, 0],
    [10, 0],
    [10, 10],
    [6, 10],
    [6, 5],
    [4, 5],
    [4, 10],
    [0, 10],
  ];
  const grown = outsetPolygon(notched, 1);
  assert.deepEqual(grown[4], [5, 6]);
  for (const [x, z] of grown) {
    assert.ok(signedDistance(x, z, notched) >= 0.99);
  }
});

test("outsetting ignores repeated points", () => {
  const grown = outsetPolygon([...SQUARE, SQUARE[0]], 1);
  assert.equal(grown.length, 4);
  assert.ok(grown.flat().every(Number.isFinite));
});
