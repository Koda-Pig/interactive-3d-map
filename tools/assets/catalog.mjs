// Dimensions are above-ground envelopes. Unspecified dimensions are explicit design choices.
const rows = {
  racing: [
    ["pit-conference-building", 370, 52, 33, "hero"],
    ["grandstand-bay-covered", 20, 32, 22, "modular", true],
    ["grandstand-bay-open", 20, 24, 12, "modular", true],
    ["grandstand-end-cap", 8, 32, 22, "modular"],
    ["temporary-bleacher", 20, 12, 7, "modular"],
    ["start-finish-gantry", 22, 3, 9, "modular"],
    ["footbridge-over-track", 40, 5, 9, "modular"],
    ["marshal-post", 4, 3, 4],
    ["big-screen", 16, 2, 12, "prop"],
    ["paddock-support-unit", 27, 14, 5],
    ["paddock-equipment-awning", 27, 22, 5.6],
    ["media-centre", 50, 25, 12],
  ],
  conference: [
    ["conference-hall", 78, 72, 24],
    ["expo-concourse", 153, 20, 17],
    ["expo-entrance", 44, 24, 27],
    ["conference-entrance-canopy", 40, 16, 5],
    ["conference-foyer", 60, 24, 12],
    ["amphitheatre", 120, 100, 18, "hero"],
    ["gateway-arch", 40, 6, 14],
    ["plaza-tower", 12, 12, 24],
  ],
  hospitality: [
    ["lake-fountain", 12, 12, 2, "modular"],
    ["fireworks-barge", 24, 12, 2.5, "modular"],
    ["jetty-kiosk", 6, 4, 3.8, "modular"],
    ["hotel-tower", 45, 25, 48],
    ["hotel-low", 80, 25, 18],
    ["lakeside-pavilion", 26, 16, 7],
    ["promenade-segment", 20, 8, 2, "modular", true],
    ["hospitality-marquee", 30, 15, 8],
    ["lake-footbridge", 8, 76, 2.9, "modular"],
    ["timber-deck", 50, 30, 1.9, "modular"],
    ["pergola", 48, 9, 3.1, "modular"],
  ],
  "mixed-use": [
    ["residents-clubhouse", 32, 10, 5, "modular"],
    ["residential-trackside", 60, 18, 24],
    ["townhouse-row", 40, 12, 10],
    ["retail-block", 30, 60, 12],
    ["research-block", 50, 30, 21],
    ["automotive-hub", 80, 45, 14],
    ["driving-academy", 40, 22, 9],
    ["karting-garage-row", 84, 14, 4.2],
    ["karting-clubhouse", 24, 14, 7],
  ],
  transport: [
    ["guard-hut", 5, 6, 3.4, "modular"],
    ["kalbaskraal-station", 70, 14, 8],
    ["aerodrome-hangar", 40, 30, 12],
    ["aerodrome-terminal", 30, 15, 7],
    ["aerodrome-control-tower", 8, 8, 20],
    ["shuttle-stop", 12, 4, 3.5, "modular"],
    ["entrance-gate", 24, 4, 6],
  ],
  props: [
    ["paddle-boat", 2.2, 3.4, 2.1],
    ["boom-gate", 5.6, 0.6, 1.4],
    ["light-pole", 3, 0.8, 12],
    ["race-fence-segment", 10, 0.3, 4, "instanced", true],
    ["barrier-segment", 10, 0.7, 1, "instanced", true],
    ["hoarding-blank", 10, 0.3, 1.5],
    ["food-stall", 6, 4, 3.5],
    // Eight moving cars share one draw call; allow the detailed prop budget.
    ["race-car-generic", 5.6, 2, 1, "prop"],
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
  "lake-footbridge",
  "timber-deck",
  "pergola",
  "lake-fountain",
  "fireworks-barge",
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
    kind: kind || (category === "props" ? "instanced" : "building"),
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

// Variants keep identical envelopes so precinct placement remains data-only.
for (const base of ["retail-block", "research-block", "residential-trackside"]) {
  const spec = catalog.find((a) => a.id === base);
  for (const variant of [2, 3]) catalog.push({ ...spec, id: `${base}-${variant}` });
}

// Waterborne structures have no rectangular building foundation beneath them.
for (const a of catalog) {
  if (["lake-fountain", "fireworks-barge"].includes(a.id))
    a.notes = "Above-ground envelope measured from the lake bed; no building skirt.";
  if (a.id === "boom-gate")
    a.notes = "Centred envelope; cabinet centre at X=-2.5, arm extends 5 m along +X.";
}
