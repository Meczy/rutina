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
  const tabActividad = document.getElementById("adminTabActividad");

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

  // "hace 5 min", "hace 3 h", "hace 2 días" o la fecha si pasó más de una semana.
  function fmtHace(f) {
    if (!f) return "nunca";
    const minutos = Math.floor((Date.now() - new Date(f).getTime()) / 60000);
    if (minutos < 1) return "recién";
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias < 7) return `hace ${dias} día${dias === 1 ? "" : "s"}`;
    return fmtFecha(f);
  }

  // ---------- Lista de usuarios ----------

  async function cargarUsuarios() {
    listaUsuariosEl.innerHTML = `<div class="meta">Cargando usuarios…</div>`;
    try {
      const result = await api("adminListarUsuarios", { semana: inicioSemana() });
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
          ? u.rutinas.map((r) => `${esc(r.nombre)}${r.activa && u.rutinas.length > 1 ? " (activa)" : ""}`).join(", ")
          : "Sin rutina asignada";
        return `
          <div class="admin-user-card" data-id="${u.id}">
            <div class="admin-user-info">
              <div class="name">${esc(u.nombre)} ${u.rol === "admin" ? '<span class="admin-badge">admin</span>' : ""}</div>
              <div class="meta">${esc(u.email)}</div>
              <div class="meta">Rutinas: ${rutinasTxt}</div>
              <div class="meta">Registrado: ${fmtFecha(u.creadoEn)} · Último uso: ${fmtHace(u.ultimoUso)}</div>
              ${
                u.rol !== "admin" && u.diasEntrenadosSemana !== null
                  ? `<div class="meta">Esta semana: ${u.diasEntrenadosSemana}/${u.diasRutina} días entrenados</div>`
                  : ""
              }
            </div>
            <div class="admin-user-actions">
              <button type="button" class="small" data-admin-ver="${u.id}">Ver</button>
              ${
                u.rol === "admin"
                  ? `<button type="button" class="small" data-admin-quitar-rol="${u.id}">Quitar admin</button>`
                  : `<button type="button" class="small" data-admin-hacer-rol="${u.id}">Hacer admin</button>`
              }
              <button type="button" class="small" data-admin-password="${u.id}">Contraseña</button>
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

    listaUsuariosEl.querySelectorAll("[data-admin-password]").forEach((btn) => {
      btn.addEventListener("click", () => abrirPasswordTemporal(Number(btn.dataset.adminPassword)));
    });
  }

  // Para quien olvidó su contraseña: el admin le pone una temporal, se la
  // pasa por fuera de la app, y la persona la cambia desde "Mi cuenta".
  function abrirPasswordTemporal(id) {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;

    modalTitle.textContent = `Contraseña de ${usuario.nombre}`;
    modal.querySelector(".modal-card").classList.remove("vertical");
    modalBody.innerHTML = `
      <form id="passwordTemporalForm" class="mi-cuenta">
        <p class="footer-note" style="margin:0;text-align:left">
          Poné una contraseña temporal y pasásela a ${esc(usuario.nombre)} (${esc(usuario.email)}).
          Se cierran sus sesiones abiertas; después puede cambiarla desde "Mi cuenta".
        </p>
        <div class="field"><label>Contraseña temporal</label>
          <input type="text" id="passwordTemporal" minlength="6" required autocomplete="off"></div>
        <p class="auth-error" id="passwordTemporalMensaje" hidden></p>
        <div class="form-actions">
          <button type="button" class="small" id="passwordTemporalCancelar">Cancelar</button>
          <button type="submit" class="main-btn" id="passwordTemporalGuardar">Guardar</button>
        </div>
      </form>
    `;
    modal.classList.add("open");

    const input = document.getElementById("passwordTemporal");
    const mensaje = document.getElementById("passwordTemporalMensaje");
    const guardar = document.getElementById("passwordTemporalGuardar");
    // Sugerencia fácil de dictar: 8 caracteres sin letras que se confundan.
    const letras = "abcdefghjkmnpqrstuvwxyz23456789";
    input.value = Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => letras[n % letras.length]).join("");

    document.getElementById("passwordTemporalCancelar").addEventListener("click", closeVideo);
    document.getElementById("passwordTemporalForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      mensaje.hidden = true;
      mensaje.classList.remove("ok");
      guardar.disabled = true;
      try {
        await api("adminPasswordTemporal", { target_usuario_id: id, password: input.value });
        mensaje.textContent = `Listo. La contraseña de ${usuario.nombre} ahora es: ${input.value}`;
        mensaje.classList.add("ok");
        mensaje.hidden = false;
        guardar.hidden = true;
      } catch (error) {
        mensaje.textContent = error.message;
        mensaje.hidden = false;
        guardar.disabled = false;
      }
    });
  }

  async function cambiarRol(id, rol) {
    const usuario = usuarios.find((u) => u.id === id);
    if (rol === "admin") {
      const tieneDatos = usuario && usuario.rutinas.length > 0;
      const ok = await confirmar(
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
      avisar(error.message);
    }
  }

  async function eliminarUsuario(id) {
    const usuario = usuarios.find((u) => u.id === id);
    const nombre = usuario ? usuario.nombre : "este usuario";
    const ok = await confirmar(
      `¿Eliminar a ${nombre}? Esto borra su cuenta, su sesión y su historial de pesos y métricas. Esta acción no se puede deshacer.`,
      { textoAceptar: "Eliminar usuario", peligro: true }
    );
    if (!ok) return;

    try {
      await api("adminEliminarUsuario", { target_usuario_id: id });
      await cargarUsuarios();
    } catch (error) {
      avisar(error.message);
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
    await Promise.all([
      cargarRutinaUsuario(),
      cargarPesosUsuario(),
      cargarMetricasUsuario(),
      cargarActividadUsuario(),
    ]);
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
    tabActividad.hidden = tab !== "actividad";
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
  const adminExerciseDescanso = document.getElementById("adminExerciseDescanso");
  const adminExerciseObservaciones = document.getElementById("adminExerciseObservaciones");
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
        <button type="button" class="small" id="adminAsignarRutinaBtn">Agregar o activar rutina…</button>
      </div>
      ${
        totalDias
          ? `<div class="admin-ejercicios-lista" style="margin-top:14px">
              ${rutinaSeleccionada
                .map(
                  (d) => `
                <div class="admin-ejercicio-row">
                  <div>
                    <div class="name" style="font-size:15px">Día ${esc(String(d.numero))} — ${esc(d.titulo)}</div>
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
      avisar(error.message);
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

  document.getElementById("adminImportarPdfBtn").addEventListener("click", () => {
    abrirImportarPdf({
      targetUsuarioId: usuarioSeleccionado.id,
      alTerminar: (rutina) => {
        rutinaSeleccionada = rutina;
        selectedAdminDay = 0;
        renderAdminEditor();
      },
    });
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
    prevBtn.innerHTML = icon("chevron-left");
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
      <span class="day-switcher-select-title">${esc(diaActual.titulo)}</span>`;

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
        <span class="day-switcher-menu-title">${esc(dia.titulo)}</span>`;
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
    nextBtn.innerHTML = icon("chevron-right");
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
          <input id="adminDayNameInput" value="${esc(diaActual.titulo)}">
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
      if (!Number.isInteger(numero) || numero < 1) return avisar("El número del día debe ser un entero mayor a 0.");
      if (!nombre) return avisar("Escribí un nombre para el día.");
      const ok = await accionAdminRutina("updateDay", { id: diaActual.id, numero, nombre });
      if (ok) {
        selectedAdminDay = Math.max(0, rutinaSeleccionada.findIndex((d) => Number(d.numero) === numero));
        renderAdminEditor();
      }
    });

    document.getElementById("adminDeleteDayBtn").addEventListener("click", async () => {
      if (rutinaSeleccionada.length === 1) return avisar("Debe existir al menos un día.");
      if (!(await confirmar(`¿Eliminar el Día ${diaActual.numero} y todos sus ejercicios?`, { textoAceptar: "Eliminar día", peligro: true }))) return;
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
    adminExerciseDescanso.value = ejercicio?.descanso || "";
    adminExerciseObservaciones.value = ejercicio?.observaciones || "";
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
    const descanso = adminExerciseDescanso.value.trim();
    const observaciones = adminExerciseObservaciones.value.trim();
    const videoUrl = adminExerciseUrl.value.trim();

    if (!nombre) return avisar("Escribí el nombre del ejercicio.");

    const dia = rutinaSeleccionada[selectedAdminDay];
    const ok = exerciseId
      ? await accionAdminRutina("updateExercise", {
          id: exerciseId,
          nombre,
          series,
          repeticiones,
          descanso,
          observaciones,
          video_url: videoUrl,
        })
      : await accionAdminRutina("createExercise", {
          dia_id: dia.id,
          nombre,
          series,
          repeticiones,
          descanso,
          observaciones,
          video_url: videoUrl,
        });

    if (ok) {
      cerrarFormularioEjercicio();
      await cargarRutinaUsuario();
      renderAdminEditor();
    }
  });

  async function borrarEjercicioAdmin(ejercicio) {
    if (!(await confirmar(`¿Quitar "${ejercicio.name}" de este día?`, { textoAceptar: "Quitar", peligro: true }))) return;
    const ok = await accionAdminRutina("deleteExercise", { id: ejercicio.id });
    if (ok) {
      await cargarRutinaUsuario();
      renderAdminEditor();
    }
  }

  // Formulario en el modal (en vez de prompt(), que en el celular se ve
  // mal o ni aparece). Asignar una rutina reemplaza la que el usuario tenía.
  async function abrirAsignarRutina() {
    const usuario = usuarioSeleccionado;
    modalTitle.textContent = `Rutina de ${usuario.nombre}`;
    modal.querySelector(".modal-card").classList.remove("vertical");
    modalBody.innerHTML = `<p class="footer-note" style="padding:16px">Cargando rutinas…</p>`;
    modal.classList.add("open");

    let rutinas;
    try {
      rutinas = (await api("adminListarRutinas")).rutinas || [];
    } catch (error) {
      modalBody.innerHTML = `<p class="auth-error" style="margin:16px">${esc(error.message)}</p>`;
      return;
    }

    // Un usuario puede tener varias rutinas; entrena con la activa.
    const activaId = (usuario.rutinas.find((r) => r.activa) || usuario.rutinas[0] || {}).id;
    const tiene = new Set(usuario.rutinas.map((r) => r.id));
    const etiqueta = (r) => (r.id === activaId ? " <em>(activa)</em>" : tiene.has(r.id) ? " <em>(ya la tiene)</em>" : "");

    modalBody.innerHTML = `
      <form id="asignarRutinaForm" class="admin-asignar">
        <p class="footer-note" style="margin:0;text-align:left">
          Elegí la rutina con la que va a entrenar ${esc(usuario.nombre)}. Se suma a sus rutinas
          (si no la tenía) y queda como la activa; las otras siguen en su lista.
        </p>
        <div class="admin-asignar-lista">
          ${rutinas
            .map(
              (r) => `
                <label class="admin-asignar-opcion">
                  <input type="radio" name="rutinaElegida" value="${r.id}" ${r.id === activaId ? "checked" : ""}>
                  <span>
                    <strong>#${r.id} · ${esc(r.nombre)}</strong>${etiqueta(r)}
                    <span class="admin-asignar-detalle">Usuarios: ${esc(r.usuarios.map((u) => u.nombre).join(", ") || "ninguno")}</span>
                  </span>
                </label>
              `
            )
            .join("")}
          <label class="admin-asignar-opcion">
            <input type="radio" name="rutinaElegida" value="nueva" ${rutinas.length ? "" : "checked"}>
            <span>
              <strong>Crear una rutina nueva en blanco</strong>
              <input type="text" id="asignarNombreNueva" placeholder="Nombre de la rutina" value="Mi rutina">
            </span>
          </label>
        </div>
        <p class="auth-error" id="asignarRutinaError" hidden></p>
        <div class="form-actions">
          <button type="button" class="small" id="asignarRutinaCancelar">Cancelar</button>
          <button type="submit" class="main-btn" id="asignarRutinaGuardar">Guardar</button>
        </div>
      </form>
    `;

    const form = document.getElementById("asignarRutinaForm");
    const errorEl = document.getElementById("asignarRutinaError");
    const guardarBtn = document.getElementById("asignarRutinaGuardar");
    const nombreNuevaInput = document.getElementById("asignarNombreNueva");

    nombreNuevaInput.addEventListener("focus", () => {
      form.querySelector('input[value="nueva"]').checked = true;
    });
    document.getElementById("asignarRutinaCancelar").addEventListener("click", closeVideo);

    return new Promise((resolve) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const elegida = form.querySelector('input[name="rutinaElegida"]:checked');
        errorEl.hidden = true;

        if (!elegida) {
          errorEl.textContent = "Elegí una rutina.";
          errorEl.hidden = false;
          return;
        }

        guardarBtn.disabled = true;
        try {
          if (elegida.value === "nueva") {
            const nombre = nombreNuevaInput.value.trim() || "Mi rutina";
            await api("adminCrearRutina", { target_usuario_id: usuario.id, nombre });
          } else {
            await api("adminAsignarRutina", { target_usuario_id: usuario.id, rutina_id: Number(elegida.value) });
          }
          closeVideo();
          selectedAdminDay = 0;
          await Promise.all([cargarRutinaUsuario(), cargarUsuarios()]);
          usuarioSeleccionado = usuarios.find((u) => u.id === usuario.id) || usuarioSeleccionado;
          resolve(true);
        } catch (error) {
          errorEl.textContent = error.message;
          errorEl.hidden = false;
          guardarBtn.disabled = false;
        }
      });
    });
  }

  // ---------- Actividad: días entrenados en las últimas 8 semanas ----------

  async function cargarActividadUsuario() {
    tabActividad.innerHTML = `<div class="meta">Cargando…</div>`;
    try {
      const result = await api("adminActividadUsuario", {
        target_usuario_id: usuarioSeleccionado.id,
        semana: inicioSemana(),
      });
      const total = result.diasRutina;

      tabActividad.innerHTML = `
        <div class="meta">Último uso: ${fmtHace(result.ultimoUso)}</div>
        <div class="admin-actividad">
          ${result.semanas
            .map((s, i) => {
              const pct = total ? Math.min(100, Math.round((s.dias / total) * 100)) : 0;
              return `
                <div class="admin-actividad-fila">
                  <span class="admin-actividad-semana">${i === 0 ? "Esta semana" : `Semana del ${fmtFecha(`${s.semana}T12:00:00`)}`}</span>
                  <span class="admin-actividad-barra"><span style="width:${pct}%"></span></span>
                  <span class="admin-actividad-dato"><strong>${s.dias}/${total}</strong> días · ${s.ejercicios} ejerc.</span>
                </div>`;
            })
            .join("")}
        </div>
        <div class="meta">Un día cuenta como entrenado cuando tiene todos sus ejercicios marcados.</div>
      `;
    } catch (error) {
      tabActividad.innerHTML = `<div class="meta">${esc(error.message)}</div>`;
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

  // ---------- Mi cuenta / cerrar sesión ----------

  document.getElementById("adminMiCuentaButton").addEventListener("click", () => abrirMiCuenta());

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
