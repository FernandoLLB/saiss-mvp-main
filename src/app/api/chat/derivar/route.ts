import { z } from "zod";
import { query } from "@/lib/db";

const Entrada = z.object({ conversacion: z.string().uuid().nullable(), convocatoria: z.string() });

// Derivación a persona: queda registrada para el panel de supervisión (y como métrica de cobertura del asistente).
export async function POST(req: Request) {
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });
  const { conversacion, convocatoria } = parsed.data;
  await query(
    `INSERT INTO evento_ia (tipo, convocatoria, modelo, prompt_version, entrada_resumen, salida)
     VALUES ('derivacion', $1, 'humano', '-', $2, $3)`,
    [convocatoria, conversacion, JSON.stringify({ motivo: "solicitud_persona" })],
  );
  return Response.json({ ok: true });
}
