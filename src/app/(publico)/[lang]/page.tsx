import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { eur, esIdioma, t } from "@/lib/i18n";
import type { Ficha } from "@/lib/kb/ficha";

export const dynamic = "force-dynamic";

type Fila = { slug: string; titulo_es: string; titulo_eu: string | null; resumen_es: string | null; resumen_eu: string | null; ficha: Ficha | null };

export default async function Inicio({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!esIdioma(lang)) notFound();
  const tx = t(lang);
  const convocatorias = await query<Fila>(
    "SELECT slug, titulo_es, titulo_eu, resumen_es, resumen_eu, CASE WHEN validada_en IS NOT NULL THEN ficha END AS ficha FROM convocatoria WHERE estado='publicada' ORDER BY creada_en, slug",
  );

  return (
    <>
      <section className="bg-primario-suave border-b border-borde">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-bold max-w-2xl">{tx.inicioTitulo}</h1>
          <p className="mt-3 text-lg text-tenue max-w-2xl">{tx.inicioSub}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8" aria-labelledby="titulo-convocatorias">
        <h2 id="titulo-convocatorias" className="text-xl font-bold mb-4">
          {tx.convocatoriasAbiertas}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {convocatorias.map((c) => {
            const titulo = (lang === "eu" && c.titulo_eu) || c.titulo_es;
            const resumen = (lang === "eu" && c.resumen_eu) || c.resumen_es;
            return (
              <li key={c.slug} className="rounded-xl border border-borde bg-superficie p-5 flex flex-col">
                <h3 className="text-lg font-bold leading-snug">{titulo}</h3>
                {resumen && <p className="mt-2 text-tenue flex-1">{resumen}</p>}
                {c.ficha?.cuantia.maximo ? (
                  <p className="mt-3 font-bold text-primario">
                    {tx.importeMax} {eur(c.ficha.cuantia.maximo, lang)}
                  </p>
                ) : null}
                <Link
                  href={`/${lang}/ayudas/${c.slug}`}
                  className="mt-4 self-start rounded-lg bg-primario px-4 py-2 font-bold text-white hover:bg-primario-oscuro"
                >
                  {tx.verAyuda}
                  <span className="sr-only">: {titulo}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
