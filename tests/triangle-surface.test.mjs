import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { TriangleSurface } from "../src/draw/triangle-surface.ts";

test("indexed surface agrees with raycasts across a road crease and cell boundaries", () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-30, 0, -30, -30, 0, 30, 30, 0, -30, 30, 3, 30], 3),
  );
  geometry.setIndex([0, 1, 2, 1, 3, 2]);
  const surface = new TriangleSurface(geometry);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (let x = -30; x <= 30; x += 2.5)
    for (let z = -30; z <= 30; z += 2.5) {
      ray.ray.origin.set(x, 100, z);
      const hit = ray.intersectObject(mesh)[0];
      assert(hit);
      assert(Math.abs(surface.heightAt(x, z) - hit.point.y) < 1e-6);
    }
  assert.throws(() => surface.heightAt(31, 0), /No road surface/);
  geometry.dispose();
  mesh.material.dispose();
});
