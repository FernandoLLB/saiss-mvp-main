import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { Etiqueta, fecha, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Cita = { seccion: string | null; pagina: number; documento: string };
type Segmento = { texto: string; citas: Cita[] };

export default async function Conversaciones({ searchParams }: PageProps<"/gestion/conversaciones">) {
  if (!(await tecnicoActual())) return null;
  const { c } = await searchParams;

  const lista = await query<{ id: string; idioma: string; titulo_es: string | null; creada_en: Date; primera: string | null; mensajes: string; sin_fuente: boolean; negativa: boolean }>(`
    SELECT cv.id, cv.idioma, c.titulo_es, cv.creada_en,
           (SELECT texto FROM mensaje WHERE conversacion=cv.id AND rol='user' ORDER BY id LIMIT 1) AS primera,
           (SELECT count(*) FROM mensaje WHERE conversacion=cv.id) AS mensajes,
           EXISTS (SELECT 1 FROM mensaje WHERE conversacion=cv.id AND resultado='sin_fuente') AS sin_fuente,
           EXISTS (SELECT 1 FROM mensaje WHERE conversacion=cv.id AND valoracion=-1) AS negativa
      FROM conversacion cv LEFT JOIN convocatoria c ON c.slug=cv.convocatoria
     WHERE cv.canal='web' ORDER BY cv.creada_en DESC LIMIT 50`);
  const activa = lista.find((x) => x.id === c) ?? lista[0];
  const mensajes = activa
    ? await query<{ id: number; rol: "user" | "assistant"; texto: string; citas: Segmento[] | null; resultado: string | null; valoracion: number | null; creado_en: Date }>(
        "SELECT id, rol, texto, citas, resultado, valoracion, creado_en FROM mensaje WHERE conversacion=$1 ORDER BY id",
        [activa.id],
      )
    : [];

  return (
    <>
      <Titulo sub="Sirven para detectar preguntas sin respuesta en las bases y mejorar la información publicada.">Conversaciones</Titulo>
      {lista.length === 0 ? (
        <p className="text-tenue">Aún no hay conversaciones.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:h-[calc(100vh-15rem)] lg:min-h-[32rem]">
          {/* Lista */}
          <nav aria-label="Conversaciones" className="overflow-y-auto rounded-xl border border-borde bg-superficie">
            <ul className="divide-y divide-borde">
              {lista.map((x) => {
                const sel = x.id === activa?.id;
                return (
                  <li key={x.id}>
                    <Link
                      href={`/gestion/conversaciones?c=${x.id}`}
                      scroll={false}
                      aria-current={sel ? "true" : undefined}
                      className={`block border-l-4 px-4 py-3 ${sel ? "border-primario bg-primario-suave" : "border-transparent hover:bg-fondo"}`}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs text-tenue">
                        <span className="flex items-center gap-1.5">
                          <Etiqueta tono={x.idioma === "eu" ? "info" : "neutro"}>{x.idioma}</Etiqueta>
                          {x.mensajes} mensajes
                        </span>
                        <span className="whitespace-nowrap">{fecha(x.creada_en)}</span>
                      </span>
                      <span className="mt-1.5 block line-clamp-2 text-sm font-bold leading-snug">{x.primera ?? "—"}</span>
                      <span className="mt-1 block truncate text-xs text-tenue">{x.titulo_es}</span>
                      {(x.sin_fuente || x.negativa) && (
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {x.sin_fuente && <Etiqueta tono="aviso">sin fuente</Etiqueta>}
                          {x.negativa && <Etiqueta tono="error">valoración negativa</Etiqueta>}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Ventana de conversación */}
          {activa && (
            <section aria-label="Conversación seleccionada" className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-borde bg-superficie">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borde bg-primario-suave px-5 py-3">
                <h2 className="mr-auto font-bold">{activa.titulo_es}</h2>
                <Etiqueta tono={activa.idioma === "eu" ? "info" : "neutro"}>{activa.idioma === "eu" ? "Euskera" : "Castellano"}</Etiqueta>
                <span className="text-sm text-tenue">{fecha(activa.creada_en)}</span>
              </header>
              <ol className="flex flex-1 flex-col gap-4 overflow-y-auto bg-fondo/60 p-5">
                {mensajes.map((m) => {
                  const citas = (m.citas ?? []).flatMap((s) => s.citas);
                  const unicas = [...new Map(citas.map((ci) => [`${ci.seccion}#${ci.pagina}`, ci])).values()];
                  return m.rol === "user" ? (
                    <li key={m.id} className="max-w-[80%] self-end">
                      <p className="rounded-2xl rounded-br-sm bg-primario px-4 py-2.5 text-white shadow-sm">{m.texto}</p>
                      <p className="mt-1 text-right text-xs text-tenue">Persona · {fecha(m.creado_en)}</p>
                    </li>
                  ) : (
                    <li key={m.id} className="max-w-[88%] self-start">
                      <div className="rounded-2xl rounded-bl-sm border border-borde bg-superficie px-4 py-3 text-sm shadow-sm">
                        <Markdown texto={m.texto} />
                        {unicas.length > 0 && (
                          <p className="mt-3 flex flex-wrap gap-1.5 border-t border-borde pt-2">
                            {unicas.map((ci, i) => (
                              <Etiqueta key={i}>
                                {(ci.seccion ?? ci.documento).split(".")[0]} · p. {ci.pagina}
                              </Etiqueta>
                            ))}
                          </p>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-tenue">
                        Asistente · {fecha(m.creado_en)}
                        {m.resultado === "sin_fuente" && <Etiqueta tono="aviso">sin fuente</Etiqueta>}
                        {m.valoracion === 1 && <Etiqueta tono="ok">útil</Etiqueta>}
                        {m.valoracion === -1 && <Etiqueta tono="error">no útil</Etiqueta>}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
      )}
    </>
  );
}
