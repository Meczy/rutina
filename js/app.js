const DONE_PREFIX = "mi-rutina-done-";
const LAST_DAY_KEY = "mi-rutina-ultimo-dia";

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
let adminPassword = "";
let selectedEditorDay = 0;
let currentDayIndex = 0;
let vista = "dias";
let diaRestaurado = false;

const tabs = document.getElementById("tabs");
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
const editorButton = document.getElementById("editorButton");
const personaButton = document.getElementById("personaButton");
const progresoButton = document.getElementById("progresoButton");
const closeEditorButton = document.getElementById("closeEditor");
const addDayButton = document.getElementById("addDay");
const managePersonasButton = document.getElementById("managePersonas");
const exportDataButton = document.getElementById("exportData");
const resetDataButton = document.getElementById("resetData");
const exerciseForm = document.getElementById("exerciseForm");
const formTitle = document.getElementById("formTitle");
const exerciseName = document.getElementById("exerciseName");
const exerciseSeries = document.getElementById("exerciseSeries");
const exerciseReps = document.getElementById("exerciseReps");
const exerciseUrl = document.getElementById("exerciseUrl");
const cancelExercise = document.getElementById("cancelExercise");
const buscarWgerButton = document.getElementById("buscarWgerButton");
const wgerPreview = document.getElementById("wgerPreview");
const wgerPreviewImg = document.getElementById("wgerPreviewImg");
const wgerQuitarButton = document.getElementById("wgerQuitarButton");
const closeVideoButton = document.getElementById("close");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
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

function guardarUltimoDia(day) {
  if (day) localStorage.setItem(LAST_DAY_KEY, String(day.id));
}

function limpiarChecksAntiguos() {
  const hoy = fechaHoy();
  const aBorrar = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DONE_PREFIX) && !key.endsWith(hoy)) {
      aBorrar.push(key);
    }
  }
  aBorrar.forEach((key) => localStorage.removeItem(key));
}

const PERSONA_KEY = "rutina_persona";

function obtenerPersona() {
  return localStorage.getItem(PERSONA_KEY) || "";
}

function pedirPersona() {
  const actual = obtenerPersona();
  const nombre = prompt("¿Cómo te llamás? Así identificamos de quién es cada peso.", actual);
  if (nombre && nombre.trim()) {
    localStorage.setItem(PERSONA_KEY, nombre.trim());
    return nombre.trim();
  }
  return actual;
}

function asegurarPersona() {
  return obtenerPersona() || pedirPersona();
}

function actualizarPersonaButton() {
  if (!personaButton) return;
  const persona = obtenerPersona();
  personaButton.textContent = persona ? `👤 ${persona}` : "👤 Elegir";
}

