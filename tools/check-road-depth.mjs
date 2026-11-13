// Render road coverage into a stencil-enabled target. Additive colour exposes
// overlapping fragments, even when their asphalt colours happen to match.
// Run with node tools/check-road-depth.mjs. PERF_BROWSER overrides Chrome's path.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 0 }, logLevel: "error" });
await server.listen();
let browser;
try {
  browser = await chromium.launch({
    executablePath:
      process.env.PERF_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(`http://localhost:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__map && !document.querySelector("#loading"));
  const results = await page.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js");
    const { renderer, scene } = window.__map;
    renderer.setAnimationLoop(null);
    const target = new T.WebGLRenderTarget(512, 512, { stencilBuffer: true });
    const pixels = new Uint8Array(512 * 512 * 4);
    const results = [];
    for (const object of scene.getObjectByName("site").children) {
      if (object.userData.location.type !== "road") continue;
      const road = object.children.find((child) => child.isMesh);
      const bounds = new T.Box3().setFromBufferAttribute(road.geometry.getAttribute("position"));
      const center = bounds.getCenter(new T.Vector3());
      const extent = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) / 2 + 10;
      const camera = new T.OrthographicCamera(-extent, extent, extent, -extent, 1, 10000);
      camera.position.set(center.x, 5000, center.z);
      camera.up.set(0, 0, -1);
      camera.lookAt(center);
      const material = new T.ShaderMaterial({
        vertexShader:
          "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: "void main(){gl_FragColor=vec4(0.125,0.,0.,1.);}",
        transparent: true,
        blending: T.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        stencilRef: road.material.stencilRef,
        stencilFunc: road.material.stencilFunc,
        stencilZPass: road.material.stencilZPass,
      });
      const testScene = new T.Scene();
      testScene.add(new T.Mesh(road.geometry, material));
      const sample = (stencil) => {
        material.stencilWrite = stencil;
        renderer.setRenderTarget(target);
        renderer.setClearColor(0, 1);
        renderer.clear();
        renderer.render(testScene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, 512, 512, pixels);
        let doubled = 0;
        let covered = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 0) covered++;
          if (pixels[i] > 33) doubled++;
        }
        return { doubled, covered };
      };
      results.push({
        id: object.name,
        stencilEnabled: road.material.stencilWrite,
        before: sample(false),
        after: sample(true),
      });
      material.dispose();
    }
    renderer.setRenderTarget(null);
    target.dispose();
    return {
      stencilBits: renderer.getContext().getParameter(renderer.getContext().STENCIL_BITS),
      roads: results,
    };
  });
  assert.ok(results.stencilBits > 0, "The map renderer needs a stencil buffer");
  assert.ok(
    results.roads.some((road) => road.before.doubled > 0),
    "The control must reproduce overlapping road fragments",
  );
  for (const road of results.roads) {
    assert.ok(road.stencilEnabled, `${road.id}: road coverage is disabled`);
    assert.equal(road.after.doubled, 0, `${road.id}: junction fragments compete`);
    assert.equal(road.after.covered, road.before.covered, `${road.id}: road coverage changed`);
  }
  console.log(
    `${results.roads.length} roads retain their coverage with zero competing junction fragments.`,
  );
} finally {
  await browser?.close();
  await server.close();
}
