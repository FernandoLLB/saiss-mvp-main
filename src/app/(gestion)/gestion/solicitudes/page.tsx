import Link from "next/link";
import { ESTADO_SOLICITUD, Etiqueta, fecha, Tarjeta, Titulo } from "@/components/gestion/Ui";
import { tecnicoActual } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export default async function Solicitudes() {
  if (!(await tecnicoActual())) return null;
  const filas = await query<{ codigo: string; expediente: string | null; solicitante: string | null; titulo_es: string; estado: string; importe_estimado: string | null; actualizada_en: Date; docs: string; avisos: string }>(`
    SELECT s.codigo, s.expediente, s.solicitante, c.titulo_es, s.estado, s.importe_estimado, s.actualizada_en, count(d.id) AS docs,
           count(d.id) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(d.analisis->'comprobaciones') x WHERE x->>'resultado'='incidencia')) AS avisos
      FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria LEFT JOIN documento d ON d.solicitud=s.codigo
     GROUP BY s.codigo, c.titulo_es ORDER BY s.actualizada_en DESC`);
  return (
    <>
      <Titulo sub="Solicitudes recibidas y en preparación.">Solicitudes</Titulo>
      <Tarjeta>
        <div className="tabla-scroll">
<table className="tabla">
          <thead className="text-left text-tenue">
            <tr>
              <th>Código</th>
              <th>Solicitante</th>
              <th>Convocatoria</th>
              <th>Estado</th>
              <th className="num">Importe orientativo</th>
              <th>Documentos</th>
              <th>Actualizada</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((s) => (
              <tr key={s.codigo}>
                <td className="fijo">
                  <Link href={`/gestion/solicitudes/${s.codigo}`} className="font-mono font-bold text-primario hover:underline">
                    {s.expediente ?? s.codigo}
                  </Link>
                </td>
                <td>{s.solicitante ?? "—"}</td>
                <td className="text-tenue">{s.titulo_es}</td>
                <td>
                  <Etiqueta tono={ESTADO_SOLICITUD[s.estado]?.tono}>{ESTADO_SOLICITUD[s.estado]?.texto}</Etiqueta>
                </td>
                <td className="num">{s.importe_estimado ? EUR.format(Number(s.importe_estimado)) : "—"}</td>
                <td>
                  <span className="flex flex-wrap items-center gap-1.5"><span className="tabular-nums">{s.docs}</span> {Number(s.avisos) > 0 && <Etiqueta tono="error">{s.avisos} con avisos</Etiqueta>}</span>
                </td>
                <td className="fijo text-tenue">{fecha(s.actualizada_en)}</td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </Tarjeta>
    </>
  );
}
