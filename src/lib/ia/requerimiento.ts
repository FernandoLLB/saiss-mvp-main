import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, parametrosModelo, MODELO, registrarEvento } from "@/lib/ia/cliente";
import { REQUERIMIENTO_VERSION, SISTEMA_REQUERIMIENTO } from "@/lib/ia/prompts";
import type { Ficha } from "@/lib/kb/ficha";

const RequerimientoSchema = z.object({
  asunto_es: z.string(),
  asunto_eu: z.string(),
  cuerpo_es: z.string(),
  cuerpo_eu: z.string(),
});

export type Incidencia = { documento: string; detalle: string; referencia: string | null };

export async function redactarRequerimiento(opts: {
  solicitud: string;
  convocatoria: string;
  tituloConvocatoria: string;
  solicitante: string | null;
  ficha: Ficha;
  incidencias: Incidencia[];
  faltan: string[];
}) {
  const inicio = Date.now();
  const stream = anthropic.beta.messages.stream({
    max_tokens: 16000,
    ...parametrosModelo("medium", betaZodOutputFormat(RequerimientoSchema)),
    system: SISTEMA_REQUERIMIENTO,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          convocatoria: opts.tituloConvocatoria,
          solicitud: opts.solicitud,
          solicitante: opts.solicitante,
          subsanacion: opts.ficha.subsanacion,
          documentacion_no_aportada: opts.faltan,
          incidencias_validadas: opts.incidencias,
        }),
      },
    ],
  });
  const mensaje = await stream.finalMessage();
  const borrador = mensaje.parsed_output;
  const eventoId = await registrarEvento({
    tipo: "requerimiento",
    convocatoria: opts.convocatoria,
    solicitud: opts.solicitud,
    promptVersion: REQUERIMIENTO_VERSION,
    entradaResumen: `${opts.incidencias.length} incidencias, ${opts.faltan.length} documentos no aportados`,
    salida: borrador ?? undefined,
    mensaje,
    inicio,
    error: borrador ? undefined : `sin borrador (${mensaje.stop_reason})`,
  });
  if (!borrador) throw new Error("No se pudo redactar el borrador");
  return { borrador, eventoId };
}
