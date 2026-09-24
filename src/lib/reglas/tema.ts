import type { Ficha } from "@/lib/kb/ficha";

// Clasificación heurística del tema de una consulta (sin IA), para las estadísticas del panel.
export const TEMAS = ["cuantia", "requisitos", "documentacion", "gastos", "plazos", "firma", "otro"] as const;
export type Tema = (typeof TEMAS)[number];

const PATRONES: [Tema, RegExp][] = [
  ["firma", /firm|sinat|presentar|aurkez|portal|gestor|ahaldun|certificado digital|ziurtagiri digital/i],
  ["gastos", /gasto|factur|faktur|bizum|pago|ordain|iva|bez|subvencionab|diruz lagun/i],
  ["documentacion", /documen|dokumen|anexo|eranskin|dni|nan|escritur|eskritur|vida laboral|lan-bizitz/i],
  ["plazos", /plazo|epe|cu[aá]ndo|noiz|fecha|data|resoluci|ebazpen|cobr|kobra|subsan|zuzen/i],
  ["cuantia", /cu[aá]nt|zenbat|importe|zenbateko|euro|€|incremento|igoera|corresponde|dagokit/i],
  ["requisitos", /puedo|dezaket|requisit|baldintz|qui[eé]n|nork|cumpl|betetz/i],
];

export function clasificarTema(texto: string): Tema {
  for (const [tema, re] of PATRONES) if (re.test(texto)) return tema;
  return "otro";
}

// Tabla compacta de reglas verificadas para el contexto del asistente (cuantías y documentos con sus IDs).
export function resumenReglas(f: Ficha) {
  const inc = f.cuantia.incrementos.map((i) => `- ${i.id}: ${i.etiqueta} → ${i.importe ? `${i.importe} €` : `hasta ${i.importe_maximo} €`}${i.requiere_local ? " (requiere local a pie de calle)" : ""}${i.incompatible_con.length ? ` (incompatible con ${i.incompatible_con.join(", ")})` : ""}. ${i.condicion}`);
  const req = f.requisitos.map((r) => `- ${r.id} (${r.cita.seccion}): ${r.texto}`);
  const docs = f.documentos.filter((d) => d.momento !== "justificacion").map((d) => `- ${d.id}: ${d.nombre}${d.condicion ? ` — ${d.condicion}` : ""}${d.firma ? " — firma electrónica obligatoria" : ""}`);
  return `CUANTÍA (art. 5): base ${f.cuantia.base} €. Tope ${f.cuantia.maximo} € con local a pie de calle${f.cuantia.maximo_sin_local != null ? ` y ${f.cuantia.maximo_sin_local} € sin él` : ""}.\nIncrementos:\n${inc.join("\n")}\nREQUISITOS:\n${req.join("\n")}\nDOCUMENTOS:\n${docs.join("\n")}\nGASTOS: ${f.gastos.periodo} Reglas: ${f.gastos.reglas_justificantes.join(" · ")}\nSUBSANACIÓN: ${f.subsanacion.plazo_dias_habiles} días hábiles; ${f.subsanacion.canal}`;
}
