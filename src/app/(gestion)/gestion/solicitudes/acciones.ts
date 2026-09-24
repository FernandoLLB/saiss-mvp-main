"use server";

import { revalidatePath } from "next/cache";
import { exigirTecnico } from "@/lib/auth";
import { one, query } from "@/lib/db";
import type { Analisis } from "@/lib/ia/documento";
import { revisarExpediente } from "@/lib/ia/expediente";
import { documentosAplicables, type DatosSolicitud } from "@/lib/reglas/creacion2025";
import { redactarRequerimiento, type Incidencia } from "@/lib/ia/requerimiento";
import type { Ficha } from "@/lib/kb/ficha";

// Decisión humana sobre la propuesta de la IA para un documento. Queda firmada en el documento y en el evento de IA.
export async function decidirDocumento(formData: FormData) {
  const tecnico = await exigirTecnico();
  const id = Number(formData.get("id"));
  const decision = String(formData.get("decision"));
  const nota = String(formData.get("nota") ?? "").trim() || null;
  if (!["validado", "corregido", "rechazado", "obsoleto"].includes(decision)) throw new Error("Decisión no válida");

  const doc = await one<{ solicitud: string; evento_ia: number | null }>(
    "UPDATE documento SET revision=$1, revision_nota=$2, revisado_por=$3, revisado_en=now() WHERE id=$4 RETURNING solicitud, evento_ia",
    [decision, nota, tecnico, id],
  );
  if (!doc) return;
  if (doc.evento_ia) {
    const mapa = { validado: "aceptada", corregido: "corregida", rechazado: "rechazada", obsoleto: "corregida" } as const;
    await query("UPDATE evento_ia SET decision_humana=$1, decision_por=$2, decision_en=now() WHERE id=$3", [
      mapa[decision as keyof typeof mapa],
      tecnico,
      doc.evento_ia,
    ]);
  }
  await query("UPDATE solicitud SET estado = CASE WHEN estado='presentada' THEN 'en_revision' ELSE estado END, actualizada_en=now() WHERE codigo=$1", [doc.solicitud]);
  revalidatePath(`/gestion/solicitudes/${doc.solicitud}`);
}

export async function generarRequerimiento(formData: FormData) {
  await exigirTecnico();
  const codigo = String(formData.get("codigo"));
  const sol = await one<{ convocatoria: string; titulo_es: string; solicitante: string | null; ficha: Ficha; datos: Record<string, unknown> }>(
    "SELECT s.convocatoria, c.titulo_es, s.solicitante, c.ficha, s.datos FROM solicitud s JOIN convocatoria c ON c.slug=s.convocatoria WHERE s.codigo=$1",
    [codigo],
  );
  if (!sol) return;
  const docs = await query<{ nombre: string; tipo_detectado: string | null; analisis: Analisis | null; revision: string; revision_nota: string | null }>(
    "SELECT nombre, tipo_detectado, analisis, revision, revision_nota FROM documento WHERE solicitud=$1",
    [codigo],
  );

  // Solo entran incidencias que la persona técnica ha confirmado (documento corregido o rechazado)
  const incidencias: Incidencia[] = docs
    .filter((d) => d.revision === "corregido" || d.revision === "rechazado" || d.revision === "obsoleto")
    .flatMap((d) => {
      const identificador = d.analisis?.datos.find((x) => /n(ú|u)mero|referencia/i.test(x.campo))?.valor;
      const nombre = `${d.analisis?.tipo_documento_nombre ?? "Documento"} «${d.nombre}»${identificador ? ` (n.º ${identificador})` : ""}`;
      const reglas = ((d.analisis as (Analisis & { reglas?: { regla: string; art: string; texto_es: string; detalle: string }[] }) | null)?.reglas ?? []).map((r) => ({ documento: nombre, detalle: `${r.texto_es} ${r.detalle}`, referencia: `${r.regla} · ${r.art}` }));
      const propias = [
        ...reglas,
        ...(d.analisis?.comprobaciones ?? [])
          .filter((c) => c.resultado === "incidencia")
          .map((c) => ({ documento: nombre, detalle: c.detalle, referencia: c.referencia })),
      ];
      return d.revision_nota ? [{ documento: nombre, detalle: d.revision_nota, referencia: null }] : propias;
    });
  const aportados = new Set(docs.filter((d) => d.revision !== "rechazado").map((d) => d.tipo_detectado));
  const faltan = documentosAplicables(sol.ficha, sol.datos as DatosSolicitud)
    .filter((d) => d.aplica === true && !aportados.has(d.id))
    .map((d) => d.nombre);

  const { borrador, eventoId } = await redactarRequerimiento({
    solicitud: codigo,
    convocatoria: sol.convocatoria,
    tituloConvocatoria: sol.titulo_es,
    solicitante: sol.solicitante,
    ficha: sol.ficha,
    incidencias,
    faltan,
  });
  await query("UPDATE requerimiento SET estado='descartado' WHERE solicitud=$1 AND estado='borrador'", [codigo]);
  await query(
    "INSERT INTO requerimiento (solicitud, borrador_es, borrador_eu, incidencias, evento_ia) VALUES ($1,$2,$3,$4,$5)",
    [codigo, `${borrador.asunto_es}\n\n${borrador.cuerpo_es}`, `${borrador.asunto_eu}\n\n${borrador.cuerpo_eu}`, JSON.stringify({ incidencias, faltan }), eventoId],
  );
  revalidatePath(`/gestion/solicitudes/${codigo}`);
}

