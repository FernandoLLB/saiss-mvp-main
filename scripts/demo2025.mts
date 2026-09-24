// Datos de demostración de la convocatoria de prueba 2025: expedientes A (correcto), B (con errores) y C (proyecto innovador),
// más conversaciones de ejemplo en euskera y castellano. Todo ficticio.
// Uso: pnpm demo2025 [--limpiar]   (requiere data/demo2025 generado con scripts/demo_2025.py)
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { one, pool, query } from "../src/lib/db";
import { responder } from "../src/lib/ia/chat";
import { analizarDocumento } from "../src/lib/ia/documento";
import { revisarExpediente } from "../src/lib/ia/expediente";
import type { Ficha } from "../src/lib/kb/ficha";
import { calcularCuantia, codigoExpediente, SLUG, type IncrementoId } from "../src/lib/reglas/creacion2025";
import { revisarConReglas } from "../src/lib/reglas/revision";

if (process.argv.includes("--limpiar")) {
  await query("DELETE FROM requerimiento");
  await query("DELETE FROM documento");
  await query("DELETE FROM solicitud");
  await query("DELETE FROM conversacion WHERE canal='web'");
  await query("DELETE FROM evento_ia WHERE origen='piloto' AND tipo IN ('chat','clasificacion_documento','revision_expediente','requerimiento','derivacion')");
  fs.rmSync("data/uploads", { recursive: true, force: true });
  console.log("✓ Datos de piloto eliminados");
}

const conv = await one<{ ficha: Ficha }>("SELECT ficha FROM convocatoria WHERE slug=$1 AND validada_en IS NOT NULL", [SLUG]);
if (!conv?.ficha) throw new Error("La convocatoria 2025 no tiene ficha validada (pnpm reglas)");
const ficha = conv.ficha;

type Exp = {
  solicitante: string;
  nif: string;
  idioma: "es" | "eu";
  estado: "presentada" | "borrador";
  datos: { forma: "autonomo" | "sociedad"; fecha_alta_iae: string; via_empleo: string; alta_reta: boolean; local: boolean; incrementos: IncrementoId[]; innovador_via?: "programa" | "memoria" };
  documentos: [string, string, boolean?][]; // fichero, DOC-xx, firma_ok
  esperado: number;
};

const expedientes: Exp[] = [
  {
    solicitante: "Txoko Berri Denda, S.L.",
    nif: "B00000010",
    idioma: "eu",
    estado: "presentada",
    datos: { forma: "sociedad", fecha_alta_iae: "2025-03-01", via_empleo: "alta_reta", alta_reta: true, local: true, incrementos: ["colectivo", "itinerario", "alquiler_hipoteca", "distrito_este"] },
    documentos: [
      ["A_anexo_solicitud.pdf", "DOC-01", true], ["A_datos_bancarios.pdf", "DOC-02"], ["A_dni_maddi.pdf", "DOC-05"], ["A_cif.pdf", "DOC-06"], ["A_escrituras.pdf", "DOC-07"],
      ["A_vida_laboral.pdf", "DOC-08"], ["A_dni_iker.pdf", "DOC-09"], ["A_alta_reta.pdf", "DOC-10"], ["A_pack_inicio.pdf", "DOC-12"], ["A_contrato_alquiler.pdf", "DOC-13"],
      ["A_factura_licencia.pdf", "DOC-15"], ["A_factura_rotulo.pdf", "DOC-15"], ["A_justificante_licencia.pdf", "DOC-16"], ["A_justificante_rotulo.pdf", "DOC-16"], ["A_certificado_hacienda.pdf", "DOC-19"],
    ],
    esperado: 4600,
  },
  {
    solicitante: "Jon Demo Prueba",
    nif: "00000021K",
    idioma: "es",
    estado: "presentada",
    datos: { forma: "autonomo", fecha_alta_iae: "2025-04-15", via_empleo: "alta_reta", alta_reta: true, local: true, incrementos: ["alquiler_hipoteca"] },
    documentos: [
      ["B_anexo_solicitud.pdf", "DOC-01", true], ["B_datos_bancarios.pdf", "DOC-02"], ["B_dni.pdf", "DOC-06"], ["B_vida_laboral.pdf", "DOC-08"], ["B_dni.pdf", "DOC-09"], ["B_alta_reta.pdf", "DOC-10"],
      ["B_pack_inicio.pdf", "DOC-12"], ["B_factura_candados.pdf", "DOC-15"], ["B_factura_web_bizum.pdf", "DOC-15"], ["B_certificado_hacienda.pdf", "DOC-19"],
    ],
    esperado: 3500,
  },
  {
    solicitante: "Bidasoa Sensor Lab, S.L.",
    nif: "B00000030",
    idioma: "eu",
    estado: "presentada",
    datos: { forma: "sociedad", fecha_alta_iae: "2025-05-10", via_empleo: "alta_reta", alta_reta: true, local: false, incrementos: ["colectivo", "proyecto_innovador"], innovador_via: "memoria" },
    documentos: [
      ["C_anexo_solicitud.pdf", "DOC-01", true], ["C_datos_bancarios.pdf", "DOC-02"], ["C_memoria_innovador.pdf", "DOC-04"], ["C_dni_nerea.pdf", "DOC-05"], ["C_cif.pdf", "DOC-06"], ["C_escrituras.pdf", "DOC-07"],
      ["C_vida_laboral.pdf", "DOC-08"], ["C_dni_nerea.pdf", "DOC-09"], ["C_pack_inicio.pdf", "DOC-12"], ["C_factura_prototipos.pdf", "DOC-15"], ["C_justificante_prototipos.pdf", "DOC-16"], ["C_certificado_hacienda.pdf", "DOC-19"],
    ],
    esperado: 4650,
  },
];

