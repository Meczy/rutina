const DONE_PREFIX = "mi-rutina-done-";

// Íconos como SVG en línea (en vez de emojis) para los botones de
// imagen/video en cada tarjeta de ejercicio.
const ICON_IMAGE = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4"></rect>
    <circle cx="8.5" cy="9.5" r="1.75" fill="currentColor" stroke="none"></circle>
    <path d="M21 15.5l-5.5-5.5a2 2 0 0 0-2.8 0L4 19"></path>
  </svg>
`;

const ICON_PLAY = `
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M8 5.14v13.72c0 .86.94 1.4 1.68.96l11.18-6.86a1.12 1.12 0 0 0 0-1.92L9.68 4.18C8.94 3.73 8 4.27 8 5.14z"></path>
  </svg>
`;

let rutina = [];
let misRutinas = []; // [{ id, nombre, activa, dias, compartidaCon }]
let selectedEditorDay = 0;
let currentDayIndex = 0;
let vista = "dias";
let semanaDiaElegido = null; // semana para la que ya se eligió el día a mostrar

const tabs = document.getElementById("tabs");
const tabsWrap = document.getElementById("tabsWrap");
const content = document.getElementById("content");
const infoSection = document.getElementById("infoSection");
const editor = document.getElementById("editor");
const editorList = document.getElementById("editorList");
const editorTabs = document.getElementById("editorTabs");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const modalTitle = document.getElementById("modalTitle");

const totalDaysEl = document.getElementById("totalDays");
const totalExercisesEl = document.getElementById("totalExercises");
const diasEntrenadosEl = document.getElementById("diasEntrenados");
const selectorRutinaEl = document.getElementById("selectorRutina");
const rutinaActivaSelect = document.getElementById("rutinaActivaSelect");
const gestionarRutinasButton = document.getElementById("gestionarRutinasButton");
const editorButton = document.getElementById("editorButton");
const personaButton = document.getElementById("personaButton");
const progresoButton = document.getElementById("progresoButton");
const closeEditorButton = document.getElementById("closeEditor");
const addDayButton = document.getElementById("addDay");
const verCatalogoButton = document.getElementById("verCatalogoButton");
const exportDataButton = document.getElementById("exportData");
const exerciseForm = document.getElementById("exerciseForm");
const formTitle = document.getElementById("formTitle");
const exerciseFormNota = document.getElementById("exerciseFormNota");
const exerciseName = document.getElementById("exerciseName");
const exerciseSeries = document.getElementById("exerciseSeries");
const exerciseReps = document.getElementById("exerciseReps");
const exerciseUrl = document.getElementById("exerciseUrl");
const cancelExercise = document.getElementById("cancelExercise");
const buscarWgerButton = document.getElementById("buscarWgerButton");
const wgerPreview = document.getElementById("wgerPreview");
const wgerPreviewImg = document.getElementById("wgerPreviewImg");
const wgerPlaceholderIcon = document.getElementById("wgerPlaceholderIcon");
const wgerAccionButton = document.getElementById("wgerAccionButton");
const imagenArchivoInput = document.getElementById("imagenArchivoInput");
const closeVideoButton = document.getElementById("close");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");
const diasButton = document.getElementById("diasButton");
const topnav = document.getElementById("topnav");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

// Subir SPRITE_VERSION cada vez que se agreguen íconos a sprite.svg: así el
// navegador baja el archivo nuevo en vez de usar la copia guardada.
const SPRITE_VERSION = "2";

function icon(nombre, clase = "") {
  return `<svg class="icon ${clase}" aria-hidden="true"><use href="/icons/sprite.svg?v=${SPRITE_VERSION}#${nombre}"></use></svg>`;
}

// --- Diálogos propios (en vez de alert/confirm/prompt del navegador, que en
// el celular se ven mal o directamente no aparecen en la app instalada).
// Van en su propia capa (#dialogo), por encima del modal y del editor. ---

let cerrarDialogoActual = null;

function abrirDialogo({ titulo = "", html, alAbrir, valorAlCancelar = null }) {
  const capa = document.getElementById("dialogo");
  if (cerrarDialogoActual) cerrarDialogoActual(null);

  return new Promise((resolve) => {
    capa.innerHTML = `
      <form class="dialogo-card" novalidate>
        ${titulo ? `<h3 class="dialogo-titulo">${esc(titulo)}</h3>` : ""}
        ${html}
      </form>
    `;
    capa.hidden = false;

    const form = capa.querySelector("form");
    const cerrar = (valor) => {
      if (cerrarDialogoActual !== cerrar) return;
      cerrarDialogoActual = null;
      capa.hidden = true;
      capa.innerHTML = "";
      document.removeEventListener("keydown", alPresionarTecla);
      resolve(valor);
    };
    const alPresionarTecla = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        cerrar(valorAlCancelar);
      }
    };

    cerrarDialogoActual = cerrar;
    document.addEventListener("keydown", alPresionarTecla);
    form.querySelectorAll("[data-dialogo-cancelar]").forEach((b) =>
      b.addEventListener("click", () => cerrar(valorAlCancelar))
    );
    alAbrir(form, cerrar);
  });
}

function avisar(mensaje, { titulo = "" } = {}) {
  return abrirDialogo({
    titulo,
    html: `
      <p class="dialogo-mensaje">${esc(mensaje)}</p>
      <div class="form-actions"><button type="submit" class="main-btn">Entendido</button></div>
    `,
    valorAlCancelar: undefined,
    alAbrir(form, cerrar) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        cerrar(undefined);
      });
      form.querySelector("button[type=submit]").focus();
    },
  });
}

// Devuelve true/false. Con peligro: true el botón de aceptar se ve rojo.
function confirmar(mensaje, { titulo = "", textoAceptar = "Aceptar", peligro = false } = {}) {
  return abrirDialogo({
    titulo,
    html: `
      <p class="dialogo-mensaje">${esc(mensaje)}</p>
      <div class="form-actions">
        <button type="button" class="small" data-dialogo-cancelar>Cancelar</button>
        <button type="submit" class="${peligro ? "main-btn peligro" : "main-btn"}">${esc(textoAceptar)}</button>
      </div>
    `,
    valorAlCancelar: false,
    alAbrir(form, cerrar) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        cerrar(true);
      });
      form.querySelector("button[type=submit]").focus();
    },
  });
}

// Devuelve el texto escrito (sin espacios de más) o null si se cancela.
function pedirTexto(mensaje, { titulo = "", valor = "", textoAceptar = "Guardar", obligatorio = true } = {}) {
  return abrirDialogo({
    titulo,
    html: `
      <label class="dialogo-mensaje" for="dialogoTexto">${esc(mensaje)}</label>
      <input id="dialogoTexto" class="dialogo-input" value="${esc(valor)}" autocomplete="off">
      <p class="auth-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="small" data-dialogo-cancelar>Cancelar</button>
        <button type="submit" class="main-btn">${esc(textoAceptar)}</button>
      </div>
    `,
    alAbrir(form, cerrar) {
      const input = form.querySelector("input");
      const error = form.querySelector(".auth-error");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const texto = input.value.trim();
        if (obligatorio && !texto) {
          error.textContent = "Escribí algo antes de guardar.";
          error.hidden = false;
          return;
        }
        cerrar(texto);
      });
      input.focus();
      input.select();
    },
  });
}

// Formulario de peso: viene cargado con el último peso y tiene botones de
// −2,5 / +2,5 kg. Devuelve el número elegido o null si se cancela.
function pedirPeso({ titulo, detalle = "", valor = "" }) {
  return abrirDialogo({
    titulo,
    html: `
      ${detalle ? `<p class="dialogo-mensaje">${esc(detalle)}</p>` : ""}
      <div class="peso-control">
        <button type="button" class="small peso-paso" data-paso="-2.5">−2,5</button>
        <div class="peso-campo">
          <input id="dialogoPeso" class="dialogo-input" inputmode="decimal" autocomplete="off"
            value="${valor === "" ? "" : esc(formatPeso(valor))}" placeholder="0" aria-label="Peso en kg">
          <span>kg</span>
        </div>
        <button type="button" class="small peso-paso" data-paso="2.5">+2,5</button>
      </div>
      <p class="auth-error" hidden></p>
      <div class="form-actions">
        <button type="button" class="small" data-dialogo-cancelar>Cancelar</button>
        <button type="submit" class="main-btn">Guardar</button>
      </div>
    `,
    alAbrir(form, cerrar) {
      const input = form.querySelector("input");
      const error = form.querySelector(".auth-error");
      const leer = () => Number(input.value.replace(",", ".").trim());

      form.querySelectorAll(".peso-paso").forEach((boton) => {
        boton.addEventListener("click", () => {
          const actual = Number.isFinite(leer()) ? leer() : 0;
          const nuevo = Math.max(0, Math.round((actual + Number(boton.dataset.paso)) * 100) / 100);
          input.value = formatPeso(nuevo);
          error.hidden = true;
        });
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const peso = leer();
        if (!input.value.trim() || !Number.isFinite(peso) || peso <= 0 || peso > 999) {
          error.textContent = "Ingresá un peso válido mayor a 0.";
          error.hidden = false;
          return;
        }
        cerrar(peso);
      });

      input.focus();
      input.select();
    },
  });
}

// Campo numérico con botones − / + propios (las flechas del navegador no
// aparecen en el celular). Acepta coma o punto como decimal.
function campoConPasos(id, { paso = 0.1, maximo = 999, requerido = false } = {}) {
  return `
    <div class="campo-pasos" data-paso="${paso}" data-maximo="${maximo}">
      <button type="button" class="campo-pasos-btn" data-direccion="-1" aria-label="Restar ${paso}">${icon("minus")}</button>
      <input id="${id}" inputmode="decimal" autocomplete="off" ${requerido ? "required" : ""}>
      <button type="button" class="campo-pasos-btn" data-direccion="1" aria-label="Sumar ${paso}">${icon("plus")}</button>
    </div>
  `;
}

function activarCamposConPasos(contenedor) {
  contenedor.querySelectorAll(".campo-pasos").forEach((campo) => {
    const input = campo.querySelector("input");
    const paso = Number(campo.dataset.paso);
    const maximo = Number(campo.dataset.maximo);

    campo.querySelectorAll(".campo-pasos-btn").forEach((boton) => {
      boton.addEventListener("click", () => {
        const actual = Number(input.value.replace(",", "."));
        const base = Number.isFinite(actual) ? actual : 0;
        const nuevo = Math.round((base + paso * Number(boton.dataset.direccion)) * 10) / 10;
        input.value = formatPeso(Math.min(maximo, Math.max(0, nuevo)));
      });
    });
  });
}

function youtubeEmbed(url) {
  const match = (url || "").match(
    /(?:youtube\.com\/(?:shorts\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return match
    ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
    : "";
}

function formatPeso(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Number(num.toFixed(1)).toString() : String(value);
}

function formatFecha(value) {
  const str = typeof value === "string" ? value : new Date(value).toISOString();
  const [y, m, d] = str.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function fechaHoy() {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - offsetMs).toISOString().slice(0, 10);
}

// Fecha del lunes de la semana actual (en la hora local del navegador).
// Se usa como parte de la clave de los checks para que se "desmarquen"
// solos al empezar una semana nueva, en vez de cada día.
function inicioSemana() {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  const local = new Date(ahora.getTime() - offsetMs);
  const diaSemana = local.getUTCDay(); // 0 = domingo, 1 = lunes, ... 6 = sábado
  const diasHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  local.setUTCDate(local.getUTCDate() - diasHastaLunes);
  return local.toISOString().slice(0, 10);
}

// Día que te toca: el primero de la semana que todavía no completaste
// (según las marcas). Si ya completaste todos, el último.
function indiceDiaQueToca() {
  const pendiente = rutina.findIndex(
    (d) => d.ejercicios.length && !d.ejercicios.every((e) => marcasSemana.has(e.id))
  );
  return pendiente >= 0 ? pendiente : Math.max(0, rutina.length - 1);
}

// --- Marcas de "hecho": se guardan en el servidor por semana (lunes), así
// se ven igual en todos los dispositivos y se reinician solas cada lunes. ---

let marcasSemana = new Set(); // ids de ejercicio (asignación a un día) marcados
let semanaMarcas = null; // lunes al que corresponden las marcas cargadas

// Antes las marcas vivían en localStorage. Las de la semana actual se suben
// al servidor una sola vez y después se borran del navegador.
async function migrarMarcasLocales() {
  let claves;
  try {
    claves = Object.keys(localStorage).filter((key) => key.startsWith(DONE_PREFIX));
  } catch {
    return;
  }
  if (!claves.length) return;

  const idsEnRutina = new Set(rutina.flatMap((d) => d.ejercicios.map((e) => e.id)));
  let todoOk = true;

  for (const key of claves) {
    const match = key.slice(DONE_PREFIX.length).match(/^\d+-(\d+)-(\d{4}-\d{2}-\d{2})$/);
    const ejercicioId = match ? Number(match[1]) : null;
    const vigente =
      match && match[2] === semanaMarcas && localStorage.getItem(key) === "1" && idsEnRutina.has(ejercicioId);

    if (vigente && !marcasSemana.has(ejercicioId)) {
      try {
        await api("marcarEjercicio", { ejercicio_id: ejercicioId, semana: semanaMarcas, hecho: true });
        marcasSemana.add(ejercicioId);
      } catch {
        todoOk = false;
        continue;
      }
    }
    localStorage.removeItem(key);
  }

  if (!todoOk) console.warn("Algunas marcas locales no se pudieron subir; se reintenta en la próxima carga.");
}

async function marcarEjercicio(exercise, hecho) {
  const semana = semanaMarcas || inicioSemana();
  if (hecho) marcasSemana.add(exercise.id);
  else marcasSemana.delete(exercise.id);
  actualizarDiasEntrenados();

  try {
    await api("marcarEjercicio", { ejercicio_id: exercise.id, semana, hecho });
  } catch (error) {
    if (hecho) marcasSemana.delete(exercise.id);
    else marcasSemana.add(exercise.id);
    render();
    avisar(error.message);
  }
}

// Un día cuenta como entrenado cuando todos sus ejercicios están marcados.
function actualizarDiasEntrenados() {
  const conEjercicios = rutina.filter((d) => d.ejercicios.length);
  const entrenados = conEjercicios.filter((d) => d.ejercicios.every((e) => marcasSemana.has(e.id)));
  diasEntrenadosEl.textContent = `${entrenados.length}/${conEjercicios.length}`;
}

// Si la app queda abierta y empieza una semana nueva, al volver a ella se
// recargan las marcas (quedan todas sin marcar).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && usuarioActual && semanaMarcas && semanaMarcas !== inicioSemana()) {
    cargarRutina().catch(() => {});
  }
});

// --- Usuario logueado (reemplaza al viejo nombre de "persona" libre) ---

let usuarioActual = null;

function nombreUsuario() {
  return usuarioActual ? usuarioActual.nombre : "";
}

// p = un peso de exercise.pesos ({ usuarioId, persona, peso, fecha }).
function esMiPeso(p) {
  return Boolean(usuarioActual) && p.usuarioId === usuarioActual.id;
}

function actualizarPersonaButton() {
  if (!personaButton) return;
  personaButton.innerHTML = usuarioActual
    ? `${icon("user")} ${esc(usuarioActual.nombre)}`
    : `${icon("user")}`;
}

async function cerrarSesion() {
  if (!(await confirmar("¿Querés cerrar sesión?", { textoAceptar: "Cerrar sesión" }))) return;
  try {
    await fetch("/api/rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    });
  } catch (error) {
    /* si falla la llamada igual mostramos la pantalla de login */
  }
  usuarioActual = null;
  rutina = [];
  semanaDiaElegido = null;
  mostrarPantallaLogin();
}

async function registrarPeso(exercise) {
  if (!usuarioActual) return;
  const previo = (exercise.pesos || []).find(esMiPeso);
  const peso = await pedirPeso({
    titulo: exercise.name,
    detalle: previo
      ? `¿Cuánto peso usaste hoy? La última vez (${formatFecha(previo.fecha)}) fueron ${formatPeso(previo.peso)} kg.`
      : "¿Cuánto peso usaste hoy?",
    valor: previo ? previo.peso : "",
  });
  if (peso === null) return;

  try {
    const response = await fetch("/api/rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "logWeight",
        catalogo_id: exercise.catalogoId,
        peso,
        fecha: fechaHoy()
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "No se pudo guardar el peso.");
    }

    rutina = result.rutina;
    render();
  } catch (error) {
    avisar(error.message);
  }
}

async function obtenerHistorialPeso(exercise, persona) {
  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getWeightHistory",
      catalogo_id: exercise.catalogoId
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "No se pudo cargar el historial.");
  }

  return result.historial || [];
}

async function verHistorialPeso(exercise, persona) {
  try {
    const historial = await obtenerHistorialPeso(exercise, persona);
    renderHistorialPeso(exercise, persona, historial);
    modal.classList.add("open");
  } catch (error) {
    avisar(error.message);
  }
}

function renderHistorialPeso(exercise, persona, historial) {
  modalTitle.textContent = `${exercise.name} · ${persona}`;
  modal.querySelector(".modal-card").classList.remove("vertical");

  if (!historial.length) {
    modalBody.innerHTML = `
      <div class="fallback">
        <h3>Sin pesos registrados todavía</h3>
        <p>Todavía no hay pesos registrados para ${esc(persona)} en "${esc(exercise.name)}".</p>
      </div>
    `;
    return;
  }

  const filas = historial
    .map((registro, index) => {
      const anterior = historial[index + 1];
      const diferencia = anterior ? registro.peso - anterior.peso : null;
      const signoClase =
        diferencia > 0 ? " up" : diferencia < 0 ? " down" : "";
      const signo =
        diferencia > 0 ? ` +${formatPeso(diferencia)}` :
        diferencia < 0 ? ` ${formatPeso(diferencia)}` : "";

      return `
        <div class="history-row" data-id="${registro.id}">
          <div class="history-info">
            <span class="history-fecha">${formatFecha(registro.fecha)}</span>
            <span class="history-peso">${formatPeso(registro.peso)}kg</span>
            ${signo ? `<span class="history-diff${signoClase}">${signo}</span>` : ""}
          </div>
          <div class="history-actions">
            <button type="button" class="small history-edit">${icon("pencil")} Editar</button>
            <button type="button" class="small danger history-delete">${icon("trash-2")} Eliminar</button>
          </div>
        </div>
      `;
    })
    .join("");

  modalBody.innerHTML = `<div class="history-list">${filas}</div>`;

  modalBody.querySelectorAll(".history-row").forEach((row) => {
    const id = Number(row.dataset.id);

    row.querySelector(".history-edit").addEventListener("click", async () => {
      const actual = historial.find((h) => h.id === id);
      const peso = await pedirPeso({
        titulo: exercise.name,
        detalle: `Nuevo peso para el ${formatFecha(actual.fecha)}.`,
        valor: actual.peso,
      });
      if (peso === null) return;

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateWeight", id, peso })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo actualizar el peso.");
        }
        rutina = result.rutina;
        render();
        const historialActualizado = await obtenerHistorialPeso(exercise, persona);
        renderHistorialPeso(exercise, persona, historialActualizado);
      } catch (error) {
        avisar(error.message);
      }
    });

    row.querySelector(".history-delete").addEventListener("click", async () => {
      const actual = historial.find((h) => h.id === id);
      if (!(await confirmar(`¿Eliminar el peso del ${formatFecha(actual.fecha)}?`, { textoAceptar: "Eliminar", peligro: true }))) return;

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteWeight", id })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo eliminar el peso.");
        }
        rutina = result.rutina;
        render();
        const historialActualizado = await obtenerHistorialPeso(exercise, persona);
        renderHistorialPeso(exercise, persona, historialActualizado);
      } catch (error) {
        avisar(error.message);
      }
    });
  });
}

// --- Pestaña "Mi progreso": peso corporal, % grasa y % agua por día ---

async function mostrarInfo() {
  vista = "info";
  content.hidden = true;
  tabsWrap.hidden = true;
  infoSection.classList.add("active");
  progresoButton.classList.add("active");
  diasButton.classList.remove("active");
  cerrarMenuNav();

  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));

  await renderInfoTab();
}

async function obtenerHistorialMetricas() {
  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getMetricasHistory" })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "No se pudo cargar el historial.");
  }

  return result.historial || [];
}

async function renderInfoTab() {
  const persona = nombreUsuario();
  if (!persona) return;

  infoSection.innerHTML = `
    <div class="day-head">
      <h2>${icon("chart-column")} Mi progreso</h2>
    </div>
    <div class="metrica-card">
      <div class="metrica-card-head">
        <strong id="infoPersonaNombre"></strong>
      </div>
      <form id="metricaForm">
        <div class="field"><label>Fecha</label><input type="date" id="metricaFecha" required></div>
        <div class="field"><label for="metricaPeso">Peso corporal (kg)</label>${campoConPasos("metricaPeso", { requerido: true })}</div>
        <div class="field"><label for="metricaGrasa">Grasa corporal % (opcional)</label>${campoConPasos("metricaGrasa", { maximo: 100 })}</div>
        <div class="field"><label for="metricaAgua">Agua % (opcional)</label>${campoConPasos("metricaAgua", { maximo: 100 })}</div>
        <p class="footer-note" id="metricaPrellenado" style="margin:0 0 10px;text-align:left" hidden></p>
        <button type="submit" class="main-btn">${icon("save")} Guardar registro del día</button>
      </form>
    </div>
    <div id="metricaHistorial"><p class="footer-note">Cargando historial…</p></div>
  `;

  document.getElementById("infoPersonaNombre").textContent = persona;

  const form = document.getElementById("metricaForm");
  const fechaInput = document.getElementById("metricaFecha");
  const pesoInput = document.getElementById("metricaPeso");
  const grasaInput = document.getElementById("metricaGrasa");
  const aguaInput = document.getElementById("metricaAgua");

  fechaInput.value = fechaHoy();
  fechaInput.max = fechaHoy();
  activarCamposConPasos(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const peso = Number(String(pesoInput.value).replace(",", "."));
    const grasa = grasaInput.value === "" ? null : Number(String(grasaInput.value).replace(",", "."));
    const agua = aguaInput.value === "" ? null : Number(String(aguaInput.value).replace(",", "."));

    if (!Number.isFinite(peso) || peso <= 0) {
      avisar("Ingresá un peso válido mayor a 0.");
      return;
    }

    try {
      const response = await fetch("/api/rutina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "logMetrica",
          fecha: fechaInput.value,
          peso,
          grasa,
          agua
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "No se pudo guardar el registro.");
      }

      form.reset();
      fechaInput.value = fechaHoy();
      prellenarMetricas(await cargarHistorialMetricas());
    } catch (error) {
      avisar(error.message);
    }
  });

  prellenarMetricas(await cargarHistorialMetricas());
}

// Carga el formulario con el último registro, para solo ajustarlo con los
// botones − / +. No pisa lo que la persona ya haya escrito.
function prellenarMetricas(historial) {
  const ultimo = historial && historial[0];
  if (!ultimo) return;

  const campos = [
    ["metricaPeso", ultimo.peso],
    ["metricaGrasa", ultimo.grasa],
    ["metricaAgua", ultimo.agua],
  ];
  let algunoCargado = false;
  for (const [id, valor] of campos) {
    const input = document.getElementById(id);
    if (input && input.value === "" && valor !== null && valor !== undefined) {
      input.value = formatPeso(valor);
      algunoCargado = true;
    }
  }

  const nota = document.getElementById("metricaPrellenado");
  if (nota && algunoCargado) {
    nota.textContent = `Cargado con tu último registro (${formatFecha(ultimo.fecha)}). Ajustalo y guardá.`;
    nota.hidden = false;
  }
}

// Devuelve el historial (o null si falló) para poder prellenar el formulario.
async function cargarHistorialMetricas() {
  const contenedor = document.getElementById("metricaHistorial");
  if (!contenedor) return null;

  try {
    const historial = await obtenerHistorialMetricas();
    renderHistorialMetricas(historial);
    return historial;
  } catch (error) {
    contenedor.innerHTML = `<p class="footer-note">${esc(error.message)}</p>`;
    return null;
  }
}

function construirGraficoSVG(historialCompleto) {
  if (historialCompleto.length < 2) return "";

  const MAX_PUNTOS = 30;
  // Orden cronológico (más antiguo primero) y nos quedamos con los más recientes.
  const datos = [...historialCompleto].reverse().slice(-MAX_PUNTOS);

  const width = 600;
  const height = 220;
  const padTop = 22;
  const padBottom = 30;
  const padLeft = 44;
  const padRight = 14;
  const areaW = width - padLeft - padRight;
  const areaH = height - padTop - padBottom;

  const pesos = datos.map((d) => d.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const rango = max - min || 1;

  const fechas = datos.map((d) => new Date(`${d.fecha.slice(0, 10)}T00:00:00`).getTime());
  const minFecha = fechas[0];
  const maxFecha = fechas[fechas.length - 1];
  const rangoFecha = maxFecha - minFecha;

  // Posición X según la fecha real (no según el índice), para que los
  // registros se vean espaciados de forma proporcional al tiempo real.
  const puntos = datos.map((d, i) => {
    const x =
      rangoFecha > 0
        ? padLeft + ((fechas[i] - minFecha) / rangoFecha) * areaW
        : padLeft + (areaW * i) / Math.max(datos.length - 1, 1);
    const y = padTop + areaH * (1 - (d.peso - min) / rango);
    return { x, y, d };
  });

  const linea = puntos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const circulos = puntos
    .map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="#d6336c"></circle>`)
    .join("");

  const yMax = padTop;
  const yMin = height - padBottom;

  // Hasta 5 etiquetas de fecha, bien repartidas (nunca pegadas a los puntos).
  const totalEtiquetas = Math.min(5, datos.length);
  const paso = totalEtiquetas > 1 ? (datos.length - 1) / (totalEtiquetas - 1) : 0;
  const indices = new Set();
  for (let i = 0; i < totalEtiquetas; i += 1) indices.add(Math.round(i * paso));

  const etiquetasFecha = [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      const p = puntos[i];
      const anchor = i === 0 ? "start" : i === datos.length - 1 ? "end" : "middle";
      return `<text x="${p.x.toFixed(1)}" y="${height - 8}" font-size="10.5" fill="#8b8290" text-anchor="${anchor}">${esc(formatFecha(p.d.fecha))}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="progreso-chart" preserveAspectRatio="xMidYMid meet">
      <line x1="${padLeft}" y1="${yMax}" x2="${width - padRight}" y2="${yMax}" stroke="#f0e2e8" stroke-width="1" stroke-dasharray="4 4"></line>
      <line x1="${padLeft}" y1="${yMin}" x2="${width - padRight}" y2="${yMin}" stroke="#f0e2e8" stroke-width="1" stroke-dasharray="4 4"></line>
      <text x="${padLeft - 6}" y="${yMax + 4}" font-size="10.5" fill="#8b8290" text-anchor="end">${formatPeso(max)}</text>
      <text x="${padLeft - 6}" y="${yMin + 4}" font-size="10.5" fill="#8b8290" text-anchor="end">${formatPeso(min)}</text>
      <polyline points="${linea}" fill="none" stroke="#d6336c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${circulos}
      ${etiquetasFecha}
    </svg>
  `;
}