async function abrirSelectorPersona() {
  let personas = [];

  try {
    const response = await fetch("/api/rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "listPersonas" })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok) personas = result.personas || [];
  } catch (error) {
    /* si falla la lista, igual se puede escribir un nombre nuevo */
  }

  renderSelectorPersona(personas);
  modal.classList.add("open");
}

function renderSelectorPersona(personas) {
  modalTitle.textContent = "¿Quién sos?";
  modal.querySelector(".modal-card").classList.remove("vertical");

  const actual = obtenerPersona();

  const opciones = personas
    .map(
      (p) => `
        <button type="button" class="persona-option${p.persona === actual ? " active" : ""}" data-persona="${esc(p.persona)}">
          🏋️ ${esc(p.persona)}
        </button>
      `
    )
    .join("");

  modalBody.innerHTML = `
    <div class="persona-selector">
      ${opciones || `<p class="footer-note">Todavía no hay personas registradas.</p>`}
      <div class="persona-new">
        <input type="text" id="personaNuevoNombre" placeholder="Escribir un nombre nuevo">
        <button type="button" class="main-btn" id="personaNuevoGuardar">Usar</button>
      </div>
    </div>
  `;

  modalBody.querySelectorAll(".persona-option").forEach((btn) => {
    btn.addEventListener("click", () => seleccionarPersona(btn.dataset.persona));
  });

  document.getElementById("personaNuevoGuardar").addEventListener("click", () => {
    const nombre = document.getElementById("personaNuevoNombre").value.trim();
    if (!nombre) {
      alert("Escribí un nombre.");
      return;
    }
    seleccionarPersona(nombre);
  });
}

function seleccionarPersona(nombre) {
  localStorage.setItem(PERSONA_KEY, nombre);
  actualizarPersonaButton();
  closeVideo();
  render();
  if (vista === "info") renderInfoTab();
}

async function registrarPeso(exercise) {
  const persona = asegurarPersona();
  if (!persona) return;

  const previo = (exercise.pesos || []).find((p) => p.persona === persona);
  const entrada = prompt(
    `¿Cuánto peso usaste hoy en "${exercise.name}"? (kg)`,
    previo ? String(previo.peso) : ""
  );
  if (entrada === null) return;

  const peso = Number(String(entrada).replace(",", "."));
  if (!Number.isFinite(peso) || peso <= 0) {
    alert("Ingresá un número válido mayor a 0.");
    return;
  }

  try {
    const response = await fetch("/api/rutina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "logWeight",
        ejercicio_id: exercise.id,
        persona,
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
    alert(error.message);
  }
}

async function obtenerHistorialPeso(exercise, persona) {
  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "getWeightHistory",
      ejercicio_id: exercise.id,
      persona
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
    alert(error.message);
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
            <button type="button" class="small history-edit">✏️ Editar</button>
            <button type="button" class="small danger history-delete">🗑 Eliminar</button>
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
      const entrada = prompt(
        `Nuevo peso para el ${formatFecha(actual.fecha)} (kg)`,
        String(actual.peso)
      );
      if (entrada === null) return;

      const peso = Number(String(entrada).replace(",", "."));
      if (!Number.isFinite(peso) || peso <= 0) {
        alert("Ingresá un número válido mayor a 0.");
        return;
      }

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateWeight", id, persona, peso })
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
        alert(error.message);
      }
    });

    row.querySelector(".history-delete").addEventListener("click", async () => {
      const actual = historial.find((h) => h.id === id);
      if (!confirm(`¿Eliminar el peso del ${formatFecha(actual.fecha)}?`)) return;

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteWeight", id, persona })
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
        alert(error.message);
      }
    });
  });
}

// --- Pestaña "Mi progreso": peso corporal, % grasa y % agua por día ---

async function mostrarInfo() {
  vista = "info";
  content.hidden = true;
  infoSection.classList.add("active");
  progresoButton.classList.add("active");

  document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));

  await renderInfoTab();
}

async function obtenerHistorialMetricas(persona) {
  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getMetricasHistory", persona })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "No se pudo cargar el historial.");
  }

  return result.historial || [];
}

async function renderInfoTab() {
  const persona = asegurarPersona();
  if (!persona) {
    infoSection.innerHTML = `
      <div class="fallback" style="border-radius:16px">
        <h3>Necesitamos tu nombre</h3>
        <p>Así identificamos de quién es cada registro.</p>
      </div>
    `;
    return;
  }

  infoSection.innerHTML = `
    <div class="day-head">
      <h2>📊 Mi progreso</h2>
    </div>
    <div class="metrica-card">
      <div class="metrica-card-head">
        <strong id="infoPersonaNombre"></strong>
        <button type="button" class="small" id="cambiarPersonaInfo">Cambiar nombre</button>
      </div>
      <form id="metricaForm">
        <div class="field"><label>Fecha</label><input type="date" id="metricaFecha" required></div>
        <div class="field"><label>Peso corporal (kg)</label><input type="number" step="0.1" min="0" id="metricaPeso" required></div>
        <div class="field"><label>Grasa corporal % (opcional)</label><input type="number" step="0.1" min="0" max="100" id="metricaGrasa"></div>
        <div class="field"><label>Agua % (opcional)</label><input type="number" step="0.1" min="0" max="100" id="metricaAgua"></div>
        <button type="submit" class="main-btn">💾 Guardar registro del día</button>
      </form>
    </div>
    <div id="metricaHistorial"><p class="footer-note">Cargando historial…</p></div>
  `;

  document.getElementById("infoPersonaNombre").textContent = persona;
  document.getElementById("cambiarPersonaInfo").addEventListener("click", abrirSelectorPersona);

  const form = document.getElementById("metricaForm");
  const fechaInput = document.getElementById("metricaFecha");
  const pesoInput = document.getElementById("metricaPeso");
  const grasaInput = document.getElementById("metricaGrasa");
  const aguaInput = document.getElementById("metricaAgua");

  fechaInput.value = fechaHoy();
  fechaInput.max = fechaHoy();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const peso = Number(String(pesoInput.value).replace(",", "."));
    const grasa = grasaInput.value === "" ? null : Number(String(grasaInput.value).replace(",", "."));
    const agua = aguaInput.value === "" ? null : Number(String(aguaInput.value).replace(",", "."));

    if (!Number.isFinite(peso) || peso <= 0) {
      alert("Ingresá un peso válido mayor a 0.");
      return;
    }

    try {
      const response = await fetch("/api/rutina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "logMetrica",
          persona,
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
      await cargarHistorialMetricas(persona);
    } catch (error) {
      alert(error.message);
    }
  });

  await cargarHistorialMetricas(persona);
}

