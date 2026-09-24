// Convierte el texto por página de un PDF en fragmentos citables (párrafos agrupados),
// conservando página y sección (artículo) para que cada cita sea verificable.

export type Fragmento = { pagina: number; seccion: string | null; texto: string };

const PIE = /fomentosansebastian\.eus\s*·|^\s*\d+\s*\/\s*\d+\s*$/i;
// Solo en mayúsculas: "artículo 42 del Código…" o "Anexo «Memoria…»" dentro de un párrafo no abren sección
const CABECERA_SECCION = /^(ART[ÍI]CULO \d+|ARTIKULUA|\d+\. ARTIKULUA|ANEXO|ERANSKINA|DISPOSICI[ÓO]N|PRELIMINAR|DISPOSICIONES)\b/;
const INICIO_ITEM = /^(•|-|✓|[a-z]\.|[a-z]\)|\d{1,2}[.)-]|\d{1,2}\s{2,})\s*/i;
const OBJETIVO = 700;
const MAXIMO = 1100;

function esMayusculas(linea: string) {
  const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  return letras.length > 3 && letras === letras.toUpperCase();
}

export function segmentar(paginas: string[]): Fragmento[] {
  const parrafos: Fragmento[] = [];
  let seccion: string | null = null;

  paginas.forEach((textoPagina, i) => {
    const pagina = i + 1;
    const lineas = textoPagina
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l && !PIE.test(l));

    let actual = "";
    let tituloAbierto = false;
    const cerrar = () => {
      if (actual.trim()) parrafos.push({ pagina, seccion, texto: actual.trim() });
      actual = "";
    };

    for (const linea of lineas) {
      if (CABECERA_SECCION.test(linea)) {
        cerrar();
        seccion = linea;
        tituloAbierto = !/[.:]$/.test(linea);
        continue;
      }
      // títulos de artículo que continúan en la línea siguiente (en mayúsculas)
      if (tituloAbierto && esMayusculas(linea)) {
        seccion = `${seccion} ${linea}`;
        continue;
      }
      tituloAbierto = false;

      if (INICIO_ITEM.test(linea) && actual) cerrar();
      actual = actual ? `${actual} ${linea}` : linea;
      if (/[.:;]$/.test(linea)) cerrar();
    }
    cerrar();
  });

  // Agrupa párrafos consecutivos de la misma página y sección hasta un tamaño razonable
  const fragmentos: Fragmento[] = [];
  for (const p of parrafos) {
    const ultimo = fragmentos.at(-1);
    if (
      ultimo &&
      ultimo.pagina === p.pagina &&
      ultimo.seccion === p.seccion &&
      ultimo.texto.length < OBJETIVO &&
      ultimo.texto.length + p.texto.length < MAXIMO
    ) {
      ultimo.texto = `${ultimo.texto}\n${p.texto}`;
    } else {
      fragmentos.push({ ...p });
    }
  }
  return fragmentos;
}