// Resumen arriba de la lista: último registro + total ganado/perdido desde
// el primer registro guardado (historial viene ordenado del más reciente
// al más antiguo).
function construirResumenPeso(historial) {
  if (!historial.length) return "";

  const ultimo = historial[0];
  const primero = historial[historial.length - 1];
  const totalDiferencia = historial.length >= 2 ? ultimo.peso - primero.peso : null;

  const claseTotal = totalDiferencia > 0 ? " up" : totalDiferencia < 0 ? " down" : "";
  const signoTotal =
    totalDiferencia > 0 ? `+${formatPeso(totalDiferencia)}` :
    totalDiferencia < 0 ? `${formatPeso(totalDiferencia)}` :
    totalDiferencia === 0 ? "0" : "";

  return `
    <div class="metrica-card metrica-resumen">
      <div class="history-info">
        <span class="history-fecha">${formatFecha(ultimo.fecha)}</span>
        <span class="history-peso">${formatPeso(ultimo.peso)}kg</span>
        ${signoTotal ? `<span class="history-diff${claseTotal}">${signoTotal}</span>` : ""}
      </div>
      ${
        totalDiferencia !== null
          ? `<p class="footer-note">Total desde el ${esc(formatFecha(primero.fecha))}</p>`
          : ""
      }
    </div>
  `;
}

