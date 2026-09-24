import Link from "next/link";
import { Etiqueta, fecha, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const TIPOS = ["chat", "clasificacion_documento", "revision_expediente", "ficha_convocatoria", "requerimiento", "derivacion", "evaluacion"];
const DECISION = { aceptada: "ok", corregida: "aviso", rechazada: "error" } as const;

export default async function Actividad({ searchParams }: PageProps<"/gestion/actividad">) {
  if (!(await tecnicoActual())) return null;
  const { tipo } = await searchParams;
  const filtro = typeof tipo === "string" && TIPOS.includes(tipo) ? tipo : null;
  const eventos = await query<{
    id: number;
    tipo: string;
    convocatoria: string | null;
    solicitud: string | null;
    modelo: string;
    modelo_servido: string | null;
    prompt_version: string;
    entrada_resumen: string | null;
    salida: unknown;
    fuentes: unknown;
    tokens_entrada: number | null;
    tokens_salida: number | null;
    tokens_cache_lectura: number | null;
    latencia_ms: number | null;
    coste_usd: string | null;
    error: string | null;
    decision_humana: keyof typeof DECISION | null;
    decision_por: string | null;
    creado_en: Date;
  }>(
    `SELECT * FROM evento_ia ${filtro ? "WHERE tipo=$1" : ""} ORDER BY id DESC LIMIT 200`,
    filtro ? [filtro] : [],
  );

  return (
    <>
      <Titulo sub="Trazabilidad de cada uso de IA: modelo, versión de instrucciones, fuentes, coste y decisión humana posterior. Base para auditoría y obligaciones del AI Act.">Registro de IA</Titulo>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link href="/gestion/actividad" className={`rounded-full border px-3 py-1 ${!filtro ? "border-primario bg-primario text-white" : "border-borde"}`}>
          Todos
        </Link>
        {TIPOS.map((t) => (
          <Link key={t} href={`/gestion/actividad?tipo=${t}`} className={`rounded-full border px-3 py-1 ${filtro === t ? "border-primario bg-primario text-white" : "border-borde"}`}>
            {t.replaceAll("_", " ")}
          </Link>
        ))}
      </div>
      <Tarjeta>
        <div className="tabla-scroll">
<table className="tabla arriba">
          <thead className="text-left text-tenue">
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Modelo · instrucciones</th>
              <th className="num">Tokens (caché)</th>
              <th className="num">Latencia</th>
              <th className="num">Coste</th>
              <th>Decisión humana</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id}>
                <td className="num text-tenue">{e.id}</td>
                <td className="fijo text-tenue">{fecha(e.creado_en)}</td>
                <td>
                  <Etiqueta tono={e.error ? "error" : "info"}>{e.tipo.replaceAll("_", " ")}</Etiqueta>
                  {e.solicitud && (
                    <Link href={`/gestion/solicitudes/${e.solicitud}`} className="block font-mono text-xs text-primario hover:underline">
                      {e.solicitud}
                    </Link>
                  )}
                </td>
                <td className="w-full max-w-md">
                  <details>
                    <summary className="cursor-pointer">{e.entrada_resumen?.slice(0, 90) ?? "—"}</summary>
                    {e.error && <p className="text-error">{e.error}</p>}
                    {Boolean(e.fuentes) && <pre className="mt-1 max-h-40 overflow-auto rounded bg-fondo p-2 text-xs">{JSON.stringify(e.fuentes, null, 1)}</pre>}
                    {Boolean(e.salida) && <pre className="mt-1 max-h-60 overflow-auto rounded bg-fondo p-2 text-xs">{JSON.stringify(e.salida, null, 1)}</pre>}
                  </details>
                </td>
                <td className="fijo text-xs">
                  {(e.modelo_servido ?? e.modelo).replace(/-\d{8}$/, "")}
                  <span className="block text-tenue">{e.prompt_version}</span>
                </td>
                <td className="num text-xs">
                  {e.tokens_entrada ?? "—"} / {e.tokens_salida ?? "—"}
                  {e.tokens_cache_lectura ? <span className="block text-ok">{e.tokens_cache_lectura} caché</span> : null}
                </td>
                <td className="num">{e.latencia_ms ? `${(e.latencia_ms / 1000).toFixed(1)} s` : "—"}</td>
                <td className="num">{e.coste_usd ? `${Number(e.coste_usd).toFixed(3)}\u00a0$` : "—"}</td>
                <td>{e.decision_humana ? <Etiqueta tono={DECISION[e.decision_humana]}>{`${e.decision_humana} · ${e.decision_por}`}</Etiqueta> : <span className="text-tenue">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Tarjeta>
    </>
  );
}
