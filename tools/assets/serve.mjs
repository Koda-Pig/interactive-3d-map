import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
export function serve(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const rel =
          pathname === "/"
            ? "tools/assets/preview.html"
            : pathname.startsWith("/models/")
              ? `public${pathname}`
              : pathname.slice(1);
        const file = path.resolve(root, rel);
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        const data = await readFile(file);
        const types = {
          ".html": "text/html",
          ".mjs": "text/javascript",
          ".js": "text/javascript",
          ".json": "application/json",
          ".glb": "model/gltf-binary",
          ".png": "image/png",
        };
        res.writeHead(200, {
          "Content-Type": types[path.extname(file)] || "application/octet-stream",
        });
        res.end(data);
      } catch {
        res.writeHead(404).end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve();
  console.log(`Asset preview: http://127.0.0.1:${server.address().port}`);
}
