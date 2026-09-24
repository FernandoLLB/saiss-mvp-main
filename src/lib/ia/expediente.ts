import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { one, query } from "@/lib/db";
import { anthropic, parametrosModelo, MODELO, registrarEvento } from "@/lib/ia/cliente";
import type { Analisis } from "@/lib/ia/documento";
import { EXPEDIENTE_VERSION, SISTEMA_EXPEDIENTE } from "@/lib/ia/prompts";
import type { Ficha } from "@/lib/kb/ficha";

export const RevisionExpedienteSchema = z.object({
  resumen: z.string().describe("Estado del expediente en dos o tres frases para la persona técnica"),
  coherencias: z.array(
    z.object({
      comprobacion: z.string().describe("p. ej. 'Factura W-0088 ↔ justificante de pago', 'NIF coincidente en todos los documentos'"),
      resultado: z.enum(["coherente", "incoherente", "no_verificable"]),
      documentos: z.array(z.number().int()).describe("ids de los documentos implicados"),
      detalle: z.string(),
    }),
  ),
  avisos_resueltos: z
    .array(z.object({ documento: z.number().int(), aviso: z.string(), resuelto_por: z.number().int(), explicacion: z.string() }))
    .describe("Avisos de un documento que otro documento del expediente ya resuelve"),
  gastos: z.object({
    total_base_subvencionable: z.number().describe("Suma de bases imponibles subvencionables con justificante de pago válido"),
    total_base_dudosa: z.number(),
    total_base_no_subvencionable: z.number(),
    cubre_importe_solicitado: z.enum(["si", "no", "no_verificable"]),
    explicacion: z.string(),
  }),
  pendientes: z.array(z.string()).describe("Lo que falta o hay que subsanar, priorizado"),
});

export type RevisionExpediente = z.infer<typeof RevisionExpedienteSchema>;

// Revisión cruzada: contrasta los análisis de todos los documentos entre sí y con los datos declarados.
// Trabaja sobre los datos ya extraídos (sin volver a leer los ficheros), por lo que es rápida y barata.
export async function revisarExpediente(codigo: string) {
  const inicio = Date.now();
  const sol = await one<{ convocatoria: string; datos: Record<string, unknown>; importe_estimado: string | null; ficha: Ficha }>(
    "SELECT s.convocatoria, s.datos, s.importe_estimado, c.ficha FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria WHERE s.codigo=$1",
    [codigo],
  );
  if (!sol) throw new Error("Solicitud no encontrada");
  const docs = await query<{ id: number; nombre: string; analisis: Analisis | null; revision: string; revision_nota: string | null }>(
    "SELECT id, nombre, analisis, revision, revision_nota FROM documento WHERE solicitud=$1 ORDER BY id",
    [codigo],
  );

  const mensaje = await anthropic.beta.messages
    .stream({
      max_tokens: 16000,
      ...parametrosModelo("medium", betaZodOutputFormat(RevisionExpedienteSchema)),
      system: SISTEMA_EXPEDIENTE,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            reglas: { documentos: sol.ficha.documentos.map(({ id, nombre, obligatoriedad, condicion, momento }) => ({ id, nombre, obligatoriedad, condicion, momento })), gastos: sol.ficha.gastos, cuantia: sol.ficha.cuantia },
            datos_declarados: sol.datos,
            importe_orientativo_solicitado: sol.importe_estimado,
            documentos: docs.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              tipo: d.analisis?.tipo_documento_nombre,
              datos: d.analisis?.datos,
              comprobaciones: d.analisis?.comprobaciones,
              gastos: d.analisis?.gastos,
              decision_tecnica: d.revision === "pendiente" ? null : { decision: d.revision, nota: d.revision_nota },
            })),
          }),
        },
      ],
    })
    .finalMessage();

  const revision = mensaje.parsed_output;
  const eventoId = await registrarEvento({
    tipo: "revision_expediente",
    convocatoria: sol.convocatoria,
    solicitud: codigo,
    promptVersion: EXPEDIENTE_VERSION,
    entradaResumen: `${docs.length} documentos`,
    salida: revision ?? undefined,
    mensaje,
    inicio,
    error: revision ? undefined : `sin revisión (${mensaje.stop_reason})`,
  });
  if (!revision) throw new Error("No se pudo revisar el expediente");
  await query("UPDATE solicitud SET revision_cruzada=$1, revision_cruzada_en=now(), revision_cruzada_evento=$2 WHERE codigo=$3", [JSON.stringify(revision), eventoId, codigo]);
  return revision;
}
