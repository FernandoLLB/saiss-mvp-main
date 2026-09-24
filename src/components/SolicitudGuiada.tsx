"use client";

import { useMemo, useState } from "react";
import type { Analisis, IncidenciaRegla } from "@/lib/ia/documento";
import type { Ficha } from "@/lib/kb/ficha";
import { eur, type Idioma, type Textos } from "@/lib/i18n";
import { cuantiaDesdeDatos, documentosAplicables, type DatosSolicitud } from "@/lib/reglas/creacion2025";

type AnalisisConReglas = Analisis & { reglas?: IncidenciaRegla[] };
type Doc = { id: number; nombre: string; tipo_detectado: string | null; analisis: AnalisisConReglas | null; revision: string };
type Datos = DatosSolicitud & { solicitante?: string; nif?: string; fecha_alta_iae?: string; via_empleo?: string };

export function SolicitudGuiada({
  codigo,
  expediente,
  estadoInicial,
  datosIniciales,
  documentosIniciales,
  ficha,
  idioma,
  tx,
}: {
  codigo: string;
  expediente: string | null;
  estadoInicial: string;
  datosIniciales: Datos;
  documentosIniciales: Doc[];
  ficha: Ficha;
  idioma: Idioma;
  tx: Textos;
}) {
  const [datos, setDatos] = useState<Datos>(datosIniciales);
  const [guardado, setGuardado] = useState(false);
  const [estado, setEstado] = useState(estadoInicial);
  const [exp, setExp] = useState(expediente);
  const [docs, setDocs] = useState<Doc[]>(documentosIniciales);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [firma, setFirma] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [reabierta, setReabierta] = useState(false);
  const eu = idioma === "eu";
  const txt = (es: string, euTxt?: string | null) => (eu && euTxt ? euTxt : es);
  const editable = estado === "borrador" || (estado === "requerimiento" && reabierta);

  const cuantia = useMemo(() => cuantiaDesdeDatos(ficha, datos), [ficha, datos]);
  const aplicables = useMemo(() => documentosAplicables(ficha, datos), [ficha, datos]);
  const grupos = [
    ["subvencion", tx.solGrupoSubvencion],
    ["empresa", tx.solGrupoEmpresa],
    ["oficio", tx.solGrupoOficio],
  ] as const;
  const docsDe = (id: string) => docs.filter((d) => d.tipo_detectado === id);
  const requeridos = aplicables.filter((d) => d.aplica === true);
  const pendientes = requeridos.filter((r) => docsDe(r.id).length === 0);
  const conAvisos = docs.filter((d) => tieneIncidencias(d));
  const incrementosVisibles = ficha.cuantia.incrementos.filter((i) => !i.requiere_local || datos.local);

  async function guardar(parcial: Partial<Datos>) {
    setDatos((d) => ({ ...d, ...parcial }));
    setGuardado(false);
    const res = await fetch(`/api/solicitudes/${codigo}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ datos: parcial }) });
    setGuardado(res.ok);
  }

  async function subir(tipo: string, fichero: File) {
    setSubiendo(tipo);
    setError(null);
    const form = new FormData();
    form.set("fichero", fichero);
    form.set("tipo", tipo);
    const def = ficha.documentos.find((d) => d.id === tipo);
    if (def?.firma) form.set("firma", firma[tipo] === false ? "0" : "1");
    try {
      const res = await fetch(`/api/solicitudes/${codigo}/documentos`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok && !json.id) throw new Error(json.error ?? "Error");
      setDocs((d) => [...d, { id: json.id, nombre: fichero.name, tipo_detectado: tipo, analisis: json.analisis, revision: json.revision ?? "pendiente" }]);
      if (!json.analisis) setError(json.error ?? tx.chatError);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx.chatError);
    } finally {
      setSubiendo(null);
    }
  }

  async function quitar(id: number) {
    await fetch(`/api/solicitudes/${codigo}/documentos?id=${id}`, { method: "DELETE" });
    setDocs((d) => d.filter((x) => x.id !== id));
  }

  async function presentar() {
    const res = await fetch(`/api/solicitudes/${codigo}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ presentar: true }) });
    if (res.ok) {
      const j = await res.json();
      setEstado(j.estado);
      setExp(j.expediente ?? exp);
      setReabierta(false);
    }
  }

  if (!editable) {
    const estados: Record<string, [string, string]> = {
      presentada: [tx.solEstadoRevision, "bg-primario-suave text-primario-oscuro"],
      en_revision: [tx.solEstadoRevision, "bg-primario-suave text-primario-oscuro"],
      requerimiento: [tx.solEstadoSubsanacion, "bg-aviso-suave text-aviso"],
      concedida: [tx.solEstadoConcedida, "bg-ok-suave text-ok"],
      denegada: [tx.solEstadoDenegada, "bg-error-suave text-error"],
    };
    const [texto, clase] = estados[estado] ?? [estado, "bg-fondo"];
    return (
      <div className="mt-6 flex flex-col gap-4">
        <div className={`rounded-2xl p-5 ${clase}`}>
          <p className="text-sm">{tx.solPresentadaEstado}</p>
          <p className="text-xl font-bold">{texto}</p>
          {exp && (
            <p className="mt-1 text-sm">
              {tx.solExpediente}: <span className="font-mono font-bold">{exp}</span>
            </p>
          )}
          {estado === "presentada" && <p className="mt-2 text-sm">{tx.solPresentada}</p>}
        </div>
        {estado === "requerimiento" && (
          <button type="button" onClick={() => setReabierta(true)} className="self-start rounded-full bg-primario px-5 py-2.5 font-bold text-white hover:bg-primario-oscuro">
            {tx.solVolverAbrir}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Paso 1: datos */}
      <Seccion titulo={tx.solPaso1} paso={1}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta={tx.solSolicitante} id="solicitante">
            <input id="solicitante" defaultValue={datos.solicitante} onBlur={(e) => guardar({ solicitante: e.target.value })} className={INPUT} />
          </Campo>
          <Campo etiqueta="NIF / CIF" id="nif">
            <input id="nif" defaultValue={datos.nif} onBlur={(e) => guardar({ nif: e.target.value })} className={INPUT} />
          </Campo>
          <Campo etiqueta={tx.solForma} id="forma">
            <select id="forma" value={datos.forma ?? ""} onChange={(e) => guardar({ forma: e.target.value as Datos["forma"] })} className={INPUT}>
              <option value="" disabled>
                —
              </option>
              {Object.entries(tx.solFormas).map(([v, et]) => (
                <option key={v} value={v}>
                  {et}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta={tx.solFechaAlta} id="alta">
            <input id="alta" type="date" value={datos.fecha_alta_iae ?? ""} onChange={(e) => guardar({ fecha_alta_iae: e.target.value })} className={INPUT} />
          </Campo>
          <Campo etiqueta={tx.solVia} id="via">
            <select id="via" value={datos.via_empleo ?? ""} onChange={(e) => guardar({ via_empleo: e.target.value, alta_reta: e.target.value === "alta_reta" })} className={INPUT}>
              <option value="" disabled>
                —
              </option>
              {Object.entries(tx.solVias).map(([v, et]) => (
                <option key={v} value={v}>
                  {et}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex flex-col gap-2">
            <Check etiqueta={tx.solLocal} checked={datos.local ?? false} onChange={(v) => guardar({ local: v, incrementos: v ? datos.incrementos : (datos.incrementos ?? []).filter((i) => !ficha.cuantia.incrementos.find((x) => x.id === i)?.requiere_local) })} />
            {datos.local && datos.incrementos?.includes("alquiler_hipoteca") && <Check etiqueta={tx.solHipoteca} checked={datos.hipoteca ?? false} onChange={(v) => guardar({ hipoteca: v })} />}
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="font-bold">{tx.solIncrementos}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {incrementosVisibles.map((inc) => {
              const marcado = datos.incrementos?.includes(inc.id) ?? false;
              return (
                <label key={inc.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${marcado ? "border-primario bg-primario-suave" : "border-borde hover:bg-fondo"}`}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={(e) => guardar({ incrementos: e.target.checked ? [...(datos.incrementos ?? []), inc.id] : (datos.incrementos ?? []).filter((i) => i !== inc.id) })}
                    className="mt-1 h-4 w-4 accent-primario"
                  />
                  <span>
                    <span className="font-bold">
                      {txt(inc.etiqueta, inc.etiqueta_eu)} · {inc.importe ? eur(inc.importe, idioma) : `${tx.importeMax} ${eur(inc.importe_maximo ?? 0, idioma)}`}
                    </span>
                    <span className="block text-sm text-tenue">{txt(inc.condicion, inc.condicion_eu)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {datos.incrementos?.includes("proyecto_innovador") && (
          <fieldset className="mt-4">
            <legend className="font-bold">{tx.solInnovadorVia}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {(["programa", "memoria"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="innovador" checked={datos.innovador_via === v} onChange={() => guardar({ innovador_via: v })} className="accent-primario" />
                  {v === "programa" ? tx.solInnovadorPrograma : tx.solInnovadorMemoria}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-xl bg-fondo p-4">
          <div>
            <p className="text-sm text-tenue">{tx.puedoImporte}</p>
            <p className="text-2xl font-bold text-primario">
              {cuantia?.hasta ? `${tx.importeMax} ` : ""}
              {eur(cuantia?.importe ?? 0, idioma)}
            </p>
            {cuantia && cuantia.descartados.length > 0 && (
              <p className="text-xs text-tenue">
                {tx.puedoDescartado}: {cuantia.descartados.map((d) => (eu ? d.motivo.eu : d.motivo.es)).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-xs text-tenue">{tx.solTopeAviso}</p>
          </div>
          <p aria-live="polite" className="text-sm text-ok">
            {guardado ? `✓ ${tx.solGuardado}` : ""}
          </p>
        </div>
      </Seccion>

      {/* Paso 2: documentos */}
      <Seccion titulo={tx.solPaso2} paso={2} sub={tx.solAvisoRevision}>
        {error && <p className="rounded-lg bg-error-suave p-3 text-error">{error}</p>}
        {grupos.map(([grupo, titulo]) => {
          const lista = aplicables.filter((d) => (d.grupo ?? "subvencion") === grupo && (grupo === "oficio" || d.aplica !== false));
          if (lista.length === 0) return null;
          return (
            <div key={grupo}>
              <h3 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-tenue">{titulo}</h3>
              <ul className="flex flex-col gap-3">
                {lista.map((d) => {
                  const subidos = docsDe(d.id);
                  const oficio = grupo === "oficio";
                  const ok = subidos.length > 0 && !subidos.some(tieneIncidencias);
                  return (
                    <li key={d.id} className={`rounded-xl border bg-superficie p-4 ${oficio ? "border-dashed border-borde" : "border-borde"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-2xl">
                          <p className="font-bold">
                            {ok && <span className="text-ok">✓ </span>}
                            {txt(d.nombre, d.nombre_eu)}
                            {d.aplica === true && !oficio && <Etiq tono="info">{tx.solDocObligatorio}</Etiq>}
                            {d.aplica === "opcional" && !oficio && <Etiq tono="neutro">{tx.solDocSiAplica}</Etiq>}
                          </p>
                          <p className="text-sm text-tenue">{txt(d.descripcion, d.descripcion_eu)}</p>
                          {d.condicion && d.aplica !== true && <p className="mt-1 text-xs text-aviso">{txt(d.condicion, d.condicion_eu)}</p>}
                        </div>
                        {!oficio && (
                          <div className="flex flex-col items-end gap-2">
                            {d.firma && (
                              <label className="flex items-center gap-1.5 text-xs text-tenue">
                                <input type="checkbox" checked={firma[d.id] !== false} onChange={(e) => setFirma({ ...firma, [d.id]: e.target.checked })} className="accent-primario" />
                                {tx.solFirma}
                              </label>
                            )}
                            <label className={`cursor-pointer rounded-full border-2 border-primario px-3.5 py-1.5 text-sm font-bold text-primario hover:bg-primario-suave ${subiendo ? "pointer-events-none opacity-50" : ""}`}>
                              {tx.solSubir}
                              <input
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) subir(d.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      {subiendo === d.id && <p className="mt-3 animate-pulse text-sm text-tenue">{tx.solAnalizando}</p>}
                      {subidos.map((s) => (
                        <ResultadoDocumento key={s.id} doc={s} idioma={idioma} tx={tx} onQuitar={() => quitar(s.id)} />
                      ))}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </Seccion>

      {/* Paso 3: presentar */}
      <Seccion titulo={tx.solPaso3} paso={3}>
        {pendientes.length > 0 && (
          <div className="rounded-lg bg-aviso-suave p-3">
            <p className="font-bold text-aviso">
              {tx.solPendientes} ({pendientes.length})
            </p>
            <ul className="list-disc pl-5 text-sm">
              {pendientes.map((p) => (
                <li key={p.id}>{txt(p.nombre, p.nombre_eu)}</li>
              ))}
            </ul>
          </div>
        )}
        {conAvisos.length > 0 && (
          <div className="rounded-lg bg-error-suave p-3">
            <p className="font-bold text-error">
              {tx.solIncidencias} ({conAvisos.length})
            </p>
            <ul className="list-disc pl-5 text-sm">
              {conAvisos.map((c) => (
                <li key={c.id}>{c.nombre}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" onClick={presentar} className="self-start rounded-full bg-primario px-6 py-3 font-bold text-white hover:bg-primario-oscuro">
          {tx.solPresentar}
        </button>
      </Seccion>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-borde bg-fondo px-3 py-2";

function tieneIncidencias(d: Doc) {
  const a = d.analisis;
  return Boolean(d.revision === "obsoleto" || (a && ((a.reglas?.length ?? 0) > 0 || a.comprobaciones.some((c) => c.resultado === "incidencia") || !a.legible)));
}

function Seccion({ titulo, paso, sub, children }: { titulo: string; paso: number; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`paso${paso}`} className="flex flex-col gap-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
      <div>
        <h2 id={`paso${paso}`} className="flex items-center gap-2 text-xl font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primario text-sm text-white">{paso}</span>
          {titulo.replace(/^\d+\.\s*/, "")}
        </h2>
        {sub && <p className="mt-1 text-sm text-tenue">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, id, children }: { etiqueta: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

function Check({ etiqueta, checked, onChange }: { etiqueta: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 ${checked ? "border-primario bg-primario-suave" : "border-borde"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primario" />
      <span className="text-sm font-bold">{etiqueta}</span>
    </label>
  );
}

function Etiq({ tono, children }: { tono: "info" | "neutro"; children: React.ReactNode }) {
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-normal ${tono === "info" ? "bg-primario-suave text-primario-oscuro" : "bg-fondo text-tenue"}`}>{children}</span>;
}

function ResultadoDocumento({ doc, idioma, tx, onQuitar }: { doc: Doc; idioma: Idioma; tx: Textos; onQuitar: () => void }) {
  const a = doc.analisis;
  const aviso = tieneIncidencias(doc);
  const eu = idioma === "eu";
  const estado = doc.revision === "obsoleto" ? tx.solEstadoObsoleto : doc.revision === "validado" ? tx.solEstadoValidado : doc.revision === "rechazado" || doc.revision === "corregido" ? tx.solEstadoRechazado : tx.solEstadoRecibido;
  return (
    <div className={`mt-3 rounded-lg p-3 text-sm ${!a ? "bg-fondo" : aviso ? "bg-error-suave" : "bg-ok-suave"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">
          {doc.nombre} <span className="font-normal text-tenue">· {estado}</span>
        </p>
        <button type="button" onClick={onQuitar} className="text-tenue hover:underline">
          {tx.solDocQuitar}
        </button>
      </div>
      {a && !aviso && <p className="mt-1 text-ok">{tx.solDocOk}</p>}
      {a && aviso && (
        <>
          <p className="mt-1 font-bold text-error">{tx.solDocAviso}</p>
          <p className="mt-1">{eu ? a.mensaje_solicitante_eu : a.mensaje_solicitante_es}</p>
          <ul className="mt-1 list-disc pl-5">
            {(a.reglas ?? []).map((r, i) => (
              <li key={`r${i}`}>
                {eu ? r.texto_eu : r.texto_es} <span className="text-tenue">({r.regla} · {r.art})</span>
              </li>
            ))}
            {a.comprobaciones
              .filter((c) => c.resultado === "incidencia")
              .map((c, i) => (
                <li key={i}>
                  {c.detalle}
                  {c.referencia && <span className="text-tenue"> ({c.referencia})</span>}
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
