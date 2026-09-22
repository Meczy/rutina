// ⚠️ DESACTUALIZADO: esta función Netlify no fue actualizada junto con
// rutina-api-node.mjs (que es la que corre en producción, ver README).
// No tiene el sistema de usuarios/login ni el modelo de rutina por usuario.
// Si en algún momento se usa este entrypoint, hay que replicarle los mismos
// cambios que a rutina-api-node.mjs antes de ponerlo en producción.
import { getDatabase } from "@netlify/database";

const db = getDatabase();

function respuesta(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function autorizado(request) {
  const password = process.env.ROUTINE_ADMIN_PASSWORD;
  if (!password) return false;
  return request.headers.get("x-routine-admin-password") === password;
}

async function obtenerRutina() {
  const dias = await db.sql`
    SELECT id, numero, nombre, orden
    FROM dias
    ORDER BY orden, numero, id
  `;

  const ejercicios = await db.sql`
    SELECT id, dia_id, nombre, series, repeticiones, video_url, image_url, wger_id, orden
    FROM ejercicios
    ORDER BY dia_id, orden, id
  `;

  const pesos = await db.sql`
    SELECT ejercicio_id, persona, peso, fecha
    FROM pesos
    ORDER BY ejercicio_id, persona, fecha DESC, created_at DESC
  `;

  return dias.map((dia) => ({
    id: Number(dia.id),
    numero: Number(dia.numero),
    titulo: dia.nombre,
    orden: Number(dia.orden),
    ejercicios: ejercicios
      .filter((e) => Number(e.dia_id) === Number(dia.id))
      .map((e) => ({
        id: Number(e.id),
        dia_id: Number(e.dia_id),
        name: e.nombre,
        series: e.series ?? "",
        reps: e.repeticiones ?? "",
        url: e.video_url ?? "",
        imageUrl: e.image_url ?? "",
        wgerId: e.wger_id === null || e.wger_id === undefined ? null : Number(e.wger_id),
        orden: Number(e.orden),
        pesos: pesos
          .filter((p) => Number(p.ejercicio_id) === Number(e.id))
          .reduce((acc, p) => {
            if (!acc.some((item) => item.persona === p.persona)) {
              acc.push({
                persona: p.persona,
                peso: Number(p.peso),
                fecha: p.fecha,
              });
            }
            return acc;
          }, []),
      })),
  }));
}

export default async (request) => {
  try {
    if (request.method === "GET") {
      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    const body = await request.json();
    const action = body.action;

    const accionesPublicas = new Set([
      "logWeight",
      "getWeightHistory",
      "updateWeight",
      "deleteWeight",
      "logMetrica",
      "getMetricasHistory",
      "deleteMetrica",
      "listPersonas"
    ]);

    if (!accionesPublicas.has(action) && !autorizado(request)) {
      return respuesta({ ok: false, error: "No autorizado." }, 401);
    }

    if (action === "validate") {
      return respuesta({ ok: true, mensaje: "Autorizado." });
    }

    if (action === "createDay") {
      const nombre = String(body.nombre ?? "").trim();
      if (!nombre) return respuesta({ error: "El nombre del día es obligatorio." }, 400);

      let numero = Number(body.numero);
      if (!Number.isInteger(numero) || numero < 1) {
        const rows = await db.sql`SELECT COALESCE(MAX(numero), 0) AS maximo FROM dias`;
        numero = Number(rows[0].maximo) + 1;
      }

      const exists = await db.sql`SELECT id FROM dias WHERE numero = ${numero}`;
      if (exists.length) {
        return respuesta({ error: `Ya existe el Día ${numero}.` }, 409);
      }

      await db.sql`
        INSERT INTO dias (numero, nombre, orden)
        VALUES (${numero}, ${nombre}, ${numero})
      `;

      return respuesta({ ok: true, rutina: await obtenerRutina() }, 201);
    }

    if (action === "updateDay") {
      const id = Number(body.id);
      const numero = Number(body.numero);
      const nombre = String(body.nombre ?? "").trim();

      if (!Number.isInteger(id) || !Number.isInteger(numero) || numero < 1 || !nombre) {
        return respuesta({ error: "Datos del día inválidos." }, 400);
      }

      const current = await db.sql`SELECT numero FROM dias WHERE id = ${id}`;
      if (!current.length) return respuesta({ error: "El día no existe." }, 404);

      const other = await db.sql`
        SELECT id FROM dias WHERE numero = ${numero} AND id <> ${id}
      `;

      if (other.length) {
        await db.sql`
          UPDATE dias
          SET numero = ${current[0].numero}, orden = ${current[0].numero}
          WHERE id = ${other[0].id}
        `;
      }

      await db.sql`
        UPDATE dias
        SET numero = ${numero}, nombre = ${nombre}, orden = ${numero}
        WHERE id = ${id}
      `;

      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    if (action === "deleteDay") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return respuesta({ error: "ID de día inválido." }, 400);
      await db.sql`DELETE FROM dias WHERE id = ${id}`;
      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    if (action === "createExercise") {
      const diaId = Number(body.dia_id);
      const nombre = String(body.nombre ?? "").trim();
      const series = String(body.series ?? "");
      const repeticiones = String(body.repeticiones ?? "");
      const videoUrl = String(body.video_url ?? "");
      const imageUrl = String(body.image_url ?? "").trim();
      const wgerId =
        body.wger_id === null || body.wger_id === undefined || body.wger_id === ""
          ? null
          : Number(body.wger_id);

      if (!Number.isInteger(diaId) || !nombre) {
        return respuesta({ error: "Datos del ejercicio inválidos." }, 400);
      }

      const maxRows = await db.sql`
        SELECT COALESCE(MAX(orden), 0) AS maximo
        FROM ejercicios
        WHERE dia_id = ${diaId}
      `;

      const orden = Number(maxRows[0].maximo) + 1;

      const rows = await db.sql`
        INSERT INTO ejercicios
          (dia_id, nombre, series, repeticiones, video_url, image_url, wger_id, orden)
        VALUES
          (${diaId}, ${nombre}, ${series}, ${repeticiones}, ${videoUrl}, ${imageUrl || null}, ${wgerId}, ${orden})
        RETURNING id
      `;

      return respuesta({ ok: true, id: Number(rows[0].id) }, 201);
    }

    if (action === "updateExercise") {
      const id = Number(body.id);
      const nombre = String(body.nombre ?? "").trim();
      const series = String(body.series ?? "");
      const repeticiones = String(body.repeticiones ?? "");
      const videoUrl = String(body.video_url ?? "");
      const imageUrl = String(body.image_url ?? "").trim();
      const wgerId =
        body.wger_id === null || body.wger_id === undefined || body.wger_id === ""
          ? null
          : Number(body.wger_id);

      if (!Number.isInteger(id) || !nombre) {
        return respuesta({ error: "Datos del ejercicio inválidos." }, 400);
      }

      await db.sql`
        UPDATE ejercicios
        SET
          nombre = ${nombre},
          series = ${series},
          repeticiones = ${repeticiones},
          video_url = ${videoUrl},
          image_url = ${imageUrl || null},
          wger_id = ${wgerId}
        WHERE id = ${id}
      `;

      return respuesta({ ok: true });
    }

    if (action === "wgerCategorias") {
      // La API de wger no traduce las categorías (siempre vienen en inglés),
      // así que las traducimos nosotros con un diccionario fijo.
      const CATEGORIAS_ES = {
        Abs: "Abdominales",
        Arms: "Brazos",
        Back: "Espalda",
        Calves: "Pantorrillas",
        Cardio: "Cardio",
        Chest: "Pecho",
        Legs: "Piernas",
        Shoulders: "Hombros",
      };

      try {
        const resp = await fetch("https://wger.de/api/v2/exercisecategory/?format=json&limit=30");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        const categorias = (data.results || [])
          .map((c) => {
            const nombreEn = String(c.name || "").trim();
            return {
              id: Number(c.id),
              nombre: CATEGORIAS_ES[nombreEn] || nombreEn,
            };
          })
          .filter((c) => c.nombre)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        return respuesta({ ok: true, categorias });
      } catch (error) {
        return respuesta(
          { error: "No se pudo conectar con la librería de ejercicios (wger). Probá de nuevo." },
          502
        );
      }
    }

    if (action === "wgerBuscar") {
      const categoriaId = Number(body.categoria_id);
      const texto = String(body.texto ?? "").trim().toLowerCase();

      try {
        const params = new URLSearchParams({ format: "json", limit: "60" });
        if (Number.isInteger(categoriaId) && categoriaId > 0) {
          params.set("category", String(categoriaId));
        }

        const resp = await fetch(`https://wger.de/api/v2/exerciseinfo/?${params.toString()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();

        const ejercicios = (data.results || [])
          .map((ex) => {
            // IDs de idioma en wger: 4 = español, 2 = inglés (antes esto pedía
            // inglés por error). Si no hay traducción en español, caemos a
            // inglés y, si tampoco, a cualquier traducción disponible.
            const traducciones = Array.isArray(ex.translations) ? ex.translations : [];
            const traduccion =
              traducciones.find((t) => t.language === 4 && t.name) ||
              traducciones.find((t) => t.language === 2 && t.name) ||
              traducciones.find((t) => t.name) ||
              null;
            const nombre = String(traduccion?.name || ex.name || "").trim();

            const imagenes = Array.isArray(ex.images) ? ex.images : [];
            const imagenObj = imagenes.find((img) => img.is_main) || imagenes[0] || null;
            let imagen = imagenObj?.image || null;
            if (imagen && !/^https?:\/\//i.test(imagen)) {
              imagen = `https://wger.de${imagen.startsWith("/") ? "" : "/"}${imagen}`;
            }

            return { wger_id: Number(ex.id), nombre, imagen };
          })
          .filter((ex) => ex.nombre);

        const filtrados = texto
          ? ejercicios.filter((ex) => ex.nombre.toLowerCase().includes(texto))
          : ejercicios;

        return respuesta({ ok: true, ejercicios: filtrados.slice(0, 40) });
      } catch (error) {
        return respuesta(
          { error: "No se pudo conectar con la librería de ejercicios (wger). Probá de nuevo." },
          502
        );
      }
    }

    if (action === "deleteExercise") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return respuesta({ error: "ID de ejercicio inválido." }, 400);
      await db.sql`DELETE FROM ejercicios WHERE id = ${id}`;
      return respuesta({ ok: true });
    }

    if (action === "reorderExercises") {
      const diaId = Number(body.dia_id);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];

      if (!Number.isInteger(diaId) || !ids.length || ids.some((id) => !Number.isInteger(id))) {
        return respuesta({ error: "Orden de ejercicios inválido." }, 400);
      }

      for (let i = 0; i < ids.length; i += 1) {
        await db.sql`
          UPDATE ejercicios
          SET orden = ${i + 1}
          WHERE id = ${ids[i]}
            AND dia_id = ${diaId}
        `;
      }

      return respuesta({ ok: true });
    }

    if (action === "logWeight") {
      const ejercicioId = Number(body.ejercicio_id);
      const persona = String(body.persona ?? "").trim().slice(0, 60);
      const peso = Number(body.peso);
      const fecha = String(body.fecha ?? "").trim();

      if (!Number.isInteger(ejercicioId) || !persona) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }
      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }

      const existeEjercicio = await db.sql`SELECT id FROM ejercicios WHERE id = ${ejercicioId}`;
      if (!existeEjercicio.length) {
        return respuesta({ error: "El ejercicio no existe." }, 404);
      }

      // Solo puede existir un peso por ejercicio + persona + día.
      // Si ya existe un registro para hoy (o la fecha indicada), se actualiza
      // en vez de crear uno nuevo (upsert vía ON CONFLICT).
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        await db.sql`
          INSERT INTO pesos (ejercicio_id, persona, peso, fecha)
          VALUES (${ejercicioId}, ${persona}, ${peso}, ${fecha})
          ON CONFLICT (ejercicio_id, persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, created_at = NOW()
        `;
      } else {
        await db.sql`
          INSERT INTO pesos (ejercicio_id, persona, peso, fecha)
          VALUES (${ejercicioId}, ${persona}, ${peso}, CURRENT_DATE)
          ON CONFLICT (ejercicio_id, persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, created_at = NOW()
        `;
      }

      return respuesta({ ok: true, rutina: await obtenerRutina() }, 201);
    }

    if (action === "updateWeight") {
      const id = Number(body.id);
      const persona = String(body.persona ?? "").trim();
      const peso = Number(body.peso);

      if (!Number.isInteger(id) || !persona) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }
      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }

      const existente = await db.sql`
        SELECT id FROM pesos WHERE id = ${id} AND persona = ${persona}
      `;
      if (!existente.length) {
        return respuesta({ error: "El registro de peso no existe." }, 404);
      }

      await db.sql`UPDATE pesos SET peso = ${peso} WHERE id = ${id}`;

      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    if (action === "deleteWeight") {
      const id = Number(body.id);
      const persona = String(body.persona ?? "").trim();

      if (!Number.isInteger(id) || !persona) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }

      await db.sql`DELETE FROM pesos WHERE id = ${id} AND persona = ${persona}`;

      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    if (action === "getWeightHistory") {
      const ejercicioId = Number(body.ejercicio_id);
      const persona = String(body.persona ?? "").trim();

      if (!Number.isInteger(ejercicioId) || !persona) {
        return respuesta({ error: "Datos inválidos." }, 400);
      }

      const historial = await db.sql`
        SELECT id, peso, fecha
        FROM pesos
        WHERE ejercicio_id = ${ejercicioId} AND persona = ${persona}
        ORDER BY fecha DESC, created_at DESC
      `;

      return respuesta({
        ok: true,
        historial: historial.map((h) => ({
          id: Number(h.id),
          peso: Number(h.peso),
          fecha: h.fecha,
        })),
      });
    }

    if (action === "logMetrica") {
      const persona = String(body.persona ?? "").trim().slice(0, 60);
      const peso = Number(body.peso);
      const grasa =
        body.grasa === "" || body.grasa === undefined || body.grasa === null
          ? null
          : Number(body.grasa);
      const agua =
        body.agua === "" || body.agua === undefined || body.agua === null
          ? null
          : Number(body.agua);
      const fecha = String(body.fecha ?? "").trim();

      if (!persona) return respuesta({ error: "Falta el nombre de la persona." }, 400);
      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }
      if (grasa !== null && (!Number.isFinite(grasa) || grasa < 0 || grasa > 100)) {
        return respuesta({ error: "El % de grasa debe estar entre 0 y 100." }, 400);
      }
      if (agua !== null && (!Number.isFinite(agua) || agua < 0 || agua > 100)) {
        return respuesta({ error: "El % de agua debe estar entre 0 y 100." }, 400);
      }

      // Un solo registro por persona y día: si ya existe, se actualiza (upsert).
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        await db.sql`
          INSERT INTO metricas_corporales (persona, fecha, peso, grasa, agua)
          VALUES (${persona}, ${fecha}, ${peso}, ${grasa}, ${agua})
          ON CONFLICT (persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, grasa = EXCLUDED.grasa, agua = EXCLUDED.agua, created_at = NOW()
        `;
      } else {
        await db.sql`
          INSERT INTO metricas_corporales (persona, fecha, peso, grasa, agua)
          VALUES (${persona}, CURRENT_DATE, ${peso}, ${grasa}, ${agua})
          ON CONFLICT (persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, grasa = EXCLUDED.grasa, agua = EXCLUDED.agua, created_at = NOW()
        `;
      }

      return respuesta({ ok: true }, 201);
    }

    if (action === "getMetricasHistory") {
      const persona = String(body.persona ?? "").trim();
      if (!persona) return respuesta({ error: "Falta el nombre de la persona." }, 400);

      const historial = await db.sql`
        SELECT id, fecha, peso, grasa, agua
        FROM metricas_corporales
        WHERE persona = ${persona}
        ORDER BY fecha DESC, created_at DESC
        LIMIT 120
      `;

      return respuesta({
        ok: true,
        historial: historial.map((h) => ({
          id: Number(h.id),
          fecha: h.fecha,
          peso: Number(h.peso),
          grasa: h.grasa === null ? null : Number(h.grasa),
          agua: h.agua === null ? null : Number(h.agua)
        }))
      });
    }

    if (action === "deleteMetrica") {
      const id = Number(body.id);
      const persona = String(body.persona ?? "").trim();

      if (!Number.isInteger(id) || !persona) {
        return respuesta({ error: "Datos inválidos." }, 400);
      }

      await db.sql`
        DELETE FROM metricas_corporales WHERE id = ${id} AND persona = ${persona}
      `;

      return respuesta({ ok: true });
    }

    if (action === "listPersonas") {
      const filas = await db.sql`
        SELECT persona, COUNT(*) AS registros
        FROM (
          SELECT persona FROM pesos
          UNION ALL
          SELECT persona FROM metricas_corporales
        ) todo
        GROUP BY persona
        ORDER BY persona
      `;

      return respuesta({
        ok: true,
        personas: filas.map((f) => ({
          persona: f.persona,
          registros: Number(f.registros)
        }))
      });
    }

    if (action === "deletePersona") {
      const persona = String(body.persona ?? "").trim();
      if (!persona) return respuesta({ error: "Falta el nombre de la persona." }, 400);

      await db.sql`DELETE FROM pesos WHERE persona = ${persona}`;
      await db.sql`DELETE FROM metricas_corporales WHERE persona = ${persona}`;

      return respuesta({ ok: true, rutina: await obtenerRutina() });
    }

    return respuesta({ error: "Acción desconocida." }, 400);
  } catch (error) {
    console.error("Error /api/rutina:", error);
    return respuesta({ ok: false, error: "Error interno del servidor." }, 500);
  }
};

export const config = {
  path: "/api/rutina",
};
