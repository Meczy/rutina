// Genera la plantilla de Excel y el PDF de ejemplo del formato de rutina que
// acepta MecFit (el mismo del PDF del entrenador), con datos de muestra.
// Se publican en public/ejemplos/ (botones de "Importar PDF").
//
// Uso (necesita exceljs y pdfkit, que no son dependencias del proyecto):
//   npm install --no-save exceljs@4.4.0 pdfkit@0.15.0
//   node scripts/generar-ejemplos-rutina.cjs public/ejemplos
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const salida = process.argv[2];
fs.mkdirSync(salida, { recursive: true });

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const rutina = {
  cliente: "Nombre Apellido",
  observaciones: "Ejemplo: hacer abdomen los días de tren superior. Descansar 90 segundos entre series.",
  bloques: [
    {
      titulo: "Día 1: Pierna",
      ejercicios: [
        ["Sentadilla goblet", "4", "12", "90seg", ""],
        ["Peso muerto rumano", "4", "10", "90seg", "Espalda recta"],
        ["Hip thrust con barra", "3", "12", "Superserie", ""],
      ],
    },
    {
      titulo: "Día 2: Torso",
      ejercicios: [
        ["Press de banca", "4", "10", "90seg", ""],
        ["Remo con mancuerna", "4", "12", "90seg", "Por brazo"],
        ["Elevaciones laterales", "3", "15", "Superserie", ""],
      ],
    },
    {
      titulo: "Día 3: Brazos",
      ejercicios: [
        ["Curl de bíceps con barra", "3", "12", "60seg", ""],
        ["Extensión de tríceps en polea", "3", "12", "60seg", ""],
        ["Curl martillo", "3", "12", "60seg", "Pirámide descendente"],
      ],
    },
    {
      // Sin "Día N": MecFit lo importa como día complementario.
      titulo: "Abdomen",
      complementario: true,
      ejercicios: [
        ["Plancha", "3", "40seg", "60seg", ""],
        ["Crunch abdominal", "3", "15", "60seg", ""],
      ],
    },
  ],
};
const diasEntrenamiento = rutina.bloques.filter((b) => !b.complementario).length;

