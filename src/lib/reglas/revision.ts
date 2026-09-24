// Aplica las reglas deterministas de la convocatoria al análisis de un documento (extraído por IA).
// Cada incidencia lleva el ID de la regla y el artículo, en castellano y euskera.
import type { Analisis, IncidenciaRegla } from "@/lib/ia/documento";
import type { Ficha } from "@/lib/kb/ficha";
import { DOCUMENTOS, estaObsoleto, evaluarGasto, INNOVADOR_MINIMO } from "@/lib/reglas/creacion2025";

export type ResultadoRevision = {
  incidencias: IncidenciaRegla[];
  gastos: { indice: number; incidencias: IncidenciaRegla[] }[];
  obsoleto: boolean;
  tipoDistinto: boolean;
  innovadorAprobado: boolean | null;
};

export function revisarConReglas(opts: {
  analisis: Analisis;
  ficha: Ficha;
  tipoDeclarado: string | null;
  firmaOk: boolean | null;
  fechaAltaIae: string | null;
  hoy?: Date;
}): ResultadoRevision {
  const { analisis: a, tipoDeclarado, firmaOk } = opts;
  const incidencias: IncidenciaRegla[] = [];
  const tipo = tipoDeclarado ?? a.tipo_documento_id;
  const def = opts.ficha.documentos.find((d) => d.id === tipo);
  const defReglas = DOCUMENTOS.find((d) => d.id === tipo);

  // Tipo declarado ≠ tipo detectado (salvo tipos equivalentes: los DNI/NIF, factura/justificante, contrato/hipoteca)
  const EQUIVALENTES = [["DOC-05", "DOC-06", "DOC-09"], ["DOC-15", "DOC-16", "DOC-03"], ["DOC-13", "DOC-14"], ["DOC-08", "DOC-10"]];
  const equivalen = (x: string, y: string) => x === y || EQUIVALENTES.some((g) => g.includes(x) && g.includes(y));
  const tipoDistinto = Boolean(tipoDeclarado && a.tipo_documento_id !== "otro" && !equivalen(a.tipo_documento_id, tipoDeclarado) && a.confianza >= 0.7);
  if (tipoDistinto) {
    const detectado = opts.ficha.documentos.find((d) => d.id === a.tipo_documento_id);
    incidencias.push({ regla: "D", art: "Art. 8", texto_es: `El documento parece ser «${detectado?.nombre ?? a.tipo_documento_nombre}», no «${def?.nombre ?? tipoDeclarado}».`, texto_eu: `Dokumentua «${detectado?.nombre_eu ?? a.tipo_documento_nombre}» dela dirudi, ez «${def?.nombre_eu ?? tipoDeclarado}».`, detalle: a.resumen });
  }

  // F02: firma electrónica exigida
  if (defReglas?.firma && firmaOk === false) {
    incidencias.push({ regla: "F02", art: "Art. 8 · manual de firma", texto_es: "Este anexo debe presentarse como PDF con firma electrónica PAdES válida.", texto_eu: "Eranskin hau PAdES sinadura elektroniko baliodun PDF gisa aurkeztu behar da.", detalle: "La validación de firma del portal no consta como correcta." });
  }

  // Caducidad de certificados
  const obsoleto = estaObsoleto(tipo, a.fecha_emision, opts.hoy);
  if (obsoleto && defReglas?.validezMeses) {
    incidencias.push({ regla: "D", art: "Art. 8", texto_es: `Certificado caducado: tiene más de ${defReglas.validezMeses} meses (emitido el ${a.fecha_emision}).`, texto_eu: `Ziurtagiria iraungita: ${defReglas.validezMeses} hilabete baino gehiago ditu (${a.fecha_emision}an emana).`, detalle: `Validez máxima ${defReglas.validezMeses} meses.` });
  }

  // Gastos: reglas G
  const gastos = a.gastos.map((g, indice) => ({ indice, incidencias: evaluarGasto(g, opts.fechaAltaIae).map((i) => ({ regla: i.regla, art: i.art, texto_es: i.texto.es, texto_eu: i.texto.eu, detalle: i.detalle })) }));
  for (const g of gastos) for (const i of g.incidencias) incidencias.push({ ...i, detalle: `${a.gastos[g.indice].concepto}: ${i.detalle}` });

  // Memoria del proyecto innovador: umbral 25/50 (propuesta pendiente de validación humana)
  let innovadorAprobado: boolean | null = null;
  if (a.valoracion_innovador) {
    const total = a.valoracion_innovador.innovacion_viabilidad + a.valoracion_innovador.idi_tecnologia;
    innovadorAprobado = total >= INNOVADOR_MINIMO;
    if (!innovadorAprobado) incidencias.push({ regla: "B", art: "Art. 5", texto_es: `La memoria no alcanza los ${INNOVADOR_MINIMO} puntos mínimos (propuesta: ${total}/50).`, texto_eu: `Memoriak ez ditu gutxieneko ${INNOVADOR_MINIMO} puntuak lortzen (proposamena: ${total}/50).`, detalle: a.valoracion_innovador.justificacion });
  }

  return { incidencias, gastos, obsoleto, tipoDistinto, innovadorAprobado };
}
