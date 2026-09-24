// Prepara la base de datos para grabar la demo.
// Uso: pnpm demo --limpiar            borra conversaciones, solicitudes y eventos del piloto (conserva fichas y evaluaciones)
//      pnpm demo --sembrar            crea conversaciones y expedientes de ejemplo con documentos ficticios
//      pnpm demo --desvalidar <slug>  deja la ficha pendiente de validar para mostrar la validación humana
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { one, pool, query } from "../src/lib/db";
import { responder } from "../src/lib/ia/chat";
import { analizarDocumento } from "../src/lib/ia/documento";
import { revisarExpediente } from "../src/lib/ia/expediente";
import { evaluar } from "../src/lib/kb/calculo";
import type { Ficha } from "../src/lib/kb/ficha";

const CONVOCATORIA = "creacion-empresas-2026";
const flag = (f: string) => process.argv.includes(f);

if (flag("--limpiar")) {
  await query("DELETE FROM requerimiento");
  await query("DELETE FROM documento");
  await query("DELETE FROM solicitud");
  await query("DELETE FROM conversacion WHERE canal='web'");
  await query("DELETE FROM evento_ia WHERE origen='piloto' AND tipo IN ('chat','clasificacion_documento','revision_expediente','requerimiento','derivacion')");
  fs.rmSync("data/uploads", { recursive: true, force: true });
  console.log("✓ Datos de piloto eliminados");
}

const desvalidar = process.argv.indexOf("--desvalidar");
if (desvalidar !== -1) {
  const slug = process.argv[desvalidar + 1];
  await query("UPDATE convocatoria SET validada_por=NULL, validada_en=NULL WHERE slug=$1", [slug]);
  console.log(`✓ Ficha de ${slug} pendiente de validación`);
}

if (flag("--sembrar")) {
  const conv = await one<{ ficha: Ficha }>("SELECT ficha FROM convocatoria WHERE slug=$1", [CONVOCATORIA]);
  if (!conv?.ficha) throw new Error("La convocatoria no tiene ficha");
  await query("UPDATE convocatoria SET validada_por=COALESCE(validada_por,'Equipo técnico FSS'), validada_en=COALESCE(validada_en, now()) WHERE slug=$1", [CONVOCATORIA]);

  const preguntas: [string, "es" | "eu", number | null][] = [
    ["¿Quién puede pedir esta ayuda?", "es", 1],
    ["He abierto una peluquería en Intxaurrondo en un bajo alquilado. ¿Cuánto me podría corresponder?", "es", 1],
    ["¿Puedo presentar facturas pagadas con Bizum?", "es", 1],
    ["Zer dokumentu aurkeztu behar ditut?", "eu", 1],
    ["¿Qué pasa si me falta algún documento?", "es", null],
    ["Nire enpresa Hernanin sortu nuen eta orain Donostiara ekarri dut. Eska dezaket?", "eu", 1],
    ["¿Se subvenciona la compra de un ordenador para el negocio?", "es", 1],
    ["¿Cuál es el horario de atención presencial?", "es", -1],
    ["¿Cuándo cobro la ayuda?", "es", 1],
    ["Laguntza hau eta EKINN+ bateragarriak dira?", "eu", null],
  ];
  for (const [pregunta, idioma, valoracion] of preguntas) {
    const r = await responder({ conversacion: null, convocatoria: CONVOCATORIA, idioma, mensaje: pregunta });
    if (valoracion) await query("UPDATE mensaje SET valoracion=$1 WHERE id=$2", [valoracion, r.mensajeId]);
    if (r.resultado === "sin_fuente") {
      await query(
        "INSERT INTO evento_ia (tipo, convocatoria, modelo, prompt_version, entrada_resumen, salida) VALUES ('derivacion',$1,'humano','-',$2,$3)",
        [CONVOCATORIA, r.conversacion, JSON.stringify({ motivo: "solicitud_persona" })],
      );
    }
    console.log(`✓ [${idioma}] ${pregunta.slice(0, 60)} → ${r.resultado}`);
  }

  const expedientes = [
    {
      solicitante: "Muestra Ejemplo Cocina S.L.",
      estado: "presentada",
      datos: { forma_juridica: "sociedad_mercantil", fecha_alta_iae: "2026-03-01", via_empleo: "alta_reta", incrementos: ["colectivo", "alquiler_hipoteca", "distrito_este"] },
      documentos: ["certificado_titularidad.pdf", "vida_laboral.pdf", "contrato_alquiler_local.pdf", "factura_licencia_apertura.pdf", "justificante_transferencia.pdf", "factura_diseno_web_bizum.pdf"],
    },
    {
      solicitante: "Estudio Inventado de Diseño (autónoma)",
      estado: "presentada",
      datos: { forma_juridica: "autonomo", fecha_alta_iae: "2026-03-01", via_empleo: "contrato_indefinido", incrementos: ["colectivo"] },
      documentos: ["contrato_indefinido_parcial.pdf", "factura_sillas_85.pdf", "factura_horno_octubre2025.pdf"],
    },
    {
      solicitante: "Talleres Ficticios Bidebieta",
      estado: "borrador",
      datos: { forma_juridica: "sociedad_mercantil", fecha_alta_iae: "2026-03-01", via_empleo: "alta_reta", incrementos: ["obras_local", "distrito_este"] },
      documentos: ["factura_reforma_escaparate.pdf"],
    },
  ];

  for (const e of expedientes) {
    const codigo = `S26-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const importe = evaluar(conv.ficha, {}, Object.fromEntries(e.datos.incrementos.map((i) => [i, "si" as const]))).importe;
    await query("INSERT INTO solicitud (codigo, convocatoria, solicitante, datos, importe_estimado, estado) VALUES ($1,$2,$3,$4,$5,'borrador')", [
      codigo,
      CONVOCATORIA,
      e.solicitante,
      JSON.stringify({ solicitante: e.solicitante, ...e.datos }),
      importe,
    ]);
    const dir = path.resolve("data/uploads", codigo);
    fs.mkdirSync(dir, { recursive: true });
    await Promise.all(
      e.documentos.map(async (fichero, i) => {
        const ruta = path.join(dir, `${crypto.randomUUID()}.pdf`);
        fs.copyFileSync(path.resolve("data/demo", fichero), ruta);
        // Nombres como los que subiría una persona real
        const nombre = `documento_${i + 1}.pdf`;
        const { analisis, eventoId } = await analizarDocumento({
          ruta,
          mime: "application/pdf",
          nombre,
          ficha: conv.ficha,
          convocatoria: CONVOCATORIA,
          solicitud: codigo,
          datosSolicitud: e.datos,
        });
        await query(
          "INSERT INTO documento (solicitud, nombre, mime, ruta, bytes, tipo_detectado, confianza, analisis, evento_ia, contenido) VALUES ($1,$2,'application/pdf',$3,$4,$5,$6,$7,$8,$9)",
          [codigo, nombre, ruta, fs.statSync(ruta).size, analisis?.tipo_documento_id ?? null, analisis?.confianza ?? null, analisis ? JSON.stringify(analisis) : null, eventoId, fs.readFileSync(ruta)],
        );
      }),
    );
    await query("UPDATE solicitud SET estado=$1, actualizada_en=now() WHERE codigo=$2", [e.estado, codigo]);
    if (e.estado === "presentada") await revisarExpediente(codigo);
    console.log(`✓ Expediente ${codigo} (${e.solicitante}) · ${e.documentos.length} documentos`);
  }
}

await pool.end();
