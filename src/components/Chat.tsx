"use client";

import { useEffect, useRef, useState } from "react";
import type { EventoChat, Segmento } from "@/app/api/chat/route";
import { Markdown } from "@/components/Markdown";
import type { Idioma, Textos } from "@/lib/i18n";

type Mensaje =
  | { rol: "user"; texto: string }
  | { rol: "assistant"; texto: string; segmentos?: Segmento[]; resultado?: string; id?: number; valoracion?: number; error?: boolean };

export function Chat({ convocatoria, idioma, tx }: { convocatoria: string; idioma: Idioma; tx: Textos }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacion, setConversacion] = useState<string | null>(null);
  const [entrada, setEntrada] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [derivado, setDerivado] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    setEntrada("");
    setOcupado(true);
    setMensajes((m) => [...m, { rol: "user", texto: limpio }, { rol: "assistant", texto: "" }]);
    const actualizar = (fn: (m: Extract<Mensaje, { rol: "assistant" }>) => Mensaje) =>
      setMensajes((ms) => {
        const copia = [...ms];
        copia[copia.length - 1] = fn(copia.at(-1) as Extract<Mensaje, { rol: "assistant" }>);
        return copia;
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversacion, convocatoria, idioma, mensaje: limpio }),
      });
      if (!res.ok || !res.body) throw new Error(String(res.status));
      const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = "";
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += value;
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";
        for (const linea of lineas) {
          if (!linea) continue;
          const ev = JSON.parse(linea) as EventoChat;
          if (ev.t === "inicio") setConversacion(ev.conversacion);
          else if (ev.t === "texto") actualizar((m) => ({ ...m, texto: m.texto + ev.v }));
          else if (ev.t === "fin")
            actualizar((m) => ({ ...m, texto: ev.segmentos.map((s) => s.texto).join(""), segmentos: ev.segmentos, resultado: ev.resultado, id: ev.mensajeId }));
          else if (ev.t === "error") actualizar((m) => ({ ...m, texto: ev.v, error: true }));
        }
      }
    } catch {
      actualizar((m) => ({ ...m, texto: tx.chatError, error: true }));
    } finally {
      setOcupado(false);
    }
  }

  async function valorar(indice: number, id: number, valor: 1 | -1) {
    setMensajes((ms) => ms.map((m, i) => (i === indice && m.rol === "assistant" ? { ...m, valoracion: valor } : m)));
    await fetch("/api/chat/valoracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mensajeId: id, valor }) });
  }

  async function derivar() {
    setDerivado(true);
    await fetch("/api/chat/derivar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversacion, convocatoria }),
    });
  }

  const ultimo = mensajes.at(-1);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-borde bg-superficie shadow-sm">
      <div className="flex items-center gap-3 border-b border-borde bg-primario-suave px-4 py-3">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primario text-sm font-bold text-white">IA</span>
        <span className="mr-auto leading-tight">
          <span className="block font-bold">{tx.marca}</span>
          <span className="flex items-center gap-1.5 text-xs text-tenue"><span aria-hidden className="h-2 w-2 rounded-full bg-ok" />{tx.fuenteOficial}</span>
        </span>
        <button
          type="button"
          onClick={derivar}
          disabled={derivado}
          className="rounded-full border border-primario/40 bg-superficie px-3 py-1.5 text-sm font-bold text-primario hover:bg-primario hover:text-white disabled:border-borde disabled:bg-transparent disabled:text-tenue"
        >
          {tx.chatHablarPersona}
        </button>
        {mensajes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMensajes([]);
              setConversacion(null);
              setDerivado(false);
            }}
            className="text-sm text-tenue hover:underline"
          >
            {tx.chatNueva}
          </button>
        )}
      </div>
      {derivado && <p className="mx-4 mt-3 rounded-lg bg-primario-suave px-3 py-2 text-sm">{tx.chatContacto}</p>}

      <div className="flex flex-col gap-4 p-4 sm:p-5 min-h-[20rem] max-h-[62vh] overflow-y-auto bg-fondo/60" aria-live="polite" aria-busy={ocupado}>
        <Burbuja rol="assistant">
          <p>{tx.chatBienvenida}</p>
        </Burbuja>
        {mensajes.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {tx.chatSugerencias.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => enviar(s)}
                className="rounded-full border border-primario/30 bg-superficie px-3.5 py-2 text-sm text-primario-oscuro shadow-sm transition hover:-translate-y-0.5 hover:bg-primario hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {mensajes.map((m, i) =>
          m.rol === "user" ? (
            <Burbuja key={i} rol="user">
              <p>{m.texto}</p>
            </Burbuja>
          ) : (
            <Burbuja key={i} rol="assistant" error={m.error}>
              {m.texto ? <RespuestaConCitas m={m} tx={tx} /> : <p className="flex items-center gap-2 text-tenue">
                  <span aria-hidden className="flex gap-1">{[0, 150, 300].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-primario/60" style={{ animationDelay: `${d}ms` }} />)}</span>
                  {tx.chatPensando}
                </p>}
              {m.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-2 text-sm text-tenue">
                  {m.valoracion ? (
                    <span>{tx.chatGracias}</span>
                  ) : (
                    <>
                      <span>{tx.chatUtil}</span>
                      <button type="button" onClick={() => valorar(i, m.id!, 1)} className="rounded border border-borde px-2 hover:bg-ok-suave">
                        {tx.chatSi}
                      </button>
                      <button type="button" onClick={() => valorar(i, m.id!, -1)} className="rounded border border-borde px-2 hover:bg-error-suave">
                        {tx.chatNo}
                      </button>
                    </>
                  )}
                  {i === mensajes.length - 1 && !ocupado && (
                    <button type="button" onClick={() => enviar(tx.lecturaFacil)} className="ml-auto text-primario hover:underline">
                      {tx.lecturaFacil}
                    </button>
                  )}
                </div>
              )}
            </Burbuja>
          ),
        )}
        {ultimo?.rol === "assistant" && ultimo.resultado === "sin_fuente" && !derivado && (
          <p className="text-sm text-tenue">
            {tx.chatSinFuente}{" "}
            <button type="button" onClick={derivar} className="font-bold text-primario hover:underline">
              {tx.chatHablarPersona}
            </button>
          </p>
        )}
        <div ref={finRef} />
      </div>

      <form
        className="flex gap-2 border-t border-borde bg-superficie p-3"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(entrada);
        }}
      >
        <label htmlFor="pregunta" className="sr-only">
          {tx.chatPlaceholder}
        </label>
        <input
          id="pregunta"
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          placeholder={tx.chatPlaceholder}
          maxLength={2000}
          autoComplete="off"
          className="flex-1 rounded-full border border-borde bg-fondo px-4 py-2.5"
        />
        <button type="submit" disabled={ocupado || !entrada.trim()} className="rounded-full bg-primario px-5 font-bold text-white transition hover:bg-primario-oscuro disabled:bg-borde disabled:text-tenue">
          {tx.chatEnviar}
        </button>
      </form>
    </div>
  );
}

