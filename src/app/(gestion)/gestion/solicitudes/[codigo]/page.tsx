import Link from "next/link";
import { notFound } from "next/navigation";
import { aprobarRequerimiento, decidirDocumento, generarRequerimiento, resolverExpediente, revisarExpedienteAccion } from "../acciones";
import type { IncidenciaRegla } from "@/lib/ia/documento";
import { documentosAplicables, INNOVADOR_CRITERIOS, INNOVADOR_MINIMO, type DatosSolicitud } from "@/lib/reglas/creacion2025";
import { plazosExpediente } from "@/lib/reglas/plazos";
import type { RevisionExpediente } from "@/lib/ia/expediente";
import { BotonEnviar } from "@/components/gestion/BotonEnviar";
import { ESTADO_SOLICITUD, Etiqueta, fecha, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { one, query } from "@/lib/db";
import type { Analisis } from "@/lib/ia/documento";
import type { Ficha } from "@/lib/kb/ficha";
import { t } from "@/lib/i18n";

const TX = t("es");

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const RESULTADO = { correcto: "ok", incidencia: "error", no_verificable: "aviso" } as const;
const REVISION = { pendiente: "neutro", validado: "ok", corregido: "aviso", rechazado: "error", obsoleto: "aviso" } as const;
const REVISION_TXT: Record<keyof typeof REVISION, string> = { pendiente: "Recibido", validado: "Validado", corregido: "Rechazado · a subsanar", rechazado: "Rechazado", obsoleto: "Obsoleto (caducado)" };
type AnalisisR = Analisis & { reglas?: IncidenciaRegla[]; innovador_aprobado?: boolean | null };

export default async function Expediente({ params }: PageProps<"/gestion/solicitudes/[codigo]">) {
  if (!(await tecnicoActual())) return null;
  const { codigo } = await params;
  const sol = await one<{
    codigo: string;
    expediente: string | null;
    estado: string;
    solicitante: string | null;
    datos: DatosSolicitud & { nif?: string; fecha_alta_iae?: string; via_empleo?: string; motivo_resolucion?: string };
    importe_estimado: string | null;
    importe_concedido: string | null;
    presentada_en: Date | null;
    requerida_en: Date | null;
    resuelta_en: Date | null;
    resuelta_por: string | null;
    creada_en: Date;
    titulo_es: string;
    convocatoria: string;
    ficha: Ficha;
    revision_cruzada: RevisionExpediente | null;
    revision_cruzada_en: Date | null;
  }>(
    `SELECT s.codigo, s.expediente, s.estado, s.solicitante, s.datos, s.importe_estimado, s.importe_concedido, s.presentada_en, s.requerida_en, s.resuelta_en, s.resuelta_por, s.creada_en, c.titulo_es, c.slug AS convocatoria, c.ficha, s.revision_cruzada, s.revision_cruzada_en
       FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria WHERE s.codigo=$1`,
    [codigo],
  );
  if (!sol) notFound();
  const docs = await query<{
    id: number;
    nombre: string;
    tipo_detectado: string | null;
    confianza: number | null;
    analisis: AnalisisR | null;
    revision: keyof typeof REVISION;
    revision_nota: string | null;
    revisado_por: string | null;
    revisado_en: Date | null;
    evento_ia: number | null;
  }>("SELECT id, nombre, tipo_detectado, confianza, analisis, revision, revision_nota, revisado_por, revisado_en, evento_ia FROM documento WHERE solicitud=$1 ORDER BY id", [codigo]);
  const requerimientos = await query<{ id: number; borrador_es: string; borrador_eu: string | null; estado: string; aprobado_por: string | null; aprobado_en: Date | null; creado_en: Date }>(
    "SELECT id, borrador_es, borrador_eu, estado, aprobado_por, aprobado_en, creado_en FROM requerimiento WHERE solicitud=$1 AND estado<>'descartado' ORDER BY id DESC",
    [codigo],
  );

  const requeridos = documentosAplicables(sol.ficha, sol.datos).filter((d) => d.aplica === true);
  const deOficio = documentosAplicables(sol.ficha, sol.datos).filter((d) => d.grupo === "oficio");
  const incrementos = sol.ficha.cuantia.incrementos.filter((i) => sol.datos.incrementos?.includes(i.id));
  const hayDecisiones = docs.some((d) => d.revision === "corregido" || d.revision === "rechazado" || d.revision === "obsoleto");
  const faltan = requeridos.filter((r) => !docs.some((d) => d.tipo_detectado === r.id && d.revision !== "rechazado"));
  const plazos = plazosExpediente(sol);
  const pendientesDecision = docs.filter((d) => d.revision === "pendiente").length;
  const resoluble = ["presentada", "en_revision"].includes(sol.estado) && pendientesDecision === 0 && docs.length > 0;
  const alertas = docs.reduce((n, d) => n + (d.analisis?.reglas?.length ?? 0) + (d.analisis?.comprobaciones.filter((c) => c.resultado === "incidencia").length ?? 0), 0);

  return (
    <>
      <Link href="/gestion/solicitudes" className="text-sm text-primario hover:underline">
        ← Solicitudes
      </Link>
      <Titulo
        sub={
          <>
            {sol.titulo_es} · creada {fecha(sol.creada_en)}
          </>
        }
      >
        <span className="font-mono">{sol.expediente ?? sol.codigo}</span> · {sol.solicitante ?? "Sin nombre"}{" "}
        <Etiqueta tono={ESTADO_SOLICITUD[sol.estado]?.tono}>{ESTADO_SOLICITUD[sol.estado]?.texto}</Etiqueta>
      </Titulo>
      <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
        {plazos.map((p) => (
          <Etiqueta key={p.tipo} tono={p.tono}>
            ⏱ {p.texto} · {p.fin.toLocaleDateString("es-ES")}
          </Etiqueta>
        ))}
        {alertas > 0 && <Etiqueta tono="error">{alertas} alertas de la IA</Etiqueta>}
        {pendientesDecision > 0 && <Etiqueta tono="aviso">{pendientesDecision} documentos por decidir</Etiqueta>}
        {sol.datos.nif && <span className="text-tenue">NIF {sol.datos.nif}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {docs.map((d) => {
            const a = d.analisis;
            const esperado = sol.ficha.documentos.find((f) => f.id === d.tipo_detectado);
            return (
              <Tarjeta
                key={d.id}
                titulo={
                  <span className="flex flex-wrap items-center gap-2">
                    <a href={`/api/gestion/documentos/${d.id}`} target="_blank" rel="noreferrer" className="text-primario hover:underline">
                      {d.nombre}
                    </a>
                    <Etiqueta tono="info">{a?.tipo_documento_nombre ?? "Sin clasificar"}</Etiqueta>
                    {d.confianza !== null && <span className="text-xs font-normal text-tenue">confianza {d.confianza.toFixed(2)}</span>}
                    <Etiqueta tono={REVISION[d.revision]}>{REVISION_TXT[d.revision]}</Etiqueta>
                  </span>
                }
              >
                {!a ? (
                  <p className="text-tenue">Sin análisis automático.</p>
                ) : (
                  <>
                    <p className="text-sm">{a.resumen}</p>
                    {esperado && (
                      <p className="mt-1 text-xs text-tenue">
                        Exigido en {esperado.cita.seccion}, pág. {esperado.cita.pagina}
                      </p>
                    )}
                    {a.reglas && a.reglas.length > 0 && (
                      <div className="mt-3 rounded-lg border border-error/30 bg-error-suave p-3">
                        <p className="mb-1 text-xs font-bold uppercase text-error">Reglas de la convocatoria incumplidas</p>
                        <ul className="flex flex-col gap-1 text-sm">
                          {a.reglas.map((r, i) => (
                            <li key={i} className="flex gap-2">
                              <Etiqueta tono="error">{r.regla}</Etiqueta>
                              <span>
                                <strong>{r.texto_es}</strong> {r.detalle} <span className="text-tenue">({r.art})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.valoracion_innovador && (
                      <div className="mt-3 rounded-lg border border-primario/30 bg-primario-suave p-3 text-sm">
                        <p className="mb-1 text-xs font-bold uppercase text-primario-oscuro">Puntuación propuesta de la memoria del proyecto innovador · pendiente de validación humana</p>
                        <p>
                          {INNOVADOR_CRITERIOS[0].etiqueta.es}: <strong>{a.valoracion_innovador.innovacion_viabilidad}/30</strong> · {INNOVADOR_CRITERIOS[1].etiqueta.es}:{" "}
                          <strong>{a.valoracion_innovador.idi_tecnologia}/20</strong> · Total{" "}
                          <strong className={a.innovador_aprobado ? "text-ok" : "text-error"}>
                            {a.valoracion_innovador.innovacion_viabilidad + a.valoracion_innovador.idi_tecnologia}/50
                          </strong>{" "}
                          (mínimo {INNOVADOR_MINIMO})
                        </p>
                        <p className="mt-1 text-tenue">{a.valoracion_innovador.justificacion}</p>
                      </div>
                    )}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase text-tenue">Comprobaciones propuestas</p>
                        <ul className="flex flex-col gap-1.5 text-sm">
                          {a.comprobaciones.map((c, i) => (
                            <li key={i} className="flex gap-2">
                              <Etiqueta tono={RESULTADO[c.resultado]}>{c.resultado.replace("_", " ")}</Etiqueta>
                              <span>
                                <strong>{c.comprobacion}.</strong> {c.detalle}
                                {c.referencia && <span className="text-tenue"> ({c.referencia})</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase text-tenue">Datos extraídos</p>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                          {a.datos.map((x, i) => (
                            <div key={i} className="contents">
                              <dt className="text-tenue">{x.campo.replaceAll("_", " ")}</dt>
                              <dd>{x.valor}</dd>
                            </div>
                          ))}
                        </dl>
                        {a.gastos.length > 0 && (
                          <>
                            <p className="mb-1 mt-3 text-xs font-bold uppercase text-tenue">Gastos</p>
                            <ul className="text-sm">
                              {a.gastos.map((g, i) => (
                                <li key={i} className="border-t border-borde py-1">
                                  <Etiqueta tono={g.subvencionable === "si" ? "ok" : g.subvencionable === "no" ? "error" : "aviso"}>{g.subvencionable}</Etiqueta> {g.concepto}
                                  {g.base_imponible !== null && <strong> · {EUR.format(g.base_imponible)}</strong>}
                                  <span className="block text-xs text-tenue">{g.motivo}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {d.revision === "pendiente" || (d.revision === "obsoleto" && !d.revisado_por) ? (
                  <form action={decidirDocumento} className="mt-4 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
                    <input type="hidden" name="id" value={d.id} />
                    <input name="nota" placeholder="Nota (opcional: corrige o matiza la propuesta)" className="min-w-60 flex-1 rounded-lg border border-borde bg-fondo px-3 py-1.5 text-sm" />
                    <BotonEnviar name="decision" value="validado" className="bg-ok text-white">
                      Validar propuesta
                    </BotonEnviar>
                    <BotonEnviar name="decision" value="corregido" className="bg-aviso text-white">
                      Requiere subsanación
                    </BotonEnviar>
                    <BotonEnviar name="decision" value="rechazado" className="bg-error text-white">
                      No válido
                    </BotonEnviar>
                  </form>
                ) : (
                  <p className="mt-3 border-t border-borde pt-2 text-xs text-tenue">
                    Decisión de {d.revisado_por} · {fecha(d.revisado_en)}
                    {d.revision_nota && <> · «{d.revision_nota}»</>}
                  </p>
                )}
              </Tarjeta>
            );
          })}
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Revisión cruzada del expediente">
            {sol.revision_cruzada ? (
              <div className="flex flex-col gap-3 text-sm">
                <p>{sol.revision_cruzada.resumen}</p>
                <ul className="flex flex-col gap-1.5">
                  {sol.revision_cruzada.coherencias.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <Etiqueta tono={c.resultado === "coherente" ? "ok" : c.resultado === "incoherente" ? "error" : "aviso"}>{c.resultado.replace("_", " ")}</Etiqueta>
                      <span>
                        <strong>{c.comprobacion}.</strong> {c.detalle}
                      </span>
                    </li>
                  ))}
                </ul>
                {sol.revision_cruzada.avisos_resueltos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-tenue">Avisos resueltos por otro documento</p>
                    <ul className="list-disc pl-5">
                      {sol.revision_cruzada.avisos_resueltos.map((a, i) => (
                        <li key={i}>
                          {docs.find((d) => d.id === a.documento)?.nombre}: {a.aviso} → {docs.find((d) => d.id === a.resuelto_por)?.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="rounded-lg bg-fondo p-2">
                  <p className="text-xs font-bold uppercase text-tenue">Gastos</p>
                  <p>
                    Subvencionable <strong>{EUR.format(sol.revision_cruzada.gastos.total_base_subvencionable)}</strong> · dudoso {EUR.format(sol.revision_cruzada.gastos.total_base_dudosa)} · no subvencionable{" "}
                    {EUR.format(sol.revision_cruzada.gastos.total_base_no_subvencionable)}
                  </p>
                  <p className="text-xs text-tenue">{sol.revision_cruzada.gastos.explicacion}</p>
                </div>
                {sol.revision_cruzada.pendientes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-tenue">Pendiente</p>
                    <ol className="list-decimal pl-5">
                      {sol.revision_cruzada.pendientes.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="text-xs text-tenue">Propuesta generada {fecha(sol.revision_cruzada_en)}</p>
              </div>
            ) : (
              <p className="text-sm text-tenue">Contrasta todos los documentos entre sí: facturas con justificantes, titulares, fechas y totales de gasto.</p>
            )}
            <form action={revisarExpedienteAccion} className="mt-3">
              <input type="hidden" name="codigo" value={sol.codigo} />
              <BotonEnviar disabled={docs.length === 0} className="w-full border border-primario text-primario" pendiente="Revisando el expediente…">
                {sol.revision_cruzada ? "Actualizar revisión cruzada" : "Revisar expediente completo"}
              </BotonEnviar>
            </form>
          </Tarjeta>
          <Tarjeta titulo="Datos declarados">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-tenue">Forma jurídica</dt>
              <dd>{sol.datos.forma ? (TX.solFormas as Record<string, string>)[sol.datos.forma] ?? sol.datos.forma : "—"}</dd>
              <dt className="text-tenue">Local a pie de calle</dt>
              <dd>{sol.datos.local ? `Sí${sol.datos.hipoteca ? " (en propiedad)" : ""}` : "No"}</dd>
              <dt className="text-tenue">Alta IAE</dt>
              <dd>{sol.datos.fecha_alta_iae ? new Date(sol.datos.fecha_alta_iae).toLocaleDateString("es-ES") : "—"}</dd>
              <dt className="text-tenue">Empleo</dt>
              <dd>{sol.datos.via_empleo ? (TX.solVias as Record<string, string>)[sol.datos.via_empleo] ?? sol.datos.via_empleo : "—"}</dd>
              <dt className="text-tenue">Incrementos</dt>
              <dd>{incrementos.map((i) => i.etiqueta).join(", ") || "—"}</dd>
              <dt className="text-tenue">Importe orientativo</dt>
              <dd className="font-bold">{sol.importe_estimado ? EUR.format(Number(sol.importe_estimado)) : "—"}</dd>
              {sol.presentada_en && (
                <>
                  <dt className="text-tenue">Registro</dt>
                  <dd>{fecha(sol.presentada_en)}</dd>
                </>
              )}
            </dl>
          </Tarjeta>
          <Tarjeta titulo="Resolución">
            {sol.resuelta_en ? (
              <div className={`rounded-lg p-3 text-sm ${sol.estado === "concedida" ? "bg-ok-suave" : "bg-error-suave"}`}>
                <p className="font-bold">
                  {sol.estado === "concedida" ? `Concedida · ${EUR.format(Number(sol.importe_concedido ?? 0))}` : "Denegada"}
                </p>
                <p className="text-xs text-tenue">
                  {sol.resuelta_por} · {fecha(sol.resuelta_en)}
                </p>
                {sol.datos.motivo_resolucion && <p className="mt-1">{sol.datos.motivo_resolucion}</p>}
              </div>
            ) : (
              <form action={resolverExpediente} className="flex flex-col gap-2 text-sm">
                <p className="text-tenue">
                  {resoluble ? "Todos los documentos tienen decisión. La resolución es siempre humana y motivada (art. 10)." : `Para resolver, todos los documentos deben tener decisión (${pendientesDecision} pendientes) y el expediente estar presentado.`}
                </p>
                <input type="hidden" name="codigo" value={sol.codigo} />
                <label className="text-xs font-bold uppercase text-tenue">Importe concedido (€)</label>
                <input name="importe" type="number" step="1" defaultValue={sol.importe_estimado ? Number(sol.importe_estimado) : 0} className="rounded-lg border border-borde bg-fondo px-3 py-1.5" />
                <input name="motivo" placeholder="Motivación (obligatoria)" required className="rounded-lg border border-borde bg-fondo px-3 py-1.5" />
                <div className="flex gap-2">
                  <BotonEnviar name="decision" value="concedida" disabled={!resoluble} className="flex-1 bg-ok text-white">
                    Conceder
                  </BotonEnviar>
                  <BotonEnviar name="decision" value="denegada" disabled={!resoluble} className="flex-1 bg-error text-white">
                    Denegar
                  </BotonEnviar>
                </div>
              </form>
            )}
          </Tarjeta>
          <Tarjeta titulo="Documentación exigida">
            <ul className="flex flex-col gap-1 text-sm">
              {requeridos.map((r) => {
                const aportado = docs.filter((d) => d.tipo_detectado === r.id);
                const estado = aportado.length === 0 ? "falta" : aportado.some((d) => d.revision === "validado") ? "validado" : aportado.some((d) => d.revision === "obsoleto") ? "obsoleto" : aportado.some((d) => d.revision === "rechazado" || d.revision === "corregido") ? "rechazado" : "recibido";
                const tono = { falta: "error", validado: "ok", obsoleto: "aviso", rechazado: "error", recibido: "neutro" } as const;
                return (
                  <li key={r.id} className="flex items-start gap-2">
                    <Etiqueta tono={tono[estado]}>{estado}</Etiqueta>
                    <span>
                      {r.nombre} <span className="text-xs text-tenue">{r.id}</span>
                    </span>
                  </li>
                );
              })}
              {deOficio.length > 0 && <li className="mt-2 text-xs text-tenue">Consulta de oficio (interoperabilidad): {deOficio.map((d) => d.nombre).join(" · ")}</li>}
            </ul>
          </Tarjeta>
          <Tarjeta titulo="Requerimiento de subsanación">
            <p className="text-sm text-tenue">
              Se redacta con las incidencias que hayas confirmado ({docs.filter((d) => d.revision === "corregido" || d.revision === "rechazado").length}) y la documentación no aportada ({faltan.length}). Nada se envía sin tu aprobación.
            </p>
            <form action={generarRequerimiento} className="mt-3">
              <input type="hidden" name="codigo" value={sol.codigo} />
              <BotonEnviar disabled={!hayDecisiones && faltan.length === 0} className="w-full bg-primario text-white" pendiente="Redactando borrador bilingüe…">
                Generar borrador (es/eu)
              </BotonEnviar>
            </form>
            {requerimientos.map((r) =>
              r.estado === "borrador" ? (
                <form key={r.id} action={aprobarRequerimiento} className="mt-4 flex flex-col gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="text-xs font-bold uppercase text-tenue" htmlFor={`es-${r.id}`}>
                    Castellano
                  </label>
                  <textarea id={`es-${r.id}`} name="borrador_es" defaultValue={r.borrador_es} rows={12} className="rounded-lg border border-borde bg-fondo p-2 text-sm" />
                  <label className="text-xs font-bold uppercase text-tenue" htmlFor={`eu-${r.id}`}>
                    Euskera
                  </label>
                  <textarea id={`eu-${r.id}`} name="borrador_eu" defaultValue={r.borrador_eu ?? ""} rows={12} className="rounded-lg border border-borde bg-fondo p-2 text-sm" />
                  <BotonEnviar className="bg-ok text-white">Aprobar requerimiento</BotonEnviar>
                </form>
              ) : (
                <div key={r.id} className="mt-4 rounded-lg bg-ok-suave p-3 text-sm">
                  <p className="font-bold text-ok">
                    Aprobado por {r.aprobado_por} · {fecha(r.aprobado_en)}
                  </p>
                  <p className="mt-2 whitespace-pre-line">{r.borrador_es}</p>
                </div>
              ),
            )}
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

// Las llamadas a IA pueden tardar: límite ampliado en Vercel
export const maxDuration = 300;
