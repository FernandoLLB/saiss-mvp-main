import type { Metadata } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import "../../globals.css";
import { cerrarSesion, iniciarSesion, tecnicoActual } from "@/lib/auth";

const atkinson = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-atkinson" });

export const metadata: Metadata = { title: "SAISS · Panel técnico" };

async function entrar(formData: FormData) {
  "use server";
  const ok = await iniciarSesion(String(formData.get("nombre") ?? ""), String(formData.get("pin") ?? ""));
  redirect(ok ? "/gestion" : "/gestion?error=1");
}

async function salir() {
  "use server";
  await cerrarSesion();
  redirect("/gestion");
}

const NAV = [
  ["/gestion", "Resumen"],
  ["/gestion/solicitudes", "Solicitudes"],
  ["/gestion/convocatorias", "Convocatorias"],
  ["/gestion/conversaciones", "Conversaciones"],
  ["/gestion/actividad", "Registro de IA"],
] as const;

export default async function LayoutGestion({ children }: LayoutProps<"/gestion">) {
  const tecnico = await tecnicoActual();

  return (
    <html lang="es" className={`${atkinson.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="bg-tinta text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <Link href="/gestion" className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-wide">SAISS</span>
              <span className="text-white/80">Panel técnico</span>
            </Link>
            {tecnico && (
              <form action={salir} className="flex items-center gap-3 text-sm">
                <span className="text-white/80">{tecnico}</span>
                <button className="rounded border border-white/40 px-2 py-0.5 hover:bg-white/10">Salir</button>
              </form>
            )}
          </div>
          {tecnico && (
            <nav aria-label="Panel técnico" className="mx-auto max-w-7xl px-4 sm:px-6 flex gap-1 overflow-x-auto">
              {NAV.map(([href, etiqueta]) => (
                <Link key={href} href={href} className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white">
                  {etiqueta}
                </Link>
              ))}
            </nav>
          )}
        </header>
        <main className="flex-1">
          {tecnico ? (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">{children}</div>
          ) : (
            <form action={entrar} className="mx-auto mt-16 flex max-w-sm flex-col gap-3 rounded-xl border border-borde bg-superficie p-6">
              <h1 className="text-xl font-bold">Acceso del equipo técnico</h1>
              <label className="text-sm font-bold" htmlFor="nombre">
                Nombre
              </label>
              <input id="nombre" name="nombre" required autoComplete="name" className="rounded-lg border border-borde bg-fondo px-3 py-2" />
              <label className="text-sm font-bold" htmlFor="pin">
                PIN
              </label>
              <input id="pin" name="pin" type="password" required inputMode="numeric" className="rounded-lg border border-borde bg-fondo px-3 py-2" />
              <button className="mt-2 rounded-lg bg-primario py-2.5 font-bold text-white">Entrar</button>
              <p className="text-xs text-tenue">Cada decisión queda registrada con tu nombre.</p>
            </form>
          )}
        </main>
      </body>
    </html>
  );
}
