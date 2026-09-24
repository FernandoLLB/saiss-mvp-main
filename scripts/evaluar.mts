// Evaluación automática del asistente (chat) y de la revisión documental contra casos de referencia.
// Uso: pnpm evaluar [--solo chat|documentos] [--casos C01,C02]
// Resultados: data/evaluacion/resultados/<fecha>.json y ../memoria/evaluacion/informe-<fecha>.md
import fs from "node:fs";
import path from "node:path";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { one, pool } from "../src/lib/db";
import { responder } from "../src/lib/ia/chat";
import { anthropic, costeUsd, MODELO, parametrosModelo, registrarEvento } from "../src/lib/ia/cliente";
import { analizarDocumento, type Analisis } from "../src/lib/ia/documento";
import type { Ficha } from "../src/lib/kb/ficha";

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i === -1 ? null : process.argv[i + 1];
};
const solo = arg("--solo");
const filtroCasos = arg("--casos")?.split(",");
const CONCURRENCIA = 4;
const JUEZ_VERSION = "juez-2026-09-14.2";

// Ejecuta con concurrencia limitada; un caso que falla se registra y no detiene la evaluación
async function enParalelo<T, R>(items: T[], fn: (x: T) => Promise<R>) {
  const res: (R | null)[] = new Array(items.length).fill(null);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCIA, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        try {
          res[i] = await fn(items[i]);
        } catch (e) {
          errores.push(`${JSON.stringify(items[i]).slice(0, 60)}: ${e instanceof Error ? e.message.slice(0, 300) : e}`);
          process.stdout.write(`  ERROR ${e instanceof Error ? e.message.slice(0, 120) : e}\n`);
        }
      }
    }),
  );
  return res.filter((r): r is R => r !== null);
}

const errores: string[] = [];
let costeJuez = 0;
async function juzgar<S extends z.ZodType>(schema: S, instrucciones: string, contenido: unknown, entrada: string) {
  const inicio = Date.now();
  const r = await anthropic.beta.messages.parse({
    max_tokens: 8000,
    ...parametrosModelo("low", betaZodOutputFormat(schema)),
    system: `Eres un evaluador estricto e imparcial de un asistente de atención sobre ayudas públicas. ${instrucciones} Responde solo con la evaluación.`,
    messages: [{ role: "user", content: JSON.stringify(contenido) }],
  });
  costeJuez += costeUsd(r.model, r.usage);
  await registrarEvento({ tipo: "evaluacion", origen: "evaluacion", promptVersion: JUEZ_VERSION, entradaResumen: entrada, salida: r.parsed_output, mensaje: r, inicio });
  if (!r.parsed_output) throw new Error(`Juez sin salida (${r.stop_reason})`);
  return r.parsed_output as z.infer<S>;
}

// ───────────── Chat ─────────────

type CasoChat = { id: string; idioma: "es" | "eu"; categoria: string; pregunta: string; esperado: "responder" | "sin_fuente" | "no_garantizar"; hechos: string[] };

const JuicioChat = z.object({
  hechos: z.array(z.object({ hecho: z.string(), presente: z.boolean() })),
  errores_factuales: z.array(z.string()).describe("Afirmaciones que contradicen la referencia o las bases, o datos inventados"),
  comportamiento_correcto: z.boolean().describe("Responde / reconoce que no está en las bases / no garantiza la concesión, según lo esperado"),
  idioma_correcto: z.boolean(),
  citas_pertinentes: z.boolean().describe("Las citas aportadas respaldan lo afirmado (true si no hay afirmaciones que citar)"),
  claridad: z.number().int().describe("1 a 5: lenguaje claro y adecuado para la ciudadanía"),
  comentario: z.string(),
});

