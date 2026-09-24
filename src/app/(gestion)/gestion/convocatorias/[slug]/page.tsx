import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { regenerarFicha, validarFicha } from "../acciones";
import { BotonEnviar } from "@/components/gestion/BotonEnviar";
import { Etiqueta, fecha, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { one, query } from "@/lib/db";
import type { Ficha } from "@/lib/kb/ficha";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function FichaConvocatoria({ params }: PageProps<"/gestion/convocatorias/[slug]">) {
  if (!(await tecnicoActual())) return null;
  const { slug } = await params;
  const c = await one<{ slug: string; titulo_es: string; ficha: Ficha | null; ficha_version: number; validada_por: string | null; validada_en: Date | null }>(
    "SELECT slug, titulo_es, ficha, ficha_version, validada_por, validada_en FROM convocatoria WHERE slug=$1",
    [slug],
  );
  if (!c) notFound();
  const bases = await one<{ fichero: string }>("SELECT fichero FROM kb_documento WHERE convocatoria=$1 AND tipo='bases' LIMIT 1", [slug]);
  const f = c.ficha;
  const cita = (x: { seccion: string; pagina: number }) => (
    <a href={bases ? `/api/kb/${bases.fichero}#page=${x.pagina}` : undefined} target="_blank" rel="noreferrer" className="whitespace-nowrap text-xs text-primario hover:underline">
      {x.seccion.split(".")[0]} · p. {x.pagina}
    </a>
  );

  return (
    <>
      <Link href="/gestion/convocatorias" className="text-sm text-primario hover:underline">
        ← Convocatorias
      </Link>
      <Titulo sub={c.validada_por?.startsWith("Reglas") ? `Ficha v${c.ficha_version} generada desde las reglas codificadas de la convocatoria (IDs R/G/DOC con su artículo). Los cálculos son deterministas.` : `Ficha v${c.ficha_version} extraída por IA de las bases oficiales. Revisa cada elemento contra su cita antes de publicar.`}>{c.titulo_es}</Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {c.validada_en ? (
          <Etiqueta tono="ok">
            Validada por {c.validada_por} · {fecha(c.validada_en)}
          </Etiqueta>
        ) : (
          <Etiqueta tono="aviso">Pendiente de validación: no visible para la ciudadanía</Etiqueta>
        )}
        <form action={regenerarFicha}>
          <input type="hidden" name="slug" value={slug} />
          <BotonEnviar className="border border-borde bg-superficie" pendiente="Regenerando (≈4 min)…">
            Regenerar con IA
          </BotonEnviar>
        </form>
      </div>

      {!f ? (
        <p className="text-tenue">Aún no hay ficha generada.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta titulo="Objeto y cuantía" className="lg:col-span-2">
            <p>{f.objeto}</p>
            <p className="mt-2 text-sm text-tenue">{f.beneficiarios}</p>
            <p className="mt-3">
              Base <strong>{f.cuantia.base ? EUR.format(f.cuantia.base) : "—"}</strong> · máximo <strong>{f.cuantia.maximo ? EUR.format(f.cuantia.maximo) : "—"}</strong> {cita(f.cuantia.cita)}
            </p>
            <Lista>
              {f.cuantia.incrementos.map((i) => (
                <Item key={i.id} derecha={cita(i.cita)}>
                  <strong>{i.etiqueta}</strong> · {i.importe ? EUR.format(i.importe) : `hasta ${EUR.format(i.importe_maximo ?? 0)}`}
                  {i.incompatible_con.length > 0 && <Etiqueta tono="aviso">incompatible con {i.incompatible_con.join(", ")}</Etiqueta>}
                  <span className="block text-sm text-tenue">{i.condicion}</span>
                </Item>
              ))}
            </Lista>
          </Tarjeta>

          <Tarjeta titulo={`Requisitos (${f.requisitos.length})`}>
            <Lista>
              {f.requisitos.map((r) => (
                <Item key={r.id} derecha={cita(r.cita)}>
                  <Etiqueta tono={r.tipo === "acceso" ? "info" : "neutro"}>{r.tipo}</Etiqueta> {r.texto}
                  {r.aplica_a && <span className="block text-xs text-tenue">Aplica a: {r.aplica_a}</span>}
                  <span className="block text-xs text-tenue">
                    ES: {r.pregunta_es} · EU: {r.pregunta_eu}
                  </span>
                </Item>
              ))}
            </Lista>
          </Tarjeta>

          <Tarjeta titulo={`Documentación (${f.documentos.length})`}>
            <Lista>
              {f.documentos.map((d) => (
                <Item key={d.id} derecha={cita(d.cita)}>
                  <Etiqueta tono={d.momento === "justificacion" ? "neutro" : "info"}>{d.momento.replaceAll("_", " ")}</Etiqueta> <strong>{d.nombre}</strong>
                  {d.condicion && <span className="block text-xs text-aviso">Si: {d.condicion}</span>}
                  <span className="block text-xs text-tenue">Comprobar: {d.comprobaciones.join(" · ")}</span>
                </Item>
              ))}
            </Lista>
          </Tarjeta>

          <Tarjeta titulo="Gastos">
            <p className="text-sm">
              {f.gastos.periodo} {cita(f.gastos.cita)}
            </p>
            <p className="mt-2 text-xs font-bold uppercase text-tenue">Subvencionables</p>
            <ul className="list-disc pl-5 text-sm">
              {f.gastos.subvencionables.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-bold uppercase text-tenue">Excluidos</p>
            <ul className="list-disc pl-5 text-sm">
              {f.gastos.excluidos.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-bold uppercase text-tenue">Justificantes</p>
            <ul className="list-disc pl-5 text-sm">
              {f.gastos.reglas_justificantes.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Plazos, presentación y subsanación">
            <Lista>
              {f.plazos.map((p, i) => (
                <Item key={i} derecha={cita(p.cita)}>
                  <strong>{p.hito}:</strong> {p.plazo}
                </Item>
              ))}
              <Item derecha={cita(f.presentacion.cita)}>
                <strong>Presentación:</strong> {f.presentacion.canal}
              </Item>
              <Item derecha={cita(f.subsanacion.cita)}>
                <strong>Subsanación:</strong> {f.subsanacion.plazo_dias_habiles} días hábiles · {f.subsanacion.canal} · {f.subsanacion.consecuencia}
              </Item>
            </Lista>
          </Tarjeta>

          <Tarjeta titulo="Validar y publicar" className="lg:col-span-2">
            <form action={validarFicha} className="flex flex-col gap-2">
              <input type="hidden" name="slug" value={slug} />
              <details>
                <summary className="cursor-pointer text-sm text-primario">Corregir la ficha antes de validar (JSON)</summary>
                <textarea name="ficha" defaultValue={JSON.stringify(f, null, 2)} rows={20} className="mt-2 w-full rounded-lg border border-borde bg-fondo p-2 font-mono text-xs" />
              </details>
              <BotonEnviar className="self-start bg-ok text-white">He revisado la ficha contra las bases: validar y publicar</BotonEnviar>
            </form>
          </Tarjeta>
        </div>
      )}
    </>
  );
}

function Lista({ children }: { children: ReactNode }) {
  return <ul className="mt-2 flex flex-col divide-y divide-borde">{children}</ul>;
}

function Item({ children, derecha }: { children: ReactNode; derecha: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <div>{children}</div>
      {derecha}
    </li>
  );
}

// Las llamadas a IA pueden tardar: límite ampliado en Vercel
export const maxDuration = 300;
