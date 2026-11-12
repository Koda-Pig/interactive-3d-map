import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const palette = {
  "wall-white": "#E8ECEF",
  "wall-grey": "#C9D0D6",
  "roof-dark": "#2B3138",
  glass: "#4F7F9C",
  "canopy-white": "#F5F3EE",
  "brand-navy": "#004272",
  "brand-teal": "#00678C",
  stone: "#B8AFA2",
  timber: "#A9784F",
  metal: "#8C959E",
  "screen-dark": "#15191E",
  concrete: "#A7A9A6",
  "safety-red": "#C8322B",
  "foliage-dark": "#4E6B3A",
  "foliage-dry": "#8A8F4C",
  trunk: "#6B5238",
  "rock-distant": "#8D9AAB",
};
export const budgets = { hero: 15000, building: 4000, modular: 1500, prop: 500, instanced: 200 };
/** A box face is 18 position values, and its faces start +X, -X, +Y. */
const FACE = 18;
const TOP_FACE = FACE * 2;
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export class KitShape {
  constructor() {
    this.parts = [];
  }
  add(g, material, x = 0, y = 0, z = 0, rotation = [0, 0, 0]) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(1, 1, 1),
    );
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute("uv");
    g.applyMatrix4(m);
    g.computeVertexNormals();
    this.parts.push({ g, material });
    return this;
  }
  box(w, h, d, x, y, z, mat = "wall-white", rot = [0, 0, 0]) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rot);
  }
  /** Sides and bottom only: a top would lie exactly on the ground and flicker against it. */
  skirt(w, depth, d) {
    const box = new THREE.BoxGeometry(w, depth, d).toNonIndexed().getAttribute("position").array;
    const positions = Float32Array.from([
      ...box.subarray(0, TOP_FACE),
      ...box.subarray(TOP_FACE + FACE),
    ]);
    const open = new THREE.BufferGeometry();
    open.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return this.add(open, "concrete", 0, -depth / 2, 0);
  }
  cylinder(r, h, x, y, z, mat = "metal", sides = 8, top = r) {
    return this.add(new THREE.CylinderGeometry(top, r, h, sides, 1), mat, x, y, z);
  }
  cone(r, h, x, y, z, mat = "foliage-dark", sides = 7) {
    return this.cylinder(r, h, x, y, z, mat, sides, 0);
  }
  beam(a, b, r, mat = "metal", sides = 4) {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      v = bv.clone().sub(av);
    const g = new THREE.CylinderGeometry(r, r, v.length(), sides);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()),
    );
    return this.add(g, mat, ...av.add(bv).multiplyScalar(0.5).toArray());
  }
  poly(points, depth, mat, z = 0) {
    const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(...p)));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
      steps: 1,
    });
    return this.add(g, mat, 0, 0, z - depth / 2);
  }
  roof(w, d, h, y, mat = "roof-dark", x = 0, z = 0) {
    return this.poly(
      [
        [x - w / 2, y],
        [x, y + h],
        [x + w / 2, y],
        [x + w / 2, y - 0.35],
        [x - w / 2, y - 0.35],
      ],
      d,
      mat,
      z,
    );
  }
  finish(spec) {
    const bounds = new THREE.Box3();
    for (const { g } of this.parts) {
      g.computeBoundingBox();
      bounds.union(g.boundingBox);
    }
    const size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    for (const { g } of this.parts) {
      g.translate(-center.x, -bounds.min.y, -center.z);
      g.scale(spec.w / size.x, spec.h / size.y, spec.d / size.z);
    }
    if (spec.skirt) this.skirt(spec.w, 3, spec.d);
    const groups = new Map();
    for (const { g, material } of this.parts) {
      if (!groups.has(material)) groups.set(material, []);
      groups.get(material).push(g);
    }
    return [...groups].map(([material, gs]) => ({ material, g: mergeGeometries(gs) }));
  }
}
export async function exportAsset(spec, parts) {
  const doc = new Document();
  doc.getRoot().getAsset().generator = "procedural-asset-kit";
  const buffer = doc.createBuffer();
  const scene = doc.createScene("scene");
  const mesh = doc.createMesh(spec.id);
  const bounds = new THREE.Box3();
  let triangles = 0;
  for (const { material, g } of parts) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox);
    const pos = g.getAttribute("position"),
      norm = g.getAttribute("normal"),
      shade = g.getAttribute("color");
    triangles += pos.count / 3;
    const c = new THREE.Color(palette[material]);
    const mat = doc
      .createMaterial(material)
      .setBaseColorFactor([c.r, c.g, c.b, 1])
      .setRoughnessFactor(material === "glass" ? 0.18 : 0.85)
      .setMetallicFactor(material === "metal" ? 0.45 : 0);
    const p = doc
      .createPrimitive()
      .setMaterial(mat)
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(pos.array))
          .setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(norm.array))
          .setBuffer(buffer),
      );
    // Baked ambient occlusion, multiplied into the base colour. A byte per
    // channel is plenty for a shade, and a quarter of the size of a float.
    if (shade)
      p.setAttribute(
        "COLOR_0",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(Uint8Array.from(shade.array, (value) => Math.round(value * 255)))
          .setNormalized(true)
          .setBuffer(buffer),
      );
    mesh.addPrimitive(p);
  }
  scene.addChild(doc.createNode(spec.id).setMesh(mesh));
  const file = `public/models/${spec.category}/${spec.id}.glb`;
  await mkdir(path.dirname(file), { recursive: true });
  const bytes = await new NodeIO().writeBinary(doc);
  await writeFile(file, bytes);
  return {
    id: spec.id,
    file: `/models/${spec.category}/${spec.id}.glb`,
    category: spec.category,
    boundingBox: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: bounds.getSize(new THREE.Vector3()).toArray(),
    },
    triangleCount: triangles,
    fileSize: bytes.length,
    materials: parts.map((p) => p.material),
    tileable: !!spec.tileable,
    instanced: spec.kind === "instanced",
    footprint: [
      [-spec.w / 2, -spec.d / 2],
      [spec.w / 2, -spec.d / 2],
      [spec.w / 2, spec.d / 2],
      [-spec.w / 2, spec.d / 2],
    ],
    spec: {
      width: spec.w,
      depth: spec.d,
      height: spec.h,
      skirtDepth: spec.skirt ? 3 : 0,
      triangleBudget: budgets[spec.kind],
    },
    ...(spec.notes && { notes: spec.notes }),
  };
}
