import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import rutina from "./rutina-api-node.mjs";

const PORT = process.env.PORT || 3000;

// Solo lo que esté dentro de ./public se sirve al navegador.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "public");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/rutina" || req.url.startsWith("/api/rutina?")) {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const request = new Request(`http://127.0.0.1${req.url}`, {
            method: req.method,
            headers: req.headers,
            body:
              req.method === "GET" || req.method === "HEAD"
                ? undefined
                : body,
          });

          const response = await rutina(request);
          const responseBody = await response.text();

          const headers = {
            "Content-Type":
              response.headers.get("content-type") ||
              "application/json; charset=utf-8",
            "Cache-Control":
              response.headers.get("cache-control") || "no-store",
          };

          const setCookie = response.headers.get("set-cookie");
          if (setCookie) headers["Set-Cookie"] = setCookie;

          res.writeHead(response.status, headers);

          res.end(responseBody);
        } catch (error) {
          console.error("Error API:", error);

          res.writeHead(500, {
            "Content-Type": "application/json; charset=utf-8",
          });

          res.end(
            JSON.stringify({
              ok: false,
              error: "Error interno del servidor.",
            })
          );
        }
      });

      return;
    }

    // ---------- Archivos estáticos: SOLO desde ./public ----------
    let requestedPath;
    try {
      requestedPath = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    if (requestedPath.includes("\0")) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    if (requestedPath === "/") {
      requestedPath = "/index.html";
    }

    // Resolvemos contra PUBLIC_DIR y verificamos que el resultado siga dentro
    // (evita ../ y variantes). Además bloqueamos cualquier archivo/carpeta oculto.
    const filePath = path.resolve(PUBLIC_DIR, "." + requestedPath);
    const dentroDePublic = filePath.startsWith(PUBLIC_DIR + path.sep);
    const esOculto = requestedPath
      .split("/")
      .some((segmento) => segmento.startsWith("."));

    if (
      !dentroDePublic ||
      esOculto ||
      !fs.existsSync(filePath) ||
      !fs.statSync(filePath).isFile()
    ) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type":
        mimeTypes[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Error servidor:", error);

    if (!res.headersSent) {
      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8",
      });
    }

    res.end("Internal server error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
});
