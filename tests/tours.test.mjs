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