async function evaluarChat() {
  const ds = JSON.parse(fs.readFileSync("data/evaluacion/chat-creacion-2026.json", "utf8")) as { convocatoria: string; casos: CasoChat[] };
  const casos = ds.casos.filter((c) => !filtroCasos || filtroCasos.includes(c.id));
  console.log(`Chat: ${casos.length} casos`);

  // Un primer caso en solitario escribe la caché de las bases; el resto la reutiliza
  const ejecutar = async (c: CasoChat) => {
    const t = Date.now();
    const r = await responder({ conversacion: null, convocatoria: ds.convocatoria, idioma: c.idioma, mensaje: c.pregunta, origen: "evaluacion" });
    const latenciaMs = Date.now() - t;
    const ev = await one<{ coste_usd: string; tokens_cache_lectura: number | null }>("SELECT coste_usd, tokens_cache_lectura FROM evento_ia WHERE id=$1", [r.eventoId]);
    const juicio = await juzgar(
      JuicioChat,
      "Compara la respuesta con los hechos de referencia (extraídos de las bases oficiales). Un hecho está presente si la respuesta lo transmite de forma equivalente, aunque sea con otras palabras o en otro idioma. Si se esperaba 'sin_fuente', el comportamiento es correcto cuando la respuesta reconoce que la información no está en las bases y no inventa datos. Si se esperaba 'no_garantizar', es correcto cuando no garantiza la concesión. Los datos de contacto oficiales de Fomento de San Sebastián (teléfono 943 482 800 y correo fomentoss@donostia.eus) figuran en las bases y en las instrucciones del asistente: ofrecerlos para derivar a una persona no es un error.",
      {
        idioma_esperado: c.idioma === "eu" ? "euskera" : "castellano",
        comportamiento_esperado: c.esperado,
        pregunta: c.pregunta,
        hechos_de_referencia: c.hechos,
        respuesta: r.texto,
        clasificacion_del_sistema: r.resultado,
        citas: r.segmentos.flatMap((s) => s.citas.map((ci) => ({ afirmacion: s.texto, seccion: ci.seccion, pagina: ci.pagina, texto_citado: ci.texto }))),
      },
      `chat ${c.id}`,
    );
    const presentes = juicio.hechos.filter((h) => h.presente).length;
    const clasificacionOk = c.esperado === "sin_fuente" ? r.resultado === "sin_fuente" : r.resultado === "respondida";
    process.stdout.write(`  ${c.id} ${juicio.comportamiento_correcto && juicio.errores_factuales.length === 0 ? "✓" : "✗"} ${(latenciaMs / 1000).toFixed(1)}s\n`);
    return {
      ...c,
      respuesta: r.texto,
      resultado_sistema: r.resultado,
      n_citas: r.segmentos.reduce((n, s) => n + s.citas.length, 0),
      latencia_ms: latenciaMs,
      coste_usd: Number(ev?.coste_usd ?? 0),
      cache: (ev?.tokens_cache_lectura ?? 0) > 0,
      hechos_presentes: presentes,
      hechos_total: c.hechos.length,
      clasificacion_ok: clasificacionOk,
      juicio,
    };
  };
  const [primero, ...resto] = casos;
  const resultados = [...(await enParalelo([primero], ejecutar)), ...(await enParalelo(resto, ejecutar))];

  const hechosTotal = resultados.reduce((n, r) => n + r.hechos_total, 0);
  const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const conHechos = resultados.filter((r) => r.esperado === "responder");
  const latencias = resultados.map((r) => r.latencia_ms).sort((a, b) => a - b);
  return {
    casos: resultados,
    resumen: {
      casos: resultados.length,
      exactitud_hechos_pct: pct(resultados.reduce((n, r) => n + r.hechos_presentes, 0), hechosTotal),
      respuestas_sin_errores_pct: pct(resultados.filter((r) => r.juicio.errores_factuales.length === 0).length, resultados.length),
      comportamiento_correcto_pct: pct(resultados.filter((r) => r.juicio.comportamiento_correcto).length, resultados.length),
      clasificacion_sin_fuente_ok_pct: pct(resultados.filter((r) => r.clasificacion_ok).length, resultados.length),
      idioma_correcto_pct: pct(resultados.filter((r) => r.juicio.idioma_correcto).length, resultados.length),
      respuestas_con_citas_pct: pct(conHechos.filter((r) => r.n_citas > 0).length, conHechos.length),
      citas_pertinentes_pct: pct(resultados.filter((r) => r.juicio.citas_pertinentes).length, resultados.length),
      claridad_media: Math.round((10 * resultados.reduce((n, r) => n + r.juicio.claridad, 0)) / resultados.length) / 10,
      latencia_mediana_s: latencias[Math.floor(latencias.length / 2)] / 1000,
      latencia_p90_s: latencias[Math.floor(latencias.length * 0.9)] / 1000,
      coste_medio_usd: Math.round((10000 * resultados.reduce((n, r) => n + r.coste_usd, 0)) / resultados.length) / 10000,
      por_idioma: Object.fromEntries(
        ["es", "eu"].map((idioma) => {
          const rs = resultados.filter((r) => r.idioma === idioma);
          return [idioma, { casos: rs.length, sin_errores_pct: pct(rs.filter((r) => r.juicio.errores_factuales.length === 0 && r.juicio.comportamiento_correcto).length, rs.length) }];
        }),
      ),
    },
  };
}