async function cargarHistorialMetricas(persona) {
  const contenedor = document.getElementById("metricaHistorial");
  if (!contenedor) return;

  try {
    const historial = await obtenerHistorialMetricas(persona);
    renderHistorialMetricas(persona, historial);
  } catch (error) {
    contenedor.innerHTML = `<p class="footer-note">${esc(error.message)}</p>`;
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

function renderHistorialMetricas(persona, historial) {
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
            <button type="button" class="small metrica-edit">✏️ Editar</button>
            <button type="button" class="small danger metrica-delete">🗑 Eliminar</button>
          </div>
        </div>
      `;
    })
    .join("");

  contenedor.innerHTML = `
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
      if (!confirm(`¿Eliminar el registro del ${formatFecha(registro.fecha)}?`)) return;

      try {
        const response = await fetch("/api/rutina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deleteMetrica", id, persona })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "No se pudo eliminar el registro.");
        }
        await cargarHistorialMetricas(persona);
      } catch (error) {
        alert(error.message);
      }
    });
  });
}

async function api(action, data = {}) {
  if (!adminPassword) {
    throw new Error("No hay contraseña de administrador.");
  }

  const response = await fetch("/api/rutina", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-routine-admin-password": adminPassword
    },
    body: JSON.stringify({ action, ...data })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "No se pudo completar la operación.");
  }

  return result;
}

async function cargarRutina() {
  const response = await fetch("/api/rutina", {
    method: "GET",
    cache: "no-store"
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !Array.isArray(result.rutina)) {
    throw new Error(result.error || "No se pudo cargar la rutina.");
  }

  rutina = result.rutina;

  if (!diaRestaurado) {
    diaRestaurado = true;
    const guardado = localStorage.getItem(LAST_DAY_KEY);
    if (guardado) {
      const idx = rutina.findIndex((d) => String(d.id) === guardado);
      if (idx >= 0) currentDayIndex = idx;
    }
  }

  if (selectedEditorDay >= rutina.length) {
    selectedEditorDay = Math.max(0, rutina.length - 1);
  }

  render();
}

function render() {
  tabs.innerHTML = "";
  content.innerHTML = "";

  if (currentDayIndex >= rutina.length) {
    currentDayIndex = Math.max(0, rutina.length - 1);
  }

  totalDaysEl.textContent = rutina.length;
  totalExercisesEl.textContent = rutina.reduce(
    (total, day) => total + day.ejercicios.length,
    0
  );

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
      const completed =
        localStorage.getItem(`${DONE_PREFIX}${day.id}-${exercise.id}-${fechaHoy()}`) === "1";

      const card = document.createElement("article");
      const platform = /instagram\.com/i.test(exercise.url || "")
        ? "instagram"
        : "";

      card.className = "card" + (completed ? " done" : "");

      const pesosHtml = (exercise.pesos || [])
        .map(
          (p) => `
            <button type="button" class="weight-chip" data-persona="${esc(p.persona)}">
              🏋️ ${esc(p.persona)} <strong>${formatPeso(p.peso)}kg</strong>
            </button>
          `
        )
        .join("");

      card.innerHTML = `
        <div class="num">${exerciseIndex + 1}</div>
        <div>
          <div class="name">${esc(exercise.name)}</div>
          <div class="meta">
            ${exercise.series ? `<span class="pill">${esc(exercise.series)} series</span>` : ""}
            ${exercise.reps ? `<span class="pill">${esc(exercise.reps)} reps</span>` : ""}
          </div>
          <div class="actions">
            ${
              exercise.imageUrl
                ? `<button type="button" class="icon-btn img-btn" title="Ver imagen">${ICON_IMAGE}</button>`
                : ""
            }
            ${
              exercise.url
                ? `<button type="button" class="icon-btn play ${platform}" title="Ver video">${ICON_PLAY}</button>`
                : ""
            }
            ${
              !exercise.imageUrl && !exercise.url
                ? `<span class="icon-btn icon-btn-empty">Sin contenido</span>`
                : ""
            }
            <input class="check" type="checkbox" ${completed ? "checked" : ""}>
          </div>
          <div class="weights">
            ${pesosHtml}
            <button type="button" class="weight-add">+ peso</button>
          </div>
        </div>
      `;

      card.querySelectorAll(".weight-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          verHistorialPeso(exercise, chip.dataset.persona);
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
        localStorage.setItem(
          `${DONE_PREFIX}${day.id}-${exercise.id}-${fechaHoy()}`,
          event.target.checked ? "1" : "0"
        );
        card.classList.toggle("done", event.target.checked);
      });

      list.appendChild(card);
    });

    section.appendChild(list);
    content.appendChild(section);
  });

  content.hidden = vista !== "dias";
  infoSection.classList.toggle("active", vista === "info");
  progresoButton.classList.toggle("active", vista === "info");
  actualizarPersonaButton();
}

