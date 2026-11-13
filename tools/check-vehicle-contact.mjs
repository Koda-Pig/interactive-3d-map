import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  await page.goto(`http://localhost:${server.httpServer.address().port}`);
  await page.waitForFunction(() => window.__map && !document.querySelector("#loading"), null, {
    timeout: 120000,
  });
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { createGround } = await import("/src/terrain/ground.ts");
    const { createRibbon } = await import("/src/draw/ribbons.ts");
    const { layout } = await import("/src/layout/locations.ts");
    const { routeOf } = await import("/src/layout/route.ts");
    const { Traffic } = await import("/src/draw/traffic.ts");
    const { circuitRace } = await import("/src/layout/race.ts");
    const race = circuitRace();
    const { surface } = createGround(1, 64);
    const track = createRibbon(
      layout.locations.find((l) => l.id === "circuit"),
      surface,
    ).children[0];
    track.updateMatrixWorld(true);
    const geometry = window.__map.scene.getObjectByName("race-traffic").geometry;
    const traffic = new Traffic(geometry, geometry, geometry, surface);
    traffic.setMode("race");
    // The first car is where the race's clock says, so holding the clock places it by distance.
    traffic.raceClock.held = true;
    const placeAt = (distance) => {
      traffic.raceClock.seconds = race.timeAt(distance);
      traffic.update(0);
    };
    traffic.update(0);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 100, 0), new THREE.Vector3(0, -1, 0));
    const matrix = new THREE.Matrix4();
    const world = new THREE.Vector3();
    const p = geometry.getAttribute("position");
    const contacts = [];
    const keys = new Set();
    for (let i = 0; i < p.count; i++)
      if (p.getY(i) < 0.0001) {
        const v = [p.getX(i), p.getY(i), p.getZ(i)];
        const key = v.join();
        if (!keys.has(key)) {
          keys.add(key);
          contacts.push(v);
        }
      }
    let min = Infinity,
      max = -Infinity,
      minAt,
      maxAt;
    const route = routeOf("circuit");
    let low = Infinity,
      high = -Infinity;
    for (let distance = 0; distance < route.length; distance += 0.5) {
      placeAt(distance);
      traffic.raceCars.getMatrixAt(0, matrix);
      low = Math.min(low, matrix.elements[13]);
      high = Math.max(high, matrix.elements[13]);
      for (const c of contacts) {
        world.fromArray(c).applyMatrix4(matrix);
        ray.ray.origin.set(world.x, 100, world.z);
        const hit = ray.intersectObject(track, false)[0];
        if (!hit) throw Error("Tyre outside track");
        const gap = world.y - hit.point.y;
        if (gap < min) {
          min = gap;
          minAt = { distance, position: world.toArray() };
        }
        if (gap > max) {
          max = gap;
          maxAt = { distance, position: world.toArray() };
        }
      }
    }
    window.contactReview = { traffic, placeAt, track, surface, minAt, maxAt };
    return {
      samples: Math.ceil(route.length / 0.5),
      contacts: contacts.length,
      min,
      max,
      minAt,
      maxAt,
      elevation: [low, high],
    };
  });
  assert(result.min >= -0.001, "Tyres penetrate the rendered track");
  assert(result.max < 0.06, "Rigid tyre plane lifts more than 6 cm across a track crease");
  console.log(JSON.stringify(result, null, 2));
  await writeFile("/tmp/car-contact.json", JSON.stringify(result, null, 2));
  for (const distance of [160, 182, result.maxAt.distance, 0]) {
    await page.evaluate(async (distance) => {
      const { Vector3 } = await import("/node_modules/three/build/three.module.js");
      const { traffic, placeAt } = window.contactReview;
      placeAt(distance);
      const { scene, camera, controls, renderer } = window.__map;
      const car = scene.getObjectByName("race-traffic");
      car.count = 1;
      car.visible = true;
      car.instanceMatrix.array.set(traffic.raceCars.instanceMatrix.array);
      car.instanceMatrix.needsUpdate = true;
      car.parent.visible = true;
      const a = car.instanceMatrix.array;
      const p = new Vector3(a[12], a[13], a[14]);
      controls.minDistance = 1;
      controls.target.copy(p);
      camera.position.copy(p).add(new Vector3(9, 5, 10));
      controls.update();
      renderer.render(scene, camera);
    }, distance);
    await page.screenshot({ path: `/tmp/car-contact-${distance}.png` });
  }
} finally {
  await browser.close();
  await server.close();
}
