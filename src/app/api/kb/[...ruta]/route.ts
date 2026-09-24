import fs from "node:fs/promises";
import path from "node:path";
import { one } from "@/lib/db";

// Sirve los documentos oficiales de la base de conocimiento (solo los validados).
export async function GET(_req: Request, { params }: RouteContext<"/api/kb/[...ruta]">) {
  const { ruta } = await params;
  const relativo = ruta.map(decodeURIComponent).join("/");
  const doc = await one("SELECT 1 FROM kb_documento WHERE fichero=$1 AND validado", [relativo]);
  if (!doc) return new Response("No encontrado", { status: 404 });
  const base = path.resolve("data/kb");
  const absoluto = path.resolve(base, relativo);
  if (!absoluto.startsWith(base + path.sep)) return new Response("No encontrado", { status: 404 });
  const bytes = await fs.readFile(absoluto);
  return new Response(bytes, {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${path.basename(relativo)}"` },
  });
}
