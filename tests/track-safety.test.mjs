import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createCrossing } from "../src/draw/crossings.ts";
import { isCarPark, parkingBlocks, stallsOf } from "../src/layout/car-parks.ts";
import { resolveOutline, resolvePath, samplePath } from "../src/layout/path.ts";
import { centreOf, signedDistance } from "../src/layout/polygon.ts";
import { createTrackSafety } from "../src/layout/track-safety.ts";

const { locations } = JSON.parse(
  readFileSync(new URL("../src/data/locations.json", import.meta.url)),
);
const circuit = locations.find((location) => location.id === "circuit");
const samples = samplePath(resolvePath(circuit.path, true), 3, true);
const safety = createTrackSafety(circuit);

function segmentDistance([x, z], [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

test("authored catchments widen the selected side while opposite verges remain narrow", () => {
  assert.ok(circuit.runoffCatchments.length >= 4);
  for (const catchment of circuit.runoffCatchments) {
    const profile = createTrackSafety({
      ...circuit,
      safetyZones: [],
      runoffCatchments: [catchment],
    });
    const widths = samples.map((sample) => profile(sample, catchment.side).width);
    assert.ok(Math.max(...widths) > 25, catchment.id);
    assert.ok(Math.max(...widths) < 250, `${catchment.id} has an unstable boundary`);
    assert.ok(samples.every((sample) => profile(sample, -catchment.side).width === circuit.runoff));
  }
});

test("runoff follows the authored outer edge instead of a symmetric width pulse", () => {
  const track = {
    width: 10,
    runoff: 3,
    closed: true,
    path: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    runoffCatchments: [
      {
        id: "fan",
        from: [20, 0],
        to: [80, 0],
        side: -1,
        boundary: [
          [30, -30],
          [65, -60],
        ],
        color: "#00678C",
      },
    ],
  };
  const profile = createTrackSafety(track);
  const sample = { x: 50, z: 0, dirX: 1, dirZ: 0, distance: 50, segment: 0 };
  const expectedEdge = 30 + (20 * 30) / 35;
  assert.ok(Math.abs(profile(sample, -1).width - (expectedEdge - 5)) < 1e-6);
  assert.equal(profile(sample, 1).width, 3);
  assert.equal(profile({ ...sample, x: 10, distance: 10 }, -1).width, 3);
});

test("local protection remains continuous at the lap seam", () => {
  const first = samples[0];
  const wrapped = {
    ...first,
    distance: resolvePath(circuit.path, true).reduce((sum, segment) => sum + segment.length, 0),
  };
  assert.deepEqual(safety(first, -1), safety(wrapped, -1));
});

/** Points every few metres around an outline, so long straight edges are checked too. */
function edgePoints(polygon) {
  return polygon.flatMap(([ax, az], index) => {
    const [bx, bz] = polygon[(index + 1) % polygon.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 5));
    return Array.from({ length: steps }, (_, step) => [
      ax + ((bx - ax) * step) / steps,
      az + ((bz - az) * step) / steps,
    ]);
  });
}

/** The barrier line on one side of the circuit, as the map draws it. */
function barrierLine(side) {
  return samples.map((sample) => {
    const offset = safety(sample, side).barrier * side;
    return [sample.x - sample.dirZ * offset, sample.z + sample.dirX * offset];
  });
}

test("occupied buildings and spectator banks remain behind the circuit protection", () => {
  // The circuit runs clockwise, so its left-hand barrier is the outer one.
  // Banks follow these lines, so they're checked against the lines themselves.
  const outer = barrierLine(-1);
  const infield = barrierLine(1);
  for (const location of locations.filter((location) => location.type === "building")) {
    for (const part of location.parts ?? [location]) {
      for (const [x, z] of edgePoints(resolveOutline(part.footprint))) {
        assert.ok(
          signedDistance(x, z, outer) > 2 || signedDistance(x, z, infield) < -2,
          `${location.id} encroaches on protection at ${x}, ${z}`,
        );
      }
    }
  }
});

test("crossing decks clear racing surfaces and ramps meet the ground", () => {
  // A sloping surface catches profiles that add height without levelling the deck.
  const surface = { heightAt: (x, z) => x * 0.003 + z * 0.008 };
  for (const road of locations.filter((location) => location.bridge)) {
    const crossing = createCrossing(road, surface);
    const roadSamples = samplePath(resolvePath(road.path, false), 2, false);
    assert.ok(crossing.structure.children.length <= 3, "bridge structure is batched by material");
    let crossings = 0;
    for (const sample of roadSamples) {
      if (sample.distance <= road.bridge.start || sample.distance >= road.bridge.end) {
        assert.equal(
          crossing.heightAt(sample.x, sample.z, sample.distance),
          surface.heightAt(sample.x, sample.z),
        );
      }
      for (const track of locations.filter(
        (location) => location.type === "track" && location.id !== "karting-track",
      )) {
        const trackSamples = samplePath(
          resolvePath(track.path, track.closed ?? false),
          3,
          track.closed ?? false,
        );
        const onTrack = trackSamples.some(
          (point) => Math.hypot(point.x - sample.x, point.z - sample.z) < track.width / 2 + 2,
        );
        if (onTrack) {
          crossings += 1;
          assert.ok(
            crossing.heightAt(sample.x, sample.z, sample.distance) -
              surface.heightAt(sample.x, sample.z) >
              7,
            `${road.id} has insufficient visible clearance`,
          );
        }
      }
    }
    assert.ok(crossings > 0, `${road.id} must cross a racing surface`);
  }
});

test("bridge spans avoid grandstands and other occupied footprints", () => {
  for (const road of locations.filter((location) => location.bridge)) {
    for (const sample of samplePath(resolvePath(road.path, false), 3, false)) {
      for (const building of locations.filter((location) => location.type === "building")) {
        for (const part of building.parts ?? [building]) {
          assert.ok(
            signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > road.width / 2 + 1,
            `${road.id} intersects ${building.id}`,
          );
        }
      }
    }
  }
});

test("paddock aisles leave team structures and covered loading bays clear", () => {
  const road = locations.find((location) => location.id === "paddock-service-aisles");
  const support = locations.find((location) => location.id === "team-support-rows");
  for (const path of [road.path, ...road.branches]) {
    for (const sample of samplePath(resolvePath(path, false), 2, false)) {
      for (const part of support.parts) {
        assert.ok(
          signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > road.width / 2,
          "paddock circulation intersects a team structure",
        );
      }
    }
  }
});

test("new working compounds stay behind the circuit protective boundary", () => {
  for (const id of ["academy-handling-ground", "automotive-demonstration-court"]) {
    const location = locations.find((location) => location.id === id);
    const polygon = resolveOutline(location.footprint);
    const [cx, cz] = centreOf(polygon);
    for (const sample of samples) {
      const side = (cx - sample.x) * -sample.dirZ + (cz - sample.z) * sample.dirX > 0 ? 1 : -1;
      assert.ok(
        signedDistance(sample.x, sample.z, polygon) > safety(sample, side).barrier,
        `${id} encroaches on circuit protection`,
      );
    }
  }
});

test("academy and automotive facilities occupy external campuses", () => {
  const outline = resolveOutline(circuit.path);
  for (const location of locations.filter((location) => location.category === "academy")) {
    const points =
      location.footprint ?? location.parts?.flatMap((part) => part.footprint) ?? location.path;
    for (const [x, z] of points)
      assert.ok(signedDistance(x, z, outline) > 0, `${location.id} remains infield`);
  }
});

test("campus entrances meet the ring road", () => {
  const ring = locations.find((location) => location.id === "ring-road");
  const roadSamples = samplePath(resolvePath(ring.path, true), 2, true);
  for (const id of ["academy-campus-road", "automotive-campus-road"]) {
    const [x, z] = locations.find((location) => location.id === id).path[0];
    assert.ok(
      roadSamples.some((point) => Math.hypot(point.x - x, point.z - z) < 2),
      id,
    );
  }
});

test("station fan walk avoids the automotive compounds", () => {
  const walk = locations.find((location) => location.id === "fan-walk");
  const obstacles = locations.filter(
    (location) =>
      location.category === "academy" && (location.type === "building" || location.type === "area"),
  );
  for (const sample of samplePath(resolvePath(walk.path, false), 3, false)) {
    for (const obstacle of obstacles) {
      for (const part of obstacle.parts ?? [obstacle]) {
        assert.ok(
          signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > walk.width / 2,
          `fan walk intersects ${obstacle.id}`,
        );
      }
    }
  }
});

test("academy circulation avoids cutting through the skid pan", () => {
  const road = locations.find((location) => location.id === "academy-campus-road");
  const pan = resolveOutline(locations.find((location) => location.id === "skid-pan").footprint);
  for (const path of [road.path, ...road.branches]) {
    const samples = samplePath(resolvePath(path, false), 2, false);
    const end = samples.at(-1);
    for (const sample of samples) {
      // Allow the final few metres of a designated entry to meet the pan edge.
      if (signedDistance(end.x, end.z, pan) <= 1 && end.distance - sample.distance < 6) continue;
      assert.ok(
        signedDistance(sample.x, sample.z, pan) > road.width / 2,
        "campus circulation cuts through the training surface",
      );
    }
  }
});

test("external response route stays clear of occupied footprints", () => {
  const road = locations.find((location) => location.id === "circuit-response-road");
  for (const path of [road.path, ...road.branches]) {
    for (const sample of samplePath(resolvePath(path, false), 3, false)) {
      for (const building of locations.filter((location) => location.type === "building")) {
        for (const part of building.parts ?? [building]) {
          assert.ok(
            signedDistance(sample.x, sample.z, resolveOutline(part.footprint)) > road.width / 2,
            `response road intersects ${building.id}`,
          );
        }
      }
    }
  }
});

test("roads meet the main circuit only through the visible elevated crossings", () => {
  for (const road of locations.filter((location) => location.type === "road")) {
    const paths = [
      ...(road.bridge ? [] : [{ path: road.path, closed: road.closed ?? false }]),
      ...(road.branches ?? []).map((path) => ({ path, closed: false })),
    ];
    for (const { path, closed } of paths) {
      for (const sample of samplePath(resolvePath(path, closed), 3, closed)) {
        const separation = Math.min(
          ...samples.map((track) => Math.hypot(track.x - sample.x, track.z - sample.z)),
        );
        assert.ok(
          separation > (circuit.width + road.width) / 2,
          `${road.id} crosses the racing surface at grade`,
        );
      }
    }
  }
});

test("pit entry and exit join in the direction of racing travel", () => {
  const pit = locations.find((location) => location.id === "pit-lane");
  const pitSamples = samplePath(resolvePath(pit.path, false), 2, false);
  for (const point of [pitSamples[0], pitSamples.at(-1)]) {
    const nearest = samples.reduce((best, track) =>
      Math.hypot(track.x - point.x, track.z - point.z) <
      Math.hypot(best.x - point.x, best.z - point.z)
        ? track
        : best,
    );
    assert.ok(Math.hypot(nearest.x - point.x, nearest.z - point.z) < 2);
    assert.ok(
      nearest.dirX * point.dirX + nearest.dirZ * point.dirZ > 0.98,
      "pit connection has an abrupt direction change",
    );
  }
});

const outlinesOf = (location) =>
  (location.parts ?? [location]).map((part) => resolveOutline(part.footprint));

test("karting garages sit beside the track and keep their access", () => {
  const garages = locations.find((location) => location.id === "karting-garages");
  const apron = resolveOutline(
    locations.find((location) => location.id === "karting-pit-apron").footprint,
  );
  const clubhouse = resolveOutline(
    locations.find((location) => location.id === "karting-clubhouse").footprint,
  );
  const kart = locations.find((location) => location.id === "karting-track");
  const kartSamples = samplePath(resolvePath(kart.path, true), 3, true);
  for (const outline of outlinesOf(garages)) {
    for (const [x, z] of outline) {
      assert.ok(signedDistance(x, z, clubhouse) > 0, "garages overlap the clubhouse");
    }
    const nearest = Math.min(...outline.map(([x, z]) => signedDistance(x, z, apron)));
    assert.ok(nearest < 3, "garage doors do not open onto the pit apron");
  }
  for (const sample of kartSamples) {
    for (const outline of outlinesOf(garages)) {
      assert.ok(signedDistance(sample.x, sample.z, outline) > kart.width / 2 + kart.runoff);
    }
  }
});

test("Grandstand Fan Walk runs from the arch to behind both main stands", () => {
  const walk = locations.find((location) => location.id === "grandstand-fan-walk");
  const arch = outlinesOf(locations.find((location) => location.id === "gateway-arch")).flat();
  const [plazaAxis, concourse] = walk.branches;
  assert.ok(Math.abs(plazaAxis[0][0] - Math.max(...arch.map(([x]) => x))) < 8);
  for (const id of ["grandstand-a", "grandstand-b"]) {
    const stand = locations.find((location) => location.id === id);
    const zs = outlinesOf(stand)
      .flat()
      .map(([, z]) => z);
    assert.ok(concourse[0][1] <= Math.min(...zs) && concourse[1][1] >= Math.max(...zs), id);
  }
  for (const path of [walk.path, ...walk.branches]) {
    for (const sample of samplePath(resolvePath(path, false), 3, false)) {
      // The walk deliberately starts at the arch, so only other buildings count.
      const obstacles = locations.filter(
        (location) => location.type === "building" && location.id !== "gateway-arch",
      );
      for (const building of obstacles) {
        for (const outline of outlinesOf(building)) {
          assert.ok(
            signedDistance(sample.x, sample.z, outline) > walk.width / 2,
            `fan walk intersects ${building.id}`,
          );
        }
      }
    }
  }
});

test("Expo Centre is near stadium scale and clear of the lakefront and road", () => {
  const expo = locations.find((location) => location.id === "expo-centre");
  const outlines = outlinesOf(expo);
  const area = outlines.slice(0, 4).reduce((total, outline) => {
    const xs = outline.map(([x]) => x);
    const zs = outline.map(([, z]) => z);
    return total + (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  }, 0);
  assert.ok(area >= 40_000, `halls cover only ${area} square metres`);
  for (const id of ["promenade", "waterfront-drive"]) {
    const road = locations.find((location) => location.id === id);
    for (const sample of samplePath(
      resolvePath(road.path, road.closed ?? false),
      4,
      road.closed ?? false,
    )) {
      for (const outline of outlines) {
        assert.ok(signedDistance(sample.x, sample.z, outline) > road.width / 2, id);
      }
    }
  }
  const yard = resolveOutline(
    locations.find((location) => location.id === "expo-loading-yard").footprint,
  );
  const drive = locations.find((location) => location.id === "waterfront-drive");
  const touchesDrive = samplePath(resolvePath(drive.path, false), 4, false).some(
    (sample) => signedDistance(sample.x, sample.z, yard) < drive.width / 2 + 3,
  );
  assert.ok(touchesDrive, "loading yard has no road access");
});

test("every car park has an access spine from the ring road through its middle", () => {
  const ring = locations.find((location) => location.id === "ring-road");
  const parks = locations.filter((location) => isCarPark(location));
  assert.equal(parks.length, 8);
  const roadPoints = locations
    .filter((location) => location.type === "road" && location.width >= 10)
    .flatMap((road) => samplePath(resolvePath(road.path, road.closed ?? false), 6, road.closed));
  for (const park of parks) {
    const outline = resolveOutline(park.footprint);
    const spine = ring.branches.find(
      (branch) => signedDistance(branch[1][0], branch[1][1], outline) < 0,
    );
    assert.ok(spine, `${park.id} has no access spine`);
    assert.ok(
      roadPoints.some(({ x, z }) => Math.hypot(x - spine[0][0], z - spine[0][1]) < 6),
      `${park.id}'s spine doesn't start on a road`,
    );
    const blocks = parkingBlocks(park);
    assert.ok(blocks.length >= 4, park.id);
    for (const { x, z } of blocks.flatMap(stallsOf)) {
      assert.ok(signedDistance(x, z, outline) < -8, `${park.id} has a stall at its edge`);
      assert.ok(
        Math.abs(segmentDistance([x, z], spine[0], spine[1])) > ring.width / 2 + 0.5,
        `${park.id} has a stall on its spine`,
      );
    }
  }
});

test("gates are clear of every road and building", () => {
  const halfWide = 12;
  const halfDeep = 2;
  const ribbons = locations.filter(
    (location) => (location.type === "road" || location.type === "track") && !location.bridge,
  );
  for (const gate of locations.filter((location) => location.type === "gate")) {
    const sideways = gate.facing === "east" || gate.facing === "west";
    const [x, z] = gate.position;
    const halfX = sideways ? halfDeep : halfWide;
    const halfZ = sideways ? halfWide : halfDeep;
    const outline = [
      [x - halfX, z - halfZ],
      [x + halfX, z - halfZ],
      [x + halfX, z + halfZ],
      [x - halfX, z + halfZ],
    ];
    for (const ribbon of ribbons) {
      for (const path of [ribbon.path, ...(ribbon.branches ?? [])]) {
        const closed = path === ribbon.path && (ribbon.closed ?? false);
        for (const sample of samplePath(resolvePath(path, closed), 2, closed)) {
          assert.ok(
            signedDistance(sample.x, sample.z, outline) > ribbon.width / 2,
            `${gate.id} stands on ${ribbon.id}`,
          );
        }
      }
    }
    for (const building of locations.filter((location) => location.type === "building")) {
      for (const part of building.parts ?? [building]) {
        for (const [cornerX, cornerZ] of outline) {
          assert.ok(
            signedDistance(cornerX, cornerZ, resolveOutline(part.footprint)) > 0,
            `${gate.id} overlaps ${building.id}`,
          );
        }
      }
    }
  }
});

test("residential, retail and research streets start on the ring road", () => {
  const ring = locations.find((location) => location.id === "ring-road");
  const ringSamples = samplePath(resolvePath(ring.path, true), 2, true);
  for (const id of [
    "residences-east-street",
    "residences-south-street",
    "retail-street",
    "research-park-street",
  ]) {
    const [x, z] = locations.find((location) => location.id === id).path[0];
    assert.ok(
      ringSamples.some((point) => Math.hypot(point.x - x, point.z - z) < ring.width / 2),
      id,
    );
  }
});

test("lake features stand in the water, and the lake stays inside its promenade", () => {
  const lake = resolveOutline(locations.find((location) => location.id === "lake").footprint);
  for (const id of ["lake-fountain", "fireworks-barge"]) {
    for (const outline of outlinesOf(locations.find((location) => location.id === id))) {
      for (const [x, z] of outline) assert.ok(signedDistance(x, z, lake) < -10, id);
    }
  }
  const jettyHead = outlinesOf(locations.find((location) => location.id === "paddle-boats"))[2];
  for (const [x, z] of jettyHead) assert.ok(signedDistance(x, z, lake) < 0, "jetty head");
  const promenade = locations.find((location) => location.id === "promenade");
  for (const sample of samplePath(resolvePath(promenade.path, true), 4, true)) {
    assert.ok(signedDistance(sample.x, sample.z, lake) > promenade.width / 2, "promenade");
  }
});

test("the checkpoint's hut stands beside the Infield Road before its ramp", () => {
  const road = locations.find((location) => location.id === "infield-road");
  const hut = outlinesOf(locations.find((location) => location.id === "infield-checkpoint")).flat();
  const [startX, startZ] = road.path[0];
  for (const [x, z] of hut) {
    assert.ok(Math.abs(x - startX) > road.width / 2, "hut stands on the road");
    assert.ok(Math.abs(x - startX) < road.width / 2 + 10, "hut is away from the road");
    assert.ok(Math.abs(z - startZ) < road.bridge.start, "hut is past the start of the ramp");
  }
});

test("residents' pools and courts sit beside their residences", () => {
  for (const side of ["east", "south"]) {
    const homes = outlinesOf(
      locations.find((location) => location.id === `trackside-residences-${side}`),
    ).flat();
    for (const id of [`tennis-courts-${side}`, `swimming-pool-${side}`]) {
      const [x, z] = centreOf(resolveOutline(locations.find((l) => l.id === id).footprint));
      const nearest = Math.min(...homes.map(([hx, hz]) => Math.hypot(hx - x, hz - z)));
      assert.ok(nearest < 120, `${id} is ${nearest.toFixed(0)} m from the nearest home`);
    }
  }
});
