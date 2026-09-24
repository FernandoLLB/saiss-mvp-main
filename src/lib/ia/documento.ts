import fs from "node:fs/promises";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, parametrosModelo, MODELO, registrarEvento, type Origen } from "@/lib/ia/cliente";
import { DOCUMENTO_VERSION, SISTEMA_DOCUMENTO } from "@/lib/ia/prompts";
import type { Ficha } from "@/lib/kb/ficha";

export const AnalisisSchema = z.object({
  tipo_documento_id: z.string().describe("id del documento de la ficha, u 'otro'"),
  tipo_documento_nombre: z.string(),
  confianza: z.number().describe("0 a 1: seguridad en la identificación del tipo"),
  legible: z.boolean(),
  resumen: z.string().describe("Una frase: qué es y de quién/qué trata, sin datos personales innecesarios"),
  fecha_emision: z.string().nullable().describe("Fecha de emisión o firma del documento, AAAA-MM-DD"),
  datos: z.array(z.object({ campo: z.string(), valor: z.string() })).describe("Datos relevantes para la revisión"),
  comprobaciones: z.array(
    z.object({
      comprobacion: z.string(),
      resultado: z.enum(["correcto", "incidencia", "no_verificable"]),
      detalle: z.string(),
      referencia: z.string().nullable().describe("Artículo y página de las bases que la fundamenta, p. ej. 'Art. 6, pág. 11'"),
    }),
  ),
  gastos: z
    .array(
      z.object({
        concepto: z.string(),
        fecha: z.string().nullable().describe("AAAA-MM-DD"),
        base_imponible: z.number().nullable(),
        forma_pago: z.string().nullable(),
        pagada: z.boolean().nullable().describe("true si consta el pago total"),
        es_cuota_autonomos: z.boolean(),
        es_obra_local: z.boolean(),
        categoria: z.string().nullable().describe("constitucion · inversion · alquiler · obras · comunicacion · formacion · nomina · cuota · mercancia · fungible · suministro · viaje · asesoria · fianza · otro"),
        subvencionable: z.enum(["si", "no", "dudoso"]),
        motivo: z.string(),
      }),
    )
    .describe("Solo para facturas o justificantes de gasto; vacío en otros documentos"),
  valoracion_innovador: z
    .object({
      innovacion_viabilidad: z.number().int().describe("0 a 30"),
      idi_tecnologia: z.number().int().describe("0 a 20"),
      justificacion: z.string(),
    })
    .nullable()
    .describe("Solo para la memoria del proyecto innovador; null en el resto"),
  mensaje_solicitante_es: z.string().describe("Aviso breve y claro para la persona solicitante sobre este documento"),
  mensaje_solicitante_eu: z.string(),
});

export type IncidenciaRegla = { regla: string; art: string; texto_es: string; texto_eu: string; detalle: string };

export type Analisis = z.infer<typeof AnalisisSchema>;

const MIME_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function analizarDocumento(opts: {
  ruta: string;
  mime: string;
  nombre: string;
  ficha: Ficha;
  convocatoria: string;
  solicitud: string | null;
  datosSolicitud: Record<string, unknown>;
  tipoDeclarado?: string | null;
  origen?: Origen;
}) {
  const inicio = Date.now();
  const datos = (await fs.readFile(opts.ruta)).toString("base64");
  let bloque: Anthropic.Beta.BetaContentBlockParam;
  if (opts.mime === "application/pdf") {
    bloque = { type: "document", source: { type: "base64", media_type: "application/pdf", data: datos }, title: opts.nombre };
  } else if ((MIME_IMAGEN as readonly string[]).includes(opts.mime)) {
    bloque = { type: "image", source: { type: "base64", media_type: opts.mime as (typeof MIME_IMAGEN)[number], data: datos } };
  } else {
    throw new Error("Formato no admitido");
  }

  // Contexto estable (ficha validada) antes del documento: se cachea entre documentos de la misma convocatoria
  const contextoFicha = JSON.stringify({
    documentos: opts.ficha.documentos.map(({ id, nombre, descripcion, condicion, comprobaciones, cita }) => ({ id, nombre, descripcion, condicion, comprobaciones, cita })),
    gastos: opts.ficha.gastos,
    requisitos: opts.ficha.requisitos.filter((r) => r.tipo !== "compromiso").map(({ id, texto, cita }) => ({ id, texto, cita })),
  });

  const peticion = () =>
    anthropic.beta.messages.stream({
      max_tokens: 16000,
      ...parametrosModelo("medium", betaZodOutputFormat(AnalisisSchema)),
      system: SISTEMA_DOCUMENTO,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `<ficha_convocatoria>\n${contextoFicha}\n</ficha_convocatoria>`, cache_control: { type: "ephemeral" } },
            { type: "text", text: `<datos_solicitud>\n${JSON.stringify(opts.datosSolicitud)}\n</datos_solicitud>` },
            bloque,
            {
            type: "text",
            text: `Documento aportado: «${opts.nombre}».${opts.tipoDeclarado ? ` La persona lo ha subido como «${opts.tipoDeclarado}»; si no coincide con lo que es, indícalo.` : ""} Analízalo.`,
          },
          ],
        },
      ],
    });

  // Si una salida no supera la validación del esquema (p. ej. servida por el modelo de respaldo), se reintenta una vez
  let mensaje;
  try {
    mensaje = await peticion().finalMessage();
  } catch (e) {
    if (!(e instanceof Error && e.message.includes("Failed to parse structured output"))) throw e;
    mensaje = await peticion().finalMessage();
  }
  const analisis = mensaje.parsed_output;
  const eventoId = await registrarEvento({
    tipo: "clasificacion_documento",
    origen: opts.origen,
    convocatoria: opts.convocatoria,
    solicitud: opts.solicitud,
    promptVersion: DOCUMENTO_VERSION,
    entradaResumen: `${opts.nombre} (${opts.mime})`,
    salida: analisis ?? undefined,
    mensaje,
    inicio,
    error: analisis ? undefined : `sin análisis (${mensaje.stop_reason})`,
  });
  return { analisis, eventoId, mensaje };
}
