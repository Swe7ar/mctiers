// Minimal static file server for local preview.
//   node tools/serve.mjs [port]      (default 4173, serves this folder)
//
// It also exposes the tier-test hub API (see tools/hub.mjs) which the Minecraft
// plugin and the website chat talk to.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHub } from "./hub.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || 4173);
const hub = createHub(root);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function send(res, status, file) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    "Content-Type": types[ext] || "application/octet-stream",
    // Always revalidate so edits show up on the next reload.
    "Cache-Control": "no-store, must-revalidate",
  });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
    } catch (e) {
      res.writeHead(400).end("Bad request");
      return;
    }

    /* The tier-test hub owns /api/* — everything else is a static file. */
    if (pathname.startsWith("/api/")) {
      try {
        await hub.handle(req, res);
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
      return;
    }

    // Resolve inside the served root only.
    let file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    try {
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, "index.html");
      }
      if (!fs.existsSync(file)) {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<!doctype html><meta charset=utf-8><title>404</title><h1>404 — not found</h1><p><a href='/'>Back to the site</a></p>");
        return;
      }
      send(res, 200, file);
    } catch (e) {
      res.writeHead(500).end("Server error: " + e.message);
    }
  })
  .listen(port, () => console.log("preview on http://localhost:" + port + "  (" + root + ")"));
