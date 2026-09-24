import type Anthropic from "@anthropic-ai/sdk";
import { query } from "@/lib/db";

export type FuenteFragmento = {
  documentoId: number;
  titulo: string;
  fichero: string;
  orden: number;
  pagina: number;
  seccion: string | null;
  texto: string;
};

type Fila = FuenteFragmento & { tipo: string };

// Documentos validados de una convocatoria, en orden estable (bases primero) para aprovechar la caché.
export async function fuentesConvocatoria(slug: string) {
  const filas = await query<Fila>(
    `SELECT d.id AS "documentoId", d.titulo, d.fichero, d.tipo, f.orden, f.pagina, f.seccion, f.texto
       FROM kb_documento d JOIN kb_fragmento f ON f.documento = d.id
      WHERE d.convocatoria = $1 AND d.validado
      ORDER BY (d.tipo = 'bases') DESC, d.id, f.orden`,
    [slug],
  );
  const documentos: { titulo: string; fichero: string; fragmentos: FuenteFragmento[] }[] = [];
  for (const f of filas) {
    let doc = documentos.at(-1);
    if (!doc || doc.fichero !== f.fichero) {
      doc = { titulo: f.titulo, fichero: f.fichero, fragmentos: [] };
      documentos.push(doc);
    }
    doc.fragmentos.push(f);
  }
  return documentos;
}

// Bloques "document" con citas nativas: cada fragmento es la unidad mínima citable,
// así cada afirmación del asistente apunta a un párrafo concreto (artículo y página).
export function bloquesDocumentos(
  documentos: Awaited<ReturnType<typeof fuentesConvocatoria>>,
): Anthropic.Beta.BetaRequestDocumentBlock[] {
  return documentos.map((doc, i) => ({
    type: "document",
    title: doc.titulo,
    context: "Documento oficial publicado y validado por Fomento de San Sebastián. Es la única fuente autorizada.",
    source: {
      type: "content",
      content: doc.fragmentos.map((f) => ({
        type: "text",
        text: `${f.seccion ? `[${f.seccion} · pág. ${f.pagina}] ` : `[pág. ${f.pagina}] `}${f.texto}`,
      })),
    },
    citations: { enabled: true },
    ...(i === documentos.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

// Versión en texto plano con marcas de página, para tareas con salida estructurada (sin citas nativas).
export function textoConMarcas(documentos: Awaited<ReturnType<typeof fuentesConvocatoria>>) {
  return documentos
    .map(
      (doc) =>
        `<documento titulo="${doc.titulo}">\n` +
        doc.fragmentos.map((f) => `[pág. ${f.pagina}${f.seccion ? ` · ${f.seccion}` : ""}]\n${f.texto}`).join("\n\n") +
        `\n</documento>`,
    )
    .join("\n\n");
}

export type Cita = {
  documento: string;
  fichero: string;
  pagina: number;
  seccion: string | null;
  texto: string;
};

export function resolverCita(
  documentos: Awaited<ReturnType<typeof fuentesConvocatoria>>,
  c: { document_index: number; start_block_index: number; cited_text: string },
): Cita | null {
  const doc = documentos[c.document_index];
  const frag = doc?.fragmentos[c.start_block_index];
  if (!doc || !frag) return null;
  return { documento: doc.titulo, fichero: doc.fichero, pagina: frag.pagina, seccion: frag.seccion, texto: c.cited_text };
}
