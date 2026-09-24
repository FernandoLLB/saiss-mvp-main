import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { one, query } from "@/lib/db";
import { analizarDocumento } from "@/lib/ia/documento";
import type { Ficha } from "@/lib/kb/ficha";
import { revisarConReglas } from "@/lib/reglas/revision";

const MAX_BYTES = 10 * 1024 * 1024;
const ADMITIDOS: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: Request, { params }: RouteContext<"/api/solicitudes/[codigo]/documentos">) {
  const { codigo } = await params;
  const sol = await one<{ convocatoria: string; datos: Record<string, unknown>; estado: string; ficha: Ficha | null }>(
    `SELECT s.convocatoria, s.datos, s.estado, c.ficha FROM solicitud s JOIN convocatoria c ON c.slug = s.convocatoria WHERE s.codigo=$1`,
    [codigo],
  );
  if (!sol) return Response.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (!sol.ficha) return Response.json({ error: "Convocatoria sin ficha validada" }, { status: 409 });
  if (!["borrador", "requerimiento"].includes(sol.estado)) return Response.json({ error: "La solicitud ya está presentada" }, { status: 409 });

  const form = await req.formData();
  const fichero = form.get("fichero");
  if (!(fichero instanceof File)) return Response.json({ error: "Falta el fichero" }, { status: 400 });
  const tipoDeclarado = (form.get("tipo") as string | null) || null;
  // La validación de firma (F02-F04) la hace el portal; aquí se simula como dato de entrada
  const firmaOk = form.has("firma") ? form.get("firma") === "1" : null;
  const ext = ADMITIDOS[fichero.type];
  if (!ext) return Response.json({ error: "Formato no admitido (PDF, JPG, PNG o WEBP)" }, { status: 415 });
  if (fichero.size > MAX_BYTES) return Response.json({ error: "El fichero supera 10 MB" }, { status: 413 });

  // En Vercel el disco es de solo lectura salvo /tmp; el contenido se guarda además en la base de datos
  const dir = path.resolve(process.env.VERCEL ? "/tmp/uploads" : "data/uploads", codigo);
  await fs.mkdir(dir, { recursive: true });
  const ruta = path.join(dir, `${crypto.randomUUID()}.${ext}`);
  const contenido = Buffer.from(await fichero.arrayBuffer());
  await fs.writeFile(ruta, contenido);

  const doc = await one<{ id: number }>(
    "INSERT INTO documento (solicitud, nombre, mime, ruta, bytes, contenido, tipo_declarado, firma_ok) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
    [codigo, fichero.name.slice(0, 200), fichero.type, ruta, fichero.size, contenido, tipoDeclarado, firmaOk],
  );

  try {
    const { analisis, eventoId } = await analizarDocumento({
      ruta,
      mime: fichero.type,
      nombre: fichero.name,
      ficha: sol.ficha,
      convocatoria: sol.convocatoria,
      solicitud: codigo,
      datosSolicitud: sol.datos,
      tipoDeclarado: tipoDeclarado ? (sol.ficha.documentos.find((d) => d.id === tipoDeclarado)?.nombre ?? tipoDeclarado) : null,
    });
    // Reglas deterministas de la convocatoria sobre lo extraído (IDs G/D/F con artículo)
    const reglas = analisis
      ? revisarConReglas({ analisis, ficha: sol.ficha, tipoDeclarado, firmaOk, fechaAltaIae: (sol.datos.fecha_alta_iae as string | undefined) ?? null })
      : null;
    const analisisFinal = analisis && reglas ? { ...analisis, reglas: reglas.incidencias, gastos_reglas: reglas.gastos, innovador_aprobado: reglas.innovadorAprobado } : analisis;
    await query("UPDATE documento SET tipo_detectado=$1, confianza=$2, analisis=$3, evento_ia=$4, revision=$5 WHERE id=$6", [
      // El tipo que manda es el declarado por la persona (así se ordena en su lista); el detectado se guarda en el análisis
      tipoDeclarado ?? analisis?.tipo_documento_id ?? null,
      analisis?.confianza ?? null,
      analisisFinal ? JSON.stringify(analisisFinal) : null,
      eventoId,
      reglas?.obsoleto ? "obsoleto" : "pendiente",
      doc!.id,
    ]);
    await query("UPDATE solicitud SET actualizada_en=now() WHERE codigo=$1", [codigo]);
    return Response.json({ id: doc!.id, analisis: analisisFinal, revision: reglas?.obsoleto ? "obsoleto" : "pendiente" });
  } catch (e) {
    return Response.json({ id: doc!.id, analisis: null, error: e instanceof Error ? e.message : "Error de análisis" }, { status: 502 });
  }
}

export async function DELETE(req: Request, { params }: RouteContext<"/api/solicitudes/[codigo]/documentos">) {
  const { codigo } = await params;
  const id = Number(new URL(req.url).searchParams.get("id"));
  const doc = await one<{ ruta: string }>(
    `DELETE FROM documento d USING solicitud s WHERE d.id=$1 AND d.solicitud=$2 AND s.codigo=d.solicitud AND s.estado IN ('borrador','requerimiento') RETURNING d.ruta`,
    [id, codigo],
  );
  if (doc) await fs.rm(doc.ruta, { force: true });
  return Response.json({ ok: Boolean(doc) });
}

// Las llamadas a IA pueden tardar: límite ampliado en Vercel
export const maxDuration = 300;
