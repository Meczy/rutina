import "dotenv/config";
import crypto from "node:crypto";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import rutina from "./rutina-api-node.mjs";

const PORT = process.env.PORT || 3000;

// Solo lo que esté dentro de ./public se sirve al navegador.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "public");

// Etiqueta visible según el ambiente (definida en el .env de cada servidor).
// Así el index.html queda igual en el repo para dev y producción, sin tener
// que acordarse de revertir un "-DEV" a mano antes de cada deploy.
const ENV_LABEL = process.env.APP_ENV === "dev" ? "-DEV" : "";

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
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// ---------- Seguridad ----------

// Tope de un pedido a la API (igual al de nginx). Evita que alguien llene la
// memoria del servidor mandando un cuerpo gigante.
const LIMITE_CUERPO = 1024 * 1024;

// Encabezados para todas las respuestas.
const ENCABEZADOS_SEGURIDAD = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY", // nadie puede meter la app dentro de otra página
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

// Política de contenido de la página: solo código propio y el de Google
// (inicio de sesión), videos de YouTube e imágenes web. Los <script> dentro
// del HTML se permiten por su huella exacta (ver cspParaHtml).
function cspParaHtml(html) {
  const huellas = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    ([, codigo]) => `'sha256-${crypto.createHash("sha256").update(codigo).digest("base64")}'`
  );
  return [
    "default-src 'self'",
    `script-src 'self' https://accounts.google.com/gsi/client ${huellas.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://accounts.google.com/gsi/",
    "frame-src https://accounts.google.com/gsi/ https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

const server = http.createServer(async (req, res) => {
  for (const [nombre, valor] of Object.entries(ENCABEZADOS_SEGURIDAD)) res.setHeader(nombre, valor);

  try {
    if (req.url === "/api/rutina" || req.url.startsWith("/api/rutina?")) {
      let body = "";
      let tamano = 0;
      let demasiadoGrande = false;

      req.on("data", (chunk) => {
        if (demasiadoGrande) return;
        tamano += chunk.length;
        if (tamano > LIMITE_CUERPO) {
          demasiadoGrande = true;
          res.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: "El pedido es demasiado grande." }));
          req.destroy();
          return;
        }
        body += chunk;
      });

      req.on("end", async () => {
        if (demasiadoGrande) return;
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
    const tipo = { "Content-Type": mimeTypes[ext] || "application/octet-stream" };

    if (ext === ".html") {
      // Los .html son chicos: los leemos completos para poder sustituir
      // el placeholder {{ENV_LABEL}} y calcular la política de contenido
      // antes de mandarlos.
      const contenido = fs
        .readFileSync(filePath, "utf8")
        .replaceAll("{{ENV_LABEL}}", ENV_LABEL);
      res.writeHead(200, { ...tipo, "Content-Security-Policy": cspParaHtml(contenido) });
      res.end(contenido);
      return;
    }

    res.writeHead(200, tipo);
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
