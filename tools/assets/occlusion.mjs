// Ambient occlusion baked into each model as vertex colours. Corners, the
// undersides of canopies and the foot of every wall darken a little, so the
// models look grounded without any cost when the map draws them.
//
// The model is turned into a grid of filled cells, and rays from each vertex
// are marched through the grid. The ground at y = 0 counts as filled, so walls
// darken towards their base. The rays and the grid are fixed, so the result is
// the same every run.
import * as THREE from "three";

/** How many rays each vertex casts into the half of the sky it faces. */
const RAYS = 32;
/** How dark a vertex that every ray finds blocked becomes, as a share of its colour. */
const STRENGTH = 0.6;
/** The most cells along the model's longest side, which bounds the work for large models. */
const MAX_CELLS = 160;
const MIN_CELL = 0.2;
/** Rays reach this far, in metres, or less for small models. */
const MAX_REACH = 7;

/** Directions spread evenly over a hemisphere around +Z, weighted towards its middle. */
const HEMISPHERE = (() => {
  const directions = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < RAYS; index += 1) {
    const radius = Math.sqrt((index + 0.5) / RAYS);
    const angle = index * golden;
    directions.push(
      new THREE.Vector3(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
        Math.sqrt(1 - radius * radius),
      ),
    );
  }
  return directions;
})();

class Grid {
  constructor(bounds, cell) {
    this.cell = cell;
    this.min = bounds.min.clone();
    const size = bounds.getSize(new THREE.Vector3());
    this.nx = Math.max(1, Math.ceil(size.x / cell));
    this.ny = Math.max(1, Math.ceil(size.y / cell));
    this.nz = Math.max(1, Math.ceil(size.z / cell));
    this.cells = new Uint8Array(this.nx * this.ny * this.nz);
  }

  index(x, y, z) {
    const i = Math.floor((x - this.min.x) / this.cell);
    const j = Math.floor((y - this.min.y) / this.cell);
    const k = Math.floor((z - this.min.z) / this.cell);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) {
      return -1;
    }
    return (k * this.ny + j) * this.nx + i;
  }

  /** Fills every cell the triangle passes through, by sampling it finely. */
  fillTriangle(a, b, c) {
    const longest = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
    const steps = Math.max(1, Math.ceil((longest / this.cell) * 2));
    const point = new THREE.Vector3();
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps - i; j += 1) {
        const u = i / steps;
        const v = j / steps;
        point
          .copy(a)
          .multiplyScalar(1 - u - v)
          .addScaledVector(b, u)
          .addScaledVector(c, v);
        const index = this.index(point.x, point.y, point.z);
        if (index >= 0) {
          this.cells[index] = 1;
        }
      }
    }
  }

  filled(x, y, z) {
    const index = this.index(x, y, z);
    return index >= 0 && this.cells[index] === 1;
  }
}

function forEachTriangle(geometry, offsetX, visit) {
  const position = geometry.getAttribute("position");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let vertex = 0; vertex + 2 < position.count; vertex += 3) {
    a.fromBufferAttribute(position, vertex).x += offsetX;
    b.fromBufferAttribute(position, vertex + 1).x += offsetX;
    c.fromBufferAttribute(position, vertex + 2).x += offsetX;
    visit(a, b, c);
  }
}

/**
 * Adds a `color` attribute to every part, from white where nothing is near to
 * darker where the vertex is enclosed. A tileable model is baked with a copy
 * on each side, so its ends match the neighbours it will stand against.
 */
export function bakeOcclusion(parts, spec) {
  const bounds = new THREE.Box3();
  for (const { g } of parts) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox);
  }
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x * (spec.tileable ? 3 : 1), size.y, size.z);
  const cell = Math.max(MIN_CELL, longest / MAX_CELLS);
  const reach = Math.min(MAX_REACH, Math.max(1, Math.max(size.x, size.y, size.z) * 0.5));

  const copies = spec.tileable ? [-spec.w, 0, spec.w] : [0];
  const gridBounds = bounds.clone();
  gridBounds.min.x += Math.min(...copies);
  gridBounds.max.x += Math.max(...copies);
  // Above-ground only: the ground is handled as a plane, and the skirt lies under it.
  gridBounds.min.y = Math.max(gridBounds.min.y, 0);
  gridBounds.expandByScalar(cell);
  const grid = new Grid(gridBounds, cell);
  for (const { g } of parts) {
    for (const offset of copies) {
      forEachTriangle(g, offset, (a, b, c) => grid.fillTriangle(a, b, c));
    }
  }

  const step = cell * 0.5;
  const start = new THREE.Vector3();
  const ray = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const cache = new Map();

  const occlusionAt = (position, faceNormal) => {
    const key = `${position.x.toFixed(3)},${position.y.toFixed(3)},${position.z.toFixed(3)},${faceNormal.x.toFixed(2)},${faceNormal.y.toFixed(2)},${faceNormal.z.toFixed(2)}`;
    const known = cache.get(key);
    if (known !== undefined) {
      return known;
    }
    // Underground faces are hidden, so they're left alone.
    if (position.y < -0.01) {
      cache.set(key, 0);
      return 0;
    }
    normal.copy(faceNormal).normalize();
    tangent.set(Math.abs(normal.y) < 0.9 ? 0 : 1, Math.abs(normal.y) < 0.9 ? 1 : 0, 0);
    tangent.cross(normal).normalize();
    bitangent.crossVectors(normal, tangent);
    basis.makeBasis(tangent, bitangent, normal);
    // Out of the vertex's own cell, so its own surface doesn't block it.
    start.copy(position).addScaledVector(normal, cell * 1.5);

    let blocked = 0;
    for (const direction of HEMISPHERE) {
      ray.copy(direction).applyMatrix4(basis);
      for (let travelled = step; travelled <= reach; travelled += step) {
        const x = start.x + ray.x * travelled;
        const y = start.y + ray.y * travelled;
        const z = start.z + ray.z * travelled;
        if (y < 0 || grid.filled(x, y, z)) {
          // Nearby blockers count fully, distant ones less, which softens the falloff.
          blocked += 1 - (travelled / reach) * 0.5;
          break;
        }
      }
    }
    const occlusion = blocked / HEMISPHERE.length;
    cache.set(key, occlusion);
    return occlusion;
  };

  const vertex = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();
  for (const { g } of parts) {
    const position = g.getAttribute("position");
    const normals = g.getAttribute("normal");
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      faceNormal.fromBufferAttribute(normals, index);
      const shade = 1 - STRENGTH * occlusionAt(vertex, faceNormal);
      colors[index * 3] = shade;
      colors[index * 3 + 1] = shade;
      colors[index * 3 + 2] = shade;
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  return parts;
}
