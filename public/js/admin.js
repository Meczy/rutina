// ---------- Panel de administración ----------
// Reutiliza api() y esc(), definidos en app.js (mismo scope global).

(function () {
  const panelAdmin = document.getElementById("panelAdmin");
  const listaUsuariosEl = document.getElementById("adminListaUsuarios");
  const seccionUsuarios = document.getElementById("adminUsuariosSection");
  const seccionDetalle = document.getElementById("adminDetalleSection");
  const nombreUsuarioEl = document.getElementById("adminUsuarioNombre");
  const volverBtn = document.getElementById("adminVolverBtn");
  const logoutBtn = document.getElementById("adminLogoutButton");
  const tabsEl = document.getElementById("adminTabs");
  const tabRutina = document.getElementById("adminTabRutina");
  const tabPesos = document.getElementById("adminTabPesos");
  const tabMetricas = document.getElementById("adminTabMetricas");

  let usuarios = [];
  let usuarioSeleccionado = null; // { id, nombre, email, rol }
  let rutinaSeleccionada = []; // días del usuario seleccionado

  function fmtFecha(f) {
    if (!f) return "—";
    try {
      return new Date(f).toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return String(f);
    }
  }

  // ---------- Lista de usuarios ----------

  async function cargarUsuarios() {
    listaUsuariosEl.innerHTML = `<div class="meta">Cargando usuarios…</div>`;
    try {
      const result = await api("adminListarUsuarios");
      usuarios = result.usuarios || [];
      renderUsuarios();
    } catch (error) {
      listaUsuariosEl.innerHTML = `<div class="meta">${esc(error.message)}</div>`;
    }
  }

  function renderUsuarios() {
    if (!usuarios.length) {
      listaUsuariosEl.innerHTML = `<div class="meta">No hay usuarios todavía.</div>`;
      return;
    }

    listaUsuariosEl.innerHTML = usuarios
      .map((u) => {
        const rutinasTxt = u.rutinas.length
          ? u.rutinas.map((r) => esc(r.nombre)).join(", ")
          : "Sin rutina asignada";
        return `
          <div class="admin-user-card" data-id="${u.id}">
            <div class="admin-user-info">
              <div class="name">${esc(u.nombre)} ${u.rol === "admin" ? '<span class="admin-badge">admin</span>' : ""}</div>
              <div class="meta">${esc(u.email)}</div>
              <div class="meta">Rutinas: ${rutinasTxt}</div>
              <div class="meta">Registrado: ${fmtFecha(u.creadoEn)}</div>
            </div>
            <div class="admin-user-actions">
              <button type="button" class="small" data-admin-ver="${u.id}">Ver</button>
              ${
                u.rol === "admin"
                  ? `<button type="button" class="small" data-admin-quitar-rol="${u.id}">Quitar admin</button>`
                  : `<button type="button" class="small" data-admin-hacer-rol="${u.id}">Hacer admin</button>`
              }
              <button type="button" class="small" data-admin-eliminar="${u.id}" style="color:#c0392b">Eliminar</button>
            </div>
          </div>`;
      })
      .join("");

    listaUsuariosEl.querySelectorAll("[data-admin-ver]").forEach((btn) => {
      btn.addEventListener("click", () => abrirUsuario(Number(btn.dataset.adminVer)));
    });

    listaUsuariosEl.querySelectorAll("[data-admin-hacer-rol]").forEach((btn) => {
      btn.addEventListener("click", () => cambiarRol(Number(btn.dataset.adminHacerRol), "admin"));
    });

    listaUsuariosEl.querySelectorAll("[data-admin-quitar-rol]").forEach((btn) => {
      btn.addEventListener("click", () => cambiarRol(Number(btn.dataset.adminQuitarRol), "usuario"));
    });

    listaUsuariosEl.querySelectorAll("[data-admin-eliminar]").forEach((btn) => {
      btn.addEventListener("click", () => eliminarUsuario(Number(btn.dataset.adminEliminar)));
    });
  }

  async function cambiarRol(id, rol) {
    const usuario = usuarios.find((u) => u.id === id);
    if (rol === "admin") {
      const tieneDatos = usuario && usuario.rutinas.length > 0;
      const ok = confirm(
        `¿Convertir a ${usuario ? usuario.nombre : "este usuario"} en administrador?\n\n` +
          `Ojo: un admin no ve su propia rutina, solo el panel de administración. ` +
          (tieneDatos
            ? `Esta cuenta ya tiene rutina y progreso guardados: no se van a borrar, pero dejará de poder entrenar con esta cuenta hasta que le quites el rol de admin.\n\n`
            : `\n\n`) +
          `Si esta persona también quiere entrenar, es mejor que uses una cuenta aparte solo para administrar.`
      );
      if (!ok) return;
    }
    try {
      await api("adminCambiarRol", { target_usuario_id: id, rol });
      await cargarUsuarios();
    } catch (error) {
      alert(error.message);
    }
  }

  async function eliminarUsuario(id) {
    const usuario = usuarios.find((u) => u.id === id);
    const nombre = usuario ? usuario.nombre : "este usuario";
    const ok = confirm(
      `¿Eliminar a ${nombre}? Esto borra su cuenta, su sesión y su historial de pesos y métricas. Esta acción no se puede deshacer.`
    );
    if (!ok) return;

    try {
      await api("adminEliminarUsuario", { target_usuario_id: id });
      await cargarUsuarios();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------- Detalle de un usuario ----------

  async function abrirUsuario(id) {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    usuarioSeleccionado = usuario;

    nombreUsuarioEl.textContent = `${usuario.nombre} (${usuario.email})`;
    seccionUsuarios.hidden = true;
    seccionDetalle.hidden = false;

    cambiarTabAdmin("rutina");
    await Promise.all([cargarRutinaUsuario(), cargarPesosUsuario(), cargarMetricasUsuario()]);
  }

  volverBtn.addEventListener("click", () => {
    seccionDetalle.hidden = true;
    seccionUsuarios.hidden = false;
    usuarioSeleccionado = null;
    cargarUsuarios();
  });

  tabsEl.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.addEventListener("click", () => cambiarTabAdmin(btn.dataset.adminTab));
  });

  function cambiarTabAdmin(tab) {
    tabsEl.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.adminTab === tab);
    });
    tabRutina.hidden = tab !== "rutina";
    tabPesos.hidden = tab !== "pesos";
    tabMetricas.hidden = tab !== "metricas";
  }

  // ---------- Rutina del usuario seleccionado ----------

  const adminEditor = document.getElementById("adminEditor");
  const adminEditorTitle = document.getElementById("adminEditorTitle");
  const adminEditorTabs = document.getElementById("adminEditorTabs");
  const adminEditorList = document.getElementById("adminEditorList");
  const closeAdminEditorBtn = document.getElementById("closeAdminEditor");
  const adminAddDayBtn = document.getElementById("adminAddDay");
  const adminCambiarRutinaBtn = document.getElementById("adminCambiarRutinaBtn");

  const adminExerciseForm = document.getElementById("adminExerciseForm");
  const adminExerciseFormEl = document.getElementById("adminExerciseFormEl");
  const adminFormTitle = document.getElementById("adminFormTitle");
  const adminExerciseName = document.getElementById("adminExerciseName");
  const adminExerciseSeries = document.getElementById("adminExerciseSeries");
  const adminExerciseReps = document.getElementById("adminExerciseReps");
  const adminExerciseUrl = document.getElementById("adminExerciseUrl");
  const adminCancelExerciseBtn = document.getElementById("adminCancelExercise");

  let selectedAdminDay = 0;

  async function cargarRutinaUsuario() {
    tabRutina.innerHTML = `<div class="meta">Cargando rutina…</div>`;
    try {
      const response = await fetch(`/api/rutina?usuario_id=${usuarioSeleccionado.id}`, {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cargar la rutina.");
      rutinaSeleccionada = result.rutina || [];
      if (selectedAdminDay >= rutinaSeleccionada.length) {
        selectedAdminDay = Math.max(0, rutinaSeleccionada.length - 1);
      }
      renderResumenRutina();
    } catch (error) {
      tabRutina.innerHTML = `<div class="meta">${esc(error.message)}</div>`;
    }
  }

  function renderResumenRutina() {
    const totalDias = rutinaSeleccionada.length;
    const totalEjercicios = rutinaSeleccionada.reduce((total, d) => total + d.ejercicios.length, 0);

    tabRutina.innerHTML = `
      <div class="stats">
        <div class="stat"><strong>${totalDias}</strong>Días</div>
        <div class="stat"><strong>${totalEjercicios}</strong>Ejercicios</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button type="button" class="main-btn" id="adminAbrirEditorBtn">${icon("pencil")} Editar rutina</button>
        <button type="button" class="small" id="adminAsignarRutinaBtn">Crear/asignar otra rutina…</button>
      </div>
      ${
        totalDias
          ? `<div class="admin-ejercicios-lista" style="margin-top:14px">
              ${rutinaSeleccionada
                .map(
                  (d) => `
                <div class="admin-ejercicio-row">
                  <div>
                    <div class="name" style="font-size:15px">Día ${esc(String(d.numero))} — ${esc(d.nombre)}</div>
                    <div class="meta">${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? "" : "s"}</div>
                  </div>
                </div>`
                )
                .join("")}
            </div>`
          : `<div class="meta" style="margin-top:14px">Este usuario todavía no tiene días en su rutina.</div>`
      }
    `;

    document.getElementById("adminAbrirEditorBtn").addEventListener("click", abrirEditorAdmin);
    document.getElementById("adminAsignarRutinaBtn").addEventListener("click", abrirAsignarRutina);
  }

  async function accionAdminRutina(action, extra) {
    try {
      const result = await api(action, { target_usuario_id: usuarioSeleccionado.id, ...extra });
      if (result.rutina) rutinaSeleccionada = result.rutina;
      else await cargarRutinaUsuario();
      return true;
    } catch (error) {
      alert(error.message);
      return false;
    }
  }

  // ---------- Editor visual (mismo aspecto que la app normal) ----------

  function abrirEditorAdmin() {
    adminEditorTitle.textContent = `Editar rutina de ${usuarioSeleccionado.nombre}`;
    adminEditor.classList.add("open");
    selectedAdminDay = 0;
    renderAdminEditor();
  }

  closeAdminEditorBtn.addEventListener("click", () => {
    adminEditor.classList.remove("open");
    renderResumenRutina();
  });

  adminAddDayBtn.addEventListener("click", async () => {
    const max = Math.max(0, ...rutinaSeleccionada.map((d) => Number(d.numero) || 0));
    const numero = max + 1;
    const ok = await accionAdminRutina("createDay", { numero, nombre: `Día ${numero}` });
    if (ok) {
      selectedAdminDay = rutinaSeleccionada.findIndex((d) => Number(d.numero) === numero);
      renderAdminEditor();
    }
  });

  adminCambiarRutinaBtn.addEventListener("click", async () => {
    await abrirAsignarRutina();
    renderAdminEditor();
  });

  function renderAdminEditor() {
    adminEditorTabs.innerHTML = "";
    adminEditorList.innerHTML = "";

    if (!rutinaSeleccionada.length) {
      adminEditorList.innerHTML = `<div class="meta">Todavía no hay días. Agregá el primero arriba.</div>`;
      return;
    }

    if (selectedAdminDay >= rutinaSeleccionada.length) selectedAdminDay = rutinaSeleccionada.length - 1;

    const diaActual = rutinaSeleccionada[selectedAdminDay];

    const switcher = document.createElement("div");
    switcher.className = "day-switcher";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "day-switcher-arrow";
    prevBtn.textContent = "‹";
    prevBtn.disabled = selectedAdminDay === 0;
    prevBtn.addEventListener("click", () => {
      if (selectedAdminDay > 0) {
        selectedAdminDay -= 1;
        renderAdminEditor();
      }
    });

    const selectWrap = document.createElement("div");
    selectWrap.className = "day-switcher-select-wrap";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "day-switcher-select";
    trigger.innerHTML = `<span class="day-switcher-select-num">Día ${esc(String(diaActual.numero))}</span>
      <span class="day-switcher-select-title">${esc(diaActual.nombre)}</span>`;

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

    rutinaSeleccionada.forEach((dia, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "day-switcher-menu-item" + (index === selectedAdminDay ? " active" : "");
      item.innerHTML = `<span class="day-switcher-menu-num">Día ${esc(String(dia.numero))}</span>
        <span class="day-switcher-menu-title">${esc(dia.nombre)}</span>`;
      item.addEventListener("click", () => {
        closeMenu();
        selectedAdminDay = index;
        renderAdminEditor();
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

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "day-switcher-arrow";
    nextBtn.textContent = "›";
    nextBtn.disabled = selectedAdminDay === rutinaSeleccionada.length - 1;
    nextBtn.addEventListener("click", () => {
      if (selectedAdminDay < rutinaSeleccionada.length - 1) {
        selectedAdminDay += 1;
        renderAdminEditor();
      }
    });

    switcher.append(prevBtn, selectWrap, nextBtn);
    adminEditorTabs.appendChild(switcher);

    const heading = document.createElement("div");
    heading.className = "editor-day-title";
    heading.innerHTML = `
      <div class="editor-day-fields">
        <div class="day-number-edit">
          <label>Día</label>
          <input id="adminDayNumberInput" type="number" min="1" step="1" value="${Number(diaActual.numero) || 1}">
        </div>
        <div class="day-name-edit">
          <label>Nombre</label>
          <input id="adminDayNameInput" value="${esc(diaActual.nombre)}">
        </div>
        <div class="day-actions">
          <button class="small icon-only" id="adminSaveDayBtn" title="Guardar día" aria-label="Guardar día">${icon("save")}</button>
          <button class="small icon-only danger" id="adminDeleteDayBtn" title="Eliminar día" aria-label="Eliminar día">${icon("trash-2")}</button>
        </div>
      </div>
    `;
    adminEditorList.appendChild(heading);

    document.getElementById("adminSaveDayBtn").addEventListener("click", async () => {
      const numero = Number(document.getElementById("adminDayNumberInput").value);
      const nombre = document.getElementById("adminDayNameInput").value.trim();
      if (!Number.isInteger(numero) || numero < 1) return alert("El número del día debe ser un entero mayor a 0.");
      if (!nombre) return alert("Escribí un nombre para el día.");
      const ok = await accionAdminRutina("updateDay", { id: diaActual.id, numero, nombre });
      if (ok) {
        selectedAdminDay = Math.max(0, rutinaSeleccionada.findIndex((d) => Number(d.numero) === numero));
        renderAdminEditor();
      }
    });

    document.getElementById("adminDeleteDayBtn").addEventListener("click", async () => {
      if (rutinaSeleccionada.length === 1) return alert("Debe existir al menos un día.");
      if (!confirm(`¿Eliminar el Día ${diaActual.numero} y todos sus ejercicios?`)) return;
      const ok = await accionAdminRutina("deleteDay", { id: diaActual.id });
      if (ok) {
        selectedAdminDay = Math.min(selectedAdminDay, rutinaSeleccionada.length - 1);
        renderAdminEditor();
      }
    });

    const lista = document.createElement("div");
    lista.className = "editor-exercise-list";

    diaActual.ejercicios.forEach((ejercicio, index) => {
      const row = document.createElement("div");
      row.className = "edit-row";
      row.innerHTML = `
        <div class="edit-row-info">
          <strong>${esc(ejercicio.name)}</strong>
          <div class="edit-meta">${esc(ejercicio.series || "—")} × ${esc(ejercicio.reps || "—")} · ${ejercicio.url ? "video agregado" : "sin video"}</div>
        </div>
        <div class="edit-actions">
          <button class="small move-up" aria-label="Mover arriba">${icon("chevron-up")}</button>
          <button class="small move-down" aria-label="Mover abajo">${icon("chevron-down")}</button>
          <button class="small edit-button">${icon("pencil")}</button>
          <button class="small danger delete-button" aria-label="Eliminar">${icon("trash-2")}</button>
        </div>
      `;
      row.querySelector(".move-up").addEventListener("click", () => moverEjercicioAdmin(index, -1));
      row.querySelector(".move-down").addEventListener("click", () => moverEjercicioAdmin(index, 1));
      row.querySelector(".edit-button").addEventListener("click", () => abrirFormularioEjercicio(ejercicio));
      row.querySelector(".delete-button").addEventListener("click", () => borrarEjercicioAdmin(ejercicio));
      lista.appendChild(row);
    });

    adminEditorList.appendChild(lista);

    const addBtn = document.createElement("button");
    addBtn.className = "add-btn";
    addBtn.textContent = "＋ Agregar ejercicio a este día";
    addBtn.addEventListener("click", () => abrirFormularioEjercicio());
    adminEditorList.appendChild(addBtn);
  }

  async function moverEjercicioAdmin(index, delta) {
    const dia = rutinaSeleccionada[selectedAdminDay];
    const nuevoIndex = index + delta;
    if (nuevoIndex < 0 || nuevoIndex >= dia.ejercicios.length) return;

    const ids = dia.ejercicios.map((e) => e.id);
    [ids[index], ids[nuevoIndex]] = [ids[nuevoIndex], ids[index]];

    const ok = await accionAdminRutina("reorderExercises", { dia_id: dia.id, ids });
    if (ok) {
      await cargarRutinaUsuario();
      renderAdminEditor();
    }
  }

  function abrirFormularioEjercicio(ejercicio = null) {
    adminFormTitle.textContent = ejercicio ? "Editar ejercicio" : "Agregar ejercicio";
    adminExerciseFormEl.dataset.exerciseId = ejercicio?.id ? String(ejercicio.id) : "";
    adminExerciseName.value = ejercicio?.name || "";
    adminExerciseSeries.value = ejercicio?.series || "";
    adminExerciseReps.value = ejercicio?.reps || "";
    adminExerciseUrl.value = ejercicio?.url || "";
    adminExerciseForm.classList.add("open");
  }

  function cerrarFormularioEjercicio() {
    adminExerciseForm.classList.remove("open");
    adminExerciseFormEl.reset();
    adminExerciseFormEl.dataset.exerciseId = "";
  }

  adminCancelExerciseBtn.addEventListener("click", cerrarFormularioEjercicio);

  adminExerciseFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const exerciseId = Number(adminExerciseFormEl.dataset.exerciseId || 0);
    const nombre = adminExerciseName.value.trim();
    const series = adminExerciseSeries.value.trim();
    const repeticiones = adminExerciseReps.value.trim();
    const videoUrl = adminExerciseUrl.value.trim();

    if (!nombre) return alert("Escribí el nombre del ejercicio.");

    const dia = rutinaSeleccionada[selectedAdminDay];
    const ok = exerciseId
      ? await accionAdminRutina("updateExercise", { id: exerciseId, nombre, series, repeticiones, video_url: videoUrl })
      : await accionAdminRutina("createExercise", {
          dia_id: dia.id,
          nombre,
          series,
          repeticiones,
          video_url: videoUrl,
        });

    if (ok) {
      cerrarFormularioEjercicio();
      await cargarRutinaUsuario();
      renderAdminEditor();
    }
  });

  async function borrarEjercicioAdmin(ejercicio) {
    if (!confirm(`¿Borrar "${ejercicio.name}"?`)) return;
    const ok = await accionAdminRutina("deleteExercise", { id: ejercicio.id });
    if (ok) {
      await cargarRutinaUsuario();
      renderAdminEditor();
    }
  }

  async function abrirAsignarRutina() {
    try {
      const result = await api("adminListarRutinas");
      const rutinas = result.rutinas || [];
      const listado = rutinas
        .map((r) => `${r.id}: ${r.nombre} (usuarios: ${r.usuarios.map((u) => u.nombre).join(", ") || "ninguno"})`)
        .join("\n");

      const eleccion = prompt(
        `Rutinas existentes:\n${listado || "(no hay ninguna todavía)"}\n\n` +
          `Escribí el ID de una rutina para asignársela a ${usuarioSeleccionado.nombre}, ` +
          `o dejá vacío y aceptá para crearle una rutina nueva en blanco.`
      );
      if (eleccion === null) return;

      if (eleccion.trim() === "") {
        const nombreNueva = prompt("Nombre de la nueva rutina:", "Mi rutina") || "Mi rutina";
        await api("adminCrearRutina", { target_usuario_id: usuarioSeleccionado.id, nombre: nombreNueva });
      } else {
        const rutinaId = Number(eleccion);
        if (!Number.isInteger(rutinaId)) return alert("ID inválido.");
        await api("adminAsignarRutina", { target_usuario_id: usuarioSeleccionado.id, rutina_id: rutinaId });
      }
      await cargarRutinaUsuario();
    } catch (error) {
      alert(error.message);
    }
  }

  // ---------- Pesos y métricas (solo lectura) ----------

  async function cargarPesosUsuario() {
    tabPesos.innerHTML = `<div class="meta">Cargando…</div>`;
    try {
      const result = await api("adminHistorialPesosUsuario", { target_usuario_id: usuarioSeleccionado.id });
      const historial = result.historial || [];
      tabPesos.innerHTML = historial.length
        ? `<div class="admin-tabla">
            ${historial
              .map(
                (h) => `
              <div class="admin-tabla-fila">
                <span>${fmtFecha(h.fecha)}</span>
                <span>${esc(h.ejercicio)}</span>
                <span>${h.peso} kg</span>
              </div>`
              )
              .join("")}
          </div>`
        : `<div class="meta">Sin registros de peso todavía.</div>`;
    } catch (error) {
      tabPesos.innerHTML = `<div class="meta">${esc(error.message)}</div>`;
    }
  }

  async function cargarMetricasUsuario() {
    tabMetricas.innerHTML = `<div class="meta">Cargando…</div>`;
    try {
      const result = await api("adminHistorialMetricasUsuario", { target_usuario_id: usuarioSeleccionado.id });
      const historial = result.historial || [];
      tabMetricas.innerHTML = historial.length
        ? `<div class="admin-tabla">
            ${historial
              .map(
                (h) => `
              <div class="admin-tabla-fila">
                <span>${fmtFecha(h.fecha)}</span>
                <span>${h.peso} kg</span>
                <span>${h.grasa === null ? "—" : h.grasa + "% grasa"}</span>
                <span>${h.agua === null ? "—" : h.agua + "% agua"}</span>
              </div>`
              )
              .join("")}
          </div>`
        : `<div class="meta">Sin métricas registradas todavía.</div>`;
    } catch (error) {
      tabMetricas.innerHTML = `<div class="meta">${esc(error.message)}</div>`;
    }
  }

  // ---------- Cerrar sesión ----------

  logoutBtn.addEventListener("click", async () => {
    try {
      await api("logout");
    } catch {
      // seguimos igual al login aunque falle la llamada
    }
    panelAdmin.hidden = true;
    usuarioActual = null;
    mostrarPantallaLogin();
  });

  // ---------- Punto de entrada ----------

  window.MiRutinaAdmin = {
    async iniciar() {
      panelAdmin.hidden = false;
      seccionDetalle.hidden = true;
      seccionUsuarios.hidden = false;
      await cargarUsuarios();
    },
  };
})();
