"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chat } from "@/components/Chat";
import { Elegibilidad } from "@/components/Elegibilidad";
import type { Ficha } from "@/lib/kb/ficha";
import type { Idioma, Textos } from "@/lib/i18n";

type Pestana = "pregunta" | "puedo" | "preparar";

export function PestanasConvocatoria({ slug, ficha, idioma, tx }: { slug: string; ficha: Ficha | null; idioma: Idioma; tx: Textos }) {
  const [activa, setActiva] = useState<Pestana>("pregunta");
  const [creando, setCreando] = useState(false);
  const router = useRouter();
  const pestanas: [Pestana, string][] = [
    ["pregunta", tx.pestanaPregunta],
    ["puedo", tx.pestanaPuedo],
    ["preparar", tx.pestanaPreparar],
  ];

  async function empezar() {
    setCreando(true);
    const res = await fetch("/api/solicitudes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ convocatoria: slug, idioma }) });
    const { codigo } = await res.json();
    router.push(`/${idioma}/solicitud/${codigo}`);
  }

  return (
    <div>
      <div role="tablist" aria-label="SAISS" className="flex gap-1 border-b border-borde overflow-x-auto">
        {pestanas.map(([id, etiqueta]) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            aria-selected={activa === id}
            aria-controls={`panel-${id}`}
            onClick={() => setActiva(id)}
            className={`whitespace-nowrap px-4 py-2.5 font-bold border-b-4 -mb-px ${
              activa === id ? "border-acento text-tinta" : "border-transparent text-tenue hover:text-tinta"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {/* Las tres pestañas quedan montadas: al cambiar de una a otra no se pierde lo escrito ni lo respondido */}
      {pestanas.map(([id]) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={activa !== id} className="pt-5">
          {id === "pregunta" && <Chat convocatoria={slug} idioma={idioma} tx={tx} />}
          {id !== "pregunta" && !ficha && <p className="rounded-lg bg-aviso-suave p-4">{tx.fichaPendiente}</p>}
          {id === "puedo" && ficha && <Elegibilidad ficha={ficha} idioma={idioma} tx={tx} onEmpezar={empezar} />}
          {id === "preparar" && ficha && <ChecklistDocumentos ficha={ficha} idioma={idioma} tx={tx} onEmpezar={empezar} creando={creando} />}
        </div>
      ))}
    </div>
  );
}

function ChecklistDocumentos({ ficha, idioma, tx, onEmpezar, creando }: { ficha: Ficha; idioma: Idioma; tx: Textos; onEmpezar: () => void; creando: boolean }) {
  const eu = idioma === "eu";
  const txt = (es: string, euTxt?: string | null) => (eu && euTxt ? euTxt : es);
  const grupos = [
    ["subvencion", tx.solGrupoSubvencion],
    ["empresa", tx.solGrupoEmpresa],
    ["oficio", tx.solGrupoOficio],
  ] as const;
  const deSolicitud = ficha.documentos.filter((d) => d.momento !== "justificacion");
  return (
    <div className="flex flex-col gap-5">
      {grupos.map(([g, titulo]) => {
        const lista = deSolicitud.filter((d) => (d.grupo ?? "subvencion") === g);
        if (!lista.length) return null;
        return (
          <div key={g}>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-tenue">{titulo}</h3>
            <ol className="flex flex-col gap-2">
              {lista.map((d) => (
                <li key={d.id} className={`rounded-xl border bg-superficie p-3 ${g === "oficio" ? "border-dashed" : ""} border-borde`}>
                  <p className="font-bold">
                    {txt(d.nombre, d.nombre_eu)}
                    {d.firma && <span className="ml-2 rounded-full bg-primario-suave px-2 py-0.5 text-xs font-normal text-primario-oscuro">{tx.solFirma}</span>}
                    {d.obligatoriedad === "condicional" && d.condicion && <span className="ml-2 rounded-full bg-aviso-suave px-2 py-0.5 text-xs font-normal text-aviso">{txt(d.condicion, d.condicion_eu)}</span>}
                  </p>
                  <p className="text-sm text-tenue">{txt(d.descripcion, d.descripcion_eu)}</p>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
      <button type="button" onClick={onEmpezar} disabled={creando} className="self-start rounded-full bg-primario px-6 py-3 font-bold text-white hover:bg-primario-oscuro disabled:opacity-60">
        {tx.puedoEmpezar}
      </button>
    </div>
  );
}
