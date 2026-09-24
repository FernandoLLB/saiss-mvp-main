import Link from "next/link";
import { Etiqueta, fecha, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Convocatorias() {
  if (!(await tecnicoActual())) return null;
  const filas = await query<{ slug: string; titulo_es: string; estado: string; ficha_version: number; validada_por: string | null; validada_en: Date | null; documentos: string; fragmentos: string }>(`
    SELECT c.slug, c.titulo_es, c.estado, c.ficha_version, c.validada_por, c.validada_en,
           count(DISTINCT d.id) AS documentos, count(f.id) AS fragmentos
      FROM convocatoria c LEFT JOIN kb_documento d ON d.convocatoria=c.slug LEFT JOIN kb_fragmento f ON f.documento=d.id
     GROUP BY c.slug ORDER BY c.slug`);
  const publicadas = filas.filter((c) => c.estado === "publicada");
  const archivadas = filas.filter((c) => c.estado !== "publicada");
  const tarjeta = (c: (typeof filas)[number]) => (
          <Tarjeta key={c.slug} titulo={<Link href={`/gestion/convocatorias/${c.slug}`} className="text-primario hover:underline">{c.titulo_es}</Link>}>
            <p className="text-sm text-tenue">
              {c.documentos} documentos · {c.fragmentos} fragmentos citables · ficha v{c.ficha_version}
            </p>
            <p className="mt-2">
              {c.validada_en ? (
                <Etiqueta tono="ok">
                  Validada por {c.validada_por} · {fecha(c.validada_en)}
                </Etiqueta>
              ) : (
                <Etiqueta tono="aviso">Ficha pendiente de validar</Etiqueta>
              )}
            </p>
          </Tarjeta>
  );
  return (
    <>
      <Titulo sub="Base de conocimiento: documentos oficiales y ficha estructurada validada por el equipo técnico.">Convocatorias</Titulo>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{publicadas.map(tarjeta)}</div>
      {archivadas.length > 0 && (
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer text-tenue hover:text-primario">Convocatorias archivadas ({archivadas.length}) · no visibles para la ciudadanía</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 opacity-80">{archivadas.map(tarjeta)}</div>
        </details>
      )}
    </>
  );
}