function renderHistorialMetricas(historial) {
  const contenedor = document.getElementById("metricaHistorial");
  if (!contenedor) return;

  if (!historial.length) {
    contenedor.innerHTML = `
      <div class="fallback" style="border-radius:16px">
        <h3>Sin registros todavía</h3>
        <p>Guardá tu primer peso corporal para empezar a ver tu progreso.</p>
      </div>
    `;
    return;
  }

  const filas = historial
    .map((m, index) => {
      const anterior = historial[index + 1];
      const diferencia = anterior ? m.peso - anterior.peso : null;
      const signoClase = diferencia > 0 ? " up" : diferencia < 0 ? " down" : "";
      const signo =
        diferencia > 0 ? ` +${formatPeso(diferencia)}` :
        diferencia < 0 ? ` ${formatPeso(diferencia)}` : "";

      const extras = [];
      if (m.grasa !== null && m.grasa !== undefined) extras.push(`${formatPeso(m.grasa)}% grasa`);
      if (m.agua !== null && m.agua !== undefined) extras.push(`${formatPeso(m.agua)}% agua`);

      return `
        <div class="history-row" data-id="${m.id}">
          <div class="history-info">
            <span class="history-fecha">${formatFecha(m.fecha)}</span>
            <span class="history-peso">${formatPeso(m.peso)}kg</span>
            ${signo ? `<span class="history-diff${signoClase}">${signo}</span>` : ""}
            ${extras.length ? `<span class="history-diff">${esc(extras.join(" · "))}</span>` : ""}
          </div>
          <div class="history-actions">
            <button type="button" class="small metrica-edit">${icon("pencil")} Editar</button>
            <button type="button" class="small danger metrica-delete">${icon("trash-2")} Eliminar</button>
          </div>
        </div>
      `;
    })
    .join("");

  contenedor.innerHTML = `
    ${construirResumenPeso(historial)}
    ${
      historial.length >= 2
        ? `<div class="metrica-card"><strong>Evolución del peso</strong>${construirGraficoSVG(historial)}</div>`
        : ""
    }
    <div class="history-list">${filas}</div>
  `;

  contenedor.querySelectorAll(".history-row").forEach((row) => {
    const id = Number(row.dataset.id);
    const registro = historial.find((h) => h.id === id);

    row.querySelector(".metrica-edit").addEventListener("click", () => {
      document.getElementById("metricaFecha").value = registro.fecha.slice(0, 10);
      document.getElementById("metricaPeso").value = registro.peso;
      document.getElementById("metricaGrasa").value = registro.grasa ?? "";
      document.getElementById("metricaAgua").value = registro.agua ?? "";
      document.getElementById("metricaForm").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    row.querySelector(".metrica-delete").addEventListener("click", async () => {
      if (!(await confirmar(`¿Eliminar el registro del ${formatFecha(registro.fecha)}?`, { textoAceptar: "Eliminar", peligro: true }))) return;

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteMetrica", id })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo eliminar el registro.");
        }
        await cargarHistorialMetricas();
      } catch (error) {
        avisar(error.message);
      }
    });
  });
}