// ───────────── Documentos ─────────────

type CasoDoc = { id: string; fichero: string; tipo: string; incidencias: string[]; gasto_subvencionable: "si" | "no" | null };

const JuicioDoc = z.object({
  tipo_correcto: z.boolean(),
  incidencias_detectadas: z.array(z.object({ incidencia: z.string(), detectada: z.boolean() })),
  avisos_adicionales: z.array(
    z.object({ aviso: z.string(), valoracion: z.enum(["razonable", "falso_positivo"]).describe("razonable: aviso prudente que una persona técnica agradecería; falso_positivo: incidencia inexistente o errónea") }),
  ),
  gasto_correcto: z.boolean().nullable().describe("null si el caso no evalúa gastos"),
  comentario: z.string(),
});

async function evaluarDocumentos() {
  const ds = JSON.parse(fs.readFileSync("data/evaluacion/documentos-creacion-2026.json", "utf8")) as {
    convocatoria: string;
    datos_solicitud: Record<string, unknown>;
    casos: CasoDoc[];
  };
  const casos = ds.casos.filter((c) => !filtroCasos || filtroCasos.includes(c.id));
  const conv = await one<{ ficha: Ficha }>("SELECT ficha FROM convocatoria WHERE slug=$1", [ds.convocatoria]);
  if (!conv?.ficha) throw new Error("Convocatoria sin ficha");
  console.log(`Documentos: ${casos.length} casos`);

  const ejecutar = async (c: CasoDoc, i: number) => {
    const t = Date.now();
    // Nombre neutro: el nombre del fichero de prueba no debe dar pistas al modelo
    const { analisis, eventoId } = await analizarDocumento({
      ruta: path.resolve("data/demo", c.fichero),
      mime: "application/pdf",
      nombre: `documento_${String(i + 1).padStart(2, "0")}.pdf`,
      ficha: conv.ficha,
      convocatoria: ds.convocatoria,
      solicitud: null,
      datosSolicitud: ds.datos_solicitud,
      origen: "evaluacion",
    });
    const latenciaMs = Date.now() - t;
    const ev = await one<{ coste_usd: string }>("SELECT coste_usd FROM evento_ia WHERE id=$1", [eventoId]);
    if (!analisis) throw new Error(`${c.id} sin análisis`);
    const incidenciasSistema = analisis.comprobaciones.filter((x) => x.resultado === "incidencia");
    const juicio = await juzgar(
      JuicioDoc,
      "Evalúa el análisis automático de un documento aportado a una solicitud de ayuda frente a la referencia. Una incidencia de referencia está detectada si el análisis la señala como incidencia (o marca el gasto como no subvencionable por ese motivo). Clasifica cada incidencia adicional del sistema como razonable o falso positivo. La falta de un justificante de pago separado para una factura es un aviso razonable.",
      {
        tipo_de_referencia: c.tipo,
        incidencias_de_referencia: c.incidencias,
        gasto_subvencionable_de_referencia: c.gasto_subvencionable,
        datos_de_la_solicitud: ds.datos_solicitud,
        analisis: { tipo: analisis.tipo_documento_nombre, incidencias: incidenciasSistema, gastos: analisis.gastos },
      },
      `documento ${c.id}`,
    );
    process.stdout.write(`  ${c.id} ${juicio.tipo_correcto && juicio.incidencias_detectadas.every((x) => x.detectada) ? "✓" : "✗"} ${(latenciaMs / 1000).toFixed(0)}s\n`);
    return { ...c, analisis: analisis as Analisis, latencia_ms: latenciaMs, coste_usd: Number(ev?.coste_usd ?? 0), juicio };
  };
  const resultados = await enParalelo(
    casos.map((c, i) => [c, i] as const),
    ([c, i]) => ejecutar(c, i),
  );

  const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const refs = resultados.flatMap((r) => r.juicio.incidencias_detectadas);
  const adicionales = resultados.flatMap((r) => r.juicio.avisos_adicionales);
  const conGasto = resultados.filter((r) => r.juicio.gasto_correcto !== null);
  const sinIncidenciasRef = resultados.filter((r) => r.incidencias.length === 0);
  return {
    casos: resultados,
    resumen: {
      casos: resultados.length,
      tipo_correcto_pct: pct(resultados.filter((r) => r.juicio.tipo_correcto).length, resultados.length),
      incidencias_detectadas_pct: pct(refs.filter((x) => x.detectada).length, refs.length),
      incidencias_referencia: refs.length,
      avisos_adicionales: adicionales.length,
      falsos_positivos: adicionales.filter((a) => a.valoracion === "falso_positivo").length,
      documentos_correctos_sin_falsos_positivos_pct: pct(
        sinIncidenciasRef.filter((r) => r.juicio.avisos_adicionales.every((a) => a.valoracion === "razonable")).length,
        sinIncidenciasRef.length,
      ),
      gasto_correcto_pct: pct(conGasto.filter((r) => r.juicio.gasto_correcto).length, conGasto.length),
      latencia_media_s: Math.round(resultados.reduce((n, r) => n + r.latencia_ms, 0) / resultados.length / 100) / 10,
      coste_medio_usd: Math.round((10000 * resultados.reduce((n, r) => n + r.coste_usd, 0)) / resultados.length) / 10000,
    },
  };
}

