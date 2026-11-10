// Run with pnpm dev serving on 127.0.0.1:5173. Screenshots stay outside the kit.

import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const output = process.env.MAP_REVIEW_DIR || "/tmp/bmr-map-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  await page.locator(".sidebar__item").first().waitFor();
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
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${output}/${mode}-${name.replaceAll("/", "-")}.png` });
    }
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(`Reviewed all three modes without browser errors. Screenshots: ${output}`);
} finally {
  await browser.close();
}