async function api(action, data = {}) {
  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "No se pudo completar la operación.");
  }

  return result;
}

async function cargarRutina() {
  const semana = inicioSemana();
  const response = await fetch(`/api/rutina?semana=${semana}`, {
    method: "GET",
    cache: "no-store"
  });

  const result = await response.json().catch(() => ({}));

  if (response.status === 401) {
    usuarioActual = null;
    mostrarPantallaLogin();
    throw new Error("No autorizado.");
  }

  if (!response.ok || !Array.isArray(result.rutina)) {
    throw new Error(result.error || "No se pudo cargar la rutina.");
  }

  usuarioActual = result.usuario || usuarioActual;
  rutina = result.rutina;
  misRutinas = result.rutinas || [];
  marcasSemana = new Set(result.marcas || []);
  semanaMarcas = semana;

  if (usuarioActual && usuarioActual.rol !== "admin") {
    await migrarMarcasLocales();
  }

  // Al abrir la app (y cuando empieza una semana nueva) se muestra el día
  // que toca; después se respeta el día que elijas.
  if (semanaDiaElegido !== semana) {
    semanaDiaElegido = semana;
    currentDayIndex = indiceDiaQueToca();
  }

  if (selectedEditorDay >= rutina.length) {
    selectedEditorDay = Math.max(0, rutina.length - 1);
  }

  render();
}

// --- Rutina activa: se elige en el encabezado y queda guardada en la cuenta
// hasta que se cambie (también desde otros dispositivos). ---

function renderSelectorRutina() {
  selectorRutinaEl.hidden = !misRutinas.length;
  rutinaActivaSelect.innerHTML = misRutinas
    .map((r) => `<option value="${r.id}" ${r.activa ? "selected" : ""}>${esc(r.nombre)}</option>`)
    .join("");
  rutinaActivaSelect.disabled = misRutinas.length < 2;
}

async function activarRutina(rutinaId) {
  try {
    await api("activarRutina", { rutina_id: rutinaId });
    semanaDiaElegido = null; // mostrar el día que toca en la rutina nueva
    selectedEditorDay = 0;
    await cargarRutina();
    if (editor.classList.contains("open")) renderEditor();
  } catch (error) {
    renderSelectorRutina();
    avisar(error.message);
  }
}

rutinaActivaSelect.addEventListener("change", () => activarRutina(Number(rutinaActivaSelect.value)));
gestionarRutinasButton.addEventListener("click", () => abrirMiCuenta("rutinas"));

function render() {
  tabs.innerHTML = "";
  content.innerHTML = "";
  renderSelectorRutina();

  if (currentDayIndex >= rutina.length) {
    currentDayIndex = Math.max(0, rutina.length - 1);
  }

  totalDaysEl.textContent = rutina.length;
  totalExercisesEl.textContent = rutina.reduce(
    (total, day) => total + day.ejercicios.length,
    0
  );
  actualizarDiasEntrenados();

  rutina.forEach((day, dayIndex) => {
    const tab = document.createElement("button");
    tab.className = "tab" + (dayIndex === currentDayIndex && vista === "dias" ? " active" : "");
    tab.textContent = `Día ${day.numero}`;
    tab.addEventListener("click", () => showDay(dayIndex));
    tabs.appendChild(tab);

    const section = document.createElement("section");
    section.className = "day" + (dayIndex === currentDayIndex ? " active" : "");
    section.innerHTML = `
      <div class="day-head">
        <h2>${esc(day.titulo)}</h2>
        <span>${day.ejercicios.length} ejercicios</span>
      </div>
    `;

    const list = document.createElement("div");
    list.className = "exercise-list";

    day.ejercicios.forEach((exercise, exerciseIndex) => {
      const completed = marcasSemana.has(exercise.id);

      const card = document.createElement("article");
      const platform = /instagram\.com/i.test(exercise.url || "")
        ? "instagram"
        : "";

      card.className = "card" + (completed ? " done" : "");

      const pesosHtml = (exercise.pesos || [])
        .map(
          (p, i) => `
            <button type="button" class="weight-chip${esMiPeso(p) ? " mine" : ""}" data-peso-index="${i}">
              ${icon("dumbbell")} ${esc(p.persona)} <strong>${formatPeso(p.peso)}kg</strong>
            </button>
          `
        )
        .join("");

      card.innerHTML = `
        <div class="num">${exerciseIndex + 1}</div>
        <div>
          <div class="name-row">
            <div class="name">${esc(exercise.name)}</div>
            <input class="check" type="checkbox" ${completed ? "checked" : ""}>
          </div>
          <div class="meta">
            ${exercise.series ? `<span class="pill">${esc(exercise.series)} series</span>` : ""}
            ${exercise.reps ? `<span class="pill">${esc(exercise.reps)} reps</span>` : ""}
          </div>
          <div class="actions">
            ${
              exercise.imageUrl
                ? `<button type="button" class="icon-btn img-btn" title="Ver imagen">${ICON_IMAGE}<span>Imagen</span></button>`
                : ""
            }
            ${
              exercise.url
                ? `<button type="button" class="icon-btn play ${platform}" title="Ver video">${ICON_PLAY}<span>Video</span></button>`
                : ""
            }
            ${
              !exercise.imageUrl && !exercise.url
                ? `<span class="icon-btn icon-btn-empty">Sin contenido</span>`
                : ""
            }
          </div>
          <div class="weights">
            ${pesosHtml}
            <button type="button" class="weight-add">+ peso</button>
          </div>
        </div>
      `;

      card.querySelectorAll(".weight-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const p = exercise.pesos[Number(chip.dataset.pesoIndex)];
          // Solo se puede abrir (y editar) el historial propio.
          if (p && esMiPeso(p)) verHistorialPeso(exercise, p.persona);
        });
      });

      card.querySelector(".weight-add").addEventListener("click", () => {
        registrarPeso(exercise);
      });

      const videoButton = card.querySelector(".play");
      if (videoButton) {
        videoButton.addEventListener("click", () => openVideo(exercise));
      }

      const imgButton = card.querySelector(".img-btn");
      if (imgButton) {
        imgButton.addEventListener("click", () => openImage(exercise));
      }

      card.querySelector(".check").addEventListener("change", (event) => {
        card.classList.toggle("done", event.target.checked);
        marcarEjercicio(exercise, event.target.checked);
      });

      list.appendChild(card);
    });

    section.appendChild(list);
    content.appendChild(section);
  });

  content.hidden = vista !== "dias";
  tabsWrap.hidden = vista !== "dias";
  infoSection.classList.toggle("active", vista === "info");
  progresoButton.classList.toggle("active", vista === "info");
  diasButton.classList.toggle("active", vista === "dias");
  actualizarPersonaButton();
}

function showDay(index) {
  currentDayIndex = index;
  vista = "dias";

  content.hidden = false;
  tabsWrap.hidden = false;
  infoSection.classList.remove("active");
  progresoButton.classList.remove("active");
  diasButton.classList.add("active");
  cerrarMenuNav();

  const tabButtons = [...tabs.querySelectorAll(".tab")];
  tabButtons.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  document.querySelectorAll(".day").forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });
}

function openVideo(exercise) {
  modalTitle.textContent = exercise.name;
  const embed = youtubeEmbed(exercise.url);
  const isVertical = Boolean(embed) && /shorts\//i.test(exercise.url || "");
  const modalCard = modal.querySelector(".modal-card");
  modalCard.classList.toggle("vertical", isVertical);

  if (embed) {
    modalBody.innerHTML = `
      <div class="video-frame${isVertical ? " vertical" : ""}">
        <iframe
          src="${esc(embed)}"
          title="${esc(exercise.name)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen>
        </iframe>
      </div>
    `;
  } else {
    modalBody.innerHTML = `
      <div class="fallback">
        <h3>Este video se abrirá en su plataforma original</h3>
        <p>La plataforma puede bloquear la reproducción dentro de esta página.</p>
        <a href="${esc(exercise.url)}" target="_blank" rel="noopener noreferrer">Abrir video</a>
      </div>
    `;
  }

  modal.classList.add("open");
}

function openImage(exercise) {
  modalTitle.textContent = exercise.name;
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `
    <div class="image-frame">
      <img src="${esc(exercise.imageUrl)}" alt="${esc(exercise.name)}">
    </div>
  `;
  modal.classList.add("open");
}

function closeVideo() {
  modal.classList.remove("open");
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = "";
}

async function openEditor() {
  editor.classList.add("open");
  renderEditor();
}