function showDay(index) {
  currentDayIndex = index;
  vista = "dias";
  guardarUltimoDia(rutina[index]);

  content.hidden = false;
  infoSection.classList.remove("active");
  progresoButton.classList.remove("active");

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

async function pedirContraseña() {
  if (adminPassword) return true;

  const password = prompt("Contraseña de edición:");
  if (!password) return false;

  adminPassword = password;

  try {
    await api("validate");
    return true;
  } catch (error) {
    adminPassword = "";
    alert("Contraseña incorrecta o el panel de edición no está configurado.");
    return false;
  }
}

async function openEditor() {
  if (!(await pedirContraseña())) return;
  editor.classList.add("open");
  renderEditor();
}

async function gestionarPersonas() {
  if (!(await pedirContraseña())) return;

  try {
    const result = await api("listPersonas");
    renderPersonas(result.personas || []);
    modal.classList.add("open");
  } catch (error) {
    alert(error.message);
  }
}

function renderPersonas(personas) {
  modalTitle.textContent = "Personas";
  modal.querySelector(".modal-card").classList.remove("vertical");

  if (!personas.length) {
    modalBody.innerHTML = `
      <div class="fallback">
        <h3>Todavía no hay personas registradas</h3>
        <p>Cuando alguien registre un peso va a aparecer acá.</p>
      </div>
    `;
    return;
  }

  const filas = personas
    .map(
      (p) => `
        <div class="history-row" data-persona="${esc(p.persona)}">
          <div class="history-info">
            <span class="history-peso">${esc(p.persona)}</span>
            <span class="history-fecha">${p.registros} peso${p.registros === 1 ? "" : "s"} registrado${p.registros === 1 ? "" : "s"}</span>
          </div>
          <div class="history-actions">
            <button type="button" class="small danger persona-delete">🗑 Eliminar persona</button>
          </div>
        </div>
      `
    )
    .join("");

  modalBody.innerHTML = `<div class="history-list">${filas}</div>`;

  modalBody.querySelectorAll(".history-row").forEach((row) => {
    const persona = row.dataset.persona;

    row.querySelector(".persona-delete").addEventListener("click", async () => {
      if (
        !confirm(
          `¿Eliminar a "${persona}" y todos sus pesos registrados en todos los ejercicios? Esta acción no se puede deshacer.`
        )
      ) {
        return;
      }

      try {
        const result = await api("deletePersona", { persona });
        rutina = result.rutina;
        render();

        if (obtenerPersona() === persona) {
          localStorage.removeItem(PERSONA_KEY);
        }

        const actualizado = await api("listPersonas");
        renderPersonas(actualizado.personas || []);
      } catch (error) {
        alert(error.message);
      }
    });
  });
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

  const select = document.createElement("select");
  select.className = "day-switcher-select";
  rutina.forEach((day, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `Día ${day.numero}${day.titulo ? " — " + day.titulo : ""}`;
    select.appendChild(option);
  });
  select.value = String(selectedEditorDay);
  select.addEventListener("change", () => {
    selectedEditorDay = Number(select.value);
    renderEditor();
  });

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

  switcher.append(prevButton, select, nextButton);
  editorTabs.appendChild(switcher);

  const day = rutina[selectedEditorDay];
  editorList.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "editor-day-title";
  heading.innerHTML = `
    <div class="editor-day-main">
      <div class="day-number-edit">
        <label>Día</label>
        <input id="dayNumberInput" type="number" min="1" step="1" value="${Number(day.numero) || 1}">
      </div>
      <div class="day-name-edit">
        <label>Nombre</label>
        <input id="dayNameInput" value="${esc(day.titulo)}">
      </div>
      <button class="small save-day-name">💾 Guardar día</button>
    </div>
    <button class="small danger delete-day-button">🗑️ Eliminar día</button>
  `;

  heading.querySelector(".save-day-name").addEventListener("click", saveDaySettings);
  heading.querySelector(".delete-day-button").addEventListener("click", deleteCurrentDay);
  editorList.appendChild(heading);

  const exerciseList = document.createElement("div");
  exerciseList.className = "editor-exercise-list";

  day.ejercicios.forEach((exercise, index) => {
    const row = document.createElement("div");
    row.className = "edit-row draggable-exercise";
    row.dataset.exerciseId = String(exercise.id);

    row.innerHTML = `
      <div class="drag-handle" title="Arrastrar para cambiar el orden">⋮⋮</div>
      <div class="edit-row-info">
        <strong>${esc(exercise.name)}</strong>
        <div class="edit-meta">
          ${esc(exercise.series)} × ${esc(exercise.reps)} · ${exercise.url ? "video agregado" : "sin video"}
        </div>
      </div>
      <div class="edit-actions">
        <button class="small move-up">↑</button>
        <button class="small move-down">↓</button>
        <button class="small edit-button">✏️ Editar</button>
        <button class="small danger delete-button">🗑️</button>
      </div>
    `;

    row.querySelector(".move-up").addEventListener("click", () => moveExercise(index, -1));
    row.querySelector(".move-down").addEventListener("click", () => moveExercise(index, 1));
    row.querySelector(".edit-button").addEventListener("click", () => editExercise(exercise));
    row.querySelector(".delete-button").addEventListener("click", () => deleteExercise(exercise));

    configureDrag(row, exerciseList);
    exerciseList.appendChild(row);
  });

  editorList.appendChild(exerciseList);

  const addButton = document.createElement("button");
  addButton.className = "add-btn";
  addButton.textContent = "＋ Agregar ejercicio a este día";
  addButton.addEventListener("click", () => openExerciseForm());
  editorList.appendChild(addButton);
}

async function saveDaySettings() {
  const day = rutina[selectedEditorDay];
  const numero = Number(document.getElementById("dayNumberInput").value);
  const nombre = document.getElementById("dayNameInput").value.trim();

  if (!Number.isInteger(numero) || numero < 1) {
    alert("El número del día debe ser un entero mayor a 0.");
    return;
  }

  if (!nombre) {
    alert("Escribe un nombre para el día.");
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
    alert(error.message);
  }
}

async function deleteCurrentDay() {
  const day = rutina[selectedEditorDay];

  if (rutina.length === 1) {
    alert("Debe existir al menos un día.");
    return;
  }

  if (!confirm(`¿Eliminar el Día ${day.numero} y todos sus ejercicios?`)) {
    return;
  }

  try {
    const result = await api("deleteDay", { id: day.id });
    rutina = result.rutina;
    selectedEditorDay = Math.min(selectedEditorDay, rutina.length - 1);
    render();
    renderEditor();
  } catch (error) {
    alert(error.message);
  }
}

addDayButton.addEventListener("click", async () => {
  const max = Math.max(0, ...rutina.map((day) => Number(day.numero) || 0));
  const numero = max + 1;
  const nombre = prompt("Nombre del nuevo día:", `Día ${numero}`);

  if (!nombre || !nombre.trim()) return;

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
    alert(error.message);
  }
});

