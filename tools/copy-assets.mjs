#!/usr/bin/env node
import { cp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export async function copyAssets(destination) {
  if (!destination) throw new Error("Usage: bmr-map-copy-assets <public-directory>");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const target = resolve(destination, "maps", "bmr", pkg.version);
  await rm(target, { force: true, recursive: true });
  await mkdir(target, { recursive: true });
  await cp(new URL("../dist/assets/", import.meta.url), target, { recursive: true });
  return target;
}
if (process.argv[1] && (await realpath(process.argv[1])) === fileURLToPath(import.meta.url)) {
  console.log(await copyAssets(process.argv[2]));
}
