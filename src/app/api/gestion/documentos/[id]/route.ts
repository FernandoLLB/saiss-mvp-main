import fs from "node:fs/promises";
import { tecnicoActual } from "@/lib/auth";
import { one } from "@/lib/db";

// Acceso al fichero original solo para personal técnico autenticado
export async function GET(_req: Request, { params }: RouteContext<"/api/gestion/documentos/[id]">) {
  if (!(await tecnicoActual())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const doc = await one<{ ruta: string; mime: string; nombre: string; contenido: Buffer | null }>("SELECT ruta, mime, nombre, contenido FROM documento WHERE id=$1", [Number(id)]);
  if (!doc) return new Response("No encontrado", { status: 404 });
  return new Response(new Uint8Array(doc.contenido ?? (await fs.readFile(doc.ruta))), {
    headers: { "content-type": doc.mime, "content-disposition": `inline; filename="${encodeURIComponent(doc.nombre)}"`, "cache-control": "private, no-store" },
  });
}
