// --- Exportar una rutina a PDF (Mi cuenta → Rutinas → Exportar PDF) ---
// El PDF se arma acá mismo, sin librerías: texto en Helvetica (la traen
// todos los lectores de PDF) sobre hojas A4, un bloque por día con sus
// ejercicios, series, repeticiones, descanso y observaciones.

const PDF_ANCHO = 595.28;
const PDF_ALTO = 841.89;
const PDF_MARGEN = 48;
const PDF_DERECHA = PDF_ANCHO - PDF_MARGEN;

// Ancho de cada carácter de 32 (espacio) a 126 (~), en milésimas del tamaño
// de letra (tablas oficiales de Helvetica). Sirve para cortar las líneas.
const PDF_ANCHOS = {
  normal: [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
    556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
    260, 334, 584,
  ],
  negrita: [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
    722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
    556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
    280, 389, 584,
  ],
};

function anchoTextoPdf(texto, tamano, negrita = false) {
  const tabla = negrita ? PDF_ANCHOS.negrita : PDF_ANCHOS.normal;
  // Las letras con tilde miden lo mismo que sin tilde (á = a, ñ = n).
  const base = String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");
  let total = 0;
  for (const c of base) {
    const codigo = c.charCodeAt(0);
    total += codigo >= 32 && codigo <= 126 ? tabla[codigo - 32] : 556;
  }
  return (total * tamano) / 1000;
}