function renderEditor() {
  if (!rutina.length) {
    editorTabs.innerHTML = "";
    editorList.innerHTML = "";
    return;
  }

  if (selectedEditorDay >= rutina.length) {
    selectedEditorDay = rutina.length - 1;
  }

  editorTabs.innerHTML = "";

  const diaActual = rutina[selectedEditorDay];

  const switcher = document.createElement("div");
  switcher.className = "day-switcher";

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "day-switcher-arrow";
  prevButton.setAttribute("aria-label", "Día anterior");
  prevButton.textContent = "‹";
  prevButton.disabled = selectedEditorDay === 0;
  prevButton.addEventListener("click", () => {
    if (selectedEditorDay > 0) {
      selectedEditorDay -= 1;
      renderEditor();
    }
  });

  const selectWrap = document.createElement("div");
  selectWrap.className = "day-switcher-select-wrap";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "day-switcher-select";
  trigger.innerHTML = `
    <span class="day-switcher-select-num">Día ${esc(diaActual.numero)}</span>
    ${diaActual.titulo ? `<span class="day-switcher-select-title">${esc(diaActual.titulo)}</span>` : ""}
  `;

  const menu = document.createElement("div");
  menu.className = "day-switcher-menu";
  menu.hidden = true;

  function closeMenu() {
    menu.hidden = true;
    document.removeEventListener("click", onDocClick);
  }
  function onDocClick(e) {
    if (!selectWrap.contains(e.target)) closeMenu();
  }

  rutina.forEach((day, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "day-switcher-menu-item" + (index === selectedEditorDay ? " active" : "");
    item.innerHTML = `
      <span class="day-switcher-menu-num">Día ${esc(day.numero)}</span>
      ${day.titulo ? `<span class="day-switcher-menu-title">${esc(day.titulo)}</span>` : ""}
    `;
    item.addEventListener("click", () => {
      closeMenu();
      selectedEditorDay = index;
      renderEditor();
    });
    menu.appendChild(item);
  });

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      menu.hidden = false;
      document.addEventListener("click", onDocClick);
    } else {
      closeMenu();
    }
  });

  selectWrap.append(trigger, menu);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "day-switcher-arrow";
  nextButton.setAttribute("aria-label", "Día siguiente");
  nextButton.textContent = "›";
  nextButton.disabled = selectedEditorDay === rutina.length - 1;
  nextButton.addEventListener("click", () => {
    if (selectedEditorDay < rutina.length - 1) {
      selectedEditorDay += 1;
      renderEditor();
    }
  });

  switcher.append(prevButton, selectWrap, nextButton);
  editorTabs.appendChild(switcher);

  const day = rutina[selectedEditorDay];
  editorList.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "editor-day-title";
  heading.innerHTML = `
    <div class="editor-day-fields">
      <div class="day-number-edit">
        <label>Día</label>
        <input id="dayNumberInput" type="number" min="1" step="1" value="${Number(day.numero) || 1}">
      </div>
      <div class="day-name-edit">
        <label>Nombre</label>
        <input id="dayNameInput" value="${esc(day.titulo)}">
      </div>
      <div class="day-actions">
        <button class="small icon-only save-day-name" title="Guardar día" aria-label="Guardar día">${icon("save")}<span class="btn-label"></span></button>
        <button class="small icon-only danger delete-day-button" title="Eliminar día" aria-label="Eliminar día">${icon("trash-2")}<span class="btn-label"></span></button>
      </div>
    </div>
  `;

  heading.querySelector(".save-day-name").addEventListener("click", saveDaySettings);
  heading.querySelector(".delete-day-button").addEventListener("click", deleteCurrentDay);
  editorList.appendChild(heading);

  const exerciseList = document.createElement("div");
  exerciseList.className = "editor-exercise-list";

  day.ejercicios.forEach((exercise, index) => {
    const row = document.createElement("div");
    row.className = "edit-row";
    row.dataset.exerciseId = String(exercise.id);

    row.innerHTML = `
      <div class="edit-row-info">
        <strong>${esc(exercise.name)}</strong>
        <div class="edit-meta">
          ${esc(exercise.series)} × ${esc(exercise.reps)} · ${exercise.url ? "video agregado" : "sin video"}
        </div>
      </div>
      <div class="edit-actions">
        <button class="small move-up" aria-label="Mover arriba">${icon("chevron-up")}</button>
        <button class="small move-down" aria-label="Mover abajo">${icon("chevron-down")}</button>
        <button class="small edit-button">${icon("pencil")} </button>
        <button class="small danger delete-button" aria-label="Eliminar">${icon("trash-2")}</button>
      </div>
    `;

    row.querySelector(".move-up").addEventListener("click", () => moveExercise(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => moveExercise(index, 1));
    row.querySelector(".edit-button").addEventListener("click", () => editExercise(exercise));
    row.querySelector(".delete-button").addEventListener("click", () => deleteExercise(exercise));

    exerciseList.appendChild(row);
  });

  editorList.appendChild(exerciseList);

  const addButton = document.createElement("button");
  addButton.className = "add-btn";
  addButton.textContent = "＋ Agregar ejercicio a este día";
  addButton.addEventListener("click", () => abrirSelectorCatalogo());
  editorList.appendChild(addButton);
}