let n = Number((await one<{ n: string }>("SELECT count(*) AS n FROM solicitud WHERE expediente IS NOT NULL"))!.n);
for (const e of expedientes) {
  const cuantia = calcularCuantia({ local: e.datos.local, incrementos: e.datos.incrementos });
  const ok = cuantia.importe === e.esperado ? "✓" : `✗ (esperado ${e.esperado})`;
  const codigo = `S26-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const expediente = e.estado === "presentada" ? codigoExpediente(++n) : null;
  const datos = { solicitante: e.solicitante, nif: e.nif, ...e.datos };
  await query(
    "INSERT INTO solicitud (codigo, expediente, convocatoria, idioma, solicitante, datos, importe_estimado, estado, presentada_en) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $8='presentada' THEN now() - interval '3 days' END)",
    [codigo, expediente, SLUG, e.idioma, e.solicitante, JSON.stringify(datos), cuantia.importe, e.estado],
  );
  const dir = path.resolve("data/uploads", codigo);
  fs.mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const [fichero, tipo, firmaOk] of e.documentos) {
    const ruta = path.join(dir, `${crypto.randomUUID()}.pdf`);
    fs.copyFileSync(path.resolve("data/demo2025", fichero), ruta);
    const nombre = `${String(++i).padStart(2, "0")}_${fichero.replace(/^[ABC]_/, "")}`;
    const { analisis, eventoId } = await analizarDocumento({
      ruta,
      mime: "application/pdf",
      nombre,
      ficha,
      convocatoria: SLUG,
      solicitud: codigo,
      datosSolicitud: datos,
      tipoDeclarado: ficha.documentos.find((d) => d.id === tipo)?.nombre ?? tipo,
    });
    const reglas = analisis ? revisarConReglas({ analisis, ficha, tipoDeclarado: tipo, firmaOk: firmaOk ?? null, fechaAltaIae: e.datos.fecha_alta_iae }) : null;
    const analisisFinal = analisis && reglas ? { ...analisis, reglas: reglas.incidencias, gastos_reglas: reglas.gastos, innovador_aprobado: reglas.innovadorAprobado } : analisis;
    await query(
      "INSERT INTO documento (solicitud, nombre, mime, ruta, bytes, tipo_detectado, tipo_declarado, firma_ok, confianza, analisis, evento_ia, contenido, revision) VALUES ($1,$2,'application/pdf',$3,$4,$5,$5,$6,$7,$8,$9,$10,$11)",
      [codigo, nombre, ruta, fs.statSync(ruta).size, tipo, firmaOk ?? null, analisis?.confianza ?? null, analisisFinal ? JSON.stringify(analisisFinal) : null, eventoId, fs.readFileSync(ruta), reglas?.obsoleto ? "obsoleto" : "pendiente"],
    );
    const inc = reglas?.incidencias.map((r) => r.regla).join(",");
    console.log(`  ${nombre} → ${analisis?.tipo_documento_id ?? "?"}${inc ? ` [${inc}]` : ""}${reglas?.obsoleto ? " OBSOLETO" : ""}`);
  }
  if (e.estado === "presentada") await revisarExpediente(codigo);
  console.log(`✓ Expediente ${expediente ?? codigo} · ${e.solicitante} · cuantía ${cuantia.importe} € ${ok}`);
}

const preguntas: [string, "es" | "eu", number | null][] = [
  ["2025ean Altzan denda bat ireki nuen, alokairuan, eta emakumea naiz. Laguntza eska dezaket eta zenbat dagokit?", "eu", 1],
  ["Zer dokumentu aurkeztu behar ditut sozietate mugatu bat bagara?", "eu", 1],
  ["Nola sinatzen da eskaera elektronikoki?", "eu", null],
  ["¿Puedo presentar una factura de 80 euros pagada con Bizum?", "es", 1],
  ["¿Cuánto tiempo tengo para subsanar si me falta un documento?", "es", 1],
];
for (const [pregunta, idioma, valoracion] of preguntas) {
  const r = await responder({ conversacion: null, convocatoria: SLUG, idioma, mensaje: pregunta });
  if (valoracion) await query("UPDATE mensaje SET valoracion=$1 WHERE id=$2", [valoracion, r.mensajeId]);
  console.log(`✓ [${idioma}] ${pregunta.slice(0, 60)}… → ${r.resultado}`);
}
await pool.end();
