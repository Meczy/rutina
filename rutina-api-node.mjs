import { Pool } from "pg";
import {
  hashPassword,
  verifyPassword,
  crearCookieSesion,
  cookieDeLogout,
  obtenerTokenSesion,
  generarTokenSesion,
  fechaExpiracionSesion,
  verificarGoogleIdToken,
  emailValido,
} from "./auth.mjs";

const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

const db = {
  sql: async (strings, ...values) => {
    let text = "";

    for (let i = 0; i < strings.length; i += 1) {
      text += strings[i];

      if (i < values.length) {
        text += `$${i + 1}`;
      }
    }

    const result = await pool.query(text, values);
    return result.rows;
  },
};

function respuesta(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

// ---------- Sesión / usuario actual ----------

async function usuarioDesdeRequest(request) {
  const token = obtenerTokenSesion(request);
  if (!token) return null;

  const filas = await db.sql`
    SELECT u.id, u.email, u.nombre, u.rol
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.id = ${token} AND s.expires_at > NOW()
  `;

  if (!filas.length) return null;
  return {
    id: Number(filas[0].id),
    email: filas[0].email,
    nombre: filas[0].nombre,
    rol: filas[0].rol || "usuario",
  };
}

async function rutinaIdDeUsuario(usuarioId) {
  const filas = await db.sql`
    SELECT rutina_id FROM rutina_usuarios WHERE usuario_id = ${usuarioId} LIMIT 1
  `;
  return filas.length ? Number(filas[0].rutina_id) : null;
}

async function crearSesion(usuarioId) {
  const token = generarTokenSesion();
  const expira = fechaExpiracionSesion();
  await db.sql`
    INSERT INTO sesiones (id, usuario_id, expires_at) VALUES (${token}, ${usuarioId}, ${expira})
  `;
  return token;
}

async function crearRutinaPropia(usuarioId) {
  const rows = await db.sql`INSERT INTO rutinas (nombre) VALUES ('Mi rutina') RETURNING id`;
  const rutinaId = Number(rows[0].id);
  await db.sql`INSERT INTO rutina_usuarios (rutina_id, usuario_id) VALUES (${rutinaId}, ${usuarioId})`;
  return rutinaId;
}

function datosPublicosUsuario(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol || "usuario",
  };
}

// ---------- Administración (solo rol = admin) ----------

const ACCIONES_ADMIN = new Set([
  "adminListarUsuarios",
  "adminListarRutinas",
  "adminCrearRutina",
  "adminAsignarRutina",
  "adminQuitarRutina",
  "adminEliminarUsuario",
  "adminCambiarRol",
  "adminHistorialPesosUsuario",
  "adminHistorialMetricasUsuario",
]);

