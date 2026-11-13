import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const manifest = JSON.parse(
  await readFile(new URL("../dist/assets/version.json", import.meta.url), "utf8"),
);
assert.equal(manifest.version, pkg.version, "Run pnpm build:package after changing the version");
for (const file of [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/react/index.js",
  "dist/react/index.d.ts",
  "dist/style.css",
  "dist/assets/map-preview.png",
  "dist/THREE-LICENSE.txt",
  "dist/ROBOTO-LICENSE.txt",
])
  await access(new URL(`../${file}`, import.meta.url));
assert.match(
  await readFile(new URL("../dist/react/index.js", import.meta.url), "utf8"),
  /^"use client";/,
);
console.log(`Verified ${pkg.name}@${pkg.version}`);
