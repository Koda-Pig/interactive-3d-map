// Dimensions are above-ground envelopes. Unspecified dimensions are explicit design choices.
const rows = {
  racing: [
    ["pit-conference-building", 360, 45, 30, "hero"],
    ["grandstand-bay-covered", 20, 32, 22, "modular", true],
    ["grandstand-bay-open", 20, 24, 12, "modular", true],
    ["grandstand-end-cap", 8, 32, 22, "modular"],
    ["temporary-bleacher", 20, 12, 7, "modular"],
    ["start-finish-gantry", 22, 3, 9, "modular"],
    ["footbridge-over-track", 40, 5, 9, "modular"],
    ["marshal-post", 4, 3, 4],
    ["big-screen", 16, 2, 12, "prop"],
    ["media-centre", 50, 25, 12],
  ],
  conference: [
    ["conference-hall", 90, 60, 16],
    ["conference-foyer", 60, 24, 12],
    ["amphitheatre", 120, 100, 18, "hero"],
    ["gateway-arch", 40, 6, 14],
    ["plaza-tower", 12, 12, 24],
  ],
  hospitality: [
    ["hotel-tower", 45, 25, 48],
    ["hotel-low", 80, 25, 18],
    ["lakeside-pavilion", 26, 16, 7],
    ["promenade-segment", 20, 8, 2, "modular", true],
    ["hospitality-marquee", 30, 15, 8],
  ],
  "mixed-use": [
    ["residential-trackside", 60, 18, 21],
    ["townhouse-row", 40, 12, 10],
    ["retail-block", 60, 30, 9],
    ["research-block", 50, 30, 18],
    ["automotive-hub", 80, 45, 14],
    ["driving-academy", 40, 22, 9],
    ["karting-clubhouse", 24, 14, 7],
  ],
  transport: [
    ["kalbaskraal-station", 70, 14, 8],
    ["aerodrome-hangar", 40, 30, 12],
    ["aerodrome-terminal", 30, 15, 7],
    ["aerodrome-control-tower", 8, 8, 20],
    ["shuttle-stop", 12, 4, 3.5, "modular"],
    ["entrance-gate", 24, 4, 6],
  ],
  props: [
    ["light-pole", 3, 0.8, 12],
    ["race-fence-segment", 10, 0.3, 4, "instanced", true],
    ["barrier-segment", 10, 0.7, 1, "instanced", true],
    ["hoarding-blank", 10, 0.3, 1.5],
    ["food-stall", 6, 4, 3.5],
    ["race-car-generic", 5.6, 2, 1],
    ["car-parked", 4.4, 1.8, 1.5],
    ["shuttle-bus", 11, 2.5, 3.2],
    ["light-aircraft", 8, 11, 2.5],
  ],
  setting: [
    ["farm-silo-group", 18, 8, 24],
    ["farmhouse", 18, 10, 6],
    ["table-mountain-silhouette", 12000, 60, 1100, "prop"],
  ],
};
const noSkirt = new Set([
  "start-finish-gantry",
  "footbridge-over-track",
  "big-screen",
  "table-mountain-silhouette",
]);
export const catalog = Object.entries(rows).flatMap(([category, rs]) =>
  rs.map(([id, w, d, h, kind, tileable]) => ({
    id,
    category,
    w,
    d,
    h,
    kind: category === "props" ? "instanced" : kind || "building",
    tileable: !!tileable,
    skirt: category !== "props" && !noSkirt.has(id),
  })),
);
for (const [id, w, d, h] of [
  ["tree-pine", 14, 12, 14],
  ["tree-gum", 10, 9, 22],
  ["tree-olive", 7, 6, 6],
  ["shrub-fynbos", 2, 2, 1.5],
  ["rock-outcrop", 4, 3, 2],
])
  for (let variant = 1; variant <= 3; variant++)
    catalog.push({
      id: `${id}-${variant}`,
      base: id,
      variant,
      category: "nature",
      w,
      d,
      h,
      kind: "instanced",
      skirt: false,
    });

// Vehicle sizes are supplied length-first. Point the length axis along +Z.
for (const a of catalog)
  if (["race-car-generic", "car-parked", "shuttle-bus", "light-aircraft"].includes(a.id)) {
    [a.w, a.d] = [a.d, a.w];
    a.notes =
      "Supplied vehicle dimensions interpreted as length × width × height; X/Z exchanged so the nose faces +Z.";
  }
