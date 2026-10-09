// ---------- Importar rutina desde PDF ----------
// Lee el PDF en el navegador con pdf.js (copiado en /vendor/pdfjs, se carga
// solo al usarlo) y arma los días a partir de las tablas del entrenador:
//
//   Día 1: Cuadriceps - Glúteo        Nº de ejercicios  6
//   Ejercicio | Video | Series | Reps | Descanso | Observaciones
//   Press Pierna Inclinado | Ver Video | 4 | 12 | 90seg |
//   ...
//   FIN_ENTRENAMIENTO
//
// Las columnas se ubican por la posición de los encabezados, y el video de
// cada fila sale del enlace que tiene el "Ver Video" de esa misma fila.
// Reutiliza api(), esc(), icon() y el modal definidos en app.js.

const PDFJS_BASE = "/vendor/pdfjs/";

let pdfjsCargando = null;

function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);

  if (!pdfjsCargando) {
    pdfjsCargando = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${PDFJS_BASE}pdf.min.js`;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.js`;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        pdfjsCargando = null;
        reject(new Error("No se pudo cargar el lector de PDF. Revisá tu conexión y probá de nuevo."));
      };
      document.head.appendChild(script);
    });
  }

  return pdfjsCargando;
}

function normalizarTextoPdf(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Agrupa el texto de cada página en filas (misma altura) y le asigna a cada
// fila los enlaces que caen sobre ella.
async function filasDelPdf(doc) {
  const filas = [];

  for (let numeroPagina = 1; numeroPagina <= doc.numPages; numeroPagina += 1) {
    const pagina = await doc.getPage(numeroPagina);
    const [contenido, anotaciones] = await Promise.all([
      pagina.getTextContent(),
      pagina.getAnnotations(),
    ]);

    const filasPagina = [];

    for (const item of contenido.items) {
      const texto = String(item.str || "").replace(/\s+/g, " ").trim();
      if (!texto) continue;

      const y = item.transform[5];
      const x = item.transform[4] + (item.width || 0) / 2;

      let fila = filasPagina.find((f) => Math.abs(f.y - y) <= 2.5);
      if (!fila) {
        fila = { y, celdas: [], enlaces: [] };
        filasPagina.push(fila);
      }
      fila.celdas.push({ texto, x });
    }

    for (const anotacion of anotaciones) {
      if (!anotacion.url || !Array.isArray(anotacion.rect)) continue;
      const [x1, y1, x2, y2] = anotacion.rect;
      const centroY = (y1 + y2) / 2;

      const fila = filasPagina
        .filter((f) => f.y >= Math.min(y1, y2) - 2 && f.y <= Math.max(y1, y2) + 2)
        .sort((a, b) => Math.abs(a.y - centroY) - Math.abs(b.y - centroY))[0];

      if (fila) fila.enlaces.push({ url: anotacion.url, x: (x1 + x2) / 2 });
    }

    filasPagina.sort((a, b) => b.y - a.y);
    filasPagina.forEach((f) => f.celdas.sort((a, b) => a.x - b.x));
    filas.push(...filasPagina);
  }

  return filas;
}

const COLUMNAS_PDF = {
  video: "video",
  series: "series",
  reps: "reps",
  repeticiones: "reps",
  descanso: "descanso",
  observaciones: "observaciones",
};

// Encabezado de tabla: la primera celda es la columna del ejercicio (dice
// "Ejercicio" o, en bloques como el de abdomen, el nombre del bloque).
function columnasDeEncabezado(fila, anteriores) {
  const columnas = { ...(anteriores || {}), ejercicio: fila.celdas[0].x };

  for (const celda of fila.celdas.slice(1)) {
    const clave = COLUMNAS_PDF[normalizarTextoPdf(celda.texto)];
    if (clave) columnas[clave] = celda.x;
  }

  // Algunas tablas vienen sin el encabezado "Reps": si nunca lo vimos, lo
  // ubicamos entre Series y Descanso.
  if (columnas.reps === undefined && columnas.series !== undefined && columnas.descanso !== undefined) {
    columnas.reps = (columnas.series + columnas.descanso) / 2;
  }

  return columnas;
}

function columnaMasCercana(x, columnas) {
  let mejor = null;
  let distancia = Infinity;

  for (const [clave, posicion] of Object.entries(columnas)) {
    const d = Math.abs(posicion - x);
    if (d < distancia) {
      distancia = d;
      mejor = clave;
    }
  }

  return mejor;
}

function textoDeColumna(fila, columnas, clave) {
  return fila.celdas
    .filter((c) => columnaMasCercana(c.x, columnas) === clave)
    .map((c) => c.texto)
    .join(" ")
    .trim();
}

// Solo se acepta el formato de rutina del entrenador. Estas son sus marcas:
// datos del cliente arriba, bloques "Día N: …" que terminan en
// FIN_ENTRENAMIENTO, y tablas con estas columnas ("Reps" no se exige
// porque en algunas tablas falta ese encabezado).
const COLUMNAS_OBLIGATORIAS = ["video", "series", "descanso", "observaciones"];
const NOMBRES_COLUMNAS = { video: "Video", series: "Series", descanso: "Descanso", observaciones: "Observaciones" };

function validarFormatoEntrenador(marcas, dias) {
  const faltantes = [];
  if (!marcas.cliente) faltantes.push('"Nombre de Cliente"');
  if (!marcas.numeroEntrenamientos) faltantes.push('"Número de entrenamientos"');
  if (!marcas.titulosDia) faltantes.push('días con el título "Día 1: …"');
  if (!marcas.finEntrenamiento) faltantes.push('el cierre "FIN_ENTRENAMIENTO" de cada día');
  if (!marcas.encabezados) faltantes.push("la tabla de ejercicios");
  if (marcas.columnasFaltantes.size) {
    faltantes.push(`las columnas ${[...marcas.columnasFaltantes].map((c) => NOMBRES_COLUMNAS[c]).join(", ")}`);
  }

  const sinSeries = dias.flatMap((d) => d.ejercicios).filter((e) => !e.series);
  if (sinSeries.length) faltantes.push(`las series de ${sinSeries.length} ejercicio${sinSeries.length === 1 ? "" : "s"}`);

  if (faltantes.length) {
    throw new Error(
      "Este PDF no tiene el formato de rutina que acepta MecFit, así que no se puede importar. " +
        `Le falta: ${faltantes.join("; ")}.`
    );
  }
}

async function extraerRutinaDeDocumento(doc) {
  const filas = await filasDelPdf(doc);
  const dias = [];
  const marcas = {
    cliente: false,
    numeroEntrenamientos: false,
    titulosDia: 0,
    finEntrenamiento: 0,
    encabezados: 0,
    columnasFaltantes: new Set(),
  };

  let columnas = null;
  let tituloPendiente = null;
  let diaActual = null;

  for (const fila of filas) {
    const normalizadas = fila.celdas.map((c) => normalizarTextoPdf(c.texto));

    if (normalizadas.some((t) => t.startsWith("nombre de cliente"))) marcas.cliente = true;
    if (normalizadas.some((t) => t.startsWith("numero de entrenamientos"))) marcas.numeroEntrenamientos = true;

    const celdaDia = fila.celdas.find((c) => /^d[ií]a\s*\d+/i.test(c.texto));
    if (celdaDia) {
      marcas.titulosDia += 1;
      tituloPendiente = celdaDia.texto.replace(/^d[ií]a\s*\d+\s*[:.\-–]?\s*/i, "").trim();
      diaActual = null;
      continue;
    }

    if (normalizadas.some((t) => t.startsWith("fin_entrenamiento"))) {
      marcas.finEntrenamiento += 1;
      diaActual = null;
      continue;
    }

    // "Nº de ejercicios": arranca un bloque nuevo (sin "Día N" en el caso
    // del bloque de abdomen).
    if (normalizadas.some((t) => /^n.? ?de ejercicios/.test(t))) {
      diaActual = null;
      continue;
    }

    if (normalizadas.includes("video") && normalizadas.includes("series")) {
      marcas.encabezados += 1;
      COLUMNAS_OBLIGATORIAS.filter((c) => !normalizadas.includes(c)).forEach((c) => marcas.columnasFaltantes.add(c));
      columnas = columnasDeEncabezado(fila, columnas);

      const primeraCelda = fila.celdas[0].texto;
      const titulo =
        tituloPendiente ||
        (normalizarTextoPdf(primeraCelda) !== "ejercicio" ? primeraCelda : "") ||
        `Día ${dias.length + 1}`;

      diaActual = { titulo, ejercicios: [] };
      dias.push(diaActual);
      tituloPendiente = null;
      continue;
    }

    if (!diaActual || !columnas) continue;

    const nombre = textoDeColumna(fila, columnas, "ejercicio");
    if (!nombre) continue;

    const enlace =
      fila.enlaces
        .slice()
        .sort((a, b) => Math.abs(a.x - columnas.video) - Math.abs(b.x - columnas.video))[0] || null;

    diaActual.ejercicios.push({
      nombre,
      series: textoDeColumna(fila, columnas, "series"),
      repeticiones: textoDeColumna(fila, columnas, "reps"),
      descanso: textoDeColumna(fila, columnas, "descanso"),
      observaciones: textoDeColumna(fila, columnas, "observaciones"),
      video_url: enlace ? enlace.url : "",
    });
  }

  const conEjercicios = dias.filter((d) => d.ejercicios.length);
  validarFormatoEntrenador(marcas, conEjercicios);
  return conEjercicios;
}

async function leerRutinaDePdf(archivo) {
  const pdfjsLib = await cargarPdfJs();
  const datos = new Uint8Array(await archivo.arrayBuffer());

  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: datos }).promise;
  } catch {
    throw new Error("No se pudo abrir el archivo. ¿Es un PDF válido?");
  }

  try {
    return await extraerRutinaDeDocumento(doc);
  } finally {
    doc.destroy();
  }
}

