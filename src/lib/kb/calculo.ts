import type { Ficha } from "@/lib/kb/ficha";

export const requisitosAcceso = (ficha: Ficha) => ficha.requisitos.filter((r) => (r.tipo ?? "acceso") === "acceso");

export type Respuesta = "si" | "no" | "nose";

export type Evaluacion = {
  incumplidos: Ficha["requisitos"];
  dudosos: Ficha["requisitos"];
  incrementos: { id: string; etiqueta: string; importe: number; hasta: boolean }[];
  descartados: { id: string; etiqueta: string; motivo: "sin_local" | "incompatible" }[];
  importe: number;
  tope: number | null;
  importeHasta: boolean;
};

// Cálculo determinista con las reglas validadas de la ficha: la IA extrae las reglas,
// pero la estimación de requisitos e importes es reproducible y auditable.
// `local`: respuesta a la pregunta del local a pie de calle (condiciona el tope y algunos incrementos)
export function evaluar(ficha: Ficha, requisitos: Record<string, Respuesta>, incrementos: Record<string, Respuesta>, local?: Respuesta): Evaluacion {
  const descartados: Evaluacion["descartados"] = [];
  const incumplidos: Ficha["requisitos"] = [];
  const dudosos: Ficha["requisitos"] = [];
  // El autodiagnóstico solo pregunta por requisitos de acceso (los trámites y compromisos se explican aparte)
  for (const r of requisitosAcceso(ficha)) {
    const resp = requisitos[r.id];
    if (!resp || resp === "nose") dudosos.push(r);
    else if ((resp === "si") !== r.respuesta_que_cumple) incumplidos.push(r);
  }

  const candidatos = ficha.cuantia.incrementos
    .filter((inc) => incrementos[inc.id] === "si")
    .filter((inc) => inc.requiere.every((req) => incrementos[req] === "si"))
    .filter((inc) => {
      if (inc.requiere_local && local !== "si") {
        descartados.push({ id: inc.id, etiqueta: inc.etiqueta, motivo: "sin_local" });
        return false;
      }
      return true;
    })
    .map((inc) => ({ inc, valor: inc.importe ?? inc.importe_maximo ?? 0 }))
    .sort((a, b) => b.valor - a.valor);

  // Entre incrementos incompatibles se queda el de mayor importe
  const elegidos: typeof candidatos = [];
  for (const c of candidatos) {
    const choca = elegidos.some((e) => e.inc.incompatible_con.includes(c.inc.id) || c.inc.incompatible_con.includes(e.inc.id));
    if (!choca) elegidos.push(c);
    else descartados.push({ id: c.inc.id, etiqueta: c.inc.etiqueta, motivo: "incompatible" });
  }

  const base = ficha.cuantia.base ?? 0;
  const bruto = base + elegidos.reduce((s, e) => s + e.valor, 0);
  const tope = local !== "si" && ficha.cuantia.maximo_sin_local != null ? ficha.cuantia.maximo_sin_local : ficha.cuantia.maximo;
  const importe = tope ? Math.min(bruto, tope) : bruto;

  return {
    incumplidos,
    dudosos,
    incrementos: elegidos.map((e) => ({ id: e.inc.id, etiqueta: e.inc.etiqueta, importe: e.valor, hasta: e.inc.importe === null })),
    descartados,
    importe,
    tope: tope ?? null,
    importeHasta: elegidos.some((e) => e.inc.importe === null),
  };
}
