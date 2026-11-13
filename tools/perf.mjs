// Counts what the map draws in a fixed set of views, and times the main pass,
// so a change can be compared before and after. Run with `pnpm perf`.
//
// The counts (draw calls, triangles) are exact and repeatable. The times come
// from this machine's GPU in headless Chrome, so they only mean anything
// against another run on the same machine. They say nothing about a phone.
//
// Options: --out <file.json> saves the results, --compare <file.json> prints
// the change from an earlier run.
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 375, height: 812 },
};

/** Each view: a name, the address parameters, and whether to switch to race weekend. */
const VIEWS = [
  { name: "opening", query: "" },
  { name: "opening, race weekend", query: "", race: true },
  { name: "pit building", query: "location=pit-conference-building" },
  { name: "grandstand A", query: "location=grandstand-a" },
  { name: "lake", query: "location=lake" },
  { name: "car park", query: "location=car-park-1" },
];

const RUNS = [
  { tier: "high", viewport: "desktop" },
  { tier: "low", viewport: "phone" },
];

/** Frames timed per view. */
const FRAMES = 40;

const server = await createServer({ server: { port: 0 }, logLevel: "error" });
await server.listen();
const { port } = server.httpServer.address();

const browser = await chromium.launch({
  executablePath:
    process.env.PERF_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

const results = [];
try {
  for (const run of RUNS) {
    const page = await browser.newPage({
      viewport: VIEWPORTS[run.viewport],
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const view of VIEWS) {
      const query = [view.query, `quality=${run.tier}`].filter(Boolean).join("&");
      await page.goto(`http://localhost:${port}/?${query}`);
      await page.waitForFunction(
        () => window.__map && !document.querySelector("[data-part=loading]"),
        null,
        {
          timeout: 120000,
        },
      );
      if (view.race) {
        // At phone width the switch is a list to pick from, not a row of buttons.
        const button = page.getByRole("button", { name: "Race weekend" });
        if (await button.isVisible()) {
          await button.click();
        } else {
          await page.getByLabel("Site view").selectOption({ label: "Race weekend" });
        }
      }
      // Long enough for flights, fades and the shadow refit to finish.
      await page.waitForTimeout(2500);
      const measured = await page.evaluate((frames) => {
        const { renderer, scene, camera } = window.__map;
        const gl = renderer.getContext();
        const pixel = new Uint8Array(4);
        const finish = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        renderer.render(scene, camera);
        finish();
        const { calls, triangles } = renderer.info.render;
        const times = [];
        for (let frame = 0; frame < frames; frame += 1) {
          const start = performance.now();
          renderer.render(scene, camera);
          finish();
          times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        return {
          calls,
          triangles,
          medianMs: times[Math.floor(times.length / 2)],
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        };
      }, FRAMES);
      if (errors.length > 0) {
        throw new Error(`${view.name}: ${errors.join("\n")}`);
      }
      results.push({ run: `${run.tier} ${run.viewport}`, view: view.name, ...measured });
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const previous = option("--compare")
  ? JSON.parse(await readFile(option("--compare"), "utf8"))
  : null;
const change = (now, before) => {
  if (before === undefined) {
    return "";
  }
  const delta = now - before;
  const sign = delta > 0 ? "+" : "";
  return ` (${sign}${Number.isInteger(delta) ? delta : delta.toFixed(2)})`;
};

console.log("run            | view                   | draws      | triangles          | ms");
for (const row of results) {
  const before = previous?.find((other) => other.run === row.run && other.view === row.view);
  console.log(
    [
      row.run.padEnd(14),
      row.view.padEnd(22),
      `${row.calls}${change(row.calls, before?.calls)}`.padEnd(10),
      `${row.triangles}${change(row.triangles, before?.triangles)}`.padEnd(18),
      `${row.medianMs.toFixed(2)}${before ? change(row.medianMs, before.medianMs) : ""}`,
    ].join(" | "),
  );
}

if (option("--out")) {
  await writeFile(option("--out"), `${JSON.stringify(results, null, 2)}\n`);
}