// opciones.targetUsuarioId: el admin importa en la rutina de otro usuario.
// opciones.alTerminar(rutina): se llama con la rutina actualizada.
function abrirImportarPdf(opciones = {}) {
  modalTitle.textContent = "Importar rutina desde PDF";
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `
    <div style="padding:16px">
      <p class="footer-note" style="margin:0 0 12px;text-align:left">
        Elegí el PDF de tu rutina. Solo se aceptan rutinas con el formato del entrenador
        (bloques "Día N" con la tabla Ejercicio, Video, Series, Reps, Descanso y Observaciones).
        Antes de guardar vas a ver los días y ejercicios que se encontraron.
      </p>
      <input type="file" id="importarPdfInput" accept="application/pdf,.pdf">
      <div id="importarPdfResultado" style="margin-top:14px"></div>
    </div>
  `;
  modal.classList.add("open");

  const input = document.getElementById("importarPdfInput");
  const resultado = document.getElementById("importarPdfResultado");

  input.addEventListener("change", async () => {
    const archivo = input.files && input.files[0];
    if (!archivo) return;

    resultado.innerHTML = `<p class="footer-note">Leyendo el PDF…</p>`;

    try {
      const dias = await leerRutinaDePdf(archivo);
      if (!dias.length) {
        throw new Error(
          "Este PDF no tiene el formato de rutina que acepta MecFit: no se encontraron días con ejercicios."
        );
      }
      renderVistaPreviaPdf(resultado, dias, { ...opciones, nombreArchivo: archivo.name });
    } catch (error) {
      resultado.innerHTML = `<p class="auth-error">${esc(error.message)}</p>`;
    }
  });
}

