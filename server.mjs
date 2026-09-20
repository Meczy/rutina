import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import rutina from "./rutina-api-node.mjs";

const PORT = process.env.PORT || 3000;

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
    if (req.url === "/api/rutina") {
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

          res.writeHead(response.status, {
            "Content-Type":
              response.headers.get("content-type") ||
              "application/json; charset=utf-8",
            "Cache-Control":
              response.headers.get("cache-control") || "no-store",
          });

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

    let requestedPath = req.url.split("?")[0];

    if (requestedPath === "/") {
      requestedPath = "/index.html";
    }

    const filePath = path.join(process.cwd(), requestedPath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
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
