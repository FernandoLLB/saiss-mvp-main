import { z } from "zod";
import { ConvocatoriaNoDisponible, responder, type Segmento } from "@/lib/ia/chat";

const Entrada = z.object({
  conversacion: z.string().uuid().nullable(),
  convocatoria: z.string(),
  idioma: z.enum(["es", "eu"]),
  mensaje: z.string().trim().min(1).max(2000),
});

export type { Segmento };
export type EventoChat =
  | { t: "inicio"; conversacion: string }
  | { t: "texto"; v: string }
  | { t: "fin"; mensajeId: number; segmentos: Segmento[]; resultado: "respondida" | "sin_fuente" }
  | { t: "error"; v: string };

export async function POST(req: Request) {
  const parsed = Entrada.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Petición no válida" }, { status: 400 });

  const codificador = new TextEncoder();
  const cuerpo = new ReadableStream({
    async start(controller) {
      const enviar = (e: EventoChat) => controller.enqueue(codificador.encode(JSON.stringify(e) + "\n"));
      try {
        const r = await responder({
          ...parsed.data,
          alIniciar: (conversacion) => enviar({ t: "inicio", conversacion }),
          alTexto: (v) => enviar({ t: "texto", v }),
        });
        enviar({ t: "fin", mensajeId: r.mensajeId, segmentos: r.segmentos, resultado: r.resultado });
      } catch (e) {
        enviar({
          t: "error",
          v: e instanceof ConvocatoriaNoDisponible ? "Convocatoria no disponible." : "No he podido responder ahora mismo. Inténtalo de nuevo o contacta con FSS en el 943 482 800.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(cuerpo, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

// Las llamadas a IA pueden tardar: límite ampliado en Vercel
export const maxDuration = 300;