function renderVistaPreviaPdf(contenedor, dias, opciones) {
  // Nombre sugerido para la rutina nueva: el del archivo, sin ".pdf".
  const nombreSugerido =
    String(opciones.nombreArchivo || "").replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 60) ||
    "Rutina importada";
  const totalEjercicios = dias.reduce((total, d) => total + d.ejercicios.length, 0);
  const sinVideo = dias.reduce(
    (total, d) => total + d.ejercicios.filter((e) => !e.video_url).length,
    0
  );

  contenedor.innerHTML = `
    <p style="margin:0 0 10px"><strong>${dias.length} día${dias.length === 1 ? "" : "s"}</strong>
      y <strong>${totalEjercicios} ejercicio${totalEjercicios === 1 ? "" : "s"}</strong> encontrados.
      ${sinVideo ? `<br><span class="footer-note">${sinVideo} sin video.</span>` : ""}
    </p>
    ${dias
      .map(
        (dia, i) => `
          <div style="margin-bottom:12px">
            <div class="name" style="font-size:15px">Día ${i + 1} — ${esc(dia.titulo)}</div>
            <div class="history-list" style="padding:0 4px">
              ${dia.ejercicios
                .map(
                  (e) => `
                    <div class="history-row" style="padding:8px 0">
                      <div class="history-info">
                        <span class="history-fecha">${esc(e.nombre)}</span>
                        <span class="history-peso">${esc(e.series || "—")} × ${esc(e.repeticiones || "—")}${
                          e.descanso ? ` · ${esc(e.descanso)}` : ""
                        }${e.observaciones ? ` · ${esc(e.observaciones)}` : ""}</span>
                      </div>
                      ${
                        e.video_url
                          ? `<a href="${esc(e.video_url)}" target="_blank" rel="noopener noreferrer">Ver video</a>`
                          : `<span class="footer-note">Sin video</span>`
                      }
                    </div>
                  `
                )
                .join("")}
            </div>
          </div>
        `
      )
      .join("")}
    <div class="field">
      <label><input type="radio" name="importarModo" value="nueva" checked style="width:auto">
        Crear como rutina nueva (la actual queda en tu lista)</label>
      <input type="text" id="importarNombreRutina" maxlength="60" value="${esc(nombreSugerido)}"
        placeholder="Nombre de la rutina" style="margin:2px 0 10px">
      <label><input type="radio" name="importarModo" value="reemplazar" style="width:auto">
        Reemplazar la rutina actual por esta</label>
      <label><input type="radio" name="importarModo" value="agregar" style="width:auto">
        Agregar estos días a la rutina actual</label>
      <p class="footer-note" style="margin:6px 0 0;text-align:left">
        El historial de pesos se conserva: los pesos se unen por nombre de ejercicio, en cualquier rutina.
      </p>
    </div>
    <p class="auth-error" id="importarPdfError" hidden></p>
    <div class="form-actions">
      <button type="button" class="small" id="importarPdfCancelar">Cancelar</button>
      <button type="button" class="main-btn" id="importarPdfGuardar">Importar rutina</button>
    </div>
  `;

  document.getElementById("importarPdfCancelar").addEventListener("click", closeVideo);

  const guardar = document.getElementById("importarPdfGuardar");
  const errorEl = document.getElementById("importarPdfError");
  const nombreInput = document.getElementById("importarNombreRutina");
  nombreInput.addEventListener("focus", () => {
    contenedor.querySelector('input[name="importarModo"][value="nueva"]').checked = true;
  });

  guardar.addEventListener("click", async () => {
    const modo = contenedor.querySelector('input[name="importarModo"]:checked').value;
    guardar.disabled = true;
    errorEl.hidden = true;

    try {
      const datos = { modo, dias };
      if (modo === "nueva") datos.nombre_rutina = nombreInput.value.trim() || nombreSugerido;
      if (opciones.targetUsuarioId) datos.target_usuario_id = opciones.targetUsuarioId;
      const result = await api("importarRutina", datos);
      closeVideo();
      if (opciones.alTerminar) await opciones.alTerminar(result.rutina || []);
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
      guardar.disabled = false;
    }
  });
}
