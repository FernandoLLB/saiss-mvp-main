import Anthropic from "@anthropic-ai/sdk";
import { one } from "@/lib/db";

export const anthropic = new Anthropic();

// Modelo por defecto: el más económico. Se puede subir de gama con SAISS_MODEL sin tocar el código.
export const MODELO = process.env.SAISS_MODEL ?? "claude-haiku-4-5";

// Capacidades que dependen del modelo (las opciones no admitidas devuelven error 400)
const ADMITE_RESPALDO = /^claude-(opus-5|fable-5)/.test(MODELO);
const ADMITE_ESFUERZO = !/haiku/.test(MODELO);
export const ADMITE_SISTEMA_INTERMEDIO = /^claude-(opus-5|opus-4-8|fable-5)/.test(MODELO);

// Parámetros comunes de cada llamada adaptados al modelo configurado
export function parametrosModelo<F extends object | undefined = undefined>(esfuerzo: "low" | "medium" | "high", format?: F) {
  return {
    model: MODELO,
    // Si el modelo principal declina una petición, la API la reintenta con el modelo de respaldo recomendado
    ...(ADMITE_RESPALDO ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const } : {}),
    output_config: { ...(ADMITE_ESFUERZO ? { effort: esfuerzo } : {}), ...(format ? { format } : {}) } as { effort?: typeof esfuerzo; format: F },
  };
}

// USD por millón de tokens (entrada, salida). Lectura de caché ≈ 0,1× y escritura ≈ 1,25× la entrada.
const PRECIOS: Record<string, [number, number]> = {
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-4-5": [1, 5],
};

type Uso = Anthropic.Beta.BetaUsage | Anthropic.Usage;

export function costeUsd(modelo: string, uso: Uso) {
  // La API devuelve el identificador con fecha (p. ej. claude-haiku-4-5-20251001): se busca por prefijo
  const clave = Object.keys(PRECIOS).find((k) => modelo.startsWith(k));
  const [entrada, salida] = clave ? PRECIOS[clave] : PRECIOS["claude-opus-5"];
  const cacheLectura = uso.cache_read_input_tokens ?? 0;
  const cacheEscritura = uso.cache_creation_input_tokens ?? 0;
  return (
    (uso.input_tokens * entrada + cacheLectura * entrada * 0.1 + cacheEscritura * entrada * 1.25 + uso.output_tokens * salida) /
    1_000_000
  );
}

export type Origen = "piloto" | "evaluacion";

export type EventoIA = {
  origen?: Origen;
  tipo: "chat" | "clasificacion_documento" | "revision_expediente" | "ficha_convocatoria" | "requerimiento" | "evaluacion" | "derivacion";
  convocatoria?: string | null;
  solicitud?: string | null;
  promptVersion: string;
  entradaResumen?: string;
  salida?: unknown;
  fuentes?: unknown;
  mensaje?: Anthropic.Beta.BetaMessage | Anthropic.Message | null;
  inicio: number;
  error?: string;
};

// Registro de auditoría: toda llamada a IA deja rastro (modelo, instrucciones, fuentes, coste, resultado).
export async function registrarEvento(e: EventoIA) {
  const m = e.mensaje;
  const fila = await one<{ id: number }>(
    `INSERT INTO evento_ia (origen, tipo, convocatoria, solicitud, modelo, modelo_servido, prompt_version, entrada_resumen, salida, fuentes,
       tokens_entrada, tokens_salida, tokens_cache_lectura, tokens_cache_escritura, latencia_ms, coste_usd, stop_reason, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
    [
      e.origen ?? "piloto",
      e.tipo,
      e.convocatoria ?? null,
      e.solicitud ?? null,
      MODELO,
      m?.model ?? null,
      e.promptVersion,
      e.entradaResumen?.slice(0, 2000) ?? null,
      e.salida === undefined ? null : JSON.stringify(e.salida),
      e.fuentes === undefined ? null : JSON.stringify(e.fuentes),
      m?.usage.input_tokens ?? null,
      m?.usage.output_tokens ?? null,
      m?.usage.cache_read_input_tokens ?? null,
      m?.usage.cache_creation_input_tokens ?? null,
      Date.now() - e.inicio,
      m ? costeUsd(m.model, m.usage) : null,
      m?.stop_reason ?? null,
      e.error ?? null,
    ],
  );
  return fila!.id;
}