async function manejarAccionAdmin(action, body, usuarioActual) {
  if (action === "adminListarUsuarios") {
    const usuarios = await db.sql`
      SELECT u.id, u.email, u.nombre, u.rol, u.created_at,
             COALESCE(r.rutinas, '[]') AS rutinas
      FROM usuarios u
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('id', ru.rutina_id, 'nombre', rt.nombre))::text AS rutinas
        FROM rutina_usuarios ru
        JOIN rutinas rt ON rt.id = ru.rutina_id
        WHERE ru.usuario_id = u.id
      ) r ON true
      ORDER BY u.nombre
    `;
    return respuesta({
      ok: true,
      usuarios: usuarios.map((u) => ({
        id: Number(u.id),
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        creadoEn: u.created_at,
        rutinas: JSON.parse(u.rutinas || "[]"),
      })),
    });
  }

  if (action === "adminListarRutinas") {
    const rutinas = await db.sql`
      SELECT rt.id, rt.nombre,
             COALESCE(u.usuarios, '[]') AS usuarios
      FROM rutinas rt
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object('id', us.id, 'nombre', us.nombre))::text AS usuarios
        FROM rutina_usuarios ru
        JOIN usuarios us ON us.id = ru.usuario_id
        WHERE ru.rutina_id = rt.id
      ) u ON true
      ORDER BY rt.id
    `;
    return respuesta({
      ok: true,
      rutinas: rutinas.map((r) => ({
        id: Number(r.id),
        nombre: r.nombre,
        usuarios: JSON.parse(r.usuarios || "[]"),
      })),
    });
  }

  if (action === "adminCrearRutina") {
    const targetId = Number(body.target_usuario_id);
    const nombre = String(body.nombre ?? "Mi rutina").trim() || "Mi rutina";
    if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario inválido." }, 400);

    const existeUsuario = await db.sql`SELECT id FROM usuarios WHERE id = ${targetId}`;
    if (!existeUsuario.length) return respuesta({ error: "Ese usuario no existe." }, 404);

    const rows = await db.sql`INSERT INTO rutinas (nombre) VALUES (${nombre}) RETURNING id`;
    const rutinaId = Number(rows[0].id);
    await db.sql`
      INSERT INTO rutina_usuarios (rutina_id, usuario_id) VALUES (${rutinaId}, ${targetId})
      ON CONFLICT (rutina_id, usuario_id) DO NOTHING
    `;
    return respuesta({ ok: true, rutinaId }, 201);
  }

  if (action === "adminAsignarRutina") {
    const targetId = Number(body.target_usuario_id);
    const rutinaId = Number(body.rutina_id);
    if (!Number.isInteger(targetId) || !Number.isInteger(rutinaId)) {
      return respuesta({ error: "Datos inválidos." }, 400);
    }
    const existeRutina = await db.sql`SELECT id FROM rutinas WHERE id = ${rutinaId}`;
    if (!existeRutina.length) return respuesta({ error: "Esa rutina no existe." }, 404);

    await db.sql`
      INSERT INTO rutina_usuarios (rutina_id, usuario_id) VALUES (${rutinaId}, ${targetId})
      ON CONFLICT (rutina_id, usuario_id) DO NOTHING
    `;
    return respuesta({ ok: true });
  }

  if (action === "adminQuitarRutina") {
    const targetId = Number(body.target_usuario_id);
    const rutinaId = Number(body.rutina_id);
    if (!Number.isInteger(targetId) || !Number.isInteger(rutinaId)) {
      return respuesta({ error: "Datos inválidos." }, 400);
    }
    await db.sql`
      DELETE FROM rutina_usuarios WHERE rutina_id = ${rutinaId} AND usuario_id = ${targetId}
    `;
    return respuesta({ ok: true });
  }

  if (action === "adminEliminarUsuario") {
    const targetId = Number(body.target_usuario_id);
    if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario inválido." }, 400);
    if (targetId === usuarioActual.id) {
      return respuesta({ error: "No podés eliminar tu propia cuenta de administrador." }, 400);
    }
    await db.sql`DELETE FROM usuarios WHERE id = ${targetId}`;
    return respuesta({ ok: true });
  }

  if (action === "adminCambiarRol") {
    const targetId = Number(body.target_usuario_id);
    const rol = String(body.rol ?? "");
    if (!Number.isInteger(targetId) || !["usuario", "admin"].includes(rol)) {
      return respuesta({ error: "Datos inválidos." }, 400);
    }
    if (targetId === usuarioActual.id) {
      return respuesta({ error: "No podés cambiar tu propio rol." }, 400);
    }
    await db.sql`UPDATE usuarios SET rol = ${rol} WHERE id = ${targetId}`;
    return respuesta({ ok: true });
  }

  if (action === "adminHistorialPesosUsuario") {
    const targetId = Number(body.target_usuario_id);
    if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario inválido." }, 400);

    const historial = await db.sql`
      SELECT p.id, p.peso, p.fecha, e.nombre AS ejercicio
      FROM pesos p
      JOIN ejercicios e ON e.id = p.ejercicio_id
      WHERE p.usuario_id = ${targetId}
      ORDER BY p.fecha DESC, p.created_at DESC
      LIMIT 200
    `;
    return respuesta({
      ok: true,
      historial: historial.map((h) => ({
        id: Number(h.id),
        peso: Number(h.peso),
        fecha: h.fecha,
        ejercicio: h.ejercicio,
      })),
    });
  }

  if (action === "adminHistorialMetricasUsuario") {
    const targetId = Number(body.target_usuario_id);
    if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario inválido." }, 400);

    const historial = await db.sql`
      SELECT id, fecha, peso, grasa, agua
      FROM metricas_corporales
      WHERE usuario_id = ${targetId}
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
        agua: h.agua === null ? null : Number(h.agua),
      })),
    });
  }

  return respuesta({ error: "Acción de administrador desconocida." }, 400);
}

// ---------- Pertenencia (para no dejar tocar días/ejercicios ajenos) ----------

async function diaPerteneceARutina(diaId, rutinaId) {
  const filas = await db.sql`SELECT id FROM dias WHERE id = ${diaId} AND rutina_id = ${rutinaId}`;
  return filas.length > 0;
}

async function ejercicioPerteneceARutina(ejercicioId, rutinaId) {
  const filas = await db.sql`
    SELECT e.id FROM ejercicios e
    JOIN dias d ON d.id = e.dia_id
    WHERE e.id = ${ejercicioId} AND d.rutina_id = ${rutinaId}
  `;
  return filas.length > 0;
}

// ---------- Rutina ----------

async function obtenerRutina(rutinaId) {
  const dias = await db.sql`
    SELECT id, numero, nombre, orden
    FROM dias
    WHERE rutina_id = ${rutinaId}
    ORDER BY orden, numero, id
  `;

  const diaIds = dias.map((d) => Number(d.id));

  const ejercicios = diaIds.length
    ? await db.sql`
      SELECT id, dia_id, nombre, series, repeticiones, video_url, image_url, wger_id, orden
      FROM ejercicios
      WHERE dia_id = ANY(${diaIds})
      ORDER BY dia_id, orden, id
    `
    : [];

  const ejercicioIds = ejercicios.map((e) => Number(e.id));

  const pesos = ejercicioIds.length
    ? await db.sql`
      SELECT ejercicio_id, persona, peso, fecha
      FROM pesos
      WHERE ejercicio_id = ANY(${ejercicioIds})
      ORDER BY ejercicio_id, persona, fecha DESC, created_at DESC
    `
    : [];

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
      const usuario = await usuarioDesdeRequest(request);
      if (!usuario) return respuesta({ ok: false, error: "No autorizado." }, 401);

      const url = new URL(request.url);
      const usuarioIdParam = url.searchParams.get("usuario_id");

      if (usuarioIdParam && usuario.rol === "admin") {
        const targetId = Number(usuarioIdParam);
        if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario inválido." }, 400);
        const filas = await db.sql`SELECT id, email, nombre, rol FROM usuarios WHERE id = ${targetId}`;
        if (!filas.length) return respuesta({ error: "Ese usuario no existe." }, 404);
        const objetivo = {
          id: Number(filas[0].id),
          email: filas[0].email,
          nombre: filas[0].nombre,
          rol: filas[0].rol,
        };
        const rutinaId = await rutinaIdDeUsuario(objetivo.id);
        return respuesta({
          ok: true,
          usuario: datosPublicosUsuario(objetivo),
          rutina: rutinaId ? await obtenerRutina(rutinaId) : [],
        });
      }

      const rutinaId = await rutinaIdDeUsuario(usuario.id);
      return respuesta({
        ok: true,
        usuario: datosPublicosUsuario(usuario),
        rutina: rutinaId ? await obtenerRutina(rutinaId) : [],
      });
    }

    const body = await request.json();
    const action = body.action;

    // ---------- Acciones públicas (no requieren sesión) ----------

    if (action === "config") {
      return respuesta({ ok: true, googleClientId: GOOGLE_CLIENT_ID });
    }

    if (action === "register") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const nombre = String(body.nombre ?? "").trim().slice(0, 60);
      const password = String(body.password ?? "");

      if (!emailValido(email)) return respuesta({ error: "Ingresá un correo válido." }, 400);
      if (password.length < 6) {
        return respuesta({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
      }
      if (!nombre) return respuesta({ error: "Ingresá tu nombre." }, 400);

      const existente = await db.sql`SELECT id, password_hash FROM usuarios WHERE email = ${email}`;

      let usuarioId;

      if (existente.length && existente[0].password_hash) {
        return respuesta({ error: "Ya existe una cuenta con ese correo. Iniciá sesión." }, 409);
      }

      if (existente.length) {
        // Cuenta "semilla" (creada sin contraseña, ej. cuentas iniciales) o
        // cuenta que solo tenía Google: le asignamos la contraseña elegida.
        usuarioId = Number(existente[0].id);
        await db.sql`
          UPDATE usuarios SET password_hash = ${hashPassword(password)}, nombre = ${nombre}
          WHERE id = ${usuarioId}
        `;
      } else {
        const rows = await db.sql`
          INSERT INTO usuarios (email, nombre, password_hash)
          VALUES (${email}, ${nombre}, ${hashPassword(password)})
          RETURNING id
        `;
        usuarioId = Number(rows[0].id);
        await crearRutinaPropia(usuarioId);
      }

      const token = await crearSesion(usuarioId);
      return respuesta(
        { ok: true, usuario: { id: usuarioId, email, nombre } },
        201,
        { "Set-Cookie": crearCookieSesion(token, 60 * 60 * 24 * 30) }
      );
    }

    if (action === "login") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      const filas = await db.sql`
        SELECT id, email, nombre, password_hash FROM usuarios WHERE email = ${email}
      `;

      if (!filas.length || !verifyPassword(password, filas[0].password_hash)) {
        return respuesta({ error: "Correo o contraseña incorrectos." }, 401);
      }

      const usuario = filas[0];
      const token = await crearSesion(Number(usuario.id));

      return respuesta(
        { ok: true, usuario: datosPublicosUsuario({ id: Number(usuario.id), email: usuario.email, nombre: usuario.nombre }) },
        200,
        { "Set-Cookie": crearCookieSesion(token, 60 * 60 * 24 * 30) }
      );
    }

    if (action === "googleLogin") {
      let datosGoogle;
      try {
        datosGoogle = await verificarGoogleIdToken(body.id_token, GOOGLE_CLIENT_ID);
      } catch (error) {
        return respuesta({ error: error.message || "No se pudo validar la cuenta de Google." }, 401);
      }

      let filas = await db.sql`SELECT id, email, nombre FROM usuarios WHERE google_id = ${datosGoogle.googleId}`;

      if (!filas.length) {
        filas = await db.sql`SELECT id, email, nombre FROM usuarios WHERE email = ${datosGoogle.email}`;

        if (filas.length) {
          // Cuenta existente (ej. semilla o creada por correo/contraseña):
          // la vinculamos con esta cuenta de Google.
          await db.sql`UPDATE usuarios SET google_id = ${datosGoogle.googleId} WHERE id = ${filas[0].id}`;
        } else {
          const rows = await db.sql`
            INSERT INTO usuarios (email, nombre, google_id)
            VALUES (${datosGoogle.email}, ${datosGoogle.nombre}, ${datosGoogle.googleId})
            RETURNING id, email, nombre
          `;
          filas = rows;
          await crearRutinaPropia(Number(rows[0].id));
        }
      }

      const usuario = filas[0];
      const token = await crearSesion(Number(usuario.id));

      return respuesta(
        { ok: true, usuario: datosPublicosUsuario({ id: Number(usuario.id), email: usuario.email, nombre: usuario.nombre }) },
        200,
        { "Set-Cookie": crearCookieSesion(token, 60 * 60 * 24 * 30) }
      );
    }

    if (action === "logout") {
      const token = obtenerTokenSesion(request);
      if (token) await db.sql`DELETE FROM sesiones WHERE id = ${token}`;
      return respuesta({ ok: true }, 200, { "Set-Cookie": cookieDeLogout() });
    }

    // ---------- A partir de acá, todo requiere sesión ----------

    const usuario = await usuarioDesdeRequest(request);
    if (!usuario) return respuesta({ ok: false, error: "No autorizado." }, 401);

    if (ACCIONES_ADMIN.has(action)) {
      if (usuario.rol !== "admin") return respuesta({ error: "No autorizado." }, 403);
      return manejarAccionAdmin(action, body, usuario);
    }

    // Un admin puede operar en nombre de otro usuario (ver/editar su rutina,
    // registrar sus pesos, etc.) pasando target_usuario_id. Para cualquier
    // otro caso, usuarioObjetivo es simplemente el usuario logueado.
    let usuarioObjetivo = usuario;
    if (usuario.rol === "admin" && body.target_usuario_id) {
      const targetId = Number(body.target_usuario_id);
      if (!Number.isInteger(targetId)) return respuesta({ error: "Usuario objetivo inválido." }, 400);
      const filas = await db.sql`SELECT id, email, nombre, rol FROM usuarios WHERE id = ${targetId}`;
      if (!filas.length) return respuesta({ error: "Ese usuario no existe." }, 404);
      usuarioObjetivo = {
        id: Number(filas[0].id),
        email: filas[0].email,
        nombre: filas[0].nombre,
        rol: filas[0].rol,
      };
    } else if (usuario.rol === "admin") {
      return respuesta({ error: "Falta indicar sobre qué usuario operar." }, 400);
    }

    const rutinaId = await rutinaIdDeUsuario(usuarioObjetivo.id);
    if (!rutinaId) {
      return respuesta({ ok: false, error: "Ese usuario no tiene una rutina asociada." }, 500);
    }

    if (action === "createDay") {
      const nombre = String(body.nombre ?? "").trim();
      if (!nombre) return respuesta({ error: "El nombre del día es obligatorio." }, 400);

      let numero = Number(body.numero);
      if (!Number.isInteger(numero) || numero < 1) {
        const rows = await db.sql`SELECT COALESCE(MAX(numero), 0) AS maximo FROM dias WHERE rutina_id = ${rutinaId}`;
        numero = Number(rows[0].maximo) + 1;
      }

      const exists = await db.sql`SELECT id FROM dias WHERE numero = ${numero} AND rutina_id = ${rutinaId}`;
      if (exists.length) {
        return respuesta({ error: `Ya existe el Día ${numero}.` }, 409);
      }

      await db.sql`
        INSERT INTO dias (numero, nombre, orden, rutina_id)
        VALUES (${numero}, ${nombre}, ${numero}, ${rutinaId})
      `;

      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) }, 201);
    }

    if (action === "updateDay") {
      const id = Number(body.id);
      const numero = Number(body.numero);
      const nombre = String(body.nombre ?? "").trim();

      if (!Number.isInteger(id) || !Number.isInteger(numero) || numero < 1 || !nombre) {
        return respuesta({ error: "Datos del día inválidos." }, 400);
      }

      if (!(await diaPerteneceARutina(id, rutinaId))) {
        return respuesta({ error: "El día no existe." }, 404);
      }

      const current = await db.sql`SELECT numero FROM dias WHERE id = ${id}`;

      const other = await db.sql`
        SELECT id FROM dias WHERE numero = ${numero} AND id <> ${id} AND rutina_id = ${rutinaId}
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

      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) });
    }

    if (action === "deleteDay") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) return respuesta({ error: "ID de día inválido." }, 400);
      if (!(await diaPerteneceARutina(id, rutinaId))) {
        return respuesta({ error: "El día no existe." }, 404);
      }
      await db.sql`DELETE FROM dias WHERE id = ${id}`;
      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) });
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
      if (!(await diaPerteneceARutina(diaId, rutinaId))) {
        return respuesta({ error: "El día no existe." }, 404);
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
      if (!(await ejercicioPerteneceARutina(id, rutinaId))) {
        return respuesta({ error: "El ejercicio no existe." }, 404);
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
      if (!(await ejercicioPerteneceARutina(id, rutinaId))) {
        return respuesta({ error: "El ejercicio no existe." }, 404);
      }
      await db.sql`DELETE FROM ejercicios WHERE id = ${id}`;
      return respuesta({ ok: true });
    }

    if (action === "reorderExercises") {
      const diaId = Number(body.dia_id);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number) : [];

      if (!Number.isInteger(diaId) || !ids.length || ids.some((id) => !Number.isInteger(id))) {
        return respuesta({ error: "Orden de ejercicios inválido." }, 400);
      }
      if (!(await diaPerteneceARutina(diaId, rutinaId))) {
        return respuesta({ error: "El día no existe." }, 404);
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
      const peso = Number(body.peso);
      const fecha = String(body.fecha ?? "").trim();

      if (!Number.isInteger(ejercicioId)) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }
      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }
      if (!(await ejercicioPerteneceARutina(ejercicioId, rutinaId))) {
        return respuesta({ error: "El ejercicio no existe." }, 404);
      }

      const persona = usuarioObjetivo.nombre;

      // Solo puede existir un peso por ejercicio + persona + día.
      // Si ya existe un registro para hoy (o la fecha indicada), se actualiza
      // en vez de crear uno nuevo (upsert vía ON CONFLICT).
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        await db.sql`
          INSERT INTO pesos (ejercicio_id, persona, peso, fecha, usuario_id)
          VALUES (${ejercicioId}, ${persona}, ${peso}, ${fecha}, ${usuarioObjetivo.id})
          ON CONFLICT (ejercicio_id, persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, created_at = NOW(), usuario_id = ${usuarioObjetivo.id}
        `;
      } else {
        await db.sql`
          INSERT INTO pesos (ejercicio_id, persona, peso, fecha, usuario_id)
          VALUES (${ejercicioId}, ${persona}, ${peso}, CURRENT_DATE, ${usuarioObjetivo.id})
          ON CONFLICT (ejercicio_id, persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, created_at = NOW(), usuario_id = ${usuarioObjetivo.id}
        `;
      }

      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) }, 201);
    }

    if (action === "updateWeight") {
      const id = Number(body.id);
      const peso = Number(body.peso);

      if (!Number.isInteger(id)) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }
      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }

      const existente = await db.sql`
        SELECT id FROM pesos WHERE id = ${id} AND usuario_id = ${usuarioObjetivo.id}
      `;
      if (!existente.length) {
        return respuesta({ error: "El registro de peso no existe." }, 404);
      }

      await db.sql`UPDATE pesos SET peso = ${peso} WHERE id = ${id}`;

      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) });
    }

    if (action === "deleteWeight") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) {
        return respuesta({ error: "Datos de peso inválidos." }, 400);
      }

      await db.sql`DELETE FROM pesos WHERE id = ${id} AND usuario_id = ${usuarioObjetivo.id}`;

      return respuesta({ ok: true, rutina: await obtenerRutina(rutinaId) });
    }

    if (action === "getWeightHistory") {
      const ejercicioId = Number(body.ejercicio_id);

      if (!Number.isInteger(ejercicioId)) {
        return respuesta({ error: "Datos inválidos." }, 400);
      }

      const historial = await db.sql`
        SELECT id, peso, fecha
        FROM pesos
        WHERE ejercicio_id = ${ejercicioId} AND usuario_id = ${usuarioObjetivo.id}
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

      if (!Number.isFinite(peso) || peso <= 0 || peso > 999) {
        return respuesta({ error: "El peso debe ser un número mayor a 0." }, 400);
      }
      if (grasa !== null && (!Number.isFinite(grasa) || grasa < 0 || grasa > 100)) {
        return respuesta({ error: "El % de grasa debe estar entre 0 y 100." }, 400);
      }
      if (agua !== null && (!Number.isFinite(agua) || agua < 0 || agua > 100)) {
        return respuesta({ error: "El % de agua debe estar entre 0 y 100." }, 400);
      }

      const persona = usuarioObjetivo.nombre;

      // Un solo registro por persona y día: si ya existe, se actualiza (upsert).
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        await db.sql`
          INSERT INTO metricas_corporales (persona, fecha, peso, grasa, agua, usuario_id)
          VALUES (${persona}, ${fecha}, ${peso}, ${grasa}, ${agua}, ${usuarioObjetivo.id})
          ON CONFLICT (persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, grasa = EXCLUDED.grasa, agua = EXCLUDED.agua, created_at = NOW(), usuario_id = ${usuarioObjetivo.id}
        `;
      } else {
        await db.sql`
          INSERT INTO metricas_corporales (persona, fecha, peso, grasa, agua, usuario_id)
          VALUES (${persona}, CURRENT_DATE, ${peso}, ${grasa}, ${agua}, ${usuarioObjetivo.id})
          ON CONFLICT (persona, fecha)
          DO UPDATE SET peso = EXCLUDED.peso, grasa = EXCLUDED.grasa, agua = EXCLUDED.agua, created_at = NOW(), usuario_id = ${usuarioObjetivo.id}
        `;
      }

      return respuesta({ ok: true }, 201);
    }

    if (action === "getMetricasHistory") {
      const historial = await db.sql`
        SELECT id, fecha, peso, grasa, agua
        FROM metricas_corporales
        WHERE usuario_id = ${usuarioObjetivo.id}
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
          agua: h.agua === null ? null : Number(h.agua),
        })),
      });
    }

    if (action === "deleteMetrica") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) {
        return respuesta({ error: "Datos inválidos." }, 400);
      }

      await db.sql`DELETE FROM metricas_corporales WHERE id = ${id} AND usuario_id = ${usuarioObjetivo.id}`;

      return respuesta({ ok: true });
    }

    return respuesta({ error: "Acción desconocida." }, 400);
  } catch (error) {
    console.error("Error /api/rutina:", error);
    return respuesta({ ok: false, error: "Error interno del servidor." }, 500);
  }
};