function Burbuja({ rol, error, children }: { rol: "user" | "assistant"; error?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        rol === "user"
          ? "self-end max-w-[85%] rounded-2xl rounded-br-sm bg-primario px-4 py-2.5 text-white shadow-sm"
          : `self-start max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3 ${error ? "bg-error-suave" : "border border-borde bg-superficie shadow-sm"}`
      }
    >
      {children}
    </div>
  );
}

function RespuestaConCitas({ m, tx }: { m: Extract<Mensaje, { rol: "assistant" }>; tx: Textos }) {
  if (!m.segmentos) return <Markdown texto={m.texto} />;

  // Numeración única por pasaje citado
  const fuentes: { clave: string; seccion: string | null; pagina: number; documento: string; fichero: string; texto: string }[] = [];
  const indice = (c: Segmento["citas"][number]) => {
    const clave = `${c.fichero}#${c.pagina}#${c.texto.slice(0, 40)}`;
    let n = fuentes.findIndex((f) => f.clave === clave);
    if (n === -1) n = fuentes.push({ clave, ...c }) - 1;
    return n + 1;
  };
  const textoConMarcas = m.segmentos
    .map((s) => (s.citas.length ? `${s.texto}${[...new Set(s.citas.map(indice))].map((n) => ` [${n}]`).join("")}` : s.texto))
    .join("");

  return (
    <>
      <Markdown texto={textoConMarcas} />
      {fuentes.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold text-primario">
            {tx.chatFuentes} ({fuentes.length})
          </summary>
          <ol className="mt-2 flex flex-col gap-2">
            {fuentes.map((f, i) => (
              <li key={f.clave} className="rounded-lg border border-borde bg-fondo p-2">
                <a href={`/api/kb/${f.fichero}#page=${f.pagina}`} target="_blank" rel="noreferrer" className="font-bold text-primario hover:underline">
                  [{i + 1}] {f.seccion ?? f.documento} · {tx.chatPagina} {f.pagina}
                </a>
                <p className="mt-1 text-tenue line-clamp-3">«{f.texto.replace(/^\[[^\]]*\]\s*/, "")}»</p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </>
  );
}
