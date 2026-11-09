import assert from "node:assert/strict";
import { test } from "node:test";
import { pathLength, resolveOutline, resolvePath, samplePath } from "../src/layout/path.ts";

const SQUARE = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} is not close to ${expected}`);
}

test("a rounded corner becomes a straight, an arc and a straight", () => {
  const segments = resolvePath(
    [
      [0, 0],
      [100, 0, 10],
      [100, 100],
    ],
    false,
  );
  assert.deepEqual(
    segments.map((segment) => segment.kind),
    ["straight", "arc", "straight"],
  );
  assertClose(pathLength(segments), 90 + 90 + (Math.PI / 2) * 10);
});

test("a closed path includes the edge back to its first point", () => {
  assertClose(pathLength(resolvePath(SQUARE, true)), 400);
  assertClose(pathLength(resolvePath(SQUARE, false)), 300);
});

test("corners that don't fit on their edge are rejected", () => {
  assert.throws(
    () =>
      resolvePath(
        [
          [0, 0],
          [10, 0, 50],
          [10, 10],
        ],
        false,
      ),
    /overlap/,
  );
});

test("a path needs enough points", () => {
  assert.throws(() => resolvePath([[0, 0]], false));
  assert.throws(
    () =>
      resolvePath(
        [
          [0, 0],
          [1, 1],
        ],
        true,
      ),
    /more points/,
  );
});

test("an open path's samples reach its end, evenly spaced", () => {
  const segments = resolvePath(
    [
      [0, 0],
      [100, 0],
    ],
    false,
  );
  const samples = samplePath(segments, 30, false);
  assert.deepEqual(
    samples.map((sample) => sample.distance),
    [0, 25, 50, 75, 100],
  );
  assert.equal(samples.at(-1).x, 100);
});

test("a closed path's samples don't repeat its first point", () => {
  const samples = samplePath(resolvePath(SQUARE, true), 50, true);
  assert.equal(samples.length, 8);
  assert.notDeepEqual([samples.at(-1).x, samples.at(-1).z], [0, 0]);
});

test("samples around an arc point along the direction of travel", () => {
  const segments = resolvePath(
    [
      [0, 0],
      [100, 0, 10],
      [100, 100],
    ],
    false,
  );
  for (const sample of samplePath(segments, 5, false)) {
    assertClose(Math.hypot(sample.dirX, sample.dirZ), 1);
    assert.ok(sample.dirX >= -1e-6 && sample.dirZ >= -1e-6);
  }
});

test("an outline of sharp corners is left as it is", () => {
  assert.deepEqual(resolveOutline(SQUARE), SQUARE);
});

test("an outline with a rounded corner gains points around it", () => {
  const outline = resolveOutline([[0, 0], [100, 0, 20], ...SQUARE.slice(2)]);
  assert.ok(outline.length > SQUARE.length);
});
