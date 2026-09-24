import { one, query } from "@/lib/db";
import { PRESUPUESTO_PROGRAMA } from "@/lib/reglas/creacion2025";
import { plazosExpediente } from "@/lib/reglas/plazos";

// Indicadores del piloto: cobertura y calidad de la atención, eficiencia documental, supervisión humana y coste.
export async function metricas() {
  const [chat, docs, supervision, costes, solicitudes, presupuesto, temas, enTramite, obsoletos, porDia] = await Promise.all([
    one<{
      consultas: string;
      respondidas: string;
      sin_fuente: string;
      valoradas: string;
      positivas: string;
      conversaciones: string;
      en_euskera: string;
      latencia_media: string | null;
      derivaciones: string;
    }>(`
      SELECT
        (SELECT count(*) FROM mensaje m JOIN conversacion c ON c.id=m.conversacion WHERE c.canal='web' AND rol='assistant') AS consultas,
        (SELECT count(*) FROM mensaje m JOIN conversacion c ON c.id=m.conversacion WHERE c.canal='web' AND rol='assistant' AND resultado='respondida') AS respondidas,
        (SELECT count(*) FROM mensaje m JOIN conversacion c ON c.id=m.conversacion WHERE c.canal='web' AND rol='assistant' AND resultado='sin_fuente') AS sin_fuente,
        (SELECT count(*) FROM mensaje WHERE valoracion IS NOT NULL) AS valoradas,
        (SELECT count(*) FROM mensaje WHERE valoracion = 1) AS positivas,
        (SELECT count(*) FROM conversacion WHERE canal='web') AS conversaciones,
        (SELECT count(*) FROM conversacion WHERE canal='web' AND idioma='eu') AS en_euskera,
        (SELECT round(avg(latencia_ms)) FROM evento_ia WHERE origen='piloto' AND tipo='chat' AND error IS NULL) AS latencia_media,
        (SELECT count(*) FROM evento_ia WHERE tipo='derivacion') AS derivaciones`),
    one<{ analizados: string; con_incidencias: string; latencia_media: string | null; confianza_media: string | null }>(`
      SELECT count(*) AS analizados,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(analisis->'comprobaciones') c WHERE c->>'resultado'='incidencia')) AS con_incidencias,
             (SELECT round(avg(latencia_ms)) FROM evento_ia WHERE origen='piloto' AND tipo='clasificacion_documento' AND error IS NULL) AS latencia_media,
             round(avg(confianza)::numeric, 2) AS confianza_media
        FROM documento WHERE analisis IS NOT NULL`),
    one<{ revisados: string; validados: string; corregidos: string; rechazados: string }>(`
      SELECT count(*) FILTER (WHERE revision <> 'pendiente') AS revisados,
             count(*) FILTER (WHERE revision = 'validado') AS validados,
             count(*) FILTER (WHERE revision = 'corregido') AS corregidos,
             count(*) FILTER (WHERE revision = 'rechazado') AS rechazados
        FROM documento`),
    query<{ tipo: string; eventos: string; coste: string | null; coste_medio: string | null; cache_lectura: string | null; entrada: string | null }>(`
      SELECT tipo, count(*) AS eventos, round(sum(coste_usd), 3) AS coste, round(avg(coste_usd), 4) AS coste_medio,
             sum(tokens_cache_lectura) AS cache_lectura, sum(tokens_entrada + coalesce(tokens_cache_lectura,0) + coalesce(tokens_cache_escritura,0)) AS entrada
        FROM evento_ia WHERE modelo <> 'humano' AND origen='piloto' GROUP BY tipo ORDER BY tipo`),
    query<{ estado: string; n: string }>("SELECT estado, count(*) AS n FROM solicitud GROUP BY estado"),
    one<{ concedido: string | null; en_tramite: string | null; concedidas: string }>(`
      SELECT sum(importe_concedido) FILTER (WHERE estado='concedida') AS concedido,
             sum(importe_estimado) FILTER (WHERE estado IN ('presentada','en_revision','requerimiento')) AS en_tramite,
             count(*) FILTER (WHERE estado='concedida') AS concedidas FROM solicitud`),
    query<{ tema: string | null; idioma: string; n: string }>("SELECT tema, idioma, count(*) AS n FROM conversacion WHERE canal='web' GROUP BY tema, idioma"),
    query<{ codigo: string; expediente: string | null; solicitante: string | null; estado: string; presentada_en: Date | null; requerida_en: Date | null }>(
      "SELECT codigo, expediente, solicitante, estado, presentada_en, requerida_en FROM solicitud WHERE estado IN ('presentada','en_revision','requerimiento')"),
    query<{ codigo: string; expediente: string | null; nombre: string }>(
      "SELECT s.codigo, s.expediente, d.nombre FROM documento d JOIN solicitud s ON s.codigo=d.solicitud WHERE d.revision='obsoleto' AND s.estado NOT IN ('concedida','denegada')"),
    query<{ dia: string; consultas: string }>(`
      SELECT to_char(date_trunc('day', creado_en), 'DD/MM') AS dia, count(*) AS consultas
        FROM evento_ia WHERE origen='piloto' AND tipo='chat' AND creado_en > now() - interval '14 days' GROUP BY 1, date_trunc('day', creado_en) ORDER BY date_trunc('day', creado_en)`),
  ]);

  const n = (v: string | null | undefined) => Number(v ?? 0);
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : null);
  return {
    chat: {
      consultas: n(chat?.consultas),
      coberturaPct: pct(n(chat?.respondidas), n(chat?.consultas)),
      sinFuente: n(chat?.sin_fuente),
      satisfaccionPct: pct(n(chat?.positivas), n(chat?.valoradas)),
      valoradas: n(chat?.valoradas),
      conversaciones: n(chat?.conversaciones),
      euskeraPct: pct(n(chat?.en_euskera), n(chat?.conversaciones)),
      latenciaMs: n(chat?.latencia_media),
      derivaciones: n(chat?.derivaciones),
    },
    documentos: {
      analizados: n(docs?.analizados),
      conIncidencias: n(docs?.con_incidencias),
      latenciaMs: n(docs?.latencia_media),
      confianzaMedia: docs?.confianza_media ? Number(docs.confianza_media) : null,
      revisados: n(supervision?.revisados),
      aceptacionPct: pct(n(supervision?.validados), n(supervision?.revisados)),
      corregidos: n(supervision?.corregidos),
      rechazados: n(supervision?.rechazados),
    },
    costes: costes.map((c) => ({
      tipo: c.tipo,
      eventos: n(c.eventos),
      coste: n(c.coste),
      costeMedio: n(c.coste_medio),
      cachePct: pct(n(c.cache_lectura), n(c.entrada)),
    })),
    solicitudes: Object.fromEntries(solicitudes.map((s) => [s.estado, n(s.n)])),
    presupuesto: {
      total: PRESUPUESTO_PROGRAMA,
      concedido: n(presupuesto?.concedido),
      enTramite: n(presupuesto?.en_tramite),
      concedidas: n(presupuesto?.concedidas),
      pctConcedido: Math.round((100 * n(presupuesto?.concedido)) / PRESUPUESTO_PROGRAMA),
      pctComprometido: Math.round((100 * (n(presupuesto?.concedido) + n(presupuesto?.en_tramite))) / PRESUPUESTO_PROGRAMA),
    },
    temas: temas.reduce<Record<string, { es: number; eu: number }>>((acc, t) => {
      const k = t.tema ?? "otro";
      acc[k] ??= { es: 0, eu: 0 };
      acc[k][t.idioma === "eu" ? "eu" : "es"] += n(t.n);
      return acc;
    }, {}),
    plazos: enTramite
      .flatMap((s) => plazosExpediente(s).map((p) => ({ ...p, codigo: s.codigo, expediente: s.expediente, solicitante: s.solicitante })))
      .filter((p) => p.tono !== "neutro")
      .sort((a, b) => a.fin.getTime() - b.fin.getTime()),
    obsoletos,
    porDia: porDia.map((d) => ({ dia: d.dia, consultas: n(d.consultas) })),
  };
}
