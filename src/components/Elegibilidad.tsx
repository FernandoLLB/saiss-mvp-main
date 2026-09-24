"use client";

import { useMemo, useState } from "react";
import { evaluar, requisitosAcceso, type Respuesta } from "@/lib/kb/calculo";
import type { Ficha } from "@/lib/kb/ficha";
import { eur, type Idioma, type Textos } from "@/lib/i18n";
import { documentosAplicables } from "@/lib/reglas/creacion2025";

type Forma = "autonomo" | "sociedad";

// Autodiagnóstico: preguntas cortas de sí/no sobre los requisitos de acceso y los incrementos; cálculo determinista.
export function Elegibilidad({ ficha, idioma, tx, onEmpezar }: { ficha: Ficha; idioma: Idioma; tx: Textos; onEmpezar?: () => void }) {
  const [forma, setForma] = useState<Forma | null>(null);
  const [local, setLocal] = useState<Respuesta | undefined>();
  const [req, setReq] = useState<Record<string, Respuesta>>({});
  const [inc, setInc] = useState<Record<string, Respuesta>>({});
  const eu = idioma === "eu";
  const txt = (es: string, euTxt?: string | null) => (eu && euTxt ? euTxt : es);

  const preguntaLocal = ficha.cuantia.pregunta_local_es;
  const requisitos = requisitosAcceso(ficha).filter((r) => !r.aplica_forma || r.aplica_forma === forma);
  const incrementosVisibles = ficha.cuantia.incrementos.filter((i) => !i.requiere_local || local === "si");
  const resultado = useMemo(() => evaluar(ficha, req, inc, preguntaLocal ? local : "si"), [ficha, req, inc, local, preguntaLocal]);
  const respondidos = requisitos.filter((r) => req[r.id]).length;
  const completo = respondidos === requisitos.length && requisitos.length > 0;
  const docs = useMemo(
    () => documentosAplicables(ficha, { forma: forma ?? "autonomo", local: local === "si", incrementos: Object.keys(inc).filter((k) => inc[k] === "si") }).filter((d) => d.aplica === true),
    [ficha, forma, local, inc],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
      <div className="flex flex-col gap-6">
        <p className="text-tenue">{tx.puedoIntro}</p>

        <Seccion titulo={tx.puedoLocalTitulo} paso={1}>
          <Pregunta id="forma" texto={tx.puedoFormaPregunta}>
            <Opciones
              opciones={[
                ["autonomo", tx.puedoFormaAuto],
                ["sociedad", tx.puedoFormaSoc],
              ]}
              valor={forma}
              onChange={(v) => setForma(v as Forma)}
            />
          </Pregunta>
          {preguntaLocal && (
            <Pregunta id="local" texto={txt(preguntaLocal, ficha.cuantia.pregunta_local_eu)}>
              <SiNo valor={local} tx={tx} onChange={setLocal} sinDuda />
            </Pregunta>
          )}
        </Seccion>

        <Seccion titulo={tx.puedoRequisitosTitulo} paso={2} detalle={`${respondidos}/${requisitos.length}`}>
          {requisitos.map((r) => (
            <Pregunta key={r.id} id={`r-${r.id}`} texto={eu ? r.pregunta_eu : r.pregunta_es} regla={`${r.id} · ${r.cita.seccion}`} tx={tx}>
              <SiNo valor={req[r.id]} tx={tx} onChange={(v) => setReq({ ...req, [r.id]: v })} />
            </Pregunta>
          ))}
        </Seccion>

        {incrementosVisibles.length > 0 && (
          <Seccion titulo={tx.puedoIncrementosTitulo} paso={3}>
            {incrementosVisibles.map((i) => (
              <Pregunta key={i.id} id={`i-${i.id}`} texto={eu ? i.pregunta_eu : i.pregunta_es} ayuda={txt(i.condicion, i.condicion_eu)} regla={i.cita.seccion} tx={tx}>
                <SiNo valor={inc[i.id]} tx={tx} onChange={(v) => setInc({ ...inc, [i.id]: v })} sinDuda />
              </Pregunta>
            ))}
          </Seccion>
        )}
      </div>

      <aside className="lg:sticky lg:top-4 flex flex-col gap-3 self-start" aria-live="polite">
        <div className="rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
          {respondidos > 0 && resultado.incumplidos.length > 0 ? (
            <div className="rounded-lg bg-error-suave p-3">
              <p className="font-bold text-error">{tx.puedoResultadoNo}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {resultado.incumplidos.map((r) => (
                  <li key={r.id}>
                    {txt(r.texto, r.texto_eu)} <span className="text-tenue">({r.id} · {r.cita.seccion})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : completo && resultado.dudosos.filter((d) => requisitos.includes(d)).length === 0 ? (
            <p className="rounded-lg bg-ok-suave p-3 font-bold text-ok">✓ {tx.puedoResultadoOk}</p>
          ) : null}
          {respondidos > 0 && resultado.dudosos.filter((d) => requisitos.includes(d) && req[d.id] === "nose").length > 0 && (
            <div className="mt-3 rounded-lg bg-aviso-suave p-3 text-sm">
              <p className="font-bold text-aviso">{tx.puedoResultadoDudas}</p>
              <ul className="mt-1 list-disc pl-5">
                {resultado.dudosos
                  .filter((d) => req[d.id] === "nose")
                  .map((r) => (
                    <li key={r.id}>{txt(r.texto, r.texto_eu)}</li>
                  ))}
              </ul>
            </div>
          )}

          <p className="mt-4 text-sm text-tenue">{tx.puedoImporte}</p>
          <p className="text-3xl font-bold text-primario">
            {resultado.importeHasta ? `${tx.importeMax} ` : ""}
            {eur(resultado.importe, idioma)}
          </p>
          <ul className="mt-2 divide-y divide-borde text-sm">
            {ficha.cuantia.base ? (
              <li className="flex justify-between py-1">
                <span>{tx.puedoBase}</span>
                <span className="tabular-nums">{eur(ficha.cuantia.base, idioma)}</span>
              </li>
            ) : null}
            {resultado.incrementos.map((i) => {
              const def = ficha.cuantia.incrementos.find((x) => x.id === i.id);
              return (
                <li key={i.id} className="flex justify-between gap-2 py-1">
                  <span>+ {txt(i.etiqueta, def?.etiqueta_eu)}</span>
                  <span className="whitespace-nowrap tabular-nums">
                    {i.hasta ? `${tx.importeMax} ` : ""}
                    {eur(i.importe, idioma)}
                  </span>
                </li>
              );
            })}
            {resultado.descartados.map((d) => {
              const def = ficha.cuantia.incrementos.find((x) => x.id === d.id);
              return (
                <li key={d.id} className="py-1 text-tenue">
                  <span className="line-through">{txt(d.etiqueta, def?.etiqueta_eu)}</span>
                  <span className="block text-xs">
                    {tx.puedoDescartado}: {d.motivo === "sin_local" ? tx.puedoSinLocalMotivo : tx.puedoIncompatibleMotivo}
                  </span>
                </li>
              );
            })}
            {resultado.tope ? (
              <li className="flex justify-between py-1 text-xs text-tenue">
                <span>
                  {tx.puedoTope} ({local === "si" ? tx.puedoConLocal : tx.puedoSinLocal})
                </span>
                <span className="tabular-nums">{eur(resultado.tope, idioma)}</span>
              </li>
            ) : null}
          </ul>
          {onEmpezar && resultado.incumplidos.length === 0 && (
            <button type="button" onClick={onEmpezar} className="mt-4 w-full rounded-full bg-primario px-4 py-2.5 font-bold text-white hover:bg-primario-oscuro">
              {tx.puedoEmpezar}
            </button>
          )}
          <p className="mt-3 text-xs text-tenue">{tx.puedoDisclaimer}</p>
        </div>

        {forma && (
          <div className="rounded-2xl border border-borde bg-superficie p-5 text-sm">
            <p className="font-bold">
              {tx.puedoDocsTitulo} ({docs.length})
            </p>
            <ul className="mt-2 list-disc pl-5 text-tenue">
              {docs.map((d) => (
                <li key={d.id}>{txt(d.nombre, d.nombre_eu)}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Seccion({ titulo, paso, detalle, children }: { titulo: string; paso: number; detalle?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primario text-sm text-white">{paso}</span>
        {titulo}
        {detalle && <span className="text-sm font-normal text-tenue">{detalle}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Pregunta({ id, texto, ayuda, regla, tx, children }: { id: string; texto: string; ayuda?: string | null; regla?: string; tx?: Textos; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="rounded-xl border border-borde bg-superficie p-4">
      <p id={id} className="font-bold leading-snug">
        {texto}
      </p>
      {ayuda && <p className="mt-1 text-sm text-tenue">{ayuda}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {children}
        {regla && tx && <span className="ml-auto text-xs text-tenue">{regla}</span>}
      </div>
    </div>
  );
}

function Opciones<T extends string>({ opciones, valor, onChange }: { opciones: [T, string][]; valor: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <>
      {opciones.map(([v, etiqueta]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onChange(v)}
          className={`rounded-full border px-4 py-1.5 transition ${valor === v ? "border-primario bg-primario text-white" : "border-borde hover:bg-primario-suave"}`}
        >
          {etiqueta}
        </button>
      ))}
    </>
  );
}

function SiNo({ valor, tx, onChange, sinDuda }: { valor?: Respuesta; tx: Textos; onChange: (v: Respuesta) => void; sinDuda?: boolean }) {
  const opciones: [Respuesta, string][] = [
    ["si", tx.puedoSi],
    ["no", tx.puedoNo],
    ...(sinDuda ? [] : ([["nose", tx.puedoNoSe]] as [Respuesta, string][])),
  ];
  return <Opciones opciones={opciones} valor={valor} onChange={onChange} />;
}
