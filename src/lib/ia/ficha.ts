import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { one, query } from "@/lib/db";
import { anthropic, costeUsd, parametrosModelo, MODELO, registrarEvento } from "@/lib/ia/cliente";
import { FICHA_VERSION, SISTEMA_FICHA } from "@/lib/ia/prompts";
import {
  FichaCuantiaSchema,
  FichaDocumentosSchema,
  FichaRequisitosSchema,
  FichaSchema,
  FichaTramitacionSchema,
  type Ficha,
} from "@/lib/kb/ficha";
import { fuentesConvocatoria, textoConMarcas } from "@/lib/kb/contexto";

const PARTES = [
  { nombre: "cuantía", schema: FichaCuantiaSchema, instruccion: "Extrae el objeto, las personas beneficiarias y la cuantía (importe base, máximo e incrementos con sus condiciones e incompatibilidades)." },
  { nombre: "requisitos", schema: FichaRequisitosSchema, instruccion: "Extrae todos los requisitos que debe cumplir la persona solicitante y las exclusiones." },
  { nombre: "documentos", schema: FichaDocumentosSchema, instruccion: "Extrae toda la documentación a presentar (en la solicitud y en la justificación), con las comprobaciones que debe hacer la persona técnica en cada documento." },
  { nombre: "tramitación", schema: FichaTramitacionSchema, instruccion: "Extrae las reglas de gastos subvencionables y excluidos, los plazos, el canal de presentación y la subsanación." },
] as const;

// Genera la ficha estructurada de una convocatoria a partir de sus documentos.
// Queda en borrador hasta que una persona de FSS la valida desde el panel de gestión.
export async function generarFicha(slug: string) {
  const inicio = Date.now();
  const conv = await one<{ titulo_es: string }>("SELECT titulo_es FROM convocatoria WHERE slug=$1", [slug]);
  if (!conv) throw new Error(`Convocatoria desconocida: ${slug}`);
  const documentos = await fuentesConvocatoria(slug);
  const contexto: Anthropic.Beta.BetaTextBlockParam = {
    type: "text",
    text: `Convocatoria: ${conv.titulo_es}\n\n${textoConMarcas(documentos)}`,
    cache_control: { type: "ephemeral" },
  };

  const extraer = async <S extends z.ZodType>(schema: S, instruccion: string) => {
    const stream = anthropic.beta.messages.stream({
      max_tokens: 32000,
      ...parametrosModelo("high", betaZodOutputFormat(schema)),
      system: SISTEMA_FICHA,
      messages: [{ role: "user", content: [contexto, { type: "text", text: instruccion }] }],
    });
    const mensaje = await stream.finalMessage();
    if (mensaje.stop_reason === "refusal" || !mensaje.parsed_output) {
      throw new Error(`No se pudo extraer (${mensaje.stop_reason})`);
    }
    return { datos: mensaje.parsed_output as z.infer<S>, mensaje };
  };

  // La primera parte escribe la caché de los documentos; las demás la leen en paralelo.
  const [primera, ...resto] = PARTES;
  const r0 = await extraer(primera.schema, primera.instruccion);
  const otras = await Promise.all(resto.map((p) => extraer(p.schema, p.instruccion)));
  const resultados = [r0, ...otras];

  const ficha: Ficha = FichaSchema.parse(Object.assign({}, ...resultados.map((r) => r.datos)));
  const mensajes = resultados.map((r) => r.mensaje);
  const ultimo = mensajes.at(-1)!;
  // Uso agregado de las cuatro llamadas para el registro de auditoría
  const usoTotal = mensajes.reduce(
    (u, m) => ({
      input_tokens: u.input_tokens + m.usage.input_tokens,
      output_tokens: u.output_tokens + m.usage.output_tokens,
      cache_read_input_tokens: (u.cache_read_input_tokens ?? 0) + (m.usage.cache_read_input_tokens ?? 0),
      cache_creation_input_tokens: (u.cache_creation_input_tokens ?? 0) + (m.usage.cache_creation_input_tokens ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  );

  const eventoId = await registrarEvento({
    tipo: "ficha_convocatoria",
    convocatoria: slug,
    promptVersion: FICHA_VERSION,
    entradaResumen: `${documentos.length} documentos, ${documentos.reduce((n, d) => n + d.fragmentos.length, 0)} fragmentos · ${PARTES.length} extracciones`,
    salida: ficha,
    fuentes: documentos.map((d) => d.fichero),
    mensaje: { ...ultimo, usage: { ...ultimo.usage, ...usoTotal } },
    inicio,
  });
  await query(
    `UPDATE convocatoria SET ficha=$1, ficha_version=ficha_version+1, validada_por=NULL, validada_en=NULL WHERE slug=$2`,
    [JSON.stringify(ficha), slug],
  );
  return { ficha, eventoId, costeUsd: costeUsd(ultimo.model, { ...ultimo.usage, ...usoTotal }) };
}
