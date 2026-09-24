import Link from "next/link";
import { notFound } from "next/navigation";
import { SolicitudGuiada } from "@/components/SolicitudGuiada";
import { one, query } from "@/lib/db";
import { esIdioma, t } from "@/lib/i18n";
import type { Analisis } from "@/lib/ia/documento";
import type { Ficha } from "@/lib/kb/ficha";

export const dynamic = "force-dynamic";

export default async function PaginaSolicitud({ params }: PageProps<"/[lang]/solicitud/[codigo]">) {
  const { lang, codigo } = await params;
  if (!esIdioma(lang)) notFound();
  const tx = t(lang);
  const sol = await one<{
    codigo: string;
    expediente: string | null;
    convocatoria: string;
    estado: string;
    datos: Record<string, unknown>;
    importe_estimado: string | null;
    titulo_es: string;
    titulo_eu: string | null;
    ficha: Ficha | null;
  }>(
    `SELECT s.codigo, s.expediente, s.convocatoria, s.estado, s.datos, s.importe_estimado, c.titulo_es, c.titulo_eu, c.ficha
       FROM solicitud s JOIN convocatoria c ON c.slug = s.convocatoria WHERE s.codigo=$1`,
    [codigo],
  );
  if (!sol || !sol.ficha) notFound();
  const documentos = await query<{ id: number; nombre: string; tipo_detectado: string | null; analisis: Analisis | null; revision: string }>(
    "SELECT id, nombre, tipo_detectado, analisis, revision FROM documento WHERE solicitud=$1 ORDER BY id",
    [codigo],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
      <Link href={`/${lang}/ayudas/${sol.convocatoria}`} className="text-sm text-primario hover:underline">
        ← {(lang === "eu" && sol.titulo_eu) || sol.titulo_es}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold">{tx.solTitulo}</h1>
        <p className="rounded-lg border border-borde bg-superficie px-3 py-1.5 text-sm">
          {tx.solCodigo}: <strong className="font-mono">{sol.codigo}</strong>
          <span className="block text-xs text-tenue">{tx.solGuardaCodigo}</span>
        </p>
      </div>
      <SolicitudGuiada
        codigo={sol.codigo}
        expediente={sol.expediente}
        estadoInicial={sol.estado}
        datosIniciales={sol.datos}
        documentosIniciales={documentos}
        ficha={sol.ficha}
        idioma={lang}
        tx={tx}
      />
    </div>
  );
}
