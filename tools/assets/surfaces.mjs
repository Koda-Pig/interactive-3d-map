import { BufferAttribute, BufferGeometry, Vector3 } from "three";

const EPSILON = 1e-6;
/** Float32 model coordinates can differ by a few micrometres after rotation. */
const PLANE_PRECISION = 1e-4;

function side(a, b, p, axes) {
  const [x, y] = axes;
  return (b[x] - a[x]) * (p[y] - a[y]) - (b[y] - a[y]) * (p[x] - a[x]);
}

/** Split a polygon on a line, retaining interpolated positions and normals. */
function split(polygon, a, b, axes) {
  const inside = [];
  const outside = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const dp = side(a, b, p, axes);
    const dq = side(a, b, q, axes);
    if (dp >= -EPSILON) inside.push(p);
    if (dp <= EPSILON) outside.push(p);
    if ((dp > EPSILON && dq < -EPSILON) || (dp < -EPSILON && dq > EPSILON)) {
      const t = dp / (dp - dq);
      const intersection = p.map((value, axis) => value + t * (q[axis] - value));
      inside.push(intersection);
      outside.push(intersection);
    }
  }
  return { inside, outside };
}

function area(polygon, axes) {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 1; i < polygon.length - 1; i++) {
    sum += Math.abs(side(polygon[0], polygon[i], polygon[i + 1], axes));
  }
  return sum / 2;
}

function subtract(polygon, triangle, axes) {
  // First test the intersection, so disjoint triangles retain their original vertices.
  let intersection = polygon;
  for (let edge = 0; edge < 3 && intersection.length >= 3; edge++) {
    intersection = split(intersection, triangle[edge], triangle[(edge + 1) % 3], axes).inside;
  }
  if (area(intersection, axes) < EPSILON) return [polygon];

  const remaining = [];
  let inside = polygon;
  for (let edge = 0; edge < 3 && inside.length >= 3; edge++) {
    const pieces = split(inside, triangle[edge], triangle[(edge + 1) % 3], axes);
    if (area(pieces.outside, axes) > EPSILON) remaining.push(pieces.outside);
    inside = pieces.inside;
  }
  return remaining;
}

/**
 * Cut earlier faces away wherever later parts cover the same plane. Trim and
 * cladding then own their visible surface, without competing depth values.
 * Non-coplanar faces and their shading remain unchanged.
 */
export function resolveCoplanarSurfaces(parts) {
  const planes = new Map();
  const output = parts.map(() => []);
  const ab = new Vector3();
  const ac = new Vector3();
  const normal = new Vector3();

  for (let part = parts.length - 1; part >= 0; part--) {
    const { g, material } = parts[part];
    const positions = g.getAttribute("position");
    const normals = g.getAttribute("normal");
    for (let i = 0; i < positions.count; i += 3) {
      const vertices = [0, 1, 2].map((j) => [
        positions.getX(i + j),
        positions.getY(i + j),
        positions.getZ(i + j),
        normals.getX(i + j),
        normals.getY(i + j),
        normals.getZ(i + j),
      ]);
      ab.set(...vertices[1].slice(0, 3)).sub(new Vector3(...vertices[0].slice(0, 3)));
      ac.set(...vertices[2].slice(0, 3)).sub(new Vector3(...vertices[0].slice(0, 3)));
      normal.crossVectors(ab, ac);
      if (normal.lengthSq() < EPSILON ** 2) continue;
      normal.normalize();
      const distance = normal.dot(new Vector3(...vertices[0].slice(0, 3)));
      const key = [...normal.toArray(), distance]
        .map((v) => Math.round(v / PLANE_PRECISION))
        .join("/");
      const drop = normal
        .toArray()
        .map(Math.abs)
        .indexOf(Math.max(...normal.toArray().map(Math.abs)));
      const axes = [0, 1, 2].filter((axis) => axis !== drop);
      const clip = side(...vertices, axes) < 0 ? [...vertices].reverse() : vertices;
      const covering = planes.get(key) ?? [];
      let polygons = [vertices];
      for (const face of covering) {
        if (face.material === material) continue;
        polygons = polygons.flatMap((polygon) => subtract(polygon, face.vertices, axes));
        if (!polygons.length) break;
      }
      for (const polygon of polygons) {
        for (let j = 1; j < polygon.length - 1; j++) {
          if (area([polygon[0], polygon[j], polygon[j + 1]], axes) > EPSILON) {
            output[part].push(polygon[0], polygon[j], polygon[j + 1]);
          }
        }
      }
      covering.push({ vertices: clip, material });
      planes.set(key, covering);
    }
  }

  return parts.flatMap(({ g, material }, index) => {
    const vertices = output[index];
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(Float32Array.from(vertices.flatMap((v) => v.slice(0, 3))), 3),
    );
    geometry.setAttribute(
      "normal",
      new BufferAttribute(Float32Array.from(vertices.flatMap((v) => v.slice(3))), 3),
    );
    g.dispose();
    if (!vertices.length) {
      geometry.dispose();
      return [];
    }
    return [{ g: geometry, material }];
  });
}
