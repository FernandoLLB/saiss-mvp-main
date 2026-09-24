import { Fragment, type ReactNode } from "react";

// Renderizado mínimo y seguro (sin HTML) de las respuestas: párrafos, listas y negritas.
function enLinea(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
    trozo.startsWith("**") && trozo.endsWith("**") ? <strong key={i}>{trozo.slice(2, -2)}</strong> : <Fragment key={i}>{trozo}</Fragment>,
  );
}

export function Markdown({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  // Ítems numerados con sub-viñetas: las viñetas cuelgan del último ítem numerado en vez de romper la numeración
  let lista: { tipo: "ul" | "ol"; items: { texto: string; sub: string[] }[] } | null = null;
  const cerrarLista = () => {
    if (!lista) return;
    const Tag = lista.tipo;
    bloques.push(
      <Tag key={bloques.length}>
        {lista.items.map((it, i) => (
          <li key={i}>
            {enLinea(it.texto)}
            {it.sub.length > 0 && (
              <ul>
                {it.sub.map((s, j) => (
                  <li key={j}>{enLinea(s)}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </Tag>,
    );
    lista = null;
  };

  const lineas = texto.split("\n");
  for (let n = 0; n < lineas.length; n++) {
    const linea = lineas[n];
    // Tablas: filas consecutivas que empiezan y terminan por "|"
    if (/^\s*\|.*\|\s*$/.test(linea)) {
      cerrarLista();
      const filas: string[][] = [];
      while (n < lineas.length && /^\s*\|.*\|\s*$/.test(lineas[n])) {
        const celdas = lineas[n].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!celdas.every((c) => /^:?-{2,}:?$/.test(c))) filas.push(celdas);
        n++;
      }
      n--;
      const [cabecera, ...cuerpo] = filas;
      bloques.push(
        <div key={bloques.length} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {cabecera.map((c, i) => (
                  <th key={i} className="border-b border-borde px-2 py-1 text-left font-bold">
                    {enLinea(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cuerpo.map((f, i) => (
                <tr key={i} className="border-b border-borde last:border-0">
                  {f.map((c, j) => (
                    <td key={j} className="px-2 py-1 align-top">
                      {enLinea(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const ul = linea.match(/^\s*[-*•]\s+(.*)/);
    const ol = linea.match(/^\s*\d+[.)]\s+(.*)/);
    const titulo = linea.match(/^#{1,4}\s+(.*)/);
    if (/^\s*(---+|\*\*\*+)\s*$/.test(linea)) {
      cerrarLista();
      continue;
    }
    if (ul || ol) {
      const tipo = ul ? "ul" : "ol";
      if (ul && lista?.tipo === "ol" && lista.items.length) {
        lista.items[lista.items.length - 1].sub.push(ul[1]);
        continue;
      }
      if (lista && lista.tipo !== tipo) cerrarLista();
      lista ??= { tipo, items: [] };
      lista.items.push({ texto: (ul ?? ol)![1], sub: [] });
    } else if (!linea.trim()) {
      // Una línea en blanco no rompe una lista numerada si el siguiente ítem continúa la numeración
      const siguiente = lineas.slice(n + 1).find((l) => l.trim());
      if (!(lista?.tipo === "ol" && siguiente && /^\s*(\d+[.)]|[-*•])\s+/.test(siguiente))) cerrarLista();
    } else {
      cerrarLista();
      bloques.push(
        titulo ? (
          <p key={bloques.length} className="font-bold">
            {enLinea(titulo[1])}
          </p>
        ) : (
          <p key={bloques.length}>{enLinea(linea)}</p>
        ),
      );
    }
  }
  cerrarLista();
  return <div className="prosa">{bloques}</div>;
}
