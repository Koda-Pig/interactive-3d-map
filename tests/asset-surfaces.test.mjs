import assert from "node:assert/strict";
import { test } from "node:test";
import { BufferAttribute, BufferGeometry } from "three";
import { catalog } from "../tools/assets/catalog.mjs";
import { design } from "../tools/assets/designs.mjs";
import { resolveCoplanarSurfaces } from "../tools/assets/surfaces.mjs";

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function clip(polygon, a, b) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length];
    const dp = cross(a, b, p),
      dq = cross(a, b, q);
    if (dp >= 0) result.push(p);
    if (dp < 0 !== dq < 0) {
      const t = dp / (dp - dq);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return result;
}
function overlap(a, b) {
  let polygon = a;
  for (let i = 0; i < 3 && polygon.length; i++) polygon = clip(polygon, b[i], b[(i + 1) % 3]);
  return (
    Math.abs(
      polygon.reduce((sum, p, i) => {
        const q = polygon[(i + 1) % polygon.length];
        return sum + p[0] * q[1] - p[1] * q[0];
      }, 0),
    ) / 2
  );
}

function triangle(material, points) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(Float32Array.from(points.flat()), 3));
  g.computeVertexNormals();
  return { material, g };
}
function surfaceArea(parts) {
  return parts.reduce((sum, { g }) => {
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      sum += Math.abs(cross(...[0, 1, 2].map((j) => [p.getX(i + j), p.getY(i + j)]))) / 2;
    }
    return sum;
  }, 0);
}

test("coplanar trim owns its overlap without deleting the rest of a wall", () => {
  const parts = resolveCoplanarSurfaces([
    triangle("wall", [
      [0, 0, 0],
      [4, 0, 0],
      [0, 4, 0],
    ]),
    triangle("trim", [
      [0, 0, 0],
      [2, 0, 0],
      [0, 2, 0],
    ]),
  ]);
  assert.equal(surfaceArea(parts.filter((p) => p.material === "wall")), 6);
  assert.equal(surfaceArea(parts.filter((p) => p.material === "trim")), 2);
  assert.equal(surfaceArea(parts), 8);
});

test("separate planes and opposite faces retain their geometry", () => {
  const parts = resolveCoplanarSurfaces([
    triangle("front", [
      [0, 0, 0],
      [4, 0, 0],
      [0, 4, 0],
    ]),
    triangle("back", [
      [0, 0, 0],
      [0, 4, 0],
      [4, 0, 0],
    ]),
    triangle("raised", [
      [0, 0, 1],
      [4, 0, 1],
      [0, 4, 1],
    ]),
  ]);
  assert.equal(parts.length, 3);
  assert.equal(surfaceArea(parts), 24);
});

for (const spec of catalog) {
  test(`${spec.id} has no competing coplanar material faces`, () => {
    const planes = new Map();
    const parts = design(spec);
    for (const { material, g } of parts) {
      const p = g.getAttribute("position"),
        n = g.getAttribute("normal");
      for (let i = 0; i < p.count; i += 3) {
        const normal = [n.getX(i), n.getY(i), n.getZ(i)];
        const distance = normal[0] * p.getX(i) + normal[1] * p.getY(i) + normal[2] * p.getZ(i);
        const key = [...normal, distance].map((v) => Math.round(v * 10000)).join("/");
        const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
        const axes = [0, 1, 2].filter((axis) => axis !== drop);
        const vertices = [0, 1, 2].map((j) => axes.map((axis) => p.getComponent(i + j, axis)));
        if (cross(...vertices) < 0) vertices.reverse();
        const faces = planes.get(key) ?? [];
        for (const face of faces) {
          if (face.material !== material) {
            assert.ok(
              overlap(vertices, face.vertices) < 0.0001,
              `${spec.id}: ${material} overlaps ${face.material}`,
            );
          }
        }
        faces.push({ material, vertices });
        planes.set(key, faces);
      }
    }
    for (const { g } of parts) g.dispose();
  });
}
