import * as THREE from "three";

// Architecture composed for the map's elevated camera. Dimensions include overhangs.
function terrace(s, w, d, x, y, z) {
  s.box(w, 0.5, d, x, y, z, "timber");
  for (const sign of [-1, 1]) {
    s.box(w, 0.7, 0.25, x, y + 0.55, z + sign * (d / 2 - 0.15), "wall-white");
    s.box(0.25, 0.7, d, x + sign * (w / 2 - 0.15), y + 0.55, z, "wall-white");
  }
}
function plant(s, x, y, z, w = 4, d = 3) {
  s.box(w, 0.7, d, x, y, z, "wall-grey");
  s.box(w * 0.85, 0.6, d * 0.8, x, y + 0.6, z, "foliage-dry");
}
function equipment(s, x, y, z, w = 5) {
  s.box(w, 1.3, 3, x, y + 0.65, z, "metal");
  s.box(w * 0.8, 0.2, 2.3, x, y + 1.4, z, "roof-dark");
}
function garageDoors(s, w, z, height, count) {
  for (let i = 0; i < count; i++) {
    const x = w * ((i + 0.5) / count - 0.5);
    s.box((w / count) * 0.8, height, 0.25, x, height / 2, z, "screen-dark");
    for (let row = 1; row < 4; row++)
      s.box((w / count) * 0.76, 0.1, 0.3, x, (height * row) / 4, z + 0.1, "metal");
  }
}
function pit(s, { w, d, h }) {
  s.box(w, 8, d * 0.72, 0, 4, -d * 0.1);
  garageDoors(s, w * 0.97, d * 0.265, 6, 32);
  // Long conference wings step back from the pit lane, exposing terrace bands.
  for (let floor = 0; floor < 3; floor++) {
    const y = 8 + floor * 5;
    const depth = d * (0.66 - floor * 0.12);
    s.box(w * 0.83, 4.5, depth, -w * 0.035, y + 2.25, -d * 0.12, "glass");
    s.box(w * 0.85, 0.6, depth + 3, -w * 0.035, y + 4.7, -d * 0.12);
    terrace(s, w * 0.76, 4, -w * 0.035, y + 4.95, -d * 0.12 + depth / 2);
  }
  // Separate roof pavilions leave broad, visible gaps and occupied roof terraces.
  for (const x of [-0.29, -0.08, 0.13]) {
    s.box(w * 0.16, 2.4, d * 0.23, w * x, 25.2, -d * 0.19, "glass");
    s.roof(w * 0.18, d * 0.27, 1.4, 26.4, "canopy-white", w * x, -d * 0.19);
    equipment(s, w * x, 23.3, -d * 0.36, 8);
    plant(s, w * x, 23.3, d * 0.05, 12, 2.5);
  }
  s.box(w * 0.9, 0.8, d * 0.22, -w * 0.04, 10, d * 0.39, "canopy-white");
  for (let i = 0; i < 16; i++) {
    const x = -w * 0.47 + i * w * 0.055;
    s.beam([x, 0, d * 0.4], [x + 3, 13, d * 0.25], 0.6, "wall-grey");
  }
  // +X is the south lobby when the model faces west in the map.
  s.box(w * 0.1, 18, d * 0.75, w * 0.45, 9, -d * 0.07, "glass");
  s.roof(w * 0.1, d * 0.8, 3, 18, "canopy-white", w * 0.45, -d * 0.07);
  s.box(16, h - 5, 16, -w * 0.46, (h - 5) / 2, -d * 0.23, "wall-grey");
  s.box(20, 4, 20, -w * 0.46, h - 3, -d * 0.23, "glass");
  s.box(22, 1, 22, -w * 0.46, h - 0.5, -d * 0.23, "brand-navy");
}
function stand(s, { w, d, h, id }) {
  for (let n = 0; n < 10; n++) {
    const z = d * 0.45 - (n + 0.5) * d * 0.074;
    const y = 1 + n * h * 0.052;
    s.box(w, y, d * 0.074, 0, y / 2, z, "concrete");
    s.box(w, 0.3, d * 0.05, 0, y + 0.15, z, n % 4 < 2 ? "brand-navy" : "brand-teal");
  }
  s.box(w, 0.6, d * 0.19, 0, h * 0.36, -d * 0.395, "wall-white");
  for (const x of [-w * 0.36, w * 0.36]) {
    s.beam([x, 0, -d * 0.4], [x, h * 0.94, -d * 0.32], 0.3, "metal");
    s.beam([x, h * 0.74, -d * 0.4], [x, h * 0.91, -d * 0.02], 0.2, "metal");
  }
  // Constant cross section at both tile boundaries. Roof covers the upper rows only.
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const z = -d * 0.5 + i * d * 0.052;
    pts.push([z, h * (0.97 - 0.13 * ((i - 4) / 4) ** 2)]);
  }
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i][0], pts[i][1] - 0.5);
  shape.closePath();
  const roof = new THREE.ExtrudeGeometry(shape, {
    depth: w,
    bevelEnabled: false,
    curveSegments: 1,
  });
  roof.rotateY(-Math.PI / 2);
  roof.translate(w / 2, 0, 0);
  s.add(roof, "roof-dark");
  s.roof(w * 0.7, d * 0.12, h * 0.07, h * 0.93, "canopy-white", 0, -d * 0.06);
  // Rear stair and concourse remain visible from the public fan walk.
  for (let n = 0; n < 8; n++)
    s.box(
      w * 0.2,
      h * 0.045 * (n + 1),
      d * 0.022,
      0,
      h * 0.0225 * (n + 1),
      -d * 0.49 + n * d * 0.022,
      "wall-grey",
    );
  if (id === "grandstand-end-cap")
    s.box(0.4, h * 0.34, d * 0.8, -w / 2 + 0.2, h * 0.17, 0, "wall-white");
}
function hall(s, { w, d, h }) {
  s.box(w, h * 0.7, d, 0, h * 0.35, 0);
  for (let i = 0; i < 4; i++) {
    const x = w * ((i + 0.5) / 4 - 0.5);
    s.roof(w / 4, d * 0.9, h * 0.3, h * 0.7, "roof-dark", x, 0);
    s.roof(w * 0.07, d * 0.74, h * 0.085, h * 0.92, "glass", x, 0);
    equipment(s, x, h * 0.71, -d * 0.46, w * 0.12);
  }
  s.box(w * 0.9, h * 0.16, 0.3, 0, h * 0.56, d / 2, "glass");
}
function hotel(s, { w, d, h, id }) {
  const low = id === "hotel-low";
  s.box(w, h * 0.2, d * 0.9, 0, h * 0.1, 0, "stone");
  terrace(s, w * 0.96, d * 0.9, 0, h * 0.2 + 0.3, 0);
  const floors = low ? 4 : 8;
  const floorHeight = h * (low ? 0.15 : 0.085);
  for (let i = 0; i < floors; i++) {
    const level = h * 0.2 + i * floorHeight;
    const width = w * (i > floors - 3 ? 0.53 : 0.76);
    s.box(
      width,
      floorHeight * 0.94,
      d * 0.52,
      -w * 0.07,
      level + floorHeight * 0.47,
      -d * 0.15,
      "glass",
    );
    s.box(width + 2, 0.55, d * 0.68, -w * 0.07, level + floorHeight * 0.94, -d * 0.13);
  }
  const roofY = h * 0.2 + floors * floorHeight;
  terrace(s, w * 0.54, d * 0.62, -w * 0.07, roofY + 0.4, -d * 0.13);
  s.box(w * 0.26, 0.25, d * 0.22, -w * 0.13, roofY + 0.8, -d * 0.1, "brand-teal");
  s.box(w * 0.18, h - roofY - 0.8, d * 0.28, w * 0.12, (h + roofY) / 2, -d * 0.24, "wall-white");
  s.box(w * 0.28, 0.5, d * 0.28, w * 0.27, h * 0.21, d * 0.36, "canopy-white");
  for (const x of [-w * 0.4, w * 0.4]) plant(s, x, h * 0.2 + 0.7, d * 0.2);
}
function precinct(s, { w, d, h, id }) {
  const variant = Number(id.match(/-(\d)$/)?.[1] ?? 1);
  const retail = id.startsWith("retail");
  const residential = id.startsWith("residential");
  s.box(w, h * 0.18, d * 0.9, 0, h * 0.09, 0, retail ? "stone" : "wall-grey");
  const count = retail ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const x = ((i - (count - 1) / 2) * w) / count;
    const height = h * (0.62 + ((i + variant) % 3) * 0.12);
    s.box((w / count) * 0.87, height, d * 0.63, x, height / 2, -d * 0.12);
    s.box((w / count) * 0.8, height * 0.65, d * 0.65, x, height * 0.49, -d * 0.12, "glass");
    terrace(s, (w / count) * 0.92, d * 0.67, x, height + 0.3, -d * 0.12);
    if ((i + variant) % 2)
      s.roof((w / count) * 0.7, d * 0.37, 1.5, height + 1, "canopy-white", x, -d * 0.19);
    else equipment(s, x, height + 0.6, -d * 0.22, (w / count) * 0.4);
    plant(s, x, height + 0.7, d * 0.11, (w / count) * 0.45, 2);
    if (residential)
      for (let n = 1; n < 5; n++)
        s.box((w / count) * 0.92, 0.45, d * 0.22, x, (height * n) / 5, d * 0.23);
  }
  if (retail) {
    for (let i = 0; i < 5; i++) {
      const x = w * ((i + 0.5) / 5 - 0.5);
      s.box(w * 0.18, 0.3, d * 0.22, x, h * 0.38, d * 0.36, i % 2 ? "canopy-white" : "brand-teal");
      s.box(0.45, h * 0.38, 0.45, x, h * 0.19, d * 0.44, "stone");
    }
  } else s.box(w * 0.28, 0.5, d * 0.28, 0, h * 0.24, d * 0.35, "canopy-white");
}
export function aerial(s, a) {
  const { id, w, d, h } = a;
  if (id === "pit-conference-building") pit(s, a);
  else if (["grandstand-bay-covered", "grandstand-end-cap"].includes(id)) stand(s, a);
  else if (id === "conference-hall") hall(s, a);
  else if (id.startsWith("hotel-")) hotel(s, a);
  else if (/^(retail-block|research-block|residential-trackside)(-\d)?$/.test(id)) precinct(s, a);
  else if (id === "expo-concourse") {
    s.box(w, h * 0.8, d * 0.86, 0, h * 0.4, 0, "glass");
    s.roof(w, d, h * 0.15, h * 0.85, "glass");
    for (let i = 0; i <= 12; i++) {
      const x = w * (i / 12 - 0.5);
      s.box(0.7, h * 0.85, d, x, h * 0.425, 0);
      s.roof(1, d, h * 0.15, h * 0.85, "wall-white", x);
    }
  } else if (id === "expo-entrance") {
    s.box(w * 0.84, h * 0.78, d * 0.8, 0, h * 0.39, -d * 0.1, "glass");
    for (const x of [-w * 0.43, w * 0.43])
      s.box(w * 0.1, h, d * 0.86, x, h / 2, -d * 0.05, "stone");
    s.roof(w, d, h * 0.12, h * 0.87, "canopy-white");
    s.box(w * 0.48, 0.5, d * 0.55, 0, h * 0.94, -d * 0.05, "glass");
  } else if (id === "gateway-arch") {
    for (const x of [-w * 0.39, w * 0.39]) {
      s.box(w * 0.22, h * 0.73, d, x, h * 0.365, 0, "stone");
      s.box(w * 0.24, 0.65, d, x, h * 0.74, 0, "wall-white");
    }
    s.poly(
      [
        [-w / 2, h * 0.72],
        [-w * 0.24, h],
        [w * 0.24, h],
        [w / 2, h * 0.72],
        [w * 0.24, h * 0.72],
        [0, h * 0.82],
        [-w * 0.24, h * 0.72],
      ],
      d,
      "brand-navy",
    );
    s.box(w * 0.45, 0.6, d * 0.7, 0, h, 0, "canopy-white");
  } else if (id === "plaza-tower") {
    s.box(w * 0.82, h * 0.75, d * 0.82, 0, h * 0.375, 0, "stone");
    terrace(s, w, d, 0, h * 0.76, 0);
    for (const x of [-w * 0.36, w * 0.36])
      for (const z of [-d * 0.36, d * 0.36]) s.box(0.65, h * 0.22, 0.65, x, h * 0.87, z, "stone");
    s.roof(w, d, h * 0.13, h * 0.87, "brand-navy");
    s.roof(w * 0.33, d * 0.7, h * 0.05, h * 0.96, "glass");
  } else if (id === "paddock-support-unit" || id === "karting-garage-row") {
    s.box(w, h * 0.82, d * 0.82, 0, h * 0.41, -d * 0.09);
    garageDoors(s, w * 0.96, d * 0.325, h * 0.65, id === "karting-garage-row" ? 7 : 3);
    s.roof(w, d * 0.84, h * 0.14, h * 0.85, "wall-grey", 0, -d * 0.08);
    s.box(w, 0.2, d * 0.22, 0, h * 0.8, d * 0.39, "brand-teal");
    for (const x of [-w * 0.46, w * 0.46])
      s.box(0.25, h * 0.8, 0.25, x, h * 0.4, d * 0.46, "metal");
  } else if (id === "paddock-equipment-awning" || id === "conference-entrance-canopy") {
    for (const x of [-w * 0.46, w * 0.46])
      for (const z of [-d * 0.42, d * 0.42]) s.box(0.45, h * 0.85, 0.45, x, h * 0.425, z, "metal");
    s.roof(w, d, h * 0.13, h * 0.87, id.startsWith("paddock") ? "brand-navy" : "canopy-white");
    if (id.startsWith("conference"))
      s.box(w * 0.6, h * 0.72, d * 0.2, 0, h * 0.36, -d * 0.35, "glass");
  } else return false;
  return true;
}