function openExerciseForm(exercise = null) {
  formTitle.textContent = exercise ? "Editar ejercicio" : "Agregar ejercicio";
  exerciseName.value = exercise?.name || "";
  exerciseSeries.value = exercise?.series || "";
  exerciseReps.value = exercise?.reps || "";
  exerciseUrl.value = exercise?.url || "";
  exerciseForm.dataset.exerciseId = exercise?.id ? String(exercise.id) : "";
  exerciseForm.dataset.imageUrl = exercise?.imageUrl || "";
  exerciseForm.dataset.wgerId = exercise?.wgerId ? String(exercise.wgerId) : "";
  actualizarWgerPreview();
  exerciseForm.classList.add("open");
}

function actualizarWgerPreview() {
  const imagen = exerciseForm.dataset.imageUrl || "";
  if (imagen) {
    wgerPreviewImg.src = imagen;
    wgerPreview.hidden = false;
  } else {
    wgerPreviewImg.src = "";
    wgerPreview.hidden = true;
  }
}

wgerQuitarButton.addEventListener("click", () => {
  exerciseForm.dataset.imageUrl = "";
  exerciseForm.dataset.wgerId = "";
  actualizarWgerPreview();
});

buscarWgerButton.addEventListener("click", abrirBuscadorWger);

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
      if (!exerciseName.value.trim()) {
        exerciseName.value = card.dataset.nombre;
      }
      actualizarWgerPreview();
      closeVideo();
    });
  });
}