async function saveDaySettings() {
  const day = rutina[selectedEditorDay];
  const numero = Number(document.getElementById("dayNumberInput").value);
  const nombre = document.getElementById("dayNameInput").value.trim();

  if (!Number.isInteger(numero) || numero < 1) {
    avisar("El número del día debe ser un entero mayor a 0.");
    return;
  }

  if (!nombre) {
    avisar("Escribe un nombre para el día.");
    return;
  }

  try {
    const result = await api("updateDay", {
      id: day.id,
      numero,
      nombre
    });

    rutina = result.rutina;
    selectedEditorDay = Math.max(
      0,
      rutina.findIndex((item) => Number(item.numero) === numero)
    );

    render();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
}

async function deleteCurrentDay() {
  const day = rutina[selectedEditorDay];

  if (rutina.length === 1) {
    avisar("Debe existir al menos un día.");
    return;
  }

  if (!(await confirmar(`¿Eliminar el Día ${day.numero} y todos sus ejercicios?`, { textoAceptar: "Eliminar día", peligro: true }))) {
    return;
  }

  try {
    const result = await api("deleteDay", { id: day.id });
    rutina = result.rutina;
    selectedEditorDay = Math.min(selectedEditorDay, rutina.length - 1);
    render();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
}

addDayButton.addEventListener("click", async () => {
  const max = Math.max(0, ...rutina.map((day) => Number(day.numero) || 0));
  const numero = max + 1;
  const nombre = await pedirTexto("Nombre del nuevo día:", { titulo: "Nuevo día", valor: `Día ${numero}`, textoAceptar: "Crear día" });

  if (!nombre) return;

  try {
    const result = await api("createDay", {
      numero,
      nombre: nombre.trim()
    });

    rutina = result.rutina;
    selectedEditorDay = rutina.findIndex((item) => Number(item.numero) === numero);
    render();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
});

function openExerciseForm(exercise = null) {
  formTitle.textContent = exercise ? "Editar ejercicio" : "Agregar ejercicio";
  exerciseName.value = exercise?.name || "";
  exerciseSeries.value = exercise?.series || "";
  exerciseReps.value = exercise?.reps || "";
  exerciseUrl.value = exercise?.url || "";
  exerciseForm.dataset.exerciseId = exercise?.id ? String(exercise.id) : "";
  exerciseForm.dataset.catalogoId = "";
  exerciseForm.dataset.imageUrl = exercise?.imageUrl || "";
  exerciseForm.dataset.wgerId = exercise?.wgerId ? String(exercise.wgerId) : "";
  exerciseForm.classList.remove("modo-catalogo");
  exerciseFormNota.hidden = !exercise;
  actualizarWgerPreview();
  exerciseForm.classList.add("open");
}

// Editar un ejercicio directamente desde el catálogo (fuera de un día
// puntual): mismo formulario, pero sin series/repeticiones y guardando en
// catalogoActualizar en vez de en la asignación a un día.
function openCatalogoForm(item) {
  formTitle.textContent = "Editar ejercicio del catálogo";
  exerciseName.value = item.name || "";
  exerciseSeries.value = "";
  exerciseReps.value = "";
  exerciseUrl.value = item.url || "";
  exerciseForm.dataset.exerciseId = "";
  exerciseForm.dataset.catalogoId = String(item.id);
  exerciseForm.dataset.imageUrl = item.imageUrl || "";
  exerciseForm.dataset.wgerId = item.wgerId ? String(item.wgerId) : "";
  exerciseForm.classList.add("modo-catalogo");
  exerciseFormNota.hidden = false;
  actualizarWgerPreview();
  exerciseForm.classList.add("open");
}

function actualizarWgerPreview() {
  const imagen = exerciseForm.dataset.imageUrl || "";
  if (imagen) {
    wgerPreviewImg.src = imagen;
    wgerPreviewImg.removeAttribute("hidden");
    wgerPlaceholderIcon.setAttribute("hidden", "");
    wgerAccionButton.textContent = "Eliminar imagen";
    wgerAccionButton.classList.add("danger");
  } else {
    wgerPreviewImg.src = "";
    wgerPreviewImg.setAttribute("hidden", "");
    wgerPlaceholderIcon.removeAttribute("hidden");
    wgerAccionButton.textContent = "Cargar imagen";
    wgerAccionButton.classList.remove("danger");
  }
}

// El mismo botón hace de "Cargar imagen" (abre el selector de archivos del
// dispositivo) cuando no hay imagen, y de "Eliminar imagen" cuando ya hay
// una cargada (ya sea elegida en wger o subida a mano).
wgerAccionButton.addEventListener("click", () => {
  const tieneImagen = Boolean(exerciseForm.dataset.imageUrl);
  if (tieneImagen) {
    exerciseForm.dataset.imageUrl = "";
    exerciseForm.dataset.wgerId = "";
    imagenArchivoInput.value = "";
    actualizarWgerPreview();
  } else {
    imagenArchivoInput.click();
  }
});

buscarWgerButton.addEventListener("click", abrirBuscadorWger);

// --- Subir una foto propia desde el celular/computadora (galería o cámara) ---

imagenArchivoInput.addEventListener("change", async () => {
  const archivo = imagenArchivoInput.files && imagenArchivoInput.files[0];
  if (!archivo) return;

  if (!archivo.type.startsWith("image/")) {
    avisar("Elegí un archivo de imagen.");
    imagenArchivoInput.value = "";
    return;
  }

  try {
    const dataUrl = await comprimirImagen(archivo);
    exerciseForm.dataset.imageUrl = dataUrl;
    exerciseForm.dataset.wgerId = "";
    actualizarWgerPreview();
  } catch (error) {
    avisar("No se pudo cargar la imagen: " + error.message);
  } finally {
    imagenArchivoInput.value = "";
  }
});

// Redimensiona/comprime la imagen elegida en el dispositivo antes de
// guardarla, para no mandar fotos de varios MB al servidor.
function comprimirImagen(archivo, maxLado = 800, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no es una imagen válida."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxLado || height > maxLado) {
          if (width >= height) {
            height = Math.round((height * maxLado) / width);
            width = maxLado;
          } else {
            width = Math.round((width * maxLado) / height);
            height = maxLado;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// --- Agregar ejercicio a un día: elegir uno ya existente del catálogo de
// esta rutina (así el historial de peso queda compartido con los demás
// días donde se use) o crear uno nuevo. ---

async function abrirSelectorCatalogo() {
  modalTitle.textContent = "Agregar ejercicio";
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `<p class="footer-note" style="padding:16px">Cargando catálogo…</p>`;
  modal.classList.add("open");

  try {
    const result = await api("catalogoListar");
    renderSelectorCatalogo(result.catalogo || []);
  } catch (error) {
    modalBody.innerHTML = `
      <div class="fallback" style="border-radius:16px">
        <h3>No se pudo cargar</h3>
        <p>${esc(error.message)}</p>
      </div>
    `;
  }
}

function renderSelectorCatalogo(catalogo) {
  modalBody.innerHTML = `
    <div class="wger-buscador">
      <button type="button" class="main-btn" id="crearEjercicioNuevoBtn" style="width:100%;justify-content:center;margin-bottom:12px">
        ${icon("plus")} Crear ejercicio nuevo
      </button>
      <div class="wger-filtros">
        <input type="text" id="catalogoTextoInput" placeholder="Buscar en tu catálogo">
      </div>
      <div id="catalogoResultados"></div>
    </div>
  `;

  document.getElementById("crearEjercicioNuevoBtn").addEventListener("click", () => {
    closeVideo();
    openExerciseForm();
  });

  const textoInput = document.getElementById("catalogoTextoInput");
  const pintar = () => {
    const texto = textoInput.value.trim().toLowerCase();
    const filtrados = texto
      ? catalogo.filter((c) => c.name.toLowerCase().includes(texto))
      : catalogo;
    renderResultadosCatalogo(filtrados, catalogo);
  };
  textoInput.addEventListener("input", pintar);
  pintar();
}

function renderResultadosCatalogo(filtrados, catalogoCompleto) {
  const contenedor = document.getElementById("catalogoResultados");

  if (!catalogoCompleto.length) {
    contenedor.innerHTML = `<p class="footer-note">Todavía no tenés ejercicios en el catálogo. Creá el primero con el botón de arriba.</p>`;
    return;
  }

  if (!filtrados.length) {
    contenedor.innerHTML = `<p class="footer-note">Sin resultados para esa búsqueda.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="wger-grid">
      ${filtrados
        .map(
          (c) => `
            <button type="button" class="wger-card" data-catalogo-id="${c.id}">
              ${c.imageUrl ? `<img src="${esc(c.imageUrl)}" alt="${esc(c.name)}" loading="lazy">` : `<div class="wger-card-sin-imagen">Sin imagen</div>`}
              <span>${esc(c.name)}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  contenedor.querySelectorAll(".wger-card").forEach((card) => {
    card.addEventListener("click", () => {
      const item = catalogoCompleto.find((c) => String(c.id) === card.dataset.catalogoId);
      if (item) abrirFormularioAsignacion(item);
    });
  });
}

function abrirFormularioAsignacion(item) {
  modalTitle.textContent = item.name;
  modalBody.innerHTML = `
    <form id="asignarCatalogoForm" style="padding:16px;display:flex;flex-direction:column;gap:14px">
      <div class="wger-preview">
        <div class="wger-thumb">${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.name)}">` : ""}</div>
        <strong>${esc(item.name)}</strong>
      </div>
      <div class="field"><label>Series</label><input id="asignarSeries"></div>
      <div class="field"><label>Repeticiones</label><input id="asignarReps"></div>
      <div class="form-actions">
        <button type="button" class="small" id="asignarCancelar">Cancelar</button>
        <button type="submit" class="main-btn">Agregar al día</button>
      </div>
    </form>
  `;

  document.getElementById("asignarCancelar").addEventListener("click", closeVideo);

  document.getElementById("asignarCatalogoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const series = document.getElementById("asignarSeries").value.trim();
    const repeticiones = document.getElementById("asignarReps").value.trim();
    const day = rutina[selectedEditorDay];

    try {
      await api("createExercise", { dia_id: day.id, catalogo_id: item.id, series, repeticiones });
      closeVideo();
      await cargarRutina();
      renderEditor();
    } catch (error) {
      avisar(error.message);
    }
  });
}

// --- Gestión del catálogo: ver, editar y borrar ejercicios propios sin
// pasar por ningún día en particular. ---

verCatalogoButton.addEventListener("click", abrirGestionCatalogo);

document.getElementById("importarPdfButton").addEventListener("click", () => {
  abrirImportarPdf({
    alTerminar: async () => {
      selectedEditorDay = 0;
      currentDayIndex = 0;
      await cargarRutina();
      renderEditor();
    }
  });
});

async function abrirGestionCatalogo() {
  modalTitle.textContent = "Catálogo de ejercicios";
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `<p class="footer-note" style="padding:16px">Cargando catálogo…</p>`;
  modal.classList.add("open");

  try {
    const result = await api("catalogoListar");
    renderGestionCatalogo(result.catalogo || []);
  } catch (error) {
    modalBody.innerHTML = `
      <div class="fallback" style="border-radius:16px">
        <h3>No se pudo cargar</h3>
        <p>${esc(error.message)}</p>
      </div>
    `;
  }
}

function renderGestionCatalogo(catalogo) {
  if (!catalogo.length) {
    modalBody.innerHTML = `<p class="footer-note" style="padding:16px">Todavía no tenés ejercicios en el catálogo.</p>`;
    return;
  }

  modalBody.innerHTML = `
    <div class="history-list" style="padding:16px">
      ${catalogo
        .map(
          (c) => `
            <div class="history-row" data-catalogo-id="${c.id}">
              <div class="history-info">
                <span class="history-fecha">${esc(c.name)}</span>
                <span class="history-peso">${c.usos} día${c.usos === 1 ? "" : "s"}</span>
              </div>
              <div class="history-actions">
                <button type="button" class="small catalogo-edit">${icon("pencil")} Editar</button>
                <button type="button" class="small danger catalogo-delete">${icon("trash-2")} Eliminar</button>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  modalBody.querySelectorAll(".history-row").forEach((row) => {
    const item = catalogo.find((c) => String(c.id) === row.dataset.catalogoId);
    if (!item) return;

    row.querySelector(".catalogo-edit").addEventListener("click", () => {
      closeVideo();
      openCatalogoForm(item);
    });

    row.querySelector(".catalogo-delete").addEventListener("click", async () => {
      const advertencia =
        item.usos > 0
          ? ` Se usa en ${item.usos} día${item.usos === 1 ? "" : "s"}: al eliminarlo, desaparece de esos días junto con su historial de peso.`
          : "";
      if (!(await confirmar(`¿Eliminar "${item.name}" del catálogo?${advertencia}`, { textoAceptar: "Eliminar", peligro: true }))) return;

      try {
        await api("catalogoEliminar", { id: item.id });
        await cargarRutina();
        renderEditor();
        abrirGestionCatalogo();
      } catch (error) {
        avisar(error.message);
      }
    });
  });
}

async function abrirBuscadorWger() {
  modalTitle.textContent = "Buscar en la librería de ejercicios (wger)";
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `<p class="footer-note" style="padding:16px">Cargando categorías…</p>`;
  modal.classList.add("open");

  try {
    const result = await api("wgerCategorias");
    renderBuscadorWger(result.categorias || []);
  } catch (error) {
    modalBody.innerHTML = `
      <div class="fallback" style="border-radius:16px">
        <h3>No se pudo cargar</h3>
        <p>${esc(error.message)}</p>
      </div>
    `;
  }
}

function renderBuscadorWger(categorias) {
  modalBody.innerHTML = `
    <div class="wger-buscador">
      <div class="wger-filtros">
        <select id="wgerCategoriaSelect">
          <option value="">Todas las categorías</option>
          ${categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("")}
        </select>
        <input type="text" id="wgerTextoInput" placeholder="Buscar por nombre">
        <button type="button" class="small" id="wgerBuscarBtn">Buscar</button>
      </div>
      <div id="wgerResultados">
        <p class="footer-note">Elegí una categoría (ej. Abs, Chest, Legs…) o escribí un nombre para buscar.</p>
      </div>
    </div>
  `;

  const categoriaSelect = document.getElementById("wgerCategoriaSelect");
  const textoInput = document.getElementById("wgerTextoInput");

  categoriaSelect.addEventListener("change", buscarEnWger);
  document.getElementById("wgerBuscarBtn").addEventListener("click", buscarEnWger);
  textoInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") buscarEnWger();
  });
}

async function buscarEnWger() {
  const categoriaId = document.getElementById("wgerCategoriaSelect").value;
  const texto = document.getElementById("wgerTextoInput").value.trim();
  const contenedor = document.getElementById("wgerResultados");

  if (!categoriaId && !texto) {
    contenedor.innerHTML = `<p class="footer-note">Elegí una categoría o escribí un nombre para buscar.</p>`;
    return;
  }

  contenedor.innerHTML = `<p class="footer-note">Buscando…</p>`;

  try {
    const result = await api("wgerBuscar", {
      categoria_id: categoriaId || null,
      texto
    });
    renderResultadosWger(result.ejercicios || []);
  } catch (error) {
    contenedor.innerHTML = `<p class="footer-note">${esc(error.message)}</p>`;
  }
}

function renderResultadosWger(ejercicios) {
  const contenedor = document.getElementById("wgerResultados");

  if (!ejercicios.length) {
    contenedor.innerHTML = `<p class="footer-note">Sin resultados. Probá con otra categoría o término.</p>`;
    return;
  }

  contenedor.innerHTML = `
    <div class="wger-grid">
      ${ejercicios
        .map(
          (ex) => `
            <button type="button" class="wger-card" data-wger-id="${ex.wger_id}" data-nombre="${esc(ex.nombre)}" data-imagen="${esc(ex.imagen || "")}">
              ${ex.imagen ? `<img src="${esc(ex.imagen)}" alt="${esc(ex.nombre)}" loading="lazy">` : `<div class="wger-card-sin-imagen">Sin imagen</div>`}
              <span>${esc(ex.nombre)}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  contenedor.querySelectorAll(".wger-card").forEach((card) => {
    card.addEventListener("click", () => {
      exerciseForm.dataset.wgerId = card.dataset.wgerId;
      exerciseForm.dataset.imageUrl = card.dataset.imagen;
      exerciseName.value = card.dataset.nombre;
      actualizarWgerPreview();
      closeVideo();
    });
  });
}

function editExercise(exercise) {
  openExerciseForm(exercise);
}

cancelExercise.addEventListener("click", () => {
  exerciseForm.classList.remove("open", "modo-catalogo");
  exerciseForm.dataset.exerciseId = "";
  exerciseForm.dataset.catalogoId = "";
  exerciseForm.dataset.imageUrl = "";
  exerciseForm.dataset.wgerId = "";
  actualizarWgerPreview();
});

exerciseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const exerciseId = Number(exerciseForm.dataset.exerciseId || 0);
  const catalogoId = Number(exerciseForm.dataset.catalogoId || 0);
  const nombre = exerciseName.value.trim();
  const series = exerciseSeries.value.trim();
  const repeticiones = exerciseReps.value.trim();
  const videoUrl = exerciseUrl.value.trim();
  const imageUrl = exerciseForm.dataset.imageUrl || "";
  const wgerId = exerciseForm.dataset.wgerId || "";

  if (!nombre) {
    avisar("Escribe el nombre del ejercicio.");
    return;
  }

  try {
    if (catalogoId) {
      // Editando el ejercicio desde el catálogo (no desde un día puntual):
      // no hay series/repeticiones que guardar acá, esas son por día.
      await api("catalogoActualizar", {
        id: catalogoId,
        nombre,
        video_url: videoUrl,
        image_url: imageUrl,
        wger_id: wgerId
      });
    } else if (exerciseId) {
      await api("updateExercise", {
        id: exerciseId,
        nombre,
        series,
        repeticiones,
        video_url: videoUrl,
        image_url: imageUrl,
        wger_id: wgerId
      });
    } else {
      const day = rutina[selectedEditorDay];
      await api("createExercise", {
        dia_id: day.id,
        nombre,
        series,
        repeticiones,
        video_url: videoUrl,
        image_url: imageUrl,
        wger_id: wgerId
      });
    }

    exerciseForm.classList.remove("open");
    exerciseForm.dataset.exerciseId = "";
    exerciseForm.dataset.catalogoId = "";
    exerciseForm.dataset.imageUrl = "";
    exerciseForm.dataset.wgerId = "";
    exerciseForm.classList.remove("modo-catalogo");
    actualizarWgerPreview();
    await cargarRutina();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
});

async function deleteExercise(exercise) {
  if (!(await confirmar(`¿Quitar "${exercise.name}" de este día? Sigue en tu catálogo y en los demás días donde lo uses.`, { textoAceptar: "Quitar", peligro: true }))) return;

  try {
    await api("deleteExercise", { id: exercise.id });
    await cargarRutina();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
}

async function moveExercise(index, delta) {
  const day = rutina[selectedEditorDay];
  const target = index + delta;

  if (target < 0 || target >= day.ejercicios.length) return;

  const ids = day.ejercicios.map((exercise) => exercise.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];

  try {
    await api("reorderExercises", {
      dia_id: day.id,
      ids
    });

    await cargarRutina();
    renderEditor();
  } catch (error) {
    avisar(error.message);
  }
}


exportDataButton.addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify(rutina, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mi-rutina-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});

editorButton.addEventListener("click", () => {
  openEditor();
  cerrarMenuNav();
});
personaButton.addEventListener("click", () => {
  cerrarMenuNav();
  abrirMiCuenta();
});

// --- Mi cuenta: datos, cambiar contraseña y cerrar sesión ---

function abrirMiCuenta(tabInicial = "datos") {
  if (!usuarioActual) return;
  const pideActual = usuarioActual.tienePassword !== false;

  modalTitle.textContent = "Mi cuenta";
  modal.querySelector(".modal-card").classList.remove("vertical");
  modalBody.innerHTML = `
    <div class="mi-cuenta">
      <div class="mi-cuenta-encabezado">
        <span class="mi-cuenta-avatar" aria-hidden="true">${icon("user")}</span>
        <div>
          <div class="name" id="miCuentaNombre">${esc(usuarioActual.nombre)}</div>
          <div class="footer-note" style="margin:0;text-align:left">${esc(usuarioActual.email)}</div>
        </div>
      </div>

      <div class="tabs mi-cuenta-tabs" role="tablist">
        <button type="button" class="tab active" role="tab" data-cuenta-tab="datos">Datos</button>
        <button type="button" class="tab" role="tab" data-cuenta-tab="password">Contraseña</button>
        ${usuarioActual.rol === "admin" ? "" : `<button type="button" class="tab" role="tab" data-cuenta-tab="rutinas">Rutinas</button>`}
      </div>

      <form id="cambiarNombreForm" class="mi-cuenta-panel" data-cuenta-panel="datos">
        <div class="field"><label for="miNombre">Nombre</label>
          <input id="miNombre" value="${esc(usuarioActual.nombre)}" maxlength="60" autocomplete="name" required></div>
        <p class="auth-error" id="cambiarNombreMensaje" hidden></p>
        <div class="form-actions" style="margin-top:8px">
          <button type="submit" class="main-btn" id="cambiarNombreGuardar">Guardar nombre</button>
        </div>
      </form>

      <form id="cambiarPasswordForm" class="mi-cuenta-panel" data-cuenta-panel="password" hidden>
        ${
          pideActual
            ? ""
            : `<p class="footer-note" style="margin:0;text-align:left">Entrás con Google. Si creás una contraseña, también vas a poder entrar con tu correo.</p>`
        }
        ${
          pideActual
            ? `<div class="field"><label>Contraseña actual</label><input type="password" id="passwordActual" autocomplete="current-password" required></div>`
            : ""
        }
        <div class="field"><label>Contraseña nueva</label><input type="password" id="passwordNueva" autocomplete="new-password" minlength="6" required></div>
        <div class="field"><label>Repetir contraseña nueva</label><input type="password" id="passwordRepetir" autocomplete="new-password" minlength="6" required></div>
        <p class="auth-error" id="cambiarPasswordMensaje" hidden></p>
        <div class="form-actions" style="margin-top:8px">
          <button type="submit" class="main-btn" id="cambiarPasswordGuardar">${pideActual ? "Guardar contraseña" : "Crear contraseña"}</button>
        </div>
      </form>

      ${
        usuarioActual.rol === "admin"
          ? ""
          : `<div id="panelRutinas" class="mi-cuenta-panel" data-cuenta-panel="rutinas" hidden>
              <p class="footer-note">Cargando tus rutinas…</p>
            </div>`
      }

      <button type="button" class="small danger mi-cuenta-salir" id="miCuentaCerrarSesion">Cerrar sesión</button>
    </div>
  `;
  modal.classList.add("open");

  // Pestañas: se ve una sección a la vez. La de rutinas se carga la
  // primera vez que se abre (genera el código si todavía no existe).
  let rutinasCargadas = false;
  const mostrarTab = (tab) => {
    modalBody.querySelectorAll("[data-cuenta-tab]").forEach((b) => b.classList.toggle("active", b.dataset.cuentaTab === tab));
    modalBody.querySelectorAll("[data-cuenta-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.cuentaPanel !== tab;
    });
    if (tab === "rutinas" && !rutinasCargadas) {
      rutinasCargadas = true;
      cargarPanelRutinas();
    }
  };
  modalBody.querySelectorAll("[data-cuenta-tab]").forEach((boton) => {
    boton.addEventListener("click", () => mostrarTab(boton.dataset.cuentaTab));
  });
  if (modalBody.querySelector(`[data-cuenta-tab="${tabInicial}"]`)) mostrarTab(tabInicial);

  const form = document.getElementById("cambiarPasswordForm");
  const mensaje = document.getElementById("cambiarPasswordMensaje");
  const guardar = document.getElementById("cambiarPasswordGuardar");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const actual = pideActual ? document.getElementById("passwordActual").value : "";
    const nueva = document.getElementById("passwordNueva").value;
    const repetir = document.getElementById("passwordRepetir").value;

    mensaje.hidden = true;
    mensaje.classList.remove("ok");

    if (nueva !== repetir) {
      mensaje.textContent = "Las contraseñas nuevas no coinciden.";
      mensaje.hidden = false;
      return;
    }

    guardar.disabled = true;
    try {
      await api("cambiarPassword", { actual, nueva });
      usuarioActual.tienePassword = true;
      form.reset();
      mensaje.textContent = "Listo, tu contraseña se actualizó.";
      mensaje.classList.add("ok");
      mensaje.hidden = false;
    } catch (error) {
      mensaje.textContent = error.message;
      mensaje.hidden = false;
    } finally {
      guardar.disabled = false;
    }
  });

  const nombreForm = document.getElementById("cambiarNombreForm");
  const nombreMensaje = document.getElementById("cambiarNombreMensaje");
  const nombreGuardar = document.getElementById("cambiarNombreGuardar");

  nombreForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    nombreMensaje.hidden = true;
    nombreMensaje.classList.remove("ok");
    nombreGuardar.disabled = true;
    try {
      const result = await api("actualizarPerfil", { nombre: document.getElementById("miNombre").value });
      usuarioActual.nombre = result.usuario.nombre;
      document.getElementById("miNombre").value = usuarioActual.nombre;
      document.getElementById("miCuentaNombre").textContent = usuarioActual.nombre;
      actualizarPersonaButton();
      nombreMensaje.textContent = "Listo, tu nombre se actualizó.";
      nombreMensaje.classList.add("ok");
      nombreMensaje.hidden = false;
      // Los pesos muestran el nombre de la cuenta: se recarga para verlo.
      if (usuarioActual.rol !== "admin") cargarRutina().catch(() => {});
    } catch (error) {
      nombreMensaje.textContent = error.message;
      nombreMensaje.hidden = false;
    } finally {
      nombreGuardar.disabled = false;
    }
  });

  document.getElementById("miCuentaCerrarSesion").addEventListener("click", () => {
    closeVideo();
    cerrarSesion();
  });
}

// --- Mis rutinas: elegir la activa, crear, renombrar, salir, compartir la
// activa con un código y unirse a otra con un código. ---

async function cargarPanelRutinas() {
  const panel = document.getElementById("panelRutinas");
  if (!panel) return;

  let compartida;
  try {
    [misRutinas, compartida] = await Promise.all([
      api("misRutinas").then((r) => r.rutinas),
      api("rutinaCompartida"),
    ]);
  } catch (error) {
    panel.innerHTML = `<p class="auth-error">${esc(error.message)}</p>`;
    return;
  }
  renderSelectorRutina();

  const activa = misRutinas.find((r) => r.activa) || misRutinas[0];
  const otros = compartida.miembros.filter((m) => m.id !== usuarioActual.id).map((m) => m.nombre);

  panel.innerHTML = `
    <section>
      <h4 class="mi-cuenta-subtitulo">Mis rutinas</h4>
      <p class="footer-note" style="margin:0;text-align:left">
        Entrenás con la rutina activa hasta que elijas otra. Tus pesos se comparten entre rutinas
        cuando el ejercicio se llama igual.
      </p>
      <div class="mis-rutinas">
        ${misRutinas
          .map(
            (r) => `
              <div class="mis-rutinas-item${r.activa ? " activa" : ""}" data-rutina-id="${r.id}">
                <div>
                  <strong>${esc(r.nombre)}</strong>${r.activa ? '<span class="etiqueta-activa">activa</span>' : ""}
                  <div class="meta">${r.dias} día${r.dias === 1 ? "" : "s"}${
                    r.compartidaCon.length ? ` · con ${esc(r.compartidaCon.join(", "))}` : ""
                  }</div>
                </div>
                <div class="mis-rutinas-acciones">
                  ${r.activa ? "" : `<button type="button" class="small" data-accion="usar">Usar</button>`}
                  <button type="button" class="small" data-accion="renombrar">Renombrar</button>
                  ${misRutinas.length > 1 ? `<button type="button" class="small danger" data-accion="salir">Salir</button>` : ""}
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <button type="button" class="small" id="nuevaRutinaButton">${icon("plus")} Nueva rutina vacía</button>
      <p class="footer-note" style="margin:6px 0 0;text-align:left">Para crear una desde un PDF, usá "Importar PDF" en Editar rutina.</p>
    </section>

    <section>
      <h4 class="mi-cuenta-subtitulo">Compartir "${esc(activa ? activa.nombre : "")}"</h4>
      <p class="footer-note" style="margin:0;text-align:left">
        Pasale este código a quien quiera entrenar con esta rutina. Cada persona tiene sus propios pesos y marcas,
        pero si alguien edita la rutina, el cambio lo ven todos.
      </p>
      <div class="codigo-rutina">
        <strong>${esc(compartida.codigo)}</strong>
        <button type="button" class="small" id="copiarCodigoRutina">Copiar</button>
      </div>
      <p class="footer-note" style="margin:0 0 8px;text-align:left">
        ${otros.length ? `La usan también: ${esc(otros.join(", "))}.` : "Por ahora solo la usás vos."}
      </p>
      <button type="button" class="small" id="regenerarCodigoRutina">Generar código nuevo</button>
    </section>

    <section>
      <form id="unirseRutinaForm">
        <h4 class="mi-cuenta-subtitulo">Agregar una rutina con un código</h4>
        <div class="field"><label for="codigoUnirse">Código</label>
          <input id="codigoUnirse" autocomplete="off" autocapitalize="characters" placeholder="Ej.: K7P2QX" required></div>
        <p class="auth-error" id="unirseRutinaMensaje" hidden></p>
        <div class="form-actions" style="margin-top:8px">
          <button type="submit" class="main-btn" id="unirseRutinaBoton">Agregar</button>
        </div>
      </form>
    </section>
  `;

  // Después de cualquier cambio: recargar la app y volver a pintar el panel.
  const refrescar = async ({ cambioActiva = false } = {}) => {
    if (cambioActiva) {
      semanaDiaElegido = null;
      selectedEditorDay = 0;
    }
    await cargarRutina();
    await cargarPanelRutinas();
  };

  panel.querySelectorAll(".mis-rutinas-item").forEach((item) => {
    const r = misRutinas.find((x) => String(x.id) === item.dataset.rutinaId);
    if (!r) return;

    item.querySelector('[data-accion="usar"]')?.addEventListener("click", async () => {
      try {
        await api("activarRutina", { rutina_id: r.id });
        await refrescar({ cambioActiva: true });
      } catch (error) {
        avisar(error.message);
      }
    });

    item.querySelector('[data-accion="renombrar"]').addEventListener("click", async () => {
      const nombre = await pedirTexto(
        r.compartidaCon.length ? "Nuevo nombre (lo ven también quienes la comparten):" : "Nuevo nombre:",
        { titulo: "Renombrar rutina", valor: r.nombre }
      );
      if (!nombre || nombre === r.nombre) return;
      try {
        await api("renombrarRutina", { rutina_id: r.id, nombre });
        await refrescar();
      } catch (error) {
        avisar(error.message);
      }
    });

    item.querySelector('[data-accion="salir"]')?.addEventListener("click", async () => {
      const ok = await confirmar(
        `"${r.nombre}" deja de aparecer en tu lista. No se borra: ` +
          (r.compartidaCon.length ? "los demás la siguen usando y " : "") +
          "el admin te la puede volver a asignar. Tus pesos se conservan.",
        { titulo: "¿Salir de esta rutina?", textoAceptar: "Salir", peligro: true }
      );
      if (!ok) return;
      try {
        await api("salirDeRutina", { rutina_id: r.id });
        await refrescar({ cambioActiva: r.activa });
      } catch (error) {
        avisar(error.message);
      }
    });
  });

  document.getElementById("nuevaRutinaButton").addEventListener("click", async () => {
    const nombre = await pedirTexto("Nombre de la rutina nueva:", {
      titulo: "Nueva rutina",
      valor: "Mi rutina",
      textoAceptar: "Crear",
    });
    if (!nombre) return;
    try {
      await api("crearRutina", { nombre });
      await refrescar({ cambioActiva: true });
      avisar(`Listo, "${nombre}" es tu rutina activa. Agregale días desde "Editar rutina".`);
    } catch (error) {
      avisar(error.message);
    }
  });

  document.getElementById("copiarCodigoRutina").addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(compartida.codigo);
      event.target.textContent = "¡Copiado!";
    } catch {
      avisar(`El código es ${compartida.codigo}.`);
    }
  });

  document.getElementById("regenerarCodigoRutina").addEventListener("click", async () => {
    const ok = await confirmar(
      "Se genera un código nuevo y el actual deja de servir. Quienes ya usan esta rutina la siguen usando.",
      { titulo: "Generar código nuevo", textoAceptar: "Generar" }
    );
    if (!ok) return;
    try {
      await api("regenerarCodigoRutina");
      await cargarPanelRutinas();
    } catch (error) {
      avisar(error.message);
    }
  });

  const form = document.getElementById("unirseRutinaForm");
  const mensaje = document.getElementById("unirseRutinaMensaje");
  const boton = document.getElementById("unirseRutinaBoton");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const codigo = document.getElementById("codigoUnirse").value.trim();
    mensaje.hidden = true;
    if (!codigo) return;

    boton.disabled = true;
    try {
      await api("unirseARutina", { codigo });
      await refrescar({ cambioActiva: true });
      avisar("Listo, la rutina se agregó a tu lista y quedó como activa. Tus otras rutinas siguen ahí.");
    } catch (error) {
      mensaje.textContent = error.message;
      mensaje.hidden = false;
      boton.disabled = false;
    }
  });
}

progresoButton.addEventListener("click", mostrarInfo);
diasButton.addEventListener("click", () => showDay(currentDayIndex));

// --- Menú de navegación: hamburguesa en celular, barra normal en escritorio ---

function abrirMenuNav() {
  navLinks.classList.add("open");
  navToggle.setAttribute("aria-expanded", "true");
}

function cerrarMenuNav() {
  navLinks.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  if (navLinks.classList.contains("open")) {
    cerrarMenuNav();
  } else {
    abrirMenuNav();
  }
});

document.addEventListener("click", (event) => {
  if (!navLinks.classList.contains("open")) return;
  if (topnav.contains(event.target)) return;
  cerrarMenuNav();
});
closeEditorButton.addEventListener("click", () => editor.classList.remove("open"));
closeVideoButton.addEventListener("click", closeVideo);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeVideo();
});
document.addEventListener("keydown", (event) => {
  // Si hay un diálogo encima, Escape cierra solo el diálogo.
  if (event.key === "Escape" && !cerrarDialogoActual) closeVideo();
});

// --- PWA: registro de service worker e instalación en el teléfono ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

(function configurarInstalacion() {
  const installButton = document.getElementById("installButton");
  if (!installButton) return;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isIOS) {
    installButton.hidden = false;
    installButton.addEventListener("click", () => {
      avisar(
        "Para instalar MecFit en tu iPhone:\n\n" +
        "1. Tocá el botón Compartir (el cuadrito con la flecha ↑).\n" +
        "2. Elegí 'Agregar a pantalla de inicio'.\n" +
        "3. Confirmá tocando 'Agregar'."
      );
    });
    return;
  }

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    installButton.hidden = true;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    installButton.hidden = true;
  });
})();

