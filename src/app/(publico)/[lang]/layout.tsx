import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../globals.css";
import { esIdioma, IDIOMAS, t } from "@/lib/i18n";

const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata: Metadata = {
  title: "SAISS · Servicio de Atención Inteligente",
  description: "Atención y tramitación de ayudas y subvenciones con asistencia inteligente.",
};

export function generateStaticParams() {
  return IDIOMAS.map((lang) => ({ lang }));
}

export default async function LayoutPublico({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!esIdioma(lang)) notFound();
  const tx = t(lang);
  const otro = lang === "es" ? "eu" : "es";

  return (
    <html lang={lang} className={`${atkinson.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 bg-superficie px-3 py-2 rounded">
          {tx.saltar}
        </a>
        <header className="bg-primario text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <Link href={`/${lang}`} className="flex items-baseline gap-2 no-underline">
              <span className="text-xl font-bold tracking-wide">{tx.marca}</span>
              <span className="hidden sm:inline text-white/85">{tx.marcaLarga}</span>
            </Link>
            <Link
              href={`/${otro}`}
              hrefLang={otro}
              lang={otro}
              className="rounded-full border border-white/60 px-3 py-1 text-sm hover:bg-white/10"
            >
              {tx.otroIdioma}
            </Link>
          </div>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-borde bg-superficie">
          <p className="mx-auto max-w-6xl px-4 sm:px-6 py-4 text-sm text-tenue">{tx.avisoIA}</p>
        </footer>
      </body>
    </html>
  );
}
