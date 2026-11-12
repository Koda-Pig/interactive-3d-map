// Run with pnpm dev serving on 127.0.0.1:5173. Screenshots stay outside the kit.

import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const { locations } = JSON.parse(await readFile("src/data/locations.json", "utf8"));

const output = process.env.MAP_REVIEW_DIR || "/tmp/bmr-map-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  await page.locator(".sidebar__item").first().waitFor({ state: "attached" });
  await page.waitForTimeout(3000);
  for (const mode of ["Whole site", "Race weekend", "Conference day"]) {
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${output}/${mode}-overview.png` });
    for (const name of [
      "Pit / Conference Building",
      "Grandstand A",
      "Expo Centre",
      "Waterfront Hotel",
      "Retail Quarter",
      "Gateway Arch",
      "Promenade Hotel",
      "Karting Garages",
      "Team support rows",
      "Driving Academy",
      "Automotive Hub",
      "Trackside Residences East",
      "Trackside Residences South",
    ]) {
      const location = locations.find((location) => location.name === name);
      if (!location) throw Error(`Unknown review location: ${name}`);
      await page.goto(`http://127.0.0.1:5173/?location=${location.id}`);
      await page.locator(".sidebar__item").first().waitFor({ state: "attached" });
      await page.getByRole("button", { name: mode, exact: true }).click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${output}/${mode}-${name.replaceAll("/", "-")}.png` });
    }
    console.log(`Captured ${mode}`);
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(`Reviewed all three modes without browser errors. Screenshots: ${output}`);
} finally {
  await browser.close();
}