// Corta el texto en líneas que entren en `ancho`. Una palabra más larga que
// la línea (por ejemplo un enlace) se corta por letras.
function partirTextoPdf(texto, ancho, tamano, negrita = false) {
  const cabe = (t) => anchoTextoPdf(t, tamano, negrita) <= ancho;
  const lineas = [];
  let linea = "";

  for (let palabra of String(texto ?? "").split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${palabra}` : palabra;
    if (cabe(prueba)) {
      linea = prueba;
      continue;
    }
    if (linea) lineas.push(linea);
    while (!cabe(palabra)) {
      let corte = palabra.length - 1;
      while (corte > 1 && !cabe(palabra.slice(0, corte))) corte -= 1;
      lineas.push(palabra.slice(0, corte));
      palabra = palabra.slice(corte);
    }
    linea = palabra;
  }
  if (linea) lineas.push(linea);
  return lineas;
}

// Texto para el PDF (codificación WinAnsi): las letras del español entran
// tal cual; lo que no existe en esa codificación (emojis, etc.) se omite.
const PDF_WINANSI_EXTRA = { "€": 0x80, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97 };

function cadenaPdf(texto) {
  let salida = "";
  for (const c of String(texto).normalize("NFC")) {
    const codigo = c.codePointAt(0);
    const byte = (codigo >= 32 && codigo < 127) || (codigo >= 160 && codigo < 256) ? codigo : PDF_WINANSI_EXTRA[c];
    if (byte === undefined) continue;
    const letra = String.fromCharCode(byte);
    salida += letra === "(" || letra === ")" || letra === "\\" ? `\\${letra}` : letra;
  }
  return `(${salida})`;
}

function tituloDiaPdf(dia) {
  const titulo = String(dia.titulo ?? "").trim();
  if (dia.complementario) return `${titulo || "Complementario"} (complementario)`;
  if (!titulo || /^d[ií]a\s*\d+$/i.test(titulo)) return `Día ${dia.numero}`;
  return `Día ${dia.numero} · ${titulo}`;
}

// Columnas de la tabla de cada día.
const PDF_COLUMNAS = [
  { titulo: "#", x: PDF_MARGEN, ancho: 20 },
  { titulo: "Ejercicio", x: PDF_MARGEN + 22, ancho: 272 },
  { titulo: "Series", x: 350, ancho: 54 },
  { titulo: "Reps", x: 410, ancho: 62 },
  { titulo: "Descanso", x: 484, ancho: PDF_DERECHA - 484 },
];

function armarPdfRutina(nombreRutina, dias) {
  const paginas = [];
  let ops;
  let y;

  const nuevaPagina = () => {
    ops = [];
    paginas.push(ops);
    y = PDF_ALTO - PDF_MARGEN;
  };
  const texto = (x, yy, contenido, tamano, { negrita = false, gris = 0 } = {}) => {
    ops.push(
      `BT /${negrita ? "F2" : "F1"} ${tamano} Tf ${gris} g ${x.toFixed(2)} ${yy.toFixed(2)} Td ${cadenaPdf(contenido)} Tj ET`
    );
  };
  const raya = (yy, gris = 0.85) => {
    ops.push(`${gris} G 0.6 w ${PDF_MARGEN} ${yy.toFixed(2)} m ${PDF_DERECHA} ${yy.toFixed(2)} l S`);
  };
  // true si hubo que pasar a una hoja nueva para que entre `alto`.
  const asegurarEspacio = (alto) => {
    if (y - alto >= PDF_MARGEN + 24) return false;
    nuevaPagina();
    return true;
  };

  const encabezadoDia = (dia, continuacion = false) => {
    ops.push(`0.94 g ${PDF_MARGEN} ${(y - 24).toFixed(2)} ${PDF_DERECHA - PDF_MARGEN} 24 re f`);
    texto(PDF_MARGEN + 8, y - 16.5, tituloDiaPdf(dia) + (continuacion ? " (continuación)" : ""), 12, { negrita: true });
    y -= 38;
    for (const col of PDF_COLUMNAS) texto(col.x, y, col.titulo, 8, { negrita: true, gris: 0.45 });
    y -= 6;
    raya(y, 0.7);
  };

  nuevaPagina();

  for (const linea of partirTextoPdf(nombreRutina, PDF_DERECHA - PDF_MARGEN, 20, true)) {
    texto(PDF_MARGEN, y - 18, linea, 20, { negrita: true });
    y -= 26;
  }
  const hoy = new Date().toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
  texto(PDF_MARGEN, y - 4, `Exportada el ${hoy} desde MecFit`, 9, { gris: 0.45 });
  y -= 30;

  for (const dia of dias) {
    const ejercicios = dia.ejercicios || [];

    // Cada ejercicio: nombre (y observaciones abajo) y sus datos en columnas.
    const filas = ejercicios.map((e, i) => {
      const celda = (valor, col) => partirTextoPdf(valor || "–", PDF_COLUMNAS[col].ancho, 10);
      const fila = {
        numero: String(i + 1),
        nombre: partirTextoPdf(e.name, PDF_COLUMNAS[1].ancho, 10, true),
        notas: partirTextoPdf(e.observaciones, PDF_COLUMNAS[1].ancho, 8.5),
        series: celda(e.series, 2),
        reps: celda(e.reps, 3),
        descanso: celda(e.descanso, 4),
      };
      const altoEjercicio = fila.nombre.length * 13 + fila.notas.length * 11;
      const altoDatos = Math.max(fila.series.length, fila.reps.length, fila.descanso.length) * 13;
      fila.alto = Math.max(altoEjercicio, altoDatos) + 9;
      return fila;
    });

    // El título del día no queda solo al pie de una hoja.
    asegurarEspacio(46 + (filas[0]?.alto ?? 20));
    encabezadoDia(dia);

    if (!filas.length) {
      texto(PDF_COLUMNAS[1].x, y - 14, "Sin ejercicios", 10, { gris: 0.45 });
      y -= 22;
    }

    for (const fila of filas) {
      if (asegurarEspacio(fila.alto)) encabezadoDia(dia, true);

      let yy = y - 13;
      texto(PDF_COLUMNAS[0].x, yy, fila.numero, 10, { gris: 0.45 });
      fila.nombre.forEach((l, i) => texto(PDF_COLUMNAS[1].x, yy - i * 13, l, 10, { negrita: true }));
      const yNotas = yy - fila.nombre.length * 13 + 1;
      fila.notas.forEach((l, i) => texto(PDF_COLUMNAS[1].x, yNotas - i * 11, l, 8.5, { gris: 0.4 }));
      [fila.series, fila.reps, fila.descanso].forEach((lineas, c) =>
        lineas.forEach((l, i) => texto(PDF_COLUMNAS[c + 2].x, yy - i * 13, l, 10))
      );

      y -= fila.alto;
      raya(y + 2);
    }

    y -= 22;
  }

  // Pie de cada hoja.
  paginas.forEach((pagina, i) => {
    ops = pagina;
    const numero = `Página ${i + 1} de ${paginas.length}`;
    texto(PDF_MARGEN, 28, `MecFit · ${nombreRutina}`, 8, { gris: 0.55 });
    texto(PDF_DERECHA - anchoTextoPdf(numero, 8), 28, numero, 8, { gris: 0.55 });
  });

  // Objetos del PDF: 1 catálogo, 2 páginas, 3-4 letras, 5 datos del
  // documento y después, por cada hoja, la hoja y su contenido.
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${6 + i * 2} 0 R`).join(" ")}] /Count ${paginas.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Title ${cadenaPdf(nombreRutina)} /Producer (MecFit) >>`,
  ];
  paginas.forEach((pagina, i) => {
    const contenido = pagina.join("\n");
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_ANCHO} ${PDF_ALTO}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + i * 2} 0 R >>`,
      `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`
    );
  });

  // Todo es texto de un byte por carácter, así que el largo del string es
  // la posición en bytes que pide la tabla xref.
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const posiciones = objetos.map((cuerpo, i) => {
    const posicion = pdf.length;
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return posicion;
  });
  const inicioXref = pdf.length;
  pdf +=
    `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n` +
    posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
}

// En el celular abre el menú de compartir (guardar en archivos, WhatsApp…);
// en la computadora, o si el celular no lo permite, lo descarga.
async function exportarRutinaPdf(nombreRutina, dias) {
  const nombreArchivo = `${nombreRutina.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Rutina"} - MecFit.pdf`;
  const archivo = new File([armarPdfRutina(nombreRutina, dias)], nombreArchivo, { type: "application/pdf" });

  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreRutina });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
      // Si el navegador no deja compartir (por ejemplo, pasó mucho tiempo
      // desde el toque), se descarga.
    }
  }

  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
