import crypto from "node:crypto";
import { z } from "zod";
import { one } from "@/lib/db";

const Entrada = z.object({ convocatoria: z.string(), idioma: z.enum(["es", "eu"]) });

export async function POST(req: Request) {
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const conv = await one("SELECT 1 FROM convocatoria WHERE slug=$1 AND estado='publicada'", [parsed.data.convocatoria]);
  if (!conv) return Response.json({ error: "Convocatoria no disponible" }, { status: 404 });
  // Código no adivinable: da acceso al expediente en el prototipo (en producción, identificación electrónica)
  const codigo = `S26-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await one("INSERT INTO solicitud (codigo, convocatoria, idioma) VALUES ($1,$2,$3) RETURNING codigo", [
    codigo,
    parsed.data.convocatoria,
    parsed.data.idioma,
  ]);
  return Response.json({ codigo });
}