// --- Login / registro ---

const authScreen = document.getElementById("authScreen");
const appRoot = document.getElementById("appRoot");
const authForm = document.getElementById("authForm");
const authNombreField = document.getElementById("authNombreField");
const authNombre = document.getElementById("authNombre");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authError = document.getElementById("authError");
const authSubmit = document.getElementById("authSubmit");
const authSwitch = document.getElementById("authSwitch");
const googleButtonContainer = document.getElementById("googleButtonContainer");

let modoAuth = "login";
let googleListo = false;

function mostrarPantallaApp() {
  authScreen.hidden = true;
  appRoot.hidden = false;
}

function mostrarPantallaLogin() {
  appRoot.hidden = true;
  document.getElementById("panelAdmin").hidden = true;
  authScreen.hidden = false;
  authError.hidden = true;
  inicializarGoogleSignIn();
}

function actualizarFormularioAuth() {
  authNombreField.hidden = modoAuth !== "register";
  authNombre.required = modoAuth === "register";
  authPassword.autocomplete = modoAuth === "register" ? "new-password" : "current-password";
  authSubmit.textContent = modoAuth === "register" ? "Crear cuenta" : "Iniciar sesión";
  authSwitch.textContent =
    modoAuth === "register" ? "¿Ya tenés cuenta? Iniciá sesión" : "¿No tenés cuenta? Registrate";
  authError.hidden = true;
}

