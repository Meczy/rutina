// Descarga la librería de ejercicios RepDB (tier gratuito) en el servidor:
//   datos-externos/repdb/      exercises.json + licencia (no se sirve al navegador)
//   public/librerias/repdb/    una imagen WebP por ejercicio (la que muestra la app)
//
// Las dos carpetas están en .gitignore a propósito: la licencia de RepDB
// permite usarlo dentro de la app, pero NO volver a publicarlo como dataset,
// y este repositorio de GitHub es público. Por eso se descarga en cada
// servidor (dev y producción) en vez de guardarse en git.
//
// Uso (desde la raíz del proyecto):  node scripts/descargar-repdb.mjs
// Se puede volver a correr: solo baja las imágenes que falten.
//
// Licencia: https://huggingface.co/datasets/RepDB/exercise-dataset/blob/main/LICENSE.md
// Atribución obligatoria: "Exercise data by RepDB (repdb.co)".

import fs from "node:fs";
import path from "node:path";

const BASE = "https://huggingface.co/datasets/RepDB/exercise-dataset/resolve/main";
const RAIZ = path.resolve(import.meta.dirname, "..");
const DIR_DATOS = path.join(RAIZ, "datos-externos", "repdb");
const DIR_IMAGENES = path.join(RAIZ, "public", "librerias", "repdb");

fs.mkdirSync(DIR_DATOS, { recursive: true });
fs.mkdirSync(DIR_IMAGENES, { recursive: true });

async function bajar(url) {
  const respuesta = await fetch(url, { redirect: "follow" });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} en ${url}`);
  return Buffer.from(await respuesta.arrayBuffer());
}

for (const archivo of ["exercises.json", "LICENSE.md", "ATTRIBUTION.md"]) {
  fs.writeFileSync(path.join(DIR_DATOS, archivo), await bajar(`${BASE}/${archivo}`));
  console.log(`✔ ${archivo}`);
}

const { exercises } = JSON.parse(fs.readFileSync(path.join(DIR_DATOS, "exercises.json"), "utf8"));

// Una imagen por ejercicio: la pose final (muestra mejor el movimiento), o
// la única que tenga.
const pendientes = exercises
  .map((e) => {
    const flat = e.images?.flat || {};
    const origen = flat.peak || flat.main || flat.start;
    return origen ? { origen, destino: path.join(DIR_IMAGENES, `${e.id}.webp`) } : null;
  })
  .filter((p) => p && !fs.existsSync(p.destino));

console.log(`${exercises.length} ejercicios; faltan ${pendientes.length} imágenes.`);

let hechas = 0;
let errores = 0;
async function trabajador() {
  while (pendientes.length) {
    const { origen, destino } = pendientes.shift();
    try {
      fs.writeFileSync(destino, await bajar(`${BASE}/${origen}`));
      hechas += 1;
      if (hechas % 50 === 0) console.log(`  ${hechas} imágenes…`);
    } catch (error) {
      errores += 1;
      console.error(`  ✘ ${origen}: ${error.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 6 }, trabajador));

console.log(`Listo: ${hechas} imágenes nuevas${errores ? `, ${errores} con error (volvé a correr el script)` : ""}.`);
