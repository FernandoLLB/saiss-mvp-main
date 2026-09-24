import crypto from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { one, query } from "@/lib/db";
import { ADMITE_SISTEMA_INTERMEDIO, anthropic, parametrosModelo, registrarEvento, type Origen } from "@/lib/ia/cliente";
import { CHAT_VERSION, idiomaInterfaz, MARCA_SIN_FUENTE, sistemaChat } from "@/lib/ia/prompts";
import { bloquesDocumentos, fuentesConvocatoria, resolverCita, type Cita } from "@/lib/kb/contexto";
import type { Ficha } from "@/lib/kb/ficha";
import { clasificarTema, resumenReglas } from "@/lib/reglas/tema";

export type Segmento = { texto: string; citas: Cita[] };
export type RespuestaChat = {
  conversacion: string;
  mensajeId: number;
  eventoId: number;
  segmentos: Segmento[];
  texto: string;
  resultado: "respondida" | "sin_fuente";
};

export class ConvocatoriaNoDisponible extends Error {}

// Un turno de conversación: base documental validada + historial → respuesta con citas, persistida y auditada.
export async function responder(opts: {
  conversacion: string | null;
  convocatoria: string;
  idioma: "es" | "eu";
  mensaje: string;
  origen?: Origen;
  alIniciar?: (conversacion: string) => void;
  alTexto?: (delta: string) => void;
}): Promise<RespuestaChat> {
  const { convocatoria: slug, idioma, mensaje, origen = "piloto" } = opts;
  const conv = await one<{ titulo_es: string; titulo_eu: string | null; ficha: Ficha | null }>(
    "SELECT titulo_es, titulo_eu, CASE WHEN validada_en IS NOT NULL THEN ficha END AS ficha FROM convocatoria WHERE slug=$1 AND estado='publicada'",
    [slug],
  );
  if (!conv) throw new ConvocatoriaNoDisponible(slug);

  let conversacion = opts.conversacion;
  if (!conversacion) {
    conversacion = crypto.randomUUID();
    await query("INSERT INTO conversacion (id, convocatoria, idioma, canal, tema) VALUES ($1,$2,$3,$4,$5)", [
      conversacion,
      slug,
      idioma,
      origen === "evaluacion" ? "evaluacion" : "web",
      clasificarTema(mensaje),
    ]);
  }
  opts.alIniciar?.(conversacion);
  const historial = await query<{ rol: "user" | "assistant"; texto: string }>(
    "SELECT rol, texto FROM mensaje WHERE conversacion=$1 ORDER BY id",
    [conversacion],
  );
  await query("INSERT INTO mensaje (conversacion, rol, texto) VALUES ($1,'user',$2)", [conversacion, mensaje]);

  const documentos = await fuentesConvocatoria(slug);
  const turnos = [...historial, { rol: "user" as const, texto: mensaje }];
  // Los documentos van al inicio de la conversación: prefijo estable → caché compartida entre turnos y conversaciones.
  const ultimo = turnos.length - 1;
  const messages: Anthropic.Beta.BetaMessageParam[] = turnos.map((t, i): Anthropic.Beta.BetaMessageParam => {
    // El idioma de la interfaz va al final (no altera el prefijo cacheado): como instrucción de sistema intermedia
    // si el modelo la admite o, si no, como nota en el último mensaje de la persona
    const texto = i === ultimo && !ADMITE_SISTEMA_INTERMEDIO ? `${t.texto}\n\n(${idiomaInterfaz(idioma)})` : t.texto;
    return i === 0 ? { role: "user", content: [...bloquesDocumentos(documentos), { type: "text", text: texto }] } : { role: t.rol, content: texto };
  });
  if (ADMITE_SISTEMA_INTERMEDIO) messages.push({ role: "system", content: idiomaInterfaz(idioma) });

  const inicio = Date.now();
  try {
    const stream = anthropic.beta.messages.stream({
      max_tokens: 4000,
      ...parametrosModelo("low"),
      system: sistemaChat({ ...conv, reglas: conv.ficha ? resumenReglas(conv.ficha) : null }),
      messages,
    });
    // Retiene el final del texto mientras pueda ser el inicio de la marca, para no mostrarla nunca
    let pendiente = "";
    for await (const ev of stream) {
      if (ev.type !== "content_block_delta" || ev.delta.type !== "text_delta") continue;
      pendiente = (pendiente + ev.delta.text).replace(MARCA_SIN_FUENTE, "");
      let corte = pendiente.length;
      for (let i = Math.max(0, pendiente.length - MARCA_SIN_FUENTE.length); i < pendiente.length; i++) {
        if (MARCA_SIN_FUENTE.startsWith(pendiente.slice(i))) {
          corte = i;
          break;
        }
      }
      const seguro = pendiente.slice(0, corte);
      if (seguro) opts.alTexto?.(seguro);
      pendiente = pendiente.slice(seguro.length);
    }
    const final = await stream.finalMessage();

    const segmentos: Segmento[] = [];
    for (const bloque of final.content) {
      if (bloque.type !== "text") continue;
      const citas = (bloque.citations ?? [])
        .map((c) => (c.type === "content_block_location" ? resolverCita(documentos, c) : null))
        .filter((c): c is Cita => c !== null);
      segmentos.push({ texto: bloque.text, citas });
    }
    const sinFuente = segmentos.some((s) => s.texto.includes(MARCA_SIN_FUENTE));
    for (const s of segmentos) s.texto = s.texto.replace(MARCA_SIN_FUENTE, "").replace(/\s+$/, (m) => (s === segmentos.at(-1) ? "" : m));
    const texto = segmentos.map((s) => s.texto).join("");
    const todasCitas = segmentos.flatMap((s) => s.citas);
    const resultado = sinFuente || !todasCitas.length ? "sin_fuente" : "respondida";

    const eventoId = await registrarEvento({
      tipo: "chat",
      origen,
      convocatoria: slug,
      promptVersion: CHAT_VERSION,
      entradaResumen: mensaje,
      salida: { texto, resultado },
      fuentes: todasCitas.map((c) => ({ seccion: c.seccion, pagina: c.pagina, documento: c.documento })),
      mensaje: final,
      inicio,
    });
    const fila = await one<{ id: number }>(
      `INSERT INTO mensaje (conversacion, rol, texto, citas, resultado, evento_ia) VALUES ($1,'assistant',$2,$3,$4,$5) RETURNING id`,
      [conversacion, texto, JSON.stringify(segmentos), resultado, eventoId],
    );
    return { conversacion, mensajeId: fila!.id, eventoId, segmentos, texto, resultado };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await registrarEvento({ tipo: "chat", origen, convocatoria: slug, promptVersion: CHAT_VERSION, entradaResumen: mensaje, inicio, error: detalle });
    throw e;
  }
}
