import { z } from "zod";
import { query } from "@/lib/db";

const Entrada = z.object({ mensajeId: z.number().int(), valor: z.union([z.literal(1), z.literal(-1)]) });

export async function POST(req: Request) {
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  await query("UPDATE mensaje SET valoracion=$1 WHERE id=$2 AND rol='assistant'", [parsed.data.valor, parsed.data.mensajeId]);
  return Response.json({ ok: true });
}
