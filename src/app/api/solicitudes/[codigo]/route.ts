import { z } from "zod";
import { one } from "@/lib/db";
import { evaluar } from "@/lib/kb/calculo";
import { codigoExpediente, cuantiaDesdeDatos } from "@/lib/reglas/creacion2025";
import type { Ficha } from "@/lib/kb/ficha";

const Datos = z.object({
  solicitante: z.string().max(200).optional(),
  nif: z.string().max(20).optional(),
  forma: z.enum(["autonomo", "sociedad"]).optional(),
  fecha_alta_iae: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  via_empleo: z.enum(["alta_reta", "mutualidad", "contrato_indefinido"]).optional(),
  local: z.boolean().optional(),
  hipoteca: z.boolean().optional(),
  innovador_via: z.enum(["programa", "memoria"]).optional(),
  incrementos: z.array(z.string()).optional(),
});

const Entrada = z.object({ datos: Datos.optional(), presentar: z.boolean().optional() });

export async function PATCH(req: Request, { params }: RouteContext<"/api/solicitudes/[codigo]">) {
  const { codigo } = await params;
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Datos no válidos" }, { status: 400 });
  const sol = await one<{ datos: z.infer<typeof Datos>; estado: string; ficha: Ficha | null }>(
    "SELECT s.datos, s.estado, c.ficha FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria WHERE s.codigo=$1",
    [codigo],
  );
  if (!sol) return Response.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (!["borrador", "requerimiento"].includes(sol.estado)) return Response.json({ error: "La solicitud ya está presentada" }, { status: 409 });

  const datos = { ...sol.datos, ...parsed.data.datos, alta_reta: (parsed.data.datos?.via_empleo ?? sol.datos.via_empleo) === "alta_reta" };
  // Importe orientativo con las reglas deterministas de la convocatoria (bloque B)
  const importe = sol.ficha
    ? (cuantiaDesdeDatos(sol.ficha, datos)?.importe ??
      evaluar(sol.ficha, {}, Object.fromEntries((datos.incrementos ?? []).map((i) => [i, "si" as const])), datos.local ? "si" : "no").importe)
    : null;
  const presentar = parsed.data.presentar === true;
  const nuevoEstado = presentar ? (sol.estado === "requerimiento" ? "en_revision" : "presentada") : sol.estado;
  // Al finalizar la solicitud se asigna el código de expediente (XXXX/AAAA/XXXX) y arranca el plazo de resolución
  const expediente = presentar && sol.estado === "borrador" ? codigoExpediente(Number((await one<{ n: string }>("SELECT count(*) AS n FROM solicitud WHERE expediente IS NOT NULL"))!.n) + 1) : null;

  const fila = await one(
    `UPDATE solicitud SET datos=$1, solicitante=$2, importe_estimado=$3, estado=$4, actualizada_en=now(),
       expediente = COALESCE(expediente, $6), presentada_en = CASE WHEN $7 AND presentada_en IS NULL THEN now() ELSE presentada_en END
     WHERE codigo=$5 RETURNING codigo, estado, importe_estimado, expediente`,
    [JSON.stringify(datos), datos.solicitante ?? null, importe, nuevoEstado, codigo, expediente, presentar],
  );
  return Response.json(fila);
}