authSwitch.addEventListener("click", () => {
  modoAuth = modoAuth === "login" ? "register" : "login";
  actualizarFormularioAuth();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.hidden = true;

  const email = authEmail.value.trim();
  const password = authPassword.value;
  const nombre = authNombre.value.trim();

  authSubmit.disabled = true;

  try {
    const result =
      modoAuth === "register"
        ? await api("register", { email, password, nombre })
        : await api("login", { email, password });

    usuarioActual = result.usuario;
    authForm.reset();
    if (usuarioActual && usuarioActual.rol === "admin") {
      authScreen.hidden = true;
      window.MiRutinaAdmin.iniciar();
    } else {
      mostrarPantallaApp();
      await cargarRutina();
    }
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

async function onGoogleCredential(respuesta) {
  authError.hidden = true;
  try {
    const result = await api("googleLogin", { id_token: respuesta.credential });
    usuarioActual = result.usuario;
    if (usuarioActual && usuarioActual.rol === "admin") {
      authScreen.hidden = true;
      window.MiRutinaAdmin.iniciar();
    } else {
      mostrarPantallaApp();
      await cargarRutina();
    }
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  }
}

async function inicializarGoogleSignIn(intentos = 0) {
  if (googleListo) return;

  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    if (intentos < 20) setTimeout(() => inicializarGoogleSignIn(intentos + 1), 250);
    return;
  }

  try {
    const config = await api("config");
    if (!config.googleClientId) {
      googleButtonContainer.hidden = true;
      return;
    }

    window.google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: onGoogleCredential
    });

    window.google.accounts.id.renderButton(googleButtonContainer, {
      theme: "outline",
      size: "large",
      width: 300,
      locale: "es"
    });

    googleListo = true;
  } catch (error) {
    googleButtonContainer.hidden = true;
  }
}

(async function iniciar() {
  actualizarFormularioAuth();

  try {
    await cargarRutina();
    if (usuarioActual && usuarioActual.rol === "admin") {
      authScreen.hidden = true;
      appRoot.hidden = true;
      window.MiRutinaAdmin.iniciar();
      return;
    }
    mostrarPantallaApp();
  } catch (error) {
    if (!usuarioActual) {
      mostrarPantallaLogin();
    } else {
      console.error(error);
      content.innerHTML = `
        <div class="card">
          <div class="name">No se pudo cargar la rutina</div>
          <div class="meta">${esc(error.message)}</div>
        </div>
      `;
    }
  }
})();