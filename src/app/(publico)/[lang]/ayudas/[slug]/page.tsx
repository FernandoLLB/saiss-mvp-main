import Link from "next/link";
import { notFound } from "next/navigation";
import { PestanasConvocatoria } from "@/components/PestanasConvocatoria";
import { one, query } from "@/lib/db";
import { eur, esIdioma, t } from "@/lib/i18n";
import type { Ficha } from "@/lib/kb/ficha";

export const dynamic = "force-dynamic";

type Conv = {
  slug: string;
  titulo_es: string;
  titulo_eu: string | null;
  resumen_es: string | null;
  resumen_eu: string | null;
  fuente_url: string | null;
  ficha: Ficha | null;
  validada_en: Date | null;
};

export default async function PaginaConvocatoria({ params }: PageProps<"/[lang]/ayudas/[slug]">) {
  const { lang, slug } = await params;
  if (!esIdioma(lang)) notFound();
  const tx = t(lang);
  const c = await one<Conv>(
    "SELECT slug, titulo_es, titulo_eu, resumen_es, resumen_eu, fuente_url, ficha, validada_en FROM convocatoria WHERE slug=$1 AND estado='publicada'",
    [slug],
  );
  if (!c) notFound();
  const bases = await query<{ fichero: string; titulo: string }>(
    "SELECT fichero, titulo FROM kb_documento WHERE convocatoria=$1 AND validado ORDER BY (tipo='bases') DESC, id",
    [slug],
  );
  // Solo la ficha validada por una persona técnica se muestra a la ciudadanía
  const ficha = c.validada_en ? c.ficha : null;
  const titulo = (lang === "eu" && c.titulo_eu) || c.titulo_es;
  const plazo = ficha?.plazos[0];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
      <Link href={`/${lang}`} className="text-sm text-primario hover:underline">
        ← {tx.volver}
      </Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{titulo}</h1>
          <p className="mt-2 text-tenue">{(lang === "eu" && c.resumen_eu) || c.resumen_es}</p>
        </div>
        <dl className="rounded-xl border border-borde bg-superficie p-4 text-sm self-start">
          {ficha?.cuantia.maximo ? (
            <>
              <dt className="text-tenue">{tx.puedoImporte}</dt>
              <dd className="text-2xl font-bold text-primario">
                {tx.importeMax} {eur(ficha.cuantia.maximo, lang)}
              </dd>
            </>
          ) : null}
          {plazo && (
            <>
              <dt className="mt-2 text-tenue">{tx.plazo}</dt>
              <dd>{(lang === "eu" && plazo.plazo_eu) || plazo.plazo}</dd>
            </>
          )}
          <dt className="mt-2 text-tenue">{tx.fuenteOficial}</dt>
          <dd>
            <ul>
              {(bases.filter((b) => (lang === "eu" ? /euskara|EUS/i.test(b.titulo + b.fichero) : !/euskara|EUS/i.test(b.titulo + b.fichero))).slice(0, 1).length ? bases.filter((b) => (lang === "eu" ? /euskara|EUS/i.test(b.titulo + b.fichero) : !/euskara|EUS/i.test(b.titulo + b.fichero))) : bases).slice(0, 1).map((b) => (
                <li key={b.fichero}>
                  <a href={`/api/kb/${b.fichero}`} target="_blank" rel="noreferrer" className="text-primario hover:underline">
                    {b.titulo} (PDF)
                  </a>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </div>
      <div className="mt-6">
        <PestanasConvocatoria slug={slug} ficha={ficha} idioma={lang} tx={tx} />
      </div>
    </div>
  );
}
