/**
 * ⚠️ DESACTUALIZADO: este script usaba ROUTINE_ADMIN_PASSWORD, que ya no
 * existe. Ahora la API requiere estar logueado (cookie de sesión). Para
 * volver a usar este script hay que autenticarse primero (POST /api/rutina
 * con action "login" o "googleLogin") y reusar la cookie que devuelve, en
 * vez del header x-routine-admin-password.
 *
 * Homologa los ejercicios existentes de MecFit con los de la API de WGER.
 *
 * Qué hace:
 *  1. Trae tu rutina actual desde /api/rutina (GET, público).
 *  2. Para cada ejercicio SIN wger_id, busca candidatos en WGER usando
 *     la acción "wgerBuscar" de tu propia API (ya corregida para
 *     devolver nombres en español).
 *  3. Puntúa los candidatos por similitud de texto con el nombre que
 *     vos le pusiste al ejercicio.
 *  4. Escribe un reporte en homologacion.json con, para cada ejercicio,
 *     el mejor candidato y hasta 4 alternativas, para que vos decidas.
 *
 * NO actualiza nada solo: es de solo lectura contra tu base. La
 * aplicación de los cambios es un paso aparte (ver abajo).
 *
 * Uso:
 *   BASE_URL=https://mecfit.app ROUTINE_ADMIN_PASSWORD=tu_clave \
 *     node scripts/homologar-wger.mjs
 *
 * Para aplicar las homologaciones que confirmes, editá homologacion.json
 * dejando en cada ejercicio solo el candidato correcto en "elegido"
 * (o poné "elegido": null si ninguno sirve) y corré:
 *
 *   BASE_URL=https://mecfit.app ROUTINE_ADMIN_PASSWORD=tu_clave \
 *     node scripts/homologar-wger.mjs --aplicar
 */

import { writeFile, readFile } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const ADMIN_PASSWORD = process.env.ROUTINE_ADMIN_PASSWORD || "";
const REPORTE = new URL("../homologacion.json", import.meta.url);
const APLICAR = process.argv.includes("--aplicar");

if (!ADMIN_PASSWORD) {
  console.error("Falta ROUTINE_ADMIN_PASSWORD en el entorno.");
  process.exit(1);
}

async function llamarApi(body) {
  const resp = await fetch(`${BASE_URL}/api/rutina`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-routine-admin-password": ADMIN_PASSWORD,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// Similitud simple por palabras compartidas (0 a 1). Suficiente para
// rankear candidatos, no necesita ser perfecta: el humano decide al final.
function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similitud(a, b) {
  const palabrasA = new Set(normalizar(a));
  const palabrasB = new Set(normalizar(b));
  if (!palabrasA.size || !palabrasB.size) return 0;
  let comunes = 0;
  for (const p of palabrasA) if (palabrasB.has(p)) comunes += 1;
  return comunes / Math.max(palabrasA.size, palabrasB.size);
}

async function generarReporte() {
  console.log(`Trayendo rutina desde ${BASE_URL}/api/rutina ...`);
  const rutinaResp = await fetch(`${BASE_URL}/api/rutina`).then((r) => r.json());
  if (!rutinaResp.ok) throw new Error("No se pudo obtener la rutina.");

  const ejercicios = rutinaResp.rutina.flatMap((dia) => dia.ejercicios);
  const pendientes = ejercicios.filter((e) => !e.wgerId);

  console.log(
    `${ejercicios.length} ejercicios en total, ${pendientes.length} sin homologar.`
  );

  const resultado = [];

  for (const ej of pendientes) {
    process.stdout.write(`Buscando: ${ej.name} ... `);
    try {
      const { ejercicios: candidatos } = await llamarApi({
        action: "wgerBuscar",
        texto: ej.name,
      });

      const puntuados = candidatos
        .map((c) => ({ ...c, score: similitud(ej.name, c.nombre) }))
        .sort((a, b) => b.score - a.score);

      const mejor = puntuados[0] || null;

      resultado.push({
        ejercicio_id: ej.id,
        nombre_actual: ej.name,
        // Se guardan tal cual para no perderlos al aplicar (updateExercise
        // reemplaza la fila entera, no hace un merge parcial).
        series_actual: ej.series || "",
        reps_actual: ej.reps || "",
        video_url_actual: ej.url || "",
        mejor_candidato: mejor
          ? { wger_id: mejor.wger_id, nombre: mejor.nombre, imagen: mejor.imagen, score: Number(mejor.score.toFixed(2)) }
          : null,
        alternativas: puntuados.slice(1, 5).map((c) => ({
          wger_id: c.wger_id,
          nombre: c.nombre,
          imagen: c.imagen,
          score: Number(c.score.toFixed(2)),
        })),
        // Completá con el wger_id elegido (de mejor_candidato o alternativas),
        // o dejalo en null si ninguno corresponde. Este campo es el que lee
        // el modo --aplicar.
        elegido: mejor && mejor.score >= 0.5 ? mejor.wger_id : null,
      });

      console.log(mejor ? `→ mejor match: "${mejor.nombre}" (score ${mejor.score.toFixed(2)})` : "→ sin candidatos");
    } catch (error) {
      console.log(`→ error: ${error.message}`);
      resultado.push({
        ejercicio_id: ej.id,
        nombre_actual: ej.name,
        error: error.message,
      });
    }

    // Pequeña pausa para no saturar la API de wger.
    await new Promise((r) => setTimeout(r, 300));
  }

  await writeFile(REPORTE, JSON.stringify(resultado, null, 2), "utf8");
  console.log(`\nReporte guardado en ${REPORTE.pathname}`);
  console.log(
    "Revisalo, ajustá el campo \"elegido\" donde haga falta y corré de nuevo con --aplicar."
  );
}

async function aplicarHomologaciones() {
  const contenido = await readFile(REPORTE, "utf8").catch(() => {
    throw new Error(`No encontré ${REPORTE.pathname}. Corré el script sin --aplicar primero.`);
  });
  const items = JSON.parse(contenido);

  const confirmados = items.filter((i) => i.elegido);
  console.log(`Aplicando ${confirmados.length} homologaciones confirmadas...`);

  for (const item of confirmados) {
    const candidato =
      (item.mejor_candidato && item.mejor_candidato.wger_id === item.elegido && item.mejor_candidato) ||
      item.alternativas.find((a) => a.wger_id === item.elegido);

    if (!candidato) {
      console.log(`- #${item.ejercicio_id} (${item.nombre_actual}): "elegido" no coincide con ningún candidato, salteado.`);
      continue;
    }

    try {
      await llamarApi({
        action: "updateExercise",
        id: item.ejercicio_id,
        nombre: item.nombre_actual,
        series: item.series_actual || "",
        repeticiones: item.reps_actual || "",
        video_url: item.video_url_actual || "",
        wger_id: candidato.wger_id,
        image_url: candidato.imagen || "",
      });
      console.log(`✓ #${item.ejercicio_id} (${item.nombre_actual}) → wger_id ${candidato.wger_id}`);
    } catch (error) {
      console.log(`✗ #${item.ejercicio_id} (${item.nombre_actual}): ${error.message}`);
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  console.log("Listo.");
}

(APLICAR ? aplicarHomologaciones() : generarReporte()).catch((error) => {
  console.error(error);
  process.exit(1);
});
