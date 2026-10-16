// Respaldo diario de la base de producción (lo corre cron como el usuario rutina).
//
//   node scripts/respaldo-db.mjs [carpeta-de-la-app]
//
// Lee NETLIFY_DATABASE_URL del .env de la app (por defecto /home/rutina/app),
// guarda un pg_dump en /home/rutina/respaldos y borra los de más de 30 días.
// La contraseña va por variables de entorno a pg_dump, nunca en la línea de
// comandos (ahí la vería cualquier usuario del servidor con `ps`).

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const APP_DIR = process.argv[2] || "/home/rutina/app";
const DESTINO = "/home/rutina/respaldos";
const DIAS_A_GUARDAR = 30;

const env = dotenv.parse(fs.readFileSync(path.join(APP_DIR, ".env")));
const url = new URL(env.NETLIFY_DATABASE_URL);
const base = url.pathname.slice(1);

fs.mkdirSync(DESTINO, { recursive: true, mode: 0o700 });
const fecha = new Date().toISOString().slice(0, 10);
const archivo = path.join(DESTINO, `respaldo_${base}_${fecha}.dump`);

const resultado = spawnSync("pg_dump", ["--format=custom", "--no-owner", `--file=${archivo}`], {
  env: {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: base,
  },
  stdio: ["ignore", "inherit", "inherit"],
});

if (resultado.status !== 0) {
  console.error(`Falló el respaldo de ${base}.`);
  process.exit(1);
}
fs.chmodSync(archivo, 0o600);
console.log(`Respaldo listo: ${archivo} (${fs.statSync(archivo).size} bytes)`);

// Borra los respaldos viejos.
const limite = Date.now() - DIAS_A_GUARDAR * 24 * 60 * 60 * 1000;
for (const nombre of fs.readdirSync(DESTINO)) {
  const ruta = path.join(DESTINO, nombre);
  if (nombre.startsWith("respaldo_") && fs.statSync(ruta).mtimeMs < limite) fs.unlinkSync(ruta);
}