function editExercise(exercise) {
  openExerciseForm(exercise);
}

cancelExercise.addEventListener("click", () => {
  exerciseForm.classList.remove("open");
  exerciseForm.dataset.imageUrl = "";
  exerciseForm.dataset.wgerId = "";
});

exerciseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const exerciseId = Number(exerciseForm.dataset.exerciseId || 0);
  const nombre = exerciseName.value.trim();
  const series = exerciseSeries.value.trim();
  const repeticiones = exerciseReps.value.trim();
  const videoUrl = exerciseUrl.value.trim();
  const imageUrl = exerciseForm.dataset.imageUrl || "";
  const wgerId = exerciseForm.dataset.wgerId || "";

  if (!nombre) {
    alert("Escribe el nombre del ejercicio.");
    return;
  }

  try {
    if (exerciseId) {
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
    exerciseForm.dataset.imageUrl = "";
    exerciseForm.dataset.wgerId = "";
    await cargarRutina();
    renderEditor();
  } catch (error) {
    alert(error.message);
  }
});

async function deleteExercise(exercise) {
  if (!confirm(`¿Eliminar "${exercise.name}"?`)) return;

  try {
    await api("deleteExercise", { id: exercise.id });
    await cargarRutina();
    renderEditor();
  } catch (error) {
    alert(error.message);
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
    alert(error.message);
  }
}

function configureDrag(row, exerciseList) {
  const handle = row.querySelector(".drag-handle");
  if (!handle) return;

  let dragging = false;
  let pointerId = null;

  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();

    const y = event.clientY;
    const siblings = [...exerciseList.querySelectorAll(".draggable-exercise")];

    for (const sibling of siblings) {
      if (sibling === row) continue;
      const rect = sibling.getBoundingClientRect();
      const before = y < rect.top + rect.height / 2;

      if (before && sibling.previousElementSibling !== row) {
        exerciseList.insertBefore(row, sibling);
        break;
      }
      if (!before && sibling.nextElementSibling !== row) {
        exerciseList.insertBefore(row, sibling.nextSibling);
        break;
      }
    }
  };

  const finishDrag = async (event) => {
    if (!dragging) return;
    dragging = false;
    row.classList.remove("dragging");

    try {
      handle.releasePointerCapture(pointerId);
    } catch (error) {
      /* noop */
    }

    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", finishDrag);
    handle.removeEventListener("pointercancel", finishDrag);

    const day = rutina[selectedEditorDay];
    const ids = [
      ...exerciseList.querySelectorAll(".draggable-exercise")
    ].map((item) => Number(item.dataset.exerciseId));

    try {
      await api("reorderExercises", { dia_id: day.id, ids });
      await cargarRutina();
      renderEditor();
    } catch (error) {
      alert(error.message);
      await cargarRutina();
      renderEditor();
    }
  };

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    row.classList.add("dragging");

    try {
      handle.setPointerCapture(pointerId);
    } catch (error) {
      /* noop */
    }

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
  });
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

resetDataButton.addEventListener("click", () => {
  alert(
    "La rutina ahora está guardada en la base de datos. " +
    "Para restaurarla usaremos el respaldo o una función de restauración del panel."
  );
});

editorButton.addEventListener("click", openEditor);
personaButton.addEventListener("click", abrirSelectorPersona);
progresoButton.addEventListener("click", mostrarInfo);
managePersonasButton.addEventListener("click", gestionarPersonas);
closeEditorButton.addEventListener("click", () => editor.classList.remove("open"));
closeVideoButton.addEventListener("click", closeVideo);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeVideo();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeVideo();
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
      alert(
        "Para instalar Mi Rutina en tu iPhone:\n\n" +
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

(async function iniciar() {
  try {
    limpiarChecksAntiguos();
    await cargarRutina();
  } catch (error) {
    console.error(error);
    content.innerHTML = `
      <div class="card">
        <div class="name">No se pudo cargar la rutina</div>
        <div class="meta">${esc(error.message)}</div>
      </div>
    `;
  }
})();
