import type { ReactNode } from "react";

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub && <p className="mt-1 text-tenue">{sub}</p>}
    </div>
  );
}

export function Tarjeta({ titulo, children, className = "" }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-borde bg-superficie p-4 ${className}`}>
      {titulo && <h2 className="mb-3 font-bold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: ReactNode; detalle?: ReactNode }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie p-4">
      <p className="text-sm text-tenue">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tenue">{detalle}</p>}
    </div>
  );
}

const TONOS = {
  neutro: "bg-fondo text-tinta border-borde",
  ok: "bg-ok-suave text-ok border-ok/30",
  aviso: "bg-aviso-suave text-aviso border-aviso/30",
  error: "bg-error-suave text-error border-error/30",
  info: "bg-primario-suave text-primario-oscuro border-primario/30",
} as const;

export function Etiqueta({ tono = "neutro", children }: { tono?: keyof typeof TONOS; children: ReactNode }) {
  return <span className={`inline-block h-fit shrink-0 self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${TONOS[tono]}`}>{children}</span>;
}

export const ESTADO_SOLICITUD: Record<string, { texto: string; tono: keyof typeof TONOS }> = {
  borrador: { texto: "Borrador", tono: "neutro" },
  presentada: { texto: "En revisión", tono: "info" },
  en_revision: { texto: "En revisión", tono: "info" },
  requerimiento: { texto: "Subsanación", tono: "aviso" },
  completa: { texto: "Completa", tono: "ok" },
  resuelta: { texto: "Resuelta", tono: "ok" },
  concedida: { texto: "Concedida", tono: "ok" },
  denegada: { texto: "Denegada", tono: "error" },
};

export function fecha(d: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));
}
