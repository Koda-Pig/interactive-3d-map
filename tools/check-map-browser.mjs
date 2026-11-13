import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  server: { port: 0 },
  logLevel: "error",
  plugins: [
    {
      name: "map-test-fixture",
      configureServer(server) {
        server.middlewares.use("/__map_test", (_request, response) => {
          response.setHeader("Content-Type", "text/html");
          response.end("<!doctype html><html><head></head><body></body></html>");
        });
        // Exercise a non-root asset base while Vite continues to serve the source public directory.
        server.middlewares.use("/package-assets", (_request, _response, next) => next());
      },
    },
  ],
});
await server.listen();
const macChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.PERF_BROWSER ||
  (process.platform === "darwin" && existsSync(macChrome) ? macChrome : undefined);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const errors = [];
const failedRequests = [];
const assetResponses = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  page.on("response", (response) => {
    if (response.url().includes("/package-assets/")) {
      assetResponses.push({ status: response.status(), url: response.url() });
    }
  });
  await page.goto(`http://localhost:${server.httpServer.address().port}/__map_test`);
  await page.evaluate(async () => {
    await import("/src/style.css");
    const { mountMap } = await import("/src/map/index.ts");
    document.body.innerHTML =
      '<div style="height:120px"><p class="notice" id="outside">Host content</p></div><div id="one" style="height:360px;width:760px"></div><div id="two" style="height:360px;width:375px"></div>';
    const changes = [];
    const first = mountMap(document.querySelector("#one"), {
      assetBaseUrl: "/package-assets/",
      variant: "section",
      onLocationChange: (id) => changes.push(id),
    });
    const second = mountMap(document.querySelector("#two"), {
      assetBaseUrl: "/package-assets/",
      variant: "page",
      initialLocationId: "lake",
    });
    window.testMaps = { first, second, changes };
    await Promise.all([first.ready, second.ready]);
  });
  assert.equal(await page.locator("#one canvas").count(), 1);
  assert.equal(await page.locator("#two canvas").count(), 1);
  assert.equal(
    await page.locator("#outside").evaluate((element) => getComputedStyle(element).position),
    "static",
  );
  assert.ok(assetResponses.some(({ url }) => url.includes("/package-assets/models/")));
  assert.ok(assetResponses.some(({ url }) => url.includes("/package-assets/images/")));
  assert.deepEqual(
    assetResponses.filter(({ status }) => status >= 400),
    [],
  );
  assert.equal(
    await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
      return ids.length === new Set(ids).size;
    }),
    true,
  );
  await page.evaluate(() => {
    window.testMaps.first.selectLocation("lake");
    window.testMaps.first.selectLocation("missing");
  });
  assert.deepEqual(await page.evaluate(() => window.testMaps.changes), []);
  assert.equal(new URL(page.url()).search, "");
  const pausedFrames = await page.evaluate(async () => {
    const { inspection } = await import("/src/map/inspection.ts");
    window.testMaps.second.setActive(false);
    return inspection.get(document.querySelector("#two")).renderer.info.render.frame;
  });
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(async () => {
      const { inspection } = await import("/src/map/inspection.ts");
      return inspection.get(document.querySelector("#two")).renderer.info.render.frame;
    }),
    pausedFrames,
  );
  await page.evaluate(() => window.testMaps.second.setActive(true));
  await page.locator("#one .map-engage").click();
  await page.locator("#one .map-leave").click();
  await page.evaluate(() => {
    window.testMaps.first.setActive(false);
    window.testMaps.first.destroy();
    window.testMaps.first.destroy();
    window.testMaps.second.selectLocation("grandstand-a");
  });
  assert.equal(await page.locator("#one canvas").count(), 0);
  assert.equal(await page.locator("#two canvas").count(), 1);
  assert.equal(await page.locator("#two .info-panel__name").textContent(), "Grandstand A");
  await mkdir("artifacts/shared-map", { recursive: true });
  await page.screenshot({ path: "artifacts/shared-map/two-instances.png" });
  await page.evaluate(async () => {
    window.testMaps.second.destroy();
    const { mountMap } = await import("/src/map/index.ts");
    for (let i = 0; i < 3; i++) {
      const map = mountMap(document.querySelector("#one"), { assetBaseUrl: "/", variant: "page" });
      map.destroy();
      await map.ready;
    }
  });
  assert.equal(await page.locator("canvas").count(), 0);
  // React's development Strict Mode repeats setup and cleanup.
  await page.evaluate(async () => {
    const { mountStrict } = await import("/tests/react-fixture.mjs");
    window.unmountReact = mountStrict(document.querySelector("#one"));
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#one canvas") && !document.querySelector("#one [data-part=loading]"),
    null,
    { timeout: 120000 },
  );
  assert.equal(await page.locator("#one canvas").count(), 1);
  await page.evaluate(() => window.unmountReact());
  assert.equal(await page.locator("canvas").count(), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(async () => {
    const { mountMap } = await import("/src/map/index.ts");
    window.touringMap = mountMap(document.querySelector("#one"), {
      variant: "page",
      assetBaseUrl: "/",
    });
    await window.touringMap.ready;
  });
  await page.waitForFunction(() => !document.querySelector("#one .intro"));
  await page.getByRole("button", { name: "Race weekend", exact: true }).click();
  assert.equal(await page.locator("#one .route-legend").isVisible(), true);
  await page.getByRole("button", { name: "Conference day", exact: true }).click();
  assert.equal(await page.locator("#one .route-legend").isVisible(), false);
  await page.getByRole("button", { name: "Lap the circuit", exact: true }).click();
  await page.waitForTimeout(250);
  const cameraAtPause = await page.evaluate(async () => {
    const { inspection } = await import("/src/map/inspection.ts");
    window.touringMap.setActive(false);
    return inspection.get(document.querySelector("#one")).camera.position.toArray();
  });
  await page.waitForTimeout(500);
  assert.deepEqual(
    await page.evaluate(async () => {
      const { inspection } = await import("/src/map/inspection.ts");
      return inspection.get(document.querySelector("#one")).camera.position.toArray();
    }),
    cameraAtPause,
  );
  await page.evaluate(() => window.touringMap.setActive(true));
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.evaluate(() => window.touringMap.destroy());
  assert.equal(await page.locator("canvas").count(), 0);
  await page.evaluate(async () => {
    const { mountMap } = await import("/src/map/index.ts");
    const interrupted = mountMap(document.querySelector("#one"), {
      variant: "page",
      assetBaseUrl: "/",
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    interrupted.destroy();
    await interrupted.ready;
  });
  assert.equal(await page.locator("canvas").count(), 0);
  const failure = await page.evaluate(async () => {
    const { mountMap } = await import("/src/map/index.ts");
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl") ? null : original.call(this, kind, ...args);
    };
    const failed = mountMap(document.querySelector("#one"), { variant: "page", assetBaseUrl: "/" });
    let rejected = false;
    try {
      await failed.ready;
    } catch {
      rejected = true;
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
    const message = document.querySelector("#one .title__status").textContent;
    failed.destroy();
    return { rejected, message };
  });
  assert.equal(failure.rejected, true);
  assert.match(failure.message, /couldn't start/);
  assert.equal(await page.locator("canvas").count(), 0);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(errors, []);
  console.log("Browser lifecycle checks passed");
} finally {
  await browser.close();
  await server.close();
}
