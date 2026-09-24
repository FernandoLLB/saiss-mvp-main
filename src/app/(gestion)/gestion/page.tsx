import Link from "next/link";
import { ESTADO_SOLICITUD, Etiqueta, fecha, Kpi, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { query } from "@/lib/db";
import { metricas } from "@/lib/metricas";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const TIPOS: Record<string, string> = {
  chat: "Atención conversacional",
  clasificacion_documento: "Revisión documental",
  revision_expediente: "Revisión cruzada de expedientes",
  ficha_convocatoria: "Ficha de convocatoria",
  requerimiento: "Borradores de requerimiento",
  evaluacion: "Evaluación automática",
};

export default async function Resumen() {
  if (!(await tecnicoActual())) return null;
  const m = await metricas();
  const bandeja = await query<{ codigo: string; expediente: string | null; solicitante: string | null; titulo_es: string; estado: string; actualizada_en: Date; docs: string; avisos: string; pendientes: string }>(`
    SELECT s.codigo, s.expediente, s.solicitante, c.titulo_es, s.estado, s.actualizada_en,
           count(d.id) AS docs,
           count(d.id) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(d.analisis->'comprobaciones') x WHERE x->>'resultado'='incidencia')) AS avisos,
           count(d.id) FILTER (WHERE d.revision='pendiente') AS pendientes
      FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria LEFT JOIN documento d ON d.solicitud=s.codigo
     WHERE s.estado IN ('presentada','en_revision')
     GROUP BY s.codigo, c.titulo_es ORDER BY s.actualizada_en LIMIT 8`);
  const porValidar = await query<{ slug: string; titulo_es: string; ficha_version: number }>(
    "SELECT slug, titulo_es, ficha_version FROM convocatoria WHERE estado='publicada' AND ficha IS NOT NULL AND validada_en IS NULL ORDER BY slug",
  );
  const maxDia = Math.max(1, ...m.porDia.map((d) => d.consultas));

  return (
    <>
      <Titulo sub="Indicadores del piloto calculados en tiempo real a partir del registro de actividad.">Resumen</Titulo>

      <h2 className="mb-2 font-bold text-tenue">Atención a la ciudadanía</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi etiqueta="Consultas atendidas" valor={m.chat.consultas} detalle={`${m.chat.conversaciones} conversaciones`} />
        <Kpi etiqueta="Respondidas con fuente oficial" valor={m.chat.coberturaPct === null ? "—" : `${m.chat.coberturaPct} %`} detalle={`${m.chat.sinFuente} sin respuesta en las bases`} />
        <Kpi etiqueta="Valoración positiva" valor={m.chat.satisfaccionPct === null ? "—" : `${m.chat.satisfaccionPct} %`} detalle={`${m.chat.valoradas} valoraciones`} />
        <Kpi etiqueta="Derivaciones a persona" valor={m.chat.derivaciones} detalle={m.chat.euskeraPct === null ? undefined : `${m.chat.euskeraPct} % de conversaciones en euskera`} />
        <Kpi etiqueta="Tiempo medio de respuesta" valor={m.chat.latenciaMs ? `${(m.chat.latenciaMs / 1000).toFixed(1)} s` : "—"} />
      </div>

      <h2 className="mb-2 mt-6 font-bold text-tenue">Revisión documental y supervisión</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi etiqueta="Documentos revisados por IA" valor={m.documentos.analizados} detalle={m.documentos.latenciaMs ? `${(m.documentos.latenciaMs / 1000).toFixed(0)} s por documento` : undefined} />
        <Kpi etiqueta="Con incidencias detectadas" valor={m.documentos.conIncidencias} detalle="antes de llegar a la persona técnica" />
        <Kpi etiqueta="Decisiones humanas" valor={m.documentos.revisados} detalle={`${m.documentos.corregidos} corregidas · ${m.documentos.rechazados} rechazadas`} />
        <Kpi etiqueta="Propuestas IA aceptadas" valor={m.documentos.aceptacionPct === null ? "—" : `${m.documentos.aceptacionPct} %`} detalle="sin modificación" />
        <Kpi etiqueta="Confianza media de clasificación" valor={m.documentos.confianzaMedia ?? "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Presupuesto del programa (art. 2)">
          <p className="text-2xl font-bold tabular-nums">
            {EUR.format(m.presupuesto.concedido)} <span className="text-sm font-normal text-tenue">de {EUR.format(m.presupuesto.total)}</span>
          </p>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-fondo" role="img" aria-label={`${m.presupuesto.pctComprometido} % comprometido`}>
            <div className="flex h-full">
              <div className="bg-primario" style={{ width: `${m.presupuesto.pctConcedido}%` }} />
              <div className="bg-primario/40" style={{ width: `${Math.max(0, m.presupuesto.pctComprometido - m.presupuesto.pctConcedido)}%` }} />
            </div>
          </div>
          <p className="mt-1 text-xs text-tenue">
            {m.presupuesto.concedidas} concedidas · {EUR.format(m.presupuesto.enTramite)} en trámite (orientativo) · {m.presupuesto.pctComprometido} % comprometido
          </p>
        </Tarjeta>
        <Tarjeta titulo="Plazos y caducidades" className="lg:col-span-2">
          {m.plazos.length === 0 && m.obsoletos.length === 0 ? (
            <p className="text-tenue">Sin plazos próximos a vencer ni certificados caducados.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {m.plazos.map((p) => (
                <li key={`${p.codigo}-${p.tipo}`} className="flex flex-wrap items-center gap-2">
                  <Etiqueta tono={p.tono}>{p.texto}</Etiqueta>
                  <Link href={`/gestion/solicitudes/${p.codigo}`} className="font-mono text-primario hover:underline">
                    {p.expediente ?? p.codigo}
                  </Link>
                  <span className="text-tenue">{p.solicitante}</span>
                </li>
              ))}
              {m.obsoletos.map((o, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <Etiqueta tono="aviso">Certificado caducado</Etiqueta>
                  <Link href={`/gestion/solicitudes/${o.codigo}`} className="font-mono text-primario hover:underline">
                    {o.expediente ?? o.codigo}
                  </Link>
                  <span className="text-tenue">{o.nombre}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Tarjeta titulo="Bandeja de revisión" className="lg:col-span-2">
          {bandeja.length === 0 ? (
            <p className="text-tenue">No hay solicitudes presentadas pendientes.</p>
          ) : (
            <div className="tabla-scroll">
<table className="tabla">
              <thead className="text-left text-tenue">
                <tr>
                  <th>Código</th>
                  <th>Solicitante</th>
                  <th>Estado</th>
                  <th>Documentos</th>
                  <th>Actualizada</th>
                </tr>
              </thead>
              <tbody>
                {bandeja.map((s) => (
                  <tr key={s.codigo}>
                    <td className="fijo">
                      <Link href={`/gestion/solicitudes/${s.codigo}`} className="font-mono font-bold text-primario hover:underline">
                        {s.expediente ?? s.codigo}
                      </Link>
                    </td>
                    <td>
                      {s.solicitante ?? "—"}
                      <span className="block text-xs text-tenue">{s.titulo_es}</span>
                    </td>
                    <td>
                      <Etiqueta tono={ESTADO_SOLICITUD[s.estado]?.tono}>{ESTADO_SOLICITUD[s.estado]?.texto}</Etiqueta>
                    </td>
                    <td>
                      <span className="flex flex-wrap items-center gap-1.5"><span className="tabular-nums">{s.docs}</span> {Number(s.avisos) > 0 && <Etiqueta tono="error">{s.avisos} con avisos</Etiqueta>} {Number(s.pendientes) > 0 && <Etiqueta tono="aviso">{s.pendientes} por revisar</Etiqueta>}</span>
                    </td>
                    <td className="fijo text-tenue">{fecha(s.actualizada_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
</div>
          )}
        </Tarjeta>

        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Fichas pendientes de validar">
            {porValidar.length === 0 ? (
              <p className="text-tenue">Todas las fichas están validadas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {porValidar.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/gestion/convocatorias/${c.slug}`} className="text-primario hover:underline">
                      {c.titulo_es}
                    </Link>{" "}
                    <span className="text-xs text-tenue">v{c.ficha_version}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta titulo="Temas de las consultas (es / eu)">
            {Object.keys(m.temas).length === 0 ? (
              <p className="text-tenue">Sin conversaciones.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {Object.entries(m.temas)
                  .sort((a, b) => b[1].es + b[1].eu - a[1].es - a[1].eu)
                  .map(([tema, v]) => (
                    <li key={tema} className="flex items-center gap-2">
                      <span className="w-28 capitalize">{tema}</span>
                      <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-fondo">
                        <span className="bg-primario" style={{ width: `${(100 * v.es) / Math.max(1, m.chat.conversaciones)}%` }} />
                        <span className="bg-acento" style={{ width: `${(100 * v.eu) / Math.max(1, m.chat.conversaciones)}%` }} />
                      </span>
                      <span className="w-14 text-right tabular-nums text-tenue">
                        {v.es} / {v.eu}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Tarjeta>
          <Tarjeta titulo="Consultas por día (14 días)">
            {m.porDia.length === 0 ? (
              <p className="text-tenue">Sin actividad.</p>
            ) : (
              <ul className="flex h-28 items-end gap-1" aria-label="Consultas por día">
                {m.porDia.map((d) => (
                  <li key={d.dia} className="flex flex-1 flex-col items-center gap-1" title={`${d.dia}: ${d.consultas}`}>
                    <span className="text-[10px] tabular-nums text-tenue">{d.consultas}</span>
                    <span className="w-full rounded-t bg-primario" style={{ height: `${(d.consultas / maxDia) * 72}px` }} />
                    <span className="text-[10px] text-tenue">{d.dia}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
      </div>

      <Tarjeta titulo="Coste de operación de la IA" className="mt-4">
        <div className="tabla-scroll">
<table className="tabla">
          <thead className="text-left text-tenue">
            <tr>
              <th>Uso</th>
              <th className="num">Llamadas</th>
              <th className="num">Coste medio</th>
              <th className="num">Coste total</th>
              <th className="num">Entrada servida desde caché</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {m.costes.map((c) => (
              <tr key={c.tipo}>
                <td className="fijo">{TIPOS[c.tipo] ?? c.tipo}</td>
                <td className="text-right">{c.eventos}</td>
                <td className="text-right">{c.costeMedio.toFixed(3)} USD</td>
                <td className="text-right">{c.coste.toFixed(2)} USD</td>
                <td className="text-right">{c.cachePct === null ? "—" : `${c.cachePct} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Tarjeta>
    </>
  );
}