// ───────────── Informe ─────────────

const fecha = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}${solo ? `-${solo}` : ""}`;
const salida: Record<string, unknown> = { fecha: new Date().toISOString(), modelo: MODELO };
if (solo !== "documentos") salida.chat = await evaluarChat();
if (solo !== "chat") salida.documentos = await evaluarDocumentos();
salida.coste_juez_usd = Math.round(costeJuez * 1000) / 1000;
salida.errores = errores;

fs.mkdirSync("data/evaluacion/resultados", { recursive: true });
fs.writeFileSync(`data/evaluacion/resultados/${fecha}.json`, JSON.stringify(salida, null, 2));

type R = { resumen: Record<string, unknown>; casos: Record<string, unknown>[] };
const md: string[] = [`# Evaluación automática SAISS · ${new Date().toLocaleString("es-ES")}`, "", `Modelo: \`${MODELO}\` · coste del evaluador: ${salida.coste_juez_usd} USD${errores.length ? ` · ${errores.length} casos con error de ejecución` : ""}`, ""];
if (salida.chat) {
  const c = salida.chat as R;
  md.push("## Atención conversacional", "", "| Indicador | Valor |", "|---|---|");
  for (const [k, v] of Object.entries(c.resumen)) md.push(`| ${k.replaceAll("_", " ")} | ${typeof v === "object" ? JSON.stringify(v) : v} |`);
  md.push("", "### Casos con incidencias", "");
  for (const x of c.casos as Array<{ id: string; pregunta: string; juicio: z.infer<typeof JuicioChat>; hechos_presentes: number; hechos_total: number }>) {
    if (x.juicio.errores_factuales.length || !x.juicio.comportamiento_correcto || x.hechos_presentes < x.hechos_total)
      md.push(`- **${x.id}** «${x.pregunta}» · hechos ${x.hechos_presentes}/${x.hechos_total} · ${x.juicio.comentario}${x.juicio.errores_factuales.length ? ` · Errores: ${x.juicio.errores_factuales.join("; ")}` : ""}`);
  }
}
if (salida.documentos) {
  const d = salida.documentos as R;
  md.push("", "## Revisión documental", "", "| Indicador | Valor |", "|---|---|");
  for (const [k, v] of Object.entries(d.resumen)) md.push(`| ${k.replaceAll("_", " ")} | ${v} |`);
  md.push("", "### Detalle por documento", "");
  for (const x of d.casos as Array<{ id: string; tipo: string; juicio: z.infer<typeof JuicioDoc> }>) {
    md.push(
      `- **${x.id}** (${x.tipo}) · tipo ${x.juicio.tipo_correcto ? "✓" : "✗"} · ${x.juicio.incidencias_detectadas.map((i) => `${i.detectada ? "✓" : "✗"} ${i.incidencia}`).join(" · ") || "sin incidencias de referencia"}${
        x.juicio.avisos_adicionales.length ? ` · avisos adicionales: ${x.juicio.avisos_adicionales.map((a) => `${a.aviso} (${a.valoracion})`).join("; ")}` : ""
      }`,
    );
  }
}
const dirInforme = path.resolve("../memoria/evaluacion");
fs.mkdirSync(dirInforme, { recursive: true });
fs.writeFileSync(path.join(dirInforme, `informe-${fecha}.md`), md.join("\n"));
console.log(`\nInforme: memoria/evaluacion/informe-${fecha}.md`);
console.log(JSON.stringify({ chat: (salida.chat as R | undefined)?.resumen, documentos: (salida.documentos as R | undefined)?.resumen }, null, 2));
await pool.end();