export async function aprobarRequerimiento(formData: FormData) {
  const tecnico = await exigirTecnico();
  const id = Number(formData.get("id"));
  const es = String(formData.get("borrador_es"));
  const eu = String(formData.get("borrador_eu"));
  const req = await one<{ solicitud: string; evento_ia: number | null; borrador_es: string; borrador_eu: string | null }>(
    "SELECT solicitud, evento_ia, borrador_es, borrador_eu FROM requerimiento WHERE id=$1",
    [id],
  );
  if (!req) return;
  const editado = req.borrador_es !== es || (req.borrador_eu ?? "") !== eu;
  await query("UPDATE requerimiento SET borrador_es=$1, borrador_eu=$2, estado='aprobado', aprobado_por=$3, aprobado_en=now() WHERE id=$4", [es, eu, tecnico, id]);
  if (req.evento_ia) {
    await query("UPDATE evento_ia SET decision_humana=$1, decision_por=$2, decision_en=now() WHERE id=$3", [editado ? "corregida" : "aceptada", tecnico, req.evento_ia]);
  }
  // En el piloto, aquí se notifica por el canal oficial (sede/email). El prototipo no envía nada.
  await query("UPDATE solicitud SET estado='requerimiento', requerida_en=now(), actualizada_en=now() WHERE codigo=$1", [req.solicitud]);
  revalidatePath(`/gestion/solicitudes/${req.solicitud}`);
}

export async function revisarExpedienteAccion(formData: FormData) {
  await exigirTecnico();
  const codigo = String(formData.get("codigo"));
  await revisarExpediente(codigo);
  revalidatePath(`/gestion/solicitudes/${codigo}`);
}

// Resolución humana del expediente (art. 10): concesión o denegación expresa y motivada. Nunca automática.
export async function resolverExpediente(formData: FormData) {
  const tecnico = await exigirTecnico();
  const codigo = String(formData.get("codigo"));
  const decision = String(formData.get("decision"));
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  if (!["concedida", "denegada"].includes(decision)) throw new Error("Decisión no válida");
  const importe = decision === "concedida" ? Number(formData.get("importe") ?? 0) || null : null;
  await query(
    "UPDATE solicitud SET estado=$1, resuelta_en=now(), resuelta_por=$2, importe_concedido=$3, datos = datos || jsonb_build_object('motivo_resolucion', $4::text), actualizada_en=now() WHERE codigo=$5",
    [decision, tecnico, importe, motivo, codigo],
  );
  revalidatePath(`/gestion/solicitudes/${codigo}`);
  revalidatePath("/gestion");
}
