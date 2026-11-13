import * as THREE from "three";
import { aerial } from "./aerial.mjs";
import { KitShape, random } from "./shared.mjs";

function block(s, w, d, h, floors = 2) {
  s.box(w, h, d, 0, h / 2, 0);
  s.box(w, 0.45, d, 0, h, 0, "roof-dark");
  for (let n = 0; n < floors; n++) {
    const y = ((n + 0.6) * h) / floors;
    s.box(w * 0.96, (h / floors) * 0.55, d * 1.006, 0, y, 0, "glass");
    if (n < floors - 1) {
      s.box(w * 1.02, 0.35, d * 1.025, 0, ((n + 1) * h) / floors, 0, "wall-grey");
    }
  }
  roofBand(s, w, d, h);
  s.box(w * 0.16, h * 0.07, 0.18, 0, h * 0.9, d * 0.515, "brand-teal");
}
/** Trim around the roof slab only. A solid band would flicker through the slab from far away. */
function roofBand(s, w, d, y) {
  const sideDepth = d * 0.0125;
  const endWidth = w * 0.01;
  for (const sign of [-1, 1]) {
    s.box(w * 1.02, 0.35, sideDepth, 0, y, sign * (d / 2 + sideDepth / 2), "wall-grey");
    s.box(endWidth, 0.35, d, sign * (w / 2 + endWidth / 2), y, 0, "wall-grey");
  }
}
function doors(s, w, d, h, count) {
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / count;
    s.box((w / count) * 0.77, h * 0.48, 0.25, x, h * 0.24, d / 2 + 0.15, "screen-dark");
    s.box((w / count) * 0.8, 0.3, 0.5, x, h * 0.5, d / 2 + 0.3, "metal");
  }
}
function stand(s, w, d, h, covered, end) {
  const seatHeight = covered ? h * 0.63 : h;
  const steps = 10;
  for (let n = 0; n < steps; n++) {
    const dz = d / steps,
      z = d / 2 - (n + 0.5) * dz,
      sh = ((n + 1) * seatHeight) / steps;
    s.box(w, sh, dz, 0, sh / 2, z, "concrete");
    s.box(w, 0.18, dz * 0.54, 0, sh + 0.1, z, "brand-navy");
  }
  if (covered) {
    for (const x of [-w / 2 + 0.35, w / 2 - 0.35])
      s.beam([x, 0, -d * 0.42], [x, h * 0.9, -d * 0.3], 0.22, "metal");
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const z = -d / 2 + (i * d) / 12;
      const y = h - 1.4 * ((z + d * 0.05) / (d * 0.55)) ** 2;
      pts.push([z, y]);
    }
    // Constant X cross-section gives matching roof edges on adjacent bays.
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], pts[i][1] - 0.45);
    shape.closePath();
    const roof = new THREE.ExtrudeGeometry(shape, {
      depth: w,
      bevelEnabled: false,
      curveSegments: 1,
    });
    roof.rotateY(-Math.PI / 2);
    roof.translate(w / 2, 0, 0);
    s.add(roof, "roof-dark");
    s.box(w, 0.2, d * 0.16, 0, h * 0.87, d * 0.4, "canopy-white");
  }
  if (end) s.box(0.35, h * 0.64, d, -w / 2 + 0.175, h * 0.32, 0, "wall-white");
}
function vehicle(s, a) {
  const { id, w, d, h } = a;
  if (id === "light-aircraft") {
    s.poly(
      [
        [-w * 0.45, h * 0.3],
        [-w * 0.35, h * 0.6],
        [w * 0.27, h * 0.62],
        [w * 0.5, h * 0.4],
        [w * 0.27, h * 0.28],
      ],
      d * 0.11,
      "wall-white",
    );
    s.poly(
      [
        [-w * 0.22, h * 0.42],
        [w * 0.16, h * 0.42],
        [w * 0.04, h * 0.5],
        [-w * 0.2, h * 0.5],
      ],
      d,
      "wall-white",
    );
    s.box(w * 0.15, h * 0.45, d * 0.05, -w * 0.36, h * 0.65, 0, "brand-teal");
    s.box(w * 0.2, 0.12, d * 0.35, -w * 0.35, h * 0.45, 0, "wall-grey");
    s.box(w * 0.2, h * 0.28, d * 0.09, w * 0.05, h * 0.62, 0, "glass");
    for (const z of [-d * 0.1, d * 0.1]) s.cylinder(0.18, 0.2, 0, 0.18, z, "roof-dark", 5);
    return;
  }
  if (id === "race-car-generic") {
    formulaCar(s);
    return;
  }
  const bus = id === "shuttle-bus";
  s.box(w * 0.9, h * 0.35, d * 0.72, 0, h * 0.36, 0, "wall-white");
  s.box(w * (bus ? 0.87 : 0.52), h * 0.42, d * 0.67, -w * 0.05, h * 0.7, 0, "glass");
  s.box(w * (bus ? 0.9 : 0.57), 0.12, d * 0.74, -w * 0.05, h * 0.94, 0, "wall-grey");
  if (bus) s.box(w * 0.88, h * 0.12, d * 0.74, 0, h * 0.34, 0, "brand-teal");
  // Wheels use five-sided cylinders with axes across Z.
  for (const x of [-w * 0.3, w * 0.3])
    for (const z of [-d * 0.4, d * 0.4])
      s.add(
        new THREE.CylinderGeometry(h * 0.22, h * 0.22, d * 0.18, 5),
        "roof-dark",
        x,
        h * 0.22,
        z,
        [Math.PI / 2, 0, 0],
      );
}
/** Authored nose-first along +X, then rotated to +Z with the other vehicles. */
function formulaCar(s) {
  // Pale paint preserves the Convoy's instance colours; carbon remains dark.
  const paint = "wall-white",
    carbon = "screen-dark";
  s.box(3.45, 0.08, 1.32, -0.35, 0.16, 0, carbon);
  s.poly(
    [
      [-1.85, 0.2],
      [-1.3, 0.58],
      [-0.55, 0.82],
      [0.1, 0.55],
      [1.05, 0.49],
      [2.5, 0.27],
      [2.5, 0.19],
    ],
    0.38,
    paint,
  );
  // Open cockpit, shoulder rails and raised airbox behind the driver.
  s.box(0.72, 0.07, 0.46, 0.02, 0.56, 0, carbon);
  s.poly(
    [
      [-1.15, 0.48],
      [-0.8, 1],
      [-0.48, 1],
      [-0.4, 0.48],
    ],
    0.3,
    paint,
  );
  for (const side of [-1, 1]) {
    s.poly(
      [
        [-1.6, 0.22],
        [-1.25, 0.48],
        [0.55, 0.5],
        [0.72, 0.28],
      ],
      0.38,
      paint,
      side * 0.49,
    );
    s.box(0.13, 0.15, 0.29, 0.59, 0.39, side * 0.49, carbon);
    s.box(0.82, 0.12, 0.09, 0, 0.59, side * 0.27, paint);
    // Faceted halo surrounds the opening and meets a single front pillar.
    s.beam([-0.4, 0.85, side * 0.27], [0.25, 0.85, side * 0.27], 0.035, carbon);
    s.beam([0.25, 0.85, side * 0.27], [0.52, 0.8, 0], 0.035, carbon);
    // Exposed octagonal tyres and slim suspension arms.
    for (const x of [-1.72, 1.65]) {
      s.beam([x - 0.25, 0.27, side * 0.2], [x, 0.33, side * 0.8], 0.035, carbon);
      s.add(new THREE.CylinderGeometry(0.36, 0.36, 0.38, 8), carbon, x, 0.36, side * 0.81, [
        Math.PI / 2,
        0,
        0,
      ]);
    }
    s.box(0.48, 0.25, 0.06, 2.56, 0.25, side * 0.97, paint);
    s.box(0.53, 0.4, 0.06, -2.48, 0.79, side * 0.78, paint);
  }
  s.beam([0.52, 0.8, 0], [0.65, 0.48, 0], 0.04, carbon);
  s.box(0.48, 0.06, 1.94, 2.56, 0.15, 0, paint);
  s.box(0.22, 0.07, 1.82, 2.38, 0.26, 0, carbon);
  s.box(0.16, 0.6, 0.12, -2.35, 0.55, 0, carbon);
  s.box(0.53, 0.09, 1.56, -2.48, 0.91, 0, paint);
}
function nature(s, a) {
  const r = random(418 + a.variant * 731),
    { w, d, h, base } = a;
  if (base === "rock-outcrop") {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry(1, 0);
      g.scale(w * (0.24 + r() * 0.12), h * (0.35 + r() * 0.2), d * 0.4);
      s.add(g, "stone", (i - 1) * w * 0.23, h * 0.35, (r() - 0.5) * d * 0.2);
    }
    return;
  }
  if (base === "shrub-fynbos") {
    for (let i = 0; i < 3; i++)
      s.add(
        new THREE.IcosahedronGeometry(1, 0).scale(w * 0.3, h * 0.44, d * 0.32),
        i % 2 ? "foliage-dark" : "foliage-dry",
        (i - 1) * w * 0.23,
        h * 0.45,
        (r() - 0.5) * d * 0.3,
      );
    return;
  }
  s.cylinder(w * 0.045, h * 0.7, 0, h * 0.35, 0, "trunk", 5, w * 0.025);
  const pine = base === "tree-pine",
    gum = base === "tree-gum";
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.23,
      z = (r() - 0.5) * d * 0.3,
      y = h * (pine ? 0.77 : gum ? 0.58 + i * 0.13 : 0.65);
    s.beam([0, h * 0.4, 0], [x, y, z], w * 0.02, "trunk", 3);
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(w * 0.34, h * (pine ? 0.18 : gum ? 0.2 : 0.28), d * 0.42);
    g.rotateY(r() * 2);
    s.add(g, i === 1 ? "foliage-dry" : "foliage-dark", x, y, z);
  }
}
export function design(a) {
  const s = new KitShape(),
    { id, w, d, h } = a;
  if (aerial(s, a)) return s.finish(a);
  if (a.category === "nature") {
    nature(s, a);
    return s.finish(a);
  }
  if (["race-car-generic", "car-parked", "shuttle-bus", "light-aircraft"].includes(id)) {
    vehicle(s, { ...a, w: a.d, d: a.w });
    for (const p of s.parts) p.g.rotateY(-Math.PI / 2);
    return s.finish(a);
  }
  if (id === "paddle-boat") {
    // Tapered bow and stern, with two open footwells ahead of the bench.
    const hull = new THREE.Shape([
      new THREE.Vector2(-0.8, -1.7),
      new THREE.Vector2(0.8, -1.7),
      new THREE.Vector2(1.1, -1.1),
      new THREE.Vector2(1.1, 1.0),
      new THREE.Vector2(0.6, 1.7),
      new THREE.Vector2(-0.6, 1.7),
      new THREE.Vector2(-1.1, 1.0),
      new THREE.Vector2(-1.1, -1.1),
    ]);
    const g = new THREE.ExtrudeGeometry(hull, { depth: 0.35, bevelEnabled: false, steps: 1 });
    g.rotateX(Math.PI / 2);
    s.add(g, "canopy-white", 0, 0.35, 0);
    for (const x of [-1, 1]) s.box(0.2, 0.3, 2.3, x, 0.5, -0.1, "wall-white");
    s.box(1.7, 0.25, 0.65, 0, 0.65, -0.4, "brand-teal");
    s.box(1.7, 0.45, 0.15, 0, 0.92, -0.7, "brand-teal");
    s.box(0.45, 0.4, 1.1, 0, 0.55, 0.6, "wall-grey");
    for (const x of [-0.9, 0.9])
      for (const z of [-0.95, 1.05]) s.box(0.08, 1.6, 0.08, x, 1.2, z, "metal");
    s.box(2.1, 0.1, 2.35, 0, 2.05, 0.05, "canopy-white");
  } else if (id === "boom-gate") {
    s.box(0.6, 1.4, 0.6, -2.5, 0.7, 0, "brand-navy");
    s.box(0.2, 0.7, 0.5, -2.1, 0.35, 0, "metal");
    for (let stripe = 0; stripe < 10; stripe++)
      s.box(
        0.5,
        0.18,
        0.16,
        -1.95 + stripe * 0.5,
        1.2,
        0,
        stripe % 2 ? "safety-red" : "canopy-white",
      );
  } else if (id === "lake-fountain") {
    s.cylinder(5.8, 0.35, 0, 0.175, 0, "stone", 24);
    const ring = (outer, inner, bottom, top, material) => {
      const profile = [
        [inner, bottom],
        [outer, bottom],
        [outer, top],
        [inner, top],
        [inner, bottom],
      ];
      s.add(
        new THREE.LatheGeometry(
          profile.map(([x, y]) => new THREE.Vector2(x, y)),
          24,
        ),
        material,
      );
    };
    ring(6, 5.35, 0.15, 0.9, "stone");
    ring(1.65, 1.05, 0.35, 2, "wall-grey");
  } else if (id === "guard-hut") {
    s.box(4.2, 2.95, 5.2, 0, 1.475, 0, "wall-white");
    s.box(3.6, 1.15, 0.08, 0, 2, 2.64, "glass");
    for (const x of [-2.14, 2.14]) {
      s.box(0.08, 1.15, 4.4, x, 2, 0, "glass");
      s.box(0.12, 1.2, 0.1, x, 2, 0, "metal");
    }
    s.box(0.1, 1.2, 0.12, 0, 2, 2.65, "metal");
    s.box(1, 2.3, 0.1, 0, 1.15, -2.65, "brand-teal");
    s.box(w, 0.45, d, 0, 3.175, 0, "brand-navy");
  } else if (id === "residents-clubhouse") {
    s.box(w, 0.25, d, 0, 0.125, 0, "timber");
    s.box(29, 4.25, 6.6, 0, 2.375, -1.1, "wall-white");
    s.box(28, 3.6, 0.12, 0, 2.3, 2.26, "glass");
    for (const x of [-14, -7, 0, 7, 14]) {
      s.box(0.22, 3.8, 0.18, x, 2.3, 2.38, "timber");
      s.box(0.35, 4.3, 0.35, x, 2.4, 4.3, "timber");
    }
    s.box(w, 0.45, d, 0, 4.775, 0, "brand-navy");
  } else if (id === "fireworks-barge") {
    s.box(w, 0.65, d, 0, 0.325, 0, "roof-dark");
    s.box(23.5, 0.15, 11.5, 0, 0.725, 0, "wall-grey");
    s.box(6, 1.7, 3, 0, 1.65, -3.5, "brand-navy");
    s.box(1, 1.3, 0.1, 0, 1.45, -1.95, "wall-grey");
    for (const z of [-5.6, 5.6]) {
      s.box(23, 0.1, 0.1, 0, 1.75, z, "metal");
      for (const x of [-11.5, -6, 0, 6, 11.5]) s.box(0.1, 1, 0.1, x, 1.25, z, "metal");
    }
    for (const x of [-11.5, 11.5]) s.box(0.1, 0.1, 11.2, x, 1.75, 0, "metal");
    for (const x of [-7, 7]) {
      s.box(3.8, 0.3, 2, x, 0.95, 0.8, "brand-navy");
      for (const dx of [-1.2, 0, 1.2]) {
        const tube = new THREE.CylinderGeometry(0.25, 0.25, 1.3, 6, 1, true);
        s.add(tube, "roof-dark", x + dx, 1.65, 0.8, [0, 0, -dx * 0.25]);
      }
    }
  } else if (id === "jetty-kiosk") {
    s.box(5.2, 3.1, 3.2, 0, 1.55, 0, "timber");
    s.box(3.5, 1.25, 0.1, 0, 1.95, 1.65, "screen-dark");
    s.box(3.9, 0.15, 0.6, 0, 1.25, 1.7, "timber");
    s.box(3.9, 0.12, 0.9, 0, 2.65, 1.55, "roof-dark", [-0.2, 0, 0]);
    for (const x of [-2.5, 2.5]) s.box(0.18, 3.1, 0.18, x, 1.55, 1.65, "wall-grey");
    s.roof(w, d, 0.55, 3.25, "roof-dark");
  } else if (id.startsWith("grandstand") || id === "temporary-bleacher") {
    stand(
      s,
      w,
      d,
      h,
      id === "grandstand-bay-covered" || id === "grandstand-end-cap",
      id === "grandstand-end-cap",
    );
  } else if (id === "pit-conference-building") {
    s.box(w * 0.96, h * 0.29, d * 0.8, 0, h * 0.145, -d * 0.06, "wall-white");
    doors(s, w * 0.96, d * 0.68, h * 0.5, 36);
    for (let i = 0; i < 3; i++) {
      s.box(w * 0.96, h * 0.17, d * 0.79, 0, h * (0.38 + i * 0.18), -d * 0.06, "glass");
      s.box(w, 0.5, d * 0.86, 0, h * (0.48 + i * 0.18), -d * 0.06, "wall-white");
    }
    for (let x = -w * 0.47; x <= w * 0.48; x += w / 20)
      s.beam([x, 0, d * 0.44], [x + w * 0.016, h * 0.88, d * 0.27], 0.65, "wall-grey");
    s.box(w, 1.1, d * 0.98, 0, h * 0.95, 0, "roof-dark", [0.055, 0, 0]);
    s.box(w, 0.4, d * 0.21, 0, h * 0.91, d * 0.39, "canopy-white");
  } else if (id === "amphitheatre") {
    const rows = 12,
      segments = 24;
    for (let n = 0; n < rows; n++) {
      const inner = 17 + n * 3,
        outer = inner + 3,
        yt = 1 + n * 1.12;
      const pts = [];
      for (let j = 0; j <= segments; j++) {
        const t = -0.12 + (j * (Math.PI + 0.24)) / segments;
        pts.push([Math.cos(t) * outer, Math.sin(t) * outer]);
      }
      for (let j = segments; j >= 0; j--) {
        const t = -0.12 + (j * (Math.PI + 0.24)) / segments;
        pts.push([Math.cos(t) * inner, Math.sin(t) * inner]);
      }
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(...p)));
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: yt,
        bevelEnabled: false,
        curveSegments: 1,
      });
      g.rotateX(Math.PI / 2);
      s.add(g, n % 3 === 0 ? "brand-navy" : "concrete", 0, yt, 0);
    }
    s.box(42, 2, 20, 0, 1, -24, "concrete");
    s.box(42, 8, 2, 0, 6, -32, "screen-dark");
    s.roof(48, 25, 3, 15, "canopy-white", 0, -23);
    for (const x of [-21, 21]) s.box(0.7, 15, 0.7, x, 7.5, -19, "metal");
  } else if (id === "gateway-arch") {
    // Elliptical ring with straight piers and a clear opening.
    for (const x of [-w * 0.43, w * 0.43]) s.box(w * 0.14, h * 0.53, d, x, h * 0.265, 0, "stone");
    const shape = new THREE.Shape();
    for (let i = 0; i <= 16; i++) {
      const t = (i * Math.PI) / 16;
      const x = (Math.cos(t) * w) / 2,
        y = h * 0.5 + Math.sin(t) * h * 0.5;
      i ? shape.lineTo(x, y) : shape.moveTo(x, y);
    }
    for (let i = 16; i >= 0; i--) {
      const t = (i * Math.PI) / 16;
      shape.lineTo(Math.cos(t) * w * 0.36, h * 0.5 + Math.sin(t) * h * 0.29);
    }
    shape.closePath();
    s.add(
      new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 1 }),
      "wall-white",
      0,
      0,
      -d / 2,
    );
    s.box(w * 0.38, h * 0.16, d * 1.01, 0, h * 0.85, 0, "brand-navy");
  } else if (id === "conference-foyer") {
    s.box(w, h * 0.88, d, 0, h * 0.44, 0, "glass");
    s.box(w, 0.35, d, 0, h * 0.9, 0, "roof-dark");
    s.box(w, 0.35, d, 0, 0.175, 0, "wall-grey");
    for (const x of [-w * 0.49, w * 0.49]) s.box(0.65, h, d, x, h / 2, 0, "wall-white");
    for (let x = -w * 0.45; x < w * 0.46; x += w * 0.09)
      s.box(0.18, h, d * 1.01, x, h / 2, 0, "metal");
  } else if (id === "plaza-tower") {
    s.box(w, h, d, 0, h / 2, 0, "stone");
    s.box(w * 1.05, 0.8, d * 1.05, 0, h, 0, "roof-dark");
    s.box(w * 0.65, h * 0.2, d * 1.02, 0, h * 0.74, 0, "screen-dark");
    s.box(w * 0.28, h * 0.5, d * 1.02, 0, h * 0.28, 0, "wall-grey");
  } else if (id === "lakeside-pavilion" || id === "promenade-segment") {
    const promenade = id === "promenade-segment";
    const deckY = promenade ? h * 0.85 : 1.5;
    s.box(w, 0.35, d, 0, deckY, 0, "timber");
    for (const x of [-w * 0.44, 0, w * 0.44])
      for (const z of [-d * 0.38, d * 0.38]) s.box(0.4, deckY, 0.4, x, deckY / 2, z, "timber");
    if (!promenade) {
      s.box(w * 0.86, h * 0.5, d * 0.59, 0, h * 0.46, -d * 0.13, "glass");
      for (const x of [-w * 0.42, 0, w * 0.42])
        s.box(0.3, h * 0.6, 0.3, x, h * 0.47, d * 0.18, "timber");
      s.roof(w, d * 0.76, h * 0.18, h * 0.81, "roof-dark", 0, -d * 0.1);
    } else {
      for (const z of [-d / 2 + 0.12, d / 2 - 0.12]) {
        s.box(w, 0.1, 0.12, 0, h, z, "metal");
        for (const x of [-w * 0.45, 0, w * 0.45])
          s.box(0.1, h - deckY, 0.1, x, (h + deckY) / 2, z, "metal");
      }
    }
  } else if (id === "hospitality-marquee") {
    s.box(w, 0.2, d, 0, 0.1, 0, "concrete");
    for (const x of [-w * 0.45, 0, w * 0.45]) {
      s.cone(w * 0.27, h * 0.5, x, h * 0.75, 0, "canopy-white", 4);
      s.box(0.2, h * 0.55, 0.2, x, h * 0.275, 0, "metal");
    }
    for (const z of [-d * 0.46, d * 0.46]) s.box(w, h * 0.45, 0.1, 0, h * 0.225, z, "canopy-white");
  } else if (id === "start-finish-gantry" || id === "footbridge-over-track") {
    for (const x of [-w * 0.46, w * 0.46]) s.box(w * 0.035, h, d * 0.6, x, h / 2, 0, "metal");
    s.box(
      w,
      h * 0.24,
      d,
      0,
      h * 0.83,
      0,
      id === "start-finish-gantry" ? "brand-navy" : "wall-grey",
    );
    s.box(w * 0.74, h * 0.16, 0.15, 0, h * 0.84, d / 2 + 0.1, "screen-dark");
    if (id === "footbridge-over-track")
      for (let x = -w * 0.4; x < w * 0.4; x += w * 0.1)
        s.beam([x, h * 0.74, d / 2], [x + w * 0.09, h * 0.94, d / 2], 0.12, "metal");
  } else if (id === "big-screen") {
    for (const x of [-w * 0.25, w * 0.25]) s.box(0.6, h * 0.52, d * 0.7, x, h * 0.26, 0, "metal");
    s.box(w, h * 0.57, d, 0, h * 0.715, 0, "roof-dark");
    s.box(w * 0.94, h * 0.51, 0.1, 0, h * 0.72, d * 0.51, "screen-dark");
  } else if (id === "light-pole") {
    s.cylinder(0.14, h * 0.96, 0, h * 0.48, 0, "metal", 5, 0.1);
    s.box(w, 0.15, d, 0, h * 0.98, 0, "metal");
    s.box(w * 0.9, 0.1, d * 0.9, 0, h * 0.96, 0, "canopy-white");
  } else if (id === "race-fence-segment") {
    for (const x of [-w / 2 + 0.05, 0, w / 2 - 0.05]) s.box(0.1, h, 0.12, x, h / 2, 0, "metal");
    for (let y = 0.2; y < h; y += h / 5) s.box(w, 0.035, 0.035, 0, y, 0, "metal");
    for (let x = -w / 2 + 0.5; x < w / 2; x += 1.25) s.box(0.025, h, 0.035, x, h / 2, 0, "metal");
  } else if (id === "barrier-segment") {
    s.poly(
      [
        [-d / 2, 0],
        [d / 2, 0],
        [d * 0.23, h],
        [-d * 0.23, h],
      ],
      w,
      "concrete",
    );
    // The profile's extrusion runs along Z; rotate it to tile along X.
    for (const p of s.parts) p.g.rotateY(Math.PI / 2);
  } else if (id === "hoarding-blank") {
    s.box(w, h * 0.83, d, 0, h * 0.58, 0, "wall-white");
    for (const x of [-w * 0.4, w * 0.4]) s.box(0.1, h * 0.5, d * 0.8, x, h * 0.25, 0, "metal");
  } else if (id === "food-stall") {
    s.box(w, h * 0.8, d, 0, h * 0.4, 0, "wall-white");
    s.box(w * 0.78, h * 0.28, 0.1, 0, h * 0.53, d * 0.51, "screen-dark");
    s.box(w, 0.15, d * 0.25, 0, h * 0.37, d * 0.43, "timber");
    s.roof(w, d, h * 0.13, h * 0.86, "brand-teal");
  } else if (id === "shuttle-stop" || id === "kalbaskraal-station") {
    s.box(w, 0.5, d, 0, 0.25, 0, "concrete");
    for (let x = -w * 0.42; x <= w * 0.43; x += w / 6)
      s.box(0.25, h * 0.85, 0.25, x, h * 0.425, -d * 0.15, "metal");
    s.roof(w, d, h * 0.1, h * 0.89, "roof-dark");
    s.box(w * 0.65, 0.5, d * 0.15, 0, 1, -d * 0.15, "timber");
  } else if (id === "entrance-gate") {
    s.box(w, h * 0.2, d, 0, h * 0.9, 0, "brand-navy");
    for (let i = 0; i < 8; i++) {
      const x = -w * 0.45 + (i * w * 0.9) / 7;
      s.box(0.4, h * 0.8, d * 0.6, x, h * 0.4, 0, "metal");
      s.box(w * 0.07, 0.15, 0.15, x, h * 0.4, d * 0.3, "metal");
    }
    s.box(w * 0.3, h * 0.12, 0.1, 0, h * 0.91, d * 0.51, "screen-dark");
  } else if (id === "aerodrome-control-tower") {
    s.box(w * 0.48, h * 0.76, d * 0.48, 0, h * 0.38, 0, "wall-grey");
    s.box(w, h * 0.18, d, 0, h * 0.85, 0, "glass");
    s.box(w * 1.08, 0.6, d * 1.08, 0, h, 0, "roof-dark");
  } else if (id === "farm-silo-group") {
    for (const x of [-w / 3, 0, w / 3]) {
      s.cylinder(w * 0.15, h * 0.86, x, h * 0.43, 0, "wall-grey", 10);
      s.cone(w * 0.15, h * 0.14, x, h * 0.93, 0, "metal", 10);
    }
    s.box(w * 0.95, 0.4, 1, 0, h * 0.86, 0, "metal");
  } else if (id === "farmhouse") {
    s.box(w, h * 0.65, d, 0, h * 0.325, 0, "wall-white");
    s.roof(w * 1.03, d * 1.03, h * 0.35, h * 0.65);
    s.box(w * 0.65, 0.2, d * 0.25, 0, h * 0.5, d * 0.45, "roof-dark");
    doors(s, w * 0.8, d, h * 0.6, 3);
  } else if (id === "table-mountain-silhouette") {
    const ridge = [
      [-0.5, 0],
      [-0.48, 0.18],
      [-0.4, 0.31],
      [-0.34, 0.49],
      [-0.3, 0.69],
      [-0.27, 0.7],
      [-0.23, 0.48],
      [-0.2, 0.55],
      [-0.17, 0.91],
      [-0.13, 0.98],
      [0.04, 1],
      [0.13, 0.97],
      [0.19, 0.91],
      [0.22, 0.49],
      [0.26, 0.38],
      [0.29, 0.62],
      [0.32, 0.66],
      [0.38, 0.33],
      [0.46, 0.15],
      [0.5, 0],
    ];
    s.poly(
      ridge.map(([x, y]) => [x * w, y * h]),
      d,
      "rock-distant",
    );
  } else if (id === "driving-academy") {
    // Two-storey teaching wing, with a recessed ground-floor entrance.
    s.box(w * 0.94, h * 0.85, d * 0.78, 0, h * 0.425, -d * 0.08);
    for (const y of [h * 0.22, h * 0.62]) {
      s.box(w * 0.88, h * 0.24, 0.18, 0, y, d * 0.315, "glass");
      for (let i = -4; i <= 4; i++)
        s.box(0.18, h * 0.27, 0.35, i * w * 0.1, y, d * 0.33, "wall-grey");
    }
    // Classrooms also face the campus road, visible from the default fly-to bearing.
    for (const y of [h * 0.22, h * 0.62]) {
      s.box(w * 0.88, h * 0.24, 0.18, 0, y, -d * 0.475, "glass");
      for (let i = -4; i <= 4; i++)
        s.box(0.18, h * 0.27, 0.35, i * w * 0.1, y, -d * 0.49, "wall-grey");
    }
    s.box(w * 0.98, 0.25, d * 0.84, 0, h * 0.43, -d * 0.06, "wall-grey");
    s.box(w, 0.3, d * 0.94, 0, h * 0.85, -d * 0.03, "roof-dark");
    s.box(w * 0.28, h * 0.16, d * 0.38, -w * 0.28, h * 0.92, -d * 0.12, "brand-teal");
    s.box(w * 0.12, h * 0.32, 0.24, 0, h * 0.16, d * 0.33, "screen-dark");
    s.box(w * 0.4, 0.25, d * 0.22, 0, h * 0.38, d * 0.39, "canopy-white");
    for (const x of [-w * 0.18, w * 0.18])
      s.box(0.22, h * 0.36, 0.22, x, h * 0.18, d * 0.47, "metal");
    s.box(w * 0.42, 0.18, d * 0.18, 0, 0.09, d * 0.4, "stone");
  } else if (id === "automotive-hub") {
    // Workshop fronts sit behind the structural piers, rather than on a solid wall.
    s.box(w, h * 0.78, d * 0.86, 0, h * 0.39, -d * 0.07, "wall-grey");
    for (let i = 0; i < 8; i++) {
      const x = ((i - 3.5) * w) / 8;
      s.box(w * 0.1, h * 0.4, 0.3, x, h * 0.2, d * 0.365, "screen-dark");
      s.box(w * 0.1, h * 0.13, 0.35, x, h * 0.53, d * 0.365, "glass");
      s.box(w * 0.022, h * 0.78, d * 0.12, x - w * 0.0625 + w * 0.011, h * 0.39, d * 0.42);
      for (const y of [h * 0.13, h * 0.26]) s.box(w * 0.1, 0.12, 0.16, x, y, d * 0.37, "metal");
    }
    s.box(w * 0.022, h * 0.78, d * 0.12, w * 0.489, h * 0.39, d * 0.42);
    s.box(w, h * 0.1, d * 0.13, 0, h * 0.68, d * 0.425, "brand-navy");
    s.roof(w, d, h * 0.19, h * 0.78);
    for (const x of [-w * 0.3, 0, w * 0.3]) {
      s.box(w * 0.08, h * 0.13, d * 0.08, x, h * 0.91, -d * 0.16, "metal");
      s.box(w * 0.1, 0.22, d * 0.1, x, h * 0.98, -d * 0.16, "roof-dark");
    }
  } else if (id === "townhouse-row") {
    for (let i = 0; i < 5; i++) {
      const unit = w / 5,
        x = (i - 2) * unit;
      const eave = h * (i % 2 ? 0.64 : 0.68);
      s.box(
        unit * 0.97,
        eave,
        d * 0.76,
        x,
        eave / 2,
        -d * 0.06,
        i % 2 ? "wall-grey" : "wall-white",
      );
      s.roof(unit, d * 0.92, h * 0.3, eave, i % 2 ? "roof-dark" : "stone", x, -d * 0.04);
      // Dark reveals, with smaller glazing set behind their front edges.
      for (const [dx, y, ww, hh] of [
        [-0.23, 0.48, 0.28, 0.17],
        [0.23, 0.48, 0.28, 0.17],
        [-0.22, 0.19, 0.3, 0.2],
      ]) {
        s.box(unit * ww, h * hh, 0.22, x + unit * dx, h * y, d * 0.325, "screen-dark");
        s.box(unit * (ww - 0.05), h * (hh - 0.04), 0.08, x + unit * dx, h * y, d * 0.333, "glass");
      }
      s.box(unit * 0.18, h * 0.27, 0.2, x + unit * 0.23, h * 0.135, d * 0.325, "timber");
      s.box(unit * 0.44, 0.18, d * 0.2, x + unit * 0.2, h * 0.3, d * 0.4, "roof-dark");
      for (const dx of [0.01, 0.39])
        s.box(0.15, h * 0.29, 0.15, x + unit * dx, h * 0.145, d * 0.47, "timber");
      s.box(unit * 0.44, 0.16, d * 0.2, x + unit * 0.2, 0.08, d * 0.4, "stone");
    }
  } else if (id === "aerodrome-hangar") {
    s.box(w, h * 0.72, d, 0, h * 0.36, 0, "wall-grey");
    s.roof(w * 1.02, d * 1.02, h * 0.28, h * 0.72);
    doors(s, w * 0.95, d, h * 1.15, 2);
  } else {
    const floors =
      id === "hotel-tower"
        ? 10
        : id === "hotel-low"
          ? 4
          : id === "residential-trackside"
            ? 5
            : id === "research-block"
              ? 4
              : 2;
    if (id === "conference-hall") {
      s.box(w, h * 0.76, d, 0, h * 0.38, 0, "wall-white");
      s.roof(w, d, h * 0.24, h * 0.76);
      doors(s, w * 0.95, d, h * 0.8, 4);
      s.box(w * 0.94, h * 0.13, d * 1.003, 0, h * 0.62, 0, "glass");
    } else {
      block(s, w, d, h, floors);
    }
    if (id === "residential-trackside" || id.startsWith("hotel")) {
      for (let n = 0; n < floors; n++) {
        const y = ((n + 1) * h) / floors - 0.4;
        s.box(w, 0.3, d * 0.2, 0, y, d * 0.52, "wall-white");
        s.box(w, 0.6, 0.15, 0, y + 0.4, d * 0.61, "metal");
        for (let x = -w * 0.45; x < w * 0.5; x += w / 10)
          s.box(0.18, h / floors, 0.18, x, y - (h / floors) * 0.5, d * 0.61, "wall-grey");
      }
    }
    if (id === "retail-block") {
      for (let i = 0; i < 6; i++) {
        const x = ((i - 2.5) * w) / 6;
        s.box(w * 0.13, h * 0.42, 0.15, x, h * 0.25, d * 0.51, "glass");
        s.box(w * 0.15, 0.15, d * 0.15, x, h * 0.52, d * 0.52, "canopy-white");
      }
    }
    if (id === "karting-clubhouse") s.roof(w, d, h * 0.18, h, "roof-dark");
    if (id === "media-centre" || id === "karting-clubhouse" || id === "aerodrome-terminal")
      s.box(w * 1.05, 0.3, d * 0.27, 0, h * 0.58, d * 0.43, "canopy-white");
  }
  return s.finish(a);
}
