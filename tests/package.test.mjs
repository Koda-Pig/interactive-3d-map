import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("packed entries import without browser globals", async () => {
  assert.equal(typeof (await import("../dist/index.js")).mountMap, "function");
  assert.equal(typeof (await import("../dist/react/index.js")).BmrMap, "function");
});
test("the asset copy contract uses the package version", async () => {
  const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  assert.deepEqual(
    JSON.parse(await readFile(new URL("../dist/assets/version.json", import.meta.url))),
    { version },
  );
  const layout = JSON.parse(await readFile(new URL("../src/data/locations.json", import.meta.url)));
  for (const location of layout.locations) {
    if (location.image) await access(new URL(`../dist/assets/${location.image}`, import.meta.url));
    for (const model of [location.model, ...(location.parts ?? []).map((part) => part.model)]) {
      if (!model) continue;
      await access(new URL(`../dist/assets/models/${model.file}`, import.meta.url));
      if (model.endCap)
        await access(new URL(`../dist/assets/models/${model.endCap}`, import.meta.url));
    }
  }
});

test("copying assets removes stale files within the package version", async () => {
  const destination = await mkdtemp(join(tmpdir(), "bmr-map-assets-"));
  try {
    const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
    const versionDirectory = join(destination, "maps", "bmr", version);
    await mkdir(versionDirectory, { recursive: true });
    const stale = join(versionDirectory, "stale.txt");
    await writeFile(stale, "old package contents");
    const { copyAssets } = await import("../tools/copy-assets.mjs");
    assert.equal(await copyAssets(destination), versionDirectory);
    await assert.rejects(access(stale));
    assert.deepEqual(JSON.parse(await readFile(join(versionDirectory, "version.json"))), {
      version,
    });
  } finally {
    await rm(destination, { force: true, recursive: true });
  }
});