// ---------------------------------------------------------------- PDF
function generarPdf(archivo) {
  const doc = new PDFDocument({ size: "A4", margin: 32, info: { Title: "MecFit - formato de rutina (ejemplo)" } });
  doc.pipe(fs.createWriteStream(archivo));

  // Columnas: Ejercicio, Video, Series, Reps, Descanso, Observaciones
  const anchos = [190, 62, 52, 52, 66, 109];
  const xs = [];
  anchos.reduce((x, w) => (xs.push(x), x + w), 32);
  const anchoTotal = anchos.reduce((a, b) => a + b, 0);
  const alto = 15;
  let y = 32;

  const celda = (texto, col, { negrita = false, link = null, color = "#111111", tam = 8.5 } = {}) => {
    doc.font(negrita ? "Helvetica-Bold" : "Helvetica").fontSize(tam).fillColor(link ? "#1a56db" : color);
    doc.text(texto, xs[col], y + 4, { width: anchos[col], align: "center", link, underline: Boolean(link), lineBreak: false });
  };
  const fondo = (color, desde = 0, hasta = 5) => {
    doc.rect(xs[desde], y, xs[hasta] + anchos[hasta] - xs[desde], alto).fill(color);
  };
  const bordes = (desde = 0, hasta = 5) => {
    doc.lineWidth(0.5).strokeColor("#9ca3af");
    for (let c = desde; c <= hasta; c += 1) doc.rect(xs[c], y, anchos[c], alto).stroke();
  };

  // Encabezado (sin marca ni datos reales)
  doc.rect(32, y, anchoTotal, 54).fill("#e5e7eb");
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text("Rutina de entrenamiento", 32, y + 10, { width: anchoTotal, align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text("Ejemplo del formato que acepta MecFit", 32, y + 36, { width: anchoTotal, align: "center" });
  y += 62;

  const filaCompleta = (texto, { etiqueta = false } = {}) => {
    doc.rect(32, y, anchoTotal, alto).fill(etiqueta ? "#9ca3af" : "#f3f4f6");
    doc.font(etiqueta ? "Helvetica" : "Helvetica-Bold").fontSize(etiqueta ? 7 : 10).fillColor("#111827");
    doc.text(texto, 32, y + (etiqueta ? 4.5 : 3.5), { width: anchoTotal, align: "center", lineBreak: false });
    y += alto;
  };
  filaCompleta("Nombre de Cliente", { etiqueta: true });
  filaCompleta(rutina.cliente);
  filaCompleta("Observaciones Generales", { etiqueta: true });
  filaCompleta(rutina.observaciones);
  y += 12;

  fondo("#9ca3af", 0, 1);
  celda("Número de entrenamientos:", 0, { negrita: true });
  doc.rect(xs[1], y, anchos[1], alto).fill("#ffffff");
  celda(String(diasEntrenamiento), 1, { negrita: true });
  y += alto + 14;

  for (const bloque of rutina.bloques) {
    // Título del bloque + Nº de ejercicios
    fondo("#9ca3af", 0, 3);
    celda(bloque.complementario ? "Ejercicio" : bloque.titulo, 0, { negrita: true });
    // "Nº de ejercicios" ocupa las columnas Video y Series (no entra en una sola).
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111111");
    doc.text("Nº de ejercicios", xs[1], y + 4, { width: anchos[1] + anchos[2], align: "center", lineBreak: false });
    doc.rect(xs[3], y, anchos[3], alto).fill("#ffffff");
    celda(String(bloque.ejercicios.length), 3, { negrita: true });
    y += alto;

    // Encabezados de la tabla
    fondo("#9ca3af");
    ["Ejercicio", "Video", "Series", "Reps", "Descanso", "Observaciones"].forEach((t, c) =>
      celda(c === 0 && bloque.complementario ? bloque.titulo : t, c, { negrita: true })
    );
    bordes();
    y += alto;

    for (const [nombre, series, reps, descanso, obs] of bloque.ejercicios) {
      fondo("#ffffff");
      celda(nombre, 0);
      celda("Ver Video", 1, { link: yt(nombre) });
      celda(series, 2);
      celda(reps, 3);
      celda(descanso, 4);
      if (obs) celda(obs, 5, { negrita: true });
      bordes();
      y += alto;
    }

    if (!bloque.complementario) {
      doc.font("Helvetica").fontSize(6).fillColor("#6b7280").text("FIN_ENTRENAMIENTO", xs[0], y + 2, { width: anchos[0], align: "center", lineBreak: false });
    }
    y += 26;
  }

  doc.end();
}

// ---------------------------------------------------------------- Excel
async function generarExcel(archivo) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "MecFit";

  const gris = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9CA3AF" } };
  const grisClaro = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  const editable = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7CC" } };
  const borde = { style: "thin", color: { argb: "FF9CA3AF" } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };
  const centro = { horizontal: "center", vertical: "middle", wrapText: true };
  const fuente = (extra = {}) => ({ name: "Arial", size: 10, ...extra });

  // Hoja 1: la rutina (lo que se guarda como PDF)
  const hoja = libro.addWorksheet("Rutina", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
    views: [{ showGridLines: false }],
  });
  hoja.columns = [{ width: 40 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 13 }, { width: 24 }];

  const fila = (valores, estilo = {}) => {
    const r = hoja.addRow(valores);
    r.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 6) return;
      c.font = fuente(estilo.font);
      c.alignment = centro;
      if (estilo.fill) c.fill = estilo.fill;
      if (estilo.bordes) c.border = bordes;
    });
    r.height = estilo.alto || 18;
    return r;
  };
  const filaUnida = (texto, estilo) => {
    const r = fila([texto, "", "", "", "", ""], estilo);
    hoja.mergeCells(r.number, 1, r.number, 6);
    return r;
  };

  filaUnida("Rutina de entrenamiento", { font: { size: 18, bold: true }, fill: grisClaro, alto: 34 });
  filaUnida("Nombre de Cliente", { font: { size: 8 }, fill: gris });
  filaUnida(rutina.cliente, { font: { bold: true, size: 12 }, fill: editable, alto: 22 });
  filaUnida("Observaciones Generales", { font: { size: 8 }, fill: gris });
  filaUnida(rutina.observaciones, { font: { bold: true }, fill: editable, alto: 30 });
  hoja.addRow([]);
  const filaNum = fila(["Número de entrenamientos:", diasEntrenamiento], { font: { bold: true } });
  filaNum.getCell(1).fill = gris;
  filaNum.getCell(2).fill = editable;
  filaNum.getCell(2).border = bordes;
  hoja.addRow([]);

  for (const bloque of rutina.bloques) {
    const t = fila([bloque.complementario ? "Ejercicio" : bloque.titulo, "", "Nº de ejercicios", bloque.ejercicios.length], { font: { bold: true } });
    [1, 2, 3].forEach((n) => (t.getCell(n).fill = gris));
    t.getCell(1).fill = bloque.complementario ? gris : editable;
    t.getCell(4).fill = editable;
    t.getCell(4).border = bordes;

    fila([bloque.complementario ? bloque.titulo : "Ejercicio", "Video", "Series", "Reps", "Descanso", "Observaciones"], {
      font: { bold: true },
      fill: gris,
      bordes: true,
    });

    for (const [nombre, series, reps, descanso, obs] of bloque.ejercicios) {
      const r = fila([nombre, "Ver Video", series, reps, descanso, obs], { fill: editable, bordes: true });
      r.getCell(2).value = { text: "Ver Video", hyperlink: yt(nombre) };
      r.getCell(2).font = fuente({ color: { argb: "FF1A56DB" }, underline: true });
      r.getCell(6).font = fuente({ bold: true });
    }

    if (!bloque.complementario) {
      fila(["FIN_ENTRENAMIENTO"], { font: { size: 7, color: { argb: "FF6B7280" } }, alto: 14 });
    }
    hoja.addRow([]);
  }

  // Hoja 2: instrucciones
  const ayuda = libro.addWorksheet("Cómo usar");
  ayuda.columns = [{ width: 110 }];
  const lineas = [
    ["Cómo armar tu rutina para importarla en MecFit", { bold: true, size: 14 }],
    [""],
    ["1. Completá las celdas amarillas de la hoja \"Rutina\": tu nombre, las observaciones, el número de entrenamientos y los ejercicios."],
    ["2. Para cambiar el video de un ejercicio: clic derecho sobre \"Ver Video\" → Editar vínculo, y pegá el enlace de YouTube o Instagram."],
    ["3. Para agregar un ejercicio, insertá una fila dentro de la tabla de ese día y copiá el formato de una fila de ejercicio."],
    ["4. Para agregar un día, copiá un bloque completo (desde \"Día N: …\" hasta \"FIN_ENTRENAMIENTO\") y cambiale el número y el nombre."],
    ["5. Guardalo como PDF: Archivo → Guardar como (o Exportar) → PDF. Después, en MecFit: Editar rutina → Importar PDF."],
    [""],
    ["Reglas para que MecFit lo acepte", { bold: true, size: 12 }],
    ["• No cambies los textos grises: \"Nombre de Cliente\", \"Número de entrenamientos:\", \"Nº de ejercicios\" ni los encabezados Ejercicio, Video, Series, Reps, Descanso y Observaciones."],
    ["• Cada día empieza con \"Día N: nombre\" (por ejemplo \"Día 4: Espalda\") y termina con la fila FIN_ENTRENAMIENTO."],
    ["• Todos los ejercicios tienen que tener sus series."],
    ["• Un bloque sin \"Día N\" (como Abdomen) se importa como día complementario: no cuenta como día de entrenamiento."],
    ["• Descanso y Observaciones son opcionales: en MecFit aparecen en \"Notas\" de cada ejercicio."],
  ];
  for (const [texto, extra] of lineas) {
    const r = ayuda.addRow([texto]);
    r.getCell(1).font = fuente(extra || {});
    r.getCell(1).alignment = { wrapText: true, vertical: "top" };
  }

  await libro.xlsx.writeFile(archivo);
}

(async () => {
  const pdf = path.join(salida, "mecfit-formato-rutina.pdf");
  const xlsx = path.join(salida, "mecfit-plantilla-rutina.xlsx");
  generarPdf(pdf);
  await generarExcel(xlsx);
  console.log("generados:", pdf, xlsx);
})();
