import { execFileSync } from "node:child_process";
import { access, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
execFileSync(process.execPath, ["tools/check-layout.mjs"], { stdio: "inherit" });
// Every literal scenery/model dependency must exist, including files outside the layout JSON.
for (const file of await readdir("src", { recursive: true })) {
  if (!file.endsWith(".ts")) continue;
  const source = await readFile(`src/${file}`, "utf8");
  for (const match of source.matchAll(/["']((?:[\w-]+\/)+[\w-]+\.glb)["']/g))
    await access(`public/models/${match[1]}`);
}
await build({
  configFile: false,
  publicDir: false,
  build: {
    minify: true,
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: {
        index: "src/map/index.ts",
        "react/index": "src/react/index.ts",
        style: "src/map/styles.ts",
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "style",
    },
    rolldownOptions: { external: ["react", "react/jsx-runtime"] },
  },
});
await rm("dist/style.js", { force: true });
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.package.json"], {
  stdio: "inherit",
});
const browserTypes = await readFile("dist/types/map/index.d.ts", "utf8");
const mountTypes = await readFile("dist/types/map/mount.d.ts", "utf8");
const mountDeclaration = mountTypes.replace(/^import type .*\n/, "");
await writeFile(
  "dist/index.d.ts",
  browserTypes.replace('export { mountMap } from "./mount.ts";', mountDeclaration),
);
const reactTypes = await readFile("dist/types/react/bmr-map.d.ts", "utf8");
await mkdir("dist/react", { recursive: true });
await writeFile(
  "dist/react/index.d.ts",
  reactTypes.replace('from "../map/index.ts"', 'from "../index.js"'),
);
await rm("dist/types", { recursive: true });
await mkdir("dist/assets", { recursive: true });
for (const directory of ["models", "images"]) {
  await access(`public/${directory}`);
  await cp(`public/${directory}`, `dist/assets/${directory}`, { recursive: true });
}
const pkg = JSON.parse(await readFile("package.json", "utf8"));
await writeFile("dist/assets/version.json", `${JSON.stringify({ version: pkg.version })}\n`);

await cp("node_modules/three/LICENSE", "dist/THREE-LICENSE.txt");
await cp("node_modules/@fontsource/roboto/LICENSE", "dist/ROBOTO-LICENSE.txt");

await cp("public/map-preview.png", "dist/assets/map-preview.png");
const adapter = await readFile("dist/react/index.js", "utf8");
await writeFile("dist/react/index.js", `"use client";\n${adapter}`);
