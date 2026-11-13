import assert from "node:assert/strict";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { EventDispatcher, Vector3 } from "three";

const hooks = registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(
      url,
      url.endsWith(".json") ? { ...context, importAttributes: { type: "json" } } : context,
    );
    if (url.endsWith("/scene/tour.ts") || url.endsWith("/scene/flight.ts")) {
      return {
        ...loaded,
        format: "module",
        source: stripTypeScriptTypes(String(loaded.source), { mode: "transform" }),
      };
    }
    return loaded;
  },
});
const { CameraTour } = await import("../src/scene/tour.ts");
const { CameraFlight } = await import("../src/scene/flight.ts");
const { arrivalTour, lapTour } = await import("../src/scene/tours.ts");
const { pointAt } = await import("../src/layout/route.ts");
const { createCamera, homeView } = await import("../src/scene/view.ts");
hooks.deregister();

globalThis.window = { matchMedia: () => ({ matches: false }) };

function setup() {
  const camera = createCamera(1.5);
  const controls = Object.assign(new EventDispatcher(), { target: new Vector3() });
  const area = { left: 0, top: 0, right: 1200, bottom: 800, viewWidth: 1200, viewHeight: 800 };
  const flight = new CameraFlight(
    camera,
    controls,
    () => [area],
    () => area,
  );
  const tour = new CameraTour(camera, controls, flight, { heightAt: () => 0 }, () => {});
  return { camera, controls, flight, tour };
}

function beginRide(state, makePlan) {
  state.tour.start(makePlan(state.flight));
  state.flight.update(0);
  state.flight.update(10000);
  state.tour.update(10000);
}

function assertSamePose(actual, expected) {
  assert.ok(actual.controls.target.distanceTo(expected.controls.target) < 1e-6);
  assert.ok(actual.camera.position.distanceTo(expected.camera.position) < 1e-6);
}

for (const makePlan of [lapTour, arrivalTour]) {
  for (const multiplier of [0.25, 0.5, 1, 1.5, 2, 3, 4]) {
    test(`${makePlan.name} at ${multiplier}× follows the same route at the selected pace`, () => {
      const actual = setup();
      const expected = setup();
      actual.tour.setSpeed(multiplier);
      beginRide(actual, makePlan);
      beginRide(expected, makePlan);
      for (let frame = 1; frame <= 80; frame++) {
        actual.tour.update(10000 + frame * 20);
        expected.tour.update(10000 + frame * 20 * multiplier);
      }
      assertSamePose(actual, expected);
    });
  }
}

test("changing speed mid-ride keeps the camera in place and applies on the next frame", () => {
  const actual = setup();
  const expected = setup();
  beginRide(actual, lapTour);
  beginRide(expected, lapTour);
  for (let frame = 1; frame <= 50; frame++) {
    actual.tour.update(10000 + frame * 20);
    expected.tour.update(10000 + frame * 20);
  }
  actual.tour.setSpeed(2);
  assertSamePose(actual, expected);
  assert.equal(actual.tour.running, "lap");
  actual.tour.update(11020);
  expected.tour.update(11040);
  assertSamePose(actual, expected);
});

test("the selected speed survives stopping and switching tours", () => {
  const actual = setup();
  actual.tour.setSpeed(2);
  beginRide(actual, lapTour);
  actual.tour.stop();
  const expected = setup();
  // Start from the same camera pose after the interrupted tour.
  expected.camera.position.copy(actual.camera.position);
  expected.controls.target.copy(actual.controls.target);
  expected.tour.setSpeed(2);
  beginRide(actual, arrivalTour);
  beginRide(expected, arrivalTour);
  for (let frame = 1; frame <= 50; frame++) {
    actual.tour.update(10000 + frame * 20);
    expected.tour.update(10000 + frame * 20);
  }
  assertSamePose(actual, expected);
});

test("arrival starts on the highway just before the offramp and retains its walk", () => {
  const { flight } = setup();
  const plan = arrivalTour(flight);
  const start = pointAt(plan.route, plan.start);
  assert.ok(Math.abs(start.x + 1310) < 1);
  assert.ok(start.z >= 680 && start.z <= 760, `starts at z=${start.z}`);
  assert.equal(plan.start + plan.length, plan.route.length);
  assert.ok(Math.abs(plan.stages.at(-1).until - plan.length) < 1e-6);
  const park = pointAt(plan.route, plan.start + plan.stages[0].until);
  assert.ok(Math.hypot(park.x + 1120, park.z + 90) < 2);
});

for (const makePlan of [lapTour, arrivalTour]) {
  for (const phase of ["approach", "ride"]) {
    test(`stopping ${makePlan.name} during ${phase} returns to the home view`, () => {
      const { camera, controls, flight, tour } = setup();
      tour.start(makePlan(flight));
      if (phase === "ride") {
        flight.update(0);
        flight.update(10000);
        tour.update(10000);
        tour.update(10100);
      }
      tour.stop();
      assert.equal(tour.running, null);
      assert.equal(flight.flying, true);
      flight.update(11000);
      flight.update(21000);
      const home = homeView(camera.aspect);
      const expected = new Vector3().setFromSphericalCoords(home.radius, home.phi, home.theta);
      expected.add(home.target);
      assert.ok(controls.target.distanceTo(home.target) < 1e-6);
      assert.ok(camera.position.distanceTo(expected) < 1e-6);
    });
  }
}

for (const phase of ["approach", "ride"]) {
  test(`manual controls interrupt the ${phase} without starting a home flight`, () => {
    const { controls, flight, tour } = setup();
    tour.start(arrivalTour(flight));
    if (phase === "ride") {
      flight.update(0);
      flight.update(10000);
      tour.update(10000);
    }
    controls.dispatchEvent({ type: "start" });
    assert.equal(tour.running, null);
    assert.equal(flight.flying, false);
  });

  test(`another flight interrupts the ${phase} and retains its destination`, () => {
    const { controls, flight, tour } = setup();
    tour.start(arrivalTour(flight));
    if (phase === "ride") {
      flight.update(0);
      flight.update(10000);
      tour.update(10000);
    }
    const destination = new Vector3(100, 20, 300);
    flight.flyTo({ target: destination, radius: 500, phi: 1, theta: 0 });
    const leg = flight.currentLeg;
    tour.update(10100);
    assert.equal(tour.running, null);
    assert.equal(flight.currentLeg, leg);
    flight.update(11000);
    flight.update(21000);
    assert.ok(controls.target.distanceTo(destination) < 1e-6);
  });
}
