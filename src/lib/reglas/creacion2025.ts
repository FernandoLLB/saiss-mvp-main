// Reglas de la convocatoria «Ayudas a la creación de nuevas empresas 2025» (convocatoria de prueba SAISS).
// Fuente: docs/Reglas_validacion.md, extraído de las bases (01_Bases_Creacion_2025_ES.pdf).
// Todo lo normativo (importes, plazos, requisitos, documentos) vive aquí como código determinista con el ID de la regla;
// el modelo de lenguaje solo entiende, extrae y redacta.

import type { Ficha } from "@/lib/kb/ficha";

export const SLUG = "creacion-empresas-2025";
export const PRESUPUESTO_PROGRAMA = 280_000; // art. 2
export const CONTACTO = { telefono: "943 482 800", email: "fomentoss@donostia.eus", asunto: "Ayuda Creación 2025" };
export const PLAZOS = {
  subsanacionDiasHabiles: 10, // art. 9
  resolucionMeses: 4, // art. 10
  justificacionMesesDesdeAlta: 12, // art. 11
  primerPagoPct: 80, // art. 11
  minimisLimite: 300_000, // art. 7
};

type Bi = { es: string; eu: string };

// ───────────── B. Cuantía (art. 5) ─────────────

export const CUANTIA = {
  base: 1500,
  topeConLocal: 10_000,
  topeSinLocal: 5_100,
  articulo: "Art. 5",
} as const;

export type IncrementoId = "colectivo" | "itinerario" | "alquiler_hipoteca" | "obras_local" | "distrito_este" | "proyecto_innovador";

export const INCREMENTOS: {
  id: IncrementoId;
  importe: number;
  hasta: boolean; // importe máximo (depende de facturas) o fijo
  requiereLocal: boolean;
  incompatibleCon: IncrementoId[];
  etiqueta: Bi;
  condicion: Bi;
  pregunta: Bi;
}[] = [
  {
    id: "colectivo",
    importe: 150,
    hasta: false,
    requiereLocal: false,
    incompatibleCon: [],
    etiqueta: { es: "Colectivo (mujer, mayor de 45 o menor de 35)", eu: "Kolektiboa (emakumea, 45 urtetik gorakoa edo 35 urtetik beherakoa)" },
    condicion: { es: "Alguna persona socia es mujer, mayor de 45 o menor de 35 años a la fecha de alta en el IAE. No se acumula aunque cumpla varios.", eu: "Bazkideren bat emakumea da, edo 45 urtetik gorakoa edo 35 urtetik beherakoa JEZeko alta-datan. Ez da metatzen hainbat betetzen baditu ere." },
    pregunta: { es: "¿Alguna persona socia es mujer, tiene más de 45 años o menos de 35 en la fecha de alta en el IAE?", eu: "Bazkideren bat emakumea da, edo 45 urte baino gehiago edo 35 baino gutxiago ditu JEZeko alta-datan?" },
  },
  {
    id: "itinerario",
    importe: 450,
    hasta: false,
    requiereLocal: false,
    incompatibleCon: [],
    etiqueta: { es: "Itinerario de emprendimiento de Fomento", eu: "Sustapeneko ekintzailetza-ibilbidea" },
    condicion: { es: "La empresa ha completado los itinerarios de los servicios o programas de emprendimiento de Fomento (lo comprueba Fomento).", eu: "Enpresak Sustapeneko ekintzailetza-zerbitzu edo -programen ibilbideak osatu ditu (Sustapenak egiaztatzen du)." },
    pregunta: { es: "¿Habéis completado el itinerario de los servicios o programas de emprendimiento de Fomento de San Sebastián?", eu: "Donostia Sustapeneko ekintzailetza-zerbitzu edo -programen ibilbidea osatu duzue?" },
  },
  {
    id: "alquiler_hipoteca",
    importe: 2000,
    hasta: true,
    requiereLocal: true,
    incompatibleCon: ["obras_local"],
    etiqueta: { es: "Alquiler o hipoteca del local", eu: "Lokalaren alokairua edo hipoteka" },
    condicion: { es: "Alquiler o pago de hipoteca de un local comercial a pie de calle. Incompatible con el incremento por obras.", eu: "Kalean bertako merkataritza-lokalaren alokairua edo hipotekaren ordainketa. Obren igoerarekin bateraezina." },
    pregunta: { es: "¿Pagas alquiler o hipoteca por un local comercial a pie de calle?", eu: "Kalean bertako merkataritza-lokal baten alokairua edo hipoteka ordaintzen duzu?" },
  },
  {
    id: "obras_local",
    importe: 5000,
    hasta: true,
    requiereLocal: true,
    incompatibleCon: ["alquiler_hipoteca"],
    etiqueta: { es: "Obras en el local", eu: "Lokaleko obrak" },
    condicion: { es: "Obras o rehabilitación del local a pie de calle, por el importe de las facturas (base imponible). Altas de noviembre y diciembre: por presupuesto. Incompatible con alquiler.", eu: "Kalean bertako lokalaren obrak edo birgaitzea, fakturen zenbatekoaren arabera (zerga-oinarria). Azaro-abenduko altak: aurrekontuaren arabera. Alokairuarekin bateraezina." },
    pregunta: { es: "¿Has hecho (o vas a hacer) obras de reforma en el local a pie de calle?", eu: "Kalean bertako lokalean berritze-obrak egin dituzu (edo egingo dituzu)?" },
  },
  {
    id: "distrito_este",
    importe: 500,
    hasta: false,
    requiereLocal: true,
    incompatibleCon: [],
    etiqueta: { es: "Local en el Distrito Este", eu: "Lokala Ekialdeko barrutian" },
    condicion: { es: "Local comercial a pie de calle en Altza, Intxaurrondo o Miracruz-Bidebieta. Se suma al alquiler o a las obras.", eu: "Kalean bertako merkataritza-lokala Altzan, Intxaurrondon edo Mirakruz-Bidebietan. Alokairuari edo obrei gehitzen zaie." },
    pregunta: { es: "¿El local está en Altza, Intxaurrondo o Miracruz-Bidebieta (Distrito Este)?", eu: "Lokala Altzan, Intxaurrondon edo Mirakruz-Bidebietan dago (Ekialdeko barrutia)?" },
  },
  {
    id: "proyecto_innovador",
    importe: 3000,
    hasta: false,
    requiereLocal: false,
    incompatibleCon: [],
    etiqueta: { es: "Proyecto innovador", eu: "Proiektu berritzailea" },
    condicion: { es: "Vía 1: participación en EKINN+, la Incubadora u otro programa de alto potencial. Vía 2: la memoria del proyecto innovador obtiene al menos 25 de 50 puntos.", eu: "1. bidea: EKINN+, Inkubagailua edo goi-potentzialeko beste programa batean parte hartzea. 2. bidea: proiektu berritzailearen memoriak gutxienez 50etik 25 puntu lortzea." },
    pregunta: { es: "¿Tu proyecto es innovador (has pasado por EKINN+ o la Incubadora, o presentarás la memoria del proyecto innovador)?", eu: "Zure proiektua berritzailea da (EKINN+ edo Inkubagailutik pasa zara, edo proiektu berritzailearen memoria aurkeztuko duzu)?" },
  },
];

export const LOCAL_PREGUNTA: Bi = {
  es: "¿La empresa tiene un local comercial a pie de calle (en alquiler o en propiedad)?",
  eu: "Enpresak kalean bertako merkataritza-lokala du (alokairuan edo jabetzan)?",
};

export const INNOVADOR_MINIMO = 25;
export const INNOVADOR_CRITERIOS = [
  { id: "innovacion_viabilidad", maximo: 30, etiqueta: { es: "Grado de innovación empresarial y viabilidad", eu: "Enpresa-berrikuntzaren maila eta bideragarritasuna" } },
  { id: "idi_tecnologia", maximo: 20, etiqueta: { es: "Vinculación con I+D+i y tecnología", eu: "I+G+b eta teknologiarekiko lotura" } },
] as const;

export type CasoCuantia = { local: boolean; incrementos: IncrementoId[] };

export type LineaCuantia = { id: string; etiqueta: Bi; importe: number; hasta: boolean; regla: string };

export type ResultadoCuantia = {
  lineas: LineaCuantia[];
  bruto: number;
  tope: number;
  importe: number;
  hasta: boolean;
  descartados: { id: IncrementoId; motivo: Bi; regla: string }[];
};

// Cálculo determinista de la cuantía (bloque B). Incompatibilidades: se conserva el incremento de mayor importe.
export function calcularCuantia(caso: CasoCuantia): ResultadoCuantia {
  const marcados = new Set(caso.incrementos);
  const descartados: ResultadoCuantia["descartados"] = [];
  const lineas: LineaCuantia[] = [{ id: "base", etiqueta: { es: "Ayuda base", eu: "Oinarrizko laguntza" }, importe: CUANTIA.base, hasta: false, regla: "B · Art. 5" }];

  const candidatos = INCREMENTOS.filter((i) => marcados.has(i.id)).filter((i) => {
    if (i.requiereLocal && !caso.local) {
      descartados.push({ id: i.id, motivo: { es: "Requiere un local comercial a pie de calle.", eu: "Kalean bertako merkataritza-lokala behar du." }, regla: "B · Art. 5" });
      return false;
    }
    return true;
  });
  const elegidos: typeof candidatos = [];
  for (const c of [...candidatos].sort((a, b) => b.importe - a.importe)) {
    const choca = elegidos.find((e) => e.incompatibleCon.includes(c.id) || c.incompatibleCon.includes(e.id));
    if (choca) descartados.push({ id: c.id, motivo: { es: `Incompatible con «${choca.etiqueta.es}»: solo se aplica uno.`, eu: `«${choca.etiqueta.eu}» igoerarekin bateraezina: bakarra aplikatzen da.` }, regla: "B · Art. 5" });
    else elegidos.push(c);
  }
  for (const e of INCREMENTOS.filter((i) => elegidos.includes(i))) lineas.push({ id: e.id, etiqueta: e.etiqueta, importe: e.importe, hasta: e.hasta, regla: "B · Art. 5" });

  const bruto = lineas.reduce((s, l) => s + l.importe, 0);
  const tope = caso.local ? CUANTIA.topeConLocal : CUANTIA.topeSinLocal;
  return { lineas, bruto, tope, importe: Math.min(bruto, tope), hasta: lineas.some((l) => l.hasta), descartados };
}

// ───────────── A. Requisitos (arts. 3 y 4) ─────────────

export type FormaJuridica = "autonomo" | "sociedad";

export const REQUISITOS: { id: string; art: string; texto: Bi; pregunta: Bi; aplicaA?: FormaJuridica; comprobacion: string }[] = [
  { id: "R01", art: "Art. 4.a", texto: { es: "Domicilio fiscal y centro de trabajo en San Sebastián.", eu: "Zerga-helbidea eta lantokia Donostian." }, pregunta: { es: "¿La empresa tiene el domicilio fiscal y el centro de trabajo en San Sebastián?", eu: "Enpresak zerga-helbidea eta lantokia Donostian ditu?" }, comprobacion: "CIF, escrituras, alta IAE" },
  { id: "R02", art: "Art. 4.b", texto: { es: "Alta inicial en el IAE (o declaración censal) entre el 01/01/2025 y el 31/12/2025.", eu: "JEZeko hasierako alta (edo zentsu-aitorpena) 2025/01/01 eta 2025/12/31 artean." }, pregunta: { es: "¿El alta inicial en el IAE se hizo entre el 1 de enero y el 31 de diciembre de 2025?", eu: "JEZeko hasierako alta 2025eko urtarrilaren 1a eta abenduaren 31 artean egin zen?" }, comprobacion: "Histórico IAE" },
  { id: "R03", art: "Art. 4.c", texto: { es: "Sin matrícula en el IAE en la misma actividad o una similar en los 6 meses anteriores.", eu: "Aurreko 6 hilabeteetan jarduera bera edo antzekoa JEZen matrikulatu gabe." }, pregunta: { es: "¿Es una actividad nueva, sin alta en la misma o similar actividad en los 6 meses anteriores?", eu: "Jarduera berria da, aurreko 6 hilabeteetan jarduera berean edo antzekoan altarik gabe?" }, comprobacion: "Histórico IAE" },
  { id: "R04", art: "Art. 4.d", texto: { es: "No es un simple cambio de forma jurídica: las personas promotoras no han sido titulares de la misma actividad en los 6 meses anteriores.", eu: "Ez da forma juridikoaren aldaketa hutsa: sustatzaileak ez dira jarduera beraren titular izan aurreko 6 hilabeteetan." }, pregunta: { es: "¿Ninguna persona promotora ha sido titular de la misma actividad o similar en los 6 meses anteriores?", eu: "Sustatzaileetako inor ez da izan jarduera beraren edo antzekoaren titular aurreko 6 hilabeteetan?" }, comprobacion: "Histórico IAE de promotores" },
  { id: "R05", art: "Art. 4.e", texto: { es: "Al menos un alta nueva en la Seguridad Social en 2025, mantenida el primer año (RETA, mutualidad o contrato indefinido con jornada ≥ 50 %; no valen fijos discontinuos).", eu: "Gizarte Segurantzan gutxienez alta berri bat 2025ean, lehen urtean mantendua (RETA, mutualitatea edo kontratu mugagabea, lanaldiaren ≥ % 50; ez dira baliozkoak finko etenak)." }, pregunta: { es: "¿Hay al menos un alta nueva en la Seguridad Social en 2025 (autónomo, mutualidad o contrato indefinido de al menos media jornada)?", eu: "2025ean Gizarte Segurantzan gutxienez alta berri bat dago (autonomoa, mutualitatea edo gutxienez lanaldi erdiko kontratu mugagabea)?" }, comprobacion: "Vida laboral o contrato" },
  { id: "R06", art: "Art. 4.f", texto: { es: "Algún socio ha hecho la formación de Fomento (Pack Inicio) o presenta un plan de empresa con el contenido mínimo.", eu: "Bazkideren batek Sustapeneko prestakuntza egin du (Hasiera Packa) edo gutxieneko edukia duen enpresa-plana aurkezten du." }, pregunta: { es: "¿Alguna persona socia ha hecho la formación de Fomento (Pack Inicio) o presentaréis un plan de empresa?", eu: "Bazkideren batek Sustapeneko prestakuntza egin du (Hasiera Packa) edo enpresa-plana aurkeztuko duzue?" }, comprobacion: "Certificado de formación o plan de empresa" },
  { id: "R07", art: "Art. 4.g", aplicaA: "sociedad", texto: { es: "Persona jurídica: activo o volumen de operaciones ≤ 10 M€, plantilla media < 50 y sin participación ≥ 25 % de empresas que no cumplan esto.", eu: "Pertsona juridikoa: aktiboa edo eragiketa-bolumena ≤ 10 M€, batez besteko plantilla < 50 eta baldintza hauek betetzen ez dituzten enpresen partaidetza ≥ % 25 gabe." }, pregunta: { es: "Si es una sociedad: ¿tiene menos de 50 personas en plantilla, no supera los 10 millones de activo o facturación y no está participada en más del 25 % por empresas mayores?", eu: "Sozietatea bada: 50 langile baino gutxiago ditu, ez ditu 10 milioi aktibo edo fakturazio gainditzen eta ez dago enpresa handiagoek % 25 baino gehiagoan partaidetuta?" }, comprobacion: "Declaración responsable" },
  { id: "R08", art: "Arts. 3 y 4", texto: { es: "Excluidas: fundaciones y asociaciones sin ánimo de lucro, entidades participadas > 25 % por el sector público, sociedades patrimoniales y colegios profesionales.", eu: "Kanpoan: irabazi-asmorik gabeko fundazio eta elkarteak, sektore publikoak % 25 baino gehiagoan partaidetutako erakundeak, ondare-sozietateak eta elkargo profesionalak." }, pregunta: { es: "¿La entidad NO es una fundación, asociación sin ánimo de lucro, sociedad patrimonial, colegio profesional ni está participada por el sector público en más del 25 %?", eu: "Erakundea EZ da fundazioa, irabazi-asmorik gabeko elkartea, ondare-sozietatea, elkargo profesionala, eta sektore publikoak ez du % 25 baino gehiagoan partaidetzen?" }, comprobacion: "Forma jurídica y escrituras" },
  { id: "R09", art: "Art. 3", texto: { es: "Al corriente con Hacienda Foral, Seguridad Social, Ayuntamiento y Fomento, sin sanciones ni reintegros pendientes. Fomento lo consulta de oficio.", eu: "Foru Ogasunarekin, Gizarte Segurantzarekin, Udalarekin eta Sustapenarekin egunean, zigorrik eta itzulketa pendienterik gabe. Sustapenak ofizioz egiaztatzen du." }, pregunta: { es: "¿Estáis al corriente de pagos con Hacienda, Seguridad Social, Ayuntamiento y Fomento, sin sanciones ni reintegros pendientes?", eu: "Ogasunarekin, Gizarte Segurantzarekin, Udalarekin eta Sustapenarekin egunean zaudete, zigorrik eta itzulketa pendienterik gabe?" }, comprobacion: "Consulta de oficio" },
  { id: "R10", art: "Art. 5", texto: { es: "Una sola solicitud por empresa.", eu: "Eskaera bakarra enpresa bakoitzeko." }, pregunta: { es: "¿Es la primera solicitud de esta ayuda para esta empresa?", eu: "Enpresa honentzat laguntza honen lehen eskaera da?" }, comprobacion: "Registro de solicitudes" },
];

// ───────────── C. Gastos (art. 6) ─────────────

export const VENTANA_GASTOS = { mesesAntes: 2, mesesDespues: 12 };
export const MEDIOS_PAGO_ADMITIDOS = ["tarjeta", "transferencia", "domiciliacion"] as const;
export const IMPORTE_MINIMO_FACTURA = 100;

export const REGLAS_GASTO: Record<string, { art: string; texto: Bi }> = {
  G01: { art: "Art. 6", texto: { es: "Factura inferior a 100 € sin impuestos (excepto cuotas de autónomo).", eu: "100 € baino gutxiagoko faktura zergarik gabe (autonomo-kuotak izan ezik)." } },
  G02: { art: "Art. 6", texto: { es: "Factura no pagada en su totalidad.", eu: "Faktura osorik ordaindu gabe." } },
  G03: { art: "Art. 6", texto: { es: "Pago en efectivo, Bizum o app similar. Solo tarjeta, transferencia o domiciliación.", eu: "Eskudirutan, Bizum bidez edo antzeko app batekin ordaindua. Txartela, transferentzia edo helbideratzea bakarrik." } },
  G04: { art: "Art. 6", texto: { es: "Justificante de pago sin beneficiario, concepto, importe y fecha, o listado de movimientos.", eu: "Ordainagiria onuradunik, kontzepturik, zenbatekorik eta datarik gabe, edo mugimenduen zerrenda." } },
  G05: { art: "Art. 6", texto: { es: "IVA y demás impuestos indirectos no subvencionables.", eu: "BEZa eta gainerako zeharkako zergak ez dira diruz laguntzen." } },
  G06: { art: "Art. 6", texto: { es: "Gasto excluido: mercancía para revender, fungibles, suministros, viajes y dietas, asesoría recurrente, fianzas.", eu: "Gastu baztertua: birsaltzeko merkantzia, suntsikorrak, hornidurak, bidaiak eta dietak, aholkularitza errepikakorra, fidantzak." } },
  G07: { art: "Art. 6", texto: { es: "Alquiler cuyo propietario es socio o familiar hasta segundo grado.", eu: "Jabea bazkidea edo bigarren mailara arteko senidea duen alokairua." } },
  G08: { art: "Art. 6", texto: { es: "Formación: se excluyen título, viajes, alojamiento y dietas.", eu: "Prestakuntza: titulua, bidaiak, ostatua eta dietak baztertzen dira." } },
  G09: { art: "Art. 6", texto: { es: "Gasto fuera de la ventana temporal (2 meses antes y 12 después del alta), salvo obras del local.", eu: "Gastua denbora-leihotik kanpo (alta baino 2 hilabete lehenago eta 12 geroago), lokaleko obrak izan ezik." } },
  G10: { art: "Art. 11", texto: { es: "Coste superior al valor de mercado.", eu: "Merkatuko balioa baino kostu handiagoa." } },
};

export type GastoExtraido = {
  concepto: string;
  fecha: string | null; // AAAA-MM-DD
  base_imponible: number | null;
  forma_pago: string | null;
  pagada: boolean | null;
  es_cuota_autonomos?: boolean;
  es_obra_local?: boolean;
  categoria?: string | null;
};

export type IncidenciaGasto = { regla: string; art: string; texto: Bi; detalle: string };

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function medioPagoAdmitido(fp: string | null) {
  if (!fp) return null;
  const f = norm(fp);
  if (/efectivo|metalico|cash|bizum|paypal|app/.test(f)) return false;
  if (/tarjeta|transferencia|domicili|recibo|adeudo/.test(f)) return true;
  return null;
}

// Aplica las reglas de rechazo automático del bloque C a un gasto extraído de una factura o justificante.
export function evaluarGasto(g: GastoExtraido, fechaAltaIae: string | null): IncidenciaGasto[] {
  const inc: IncidenciaGasto[] = [];
  const add = (regla: string, detalle: string) => inc.push({ regla, art: REGLAS_GASTO[regla].art, texto: REGLAS_GASTO[regla].texto, detalle });
  if (g.base_imponible !== null && g.base_imponible < IMPORTE_MINIMO_FACTURA && !g.es_cuota_autonomos) add("G01", `Base imponible ${g.base_imponible} €, inferior a ${IMPORTE_MINIMO_FACTURA} €.`);
  if (g.pagada === false) add("G02", "El justificante no acredita el pago total.");
  if (medioPagoAdmitido(g.forma_pago) === false) add("G03", `Medio de pago: ${g.forma_pago}.`);
  if (g.categoria && /(mercancia|materia prima|fungible|oficina|suministro|luz|agua|telefono|viaje|dieta|asesoria|fianza|deposito)/.test(norm(g.categoria))) add("G06", `Categoría: ${g.categoria}.`);
  if (g.fecha && fechaAltaIae && !g.es_obra_local) {
    const alta = new Date(fechaAltaIae);
    const desde = new Date(alta);
    desde.setMonth(desde.getMonth() - VENTANA_GASTOS.mesesAntes);
    const hasta = new Date(alta);
    hasta.setMonth(hasta.getMonth() + VENTANA_GASTOS.mesesDespues);
    const f = new Date(g.fecha);
    if (!Number.isNaN(f.getTime()) && (f < desde || f > hasta)) add("G09", `Fecha ${g.fecha}; ventana admitida ${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)} (alta IAE ${fechaAltaIae}).`);
  }
  return inc;
}

// ───────────── D. Documentación (art. 8 y portal) ─────────────

export type CasoDocumentos = { forma: FormaJuridica; incrementos: IncrementoId[]; innovadorVia?: "programa" | "memoria"; altaReta: boolean; hipoteca?: boolean };

export type DocumentoDef = {
  id: string; // DOC-01 … DOC-22 (numeración de la tabla D)
  nombre: Bi;
  descripcion: Bi;
  grupo: "subvencion" | "empresa" | "oficio";
  firma: boolean;
  validezMeses: number | null;
  momento: "solicitud" | "justificacion" | "solicitud_o_justificacion";
  aplica: (c: CasoDocumentos) => boolean | "opcional";
  condicion: Bi | null;
  comprobaciones: string[];
};

const siempre = () => true;

export const DOCUMENTOS: DocumentoDef[] = [
  { id: "DOC-01", grupo: "subvencion", firma: true, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "Anexo: Solicitud", eu: "Eranskina: Eskaera" }, descripcion: { es: "Solicitud oficial con declaración responsable, declaración de minimis e incrementos marcados. Firmada electrónicamente.", eu: "Eskaera ofiziala, erantzukizunpeko adierazpena, minimis adierazpena eta markatutako igoerak. Elektronikoki sinatua." }, comprobaciones: ["Completo en todos sus campos", "Firma electrónica PAdES válida (F02)", "Incrementos marcados coherentes con la documentación", "Declaración de minimis cumplimentada", "NIF y razón social coinciden con el resto de documentos"] },
  { id: "DOC-02", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "Anexo: Datos bancarios", eu: "Eranskina: Banku-datuak" }, descripcion: { es: "Sellado por el banco o certificado de titularidad. Si ya consta en Fomento no hace falta repetirlo.", eu: "Bankuak zigilatua edo titulartasun-ziurtagiria. Sustapenean jada badago, ez da errepikatu behar." }, comprobaciones: ["IBAN completo y legible", "Titular coincide con la empresa solicitante", "Sello bancario o certificado de titularidad"] },
  { id: "DOC-03", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud_o_justificacion", aplica: siempre, condicion: null, nombre: { es: "Anexo: Memoria financiera", eu: "Eranskina: Finantza-memoria" }, descripcion: { es: "Relación de gastos con sus facturas y justificantes de pago. Se vuelve a presentar en la justificación.", eu: "Gastuen zerrenda, fakturekin eta ordainagiriekin. Justifikazioan berriro aurkezten da." }, comprobaciones: ["Cada gasto tiene factura y justificante de pago", "Importes coinciden con las facturas (base imponible)", "Fechas dentro de la ventana de gasto (G09)"] },
  { id: "DOC-04", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.incrementos.includes("proyecto_innovador") && c.innovadorVia === "memoria", condicion: { es: "Solo si se pide el incremento de proyecto innovador por la vía 2 (memoria).", eu: "Proiektu berritzailearen igoera 2. bidetik (memoria) eskatzen bada bakarrik." }, nombre: { es: "Anexo: Memoria del proyecto innovador", eu: "Eranskina: Proiektu berritzailearen memoria" }, descripcion: { es: "Memoria según el guion oficial. Se puntúa: innovación y viabilidad (hasta 30) y vinculación con I+D+i (hasta 20); mínimo 25 de 50.", eu: "Gidoi ofizialaren araberako memoria. Puntuatzen da: berrikuntza eta bideragarritasuna (30era arte) eta I+G+b lotura (20ra arte); gutxienez 50etik 25." }, comprobaciones: ["Sigue el guion del anexo", "Puntuación propuesta por la IA pendiente de validación humana"] },
  { id: "DOC-05", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.forma === "sociedad", condicion: { es: "Obligatorio en sociedades (S.L., C.B., S.Coop, S.A.…).", eu: "Sozietateetan derrigorrezkoa (S.L., O.E., S.Koop, S.A.…)." }, nombre: { es: "DNI de la persona solicitante o firmante", eu: "Eskatzailearen edo sinatzailearen NANa" }, descripcion: { es: "DNI de quien firma la solicitud en nombre de la sociedad.", eu: "Sozietatearen izenean eskaera sinatzen duenaren NANa." }, comprobaciones: ["Legible y en vigor", "Coincide con la persona firmante de la solicitud"] },
  { id: "DOC-06", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "Copia del NIF/CIF", eu: "IFZ/IFK kopia" }, descripcion: { es: "Tarjeta del NIF/CIF de la empresa. Las personas autónomas adjuntan de nuevo su DNI.", eu: "Enpresaren IFZ/IFK txartela. Autonomoek NANa berriro eransten dute." }, comprobaciones: ["NIF coincide con la solicitud", "Domicilio fiscal en San Sebastián (R01)"] },
  { id: "DOC-07", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.forma === "sociedad", condicion: { es: "Obligatorio en sociedades. En sociedades civiles sin personalidad jurídica, contrato privado sellado por Hacienda Foral.", eu: "Sozietateetan derrigorrezkoa. Nortasun juridikorik gabeko sozietate zibiletan, Foru Ogasunak zigilatutako kontratu pribatua." }, nombre: { es: "Escrituras de constitución", eu: "Eraketa-eskriturak" }, descripcion: { es: "Escritura o documento de constitución y estatutos.", eu: "Eraketa-eskritura edo -agiria eta estatutuak." }, comprobaciones: ["Fecha de constitución coherente con el alta en el IAE", "Personas socias coinciden con la solicitud", "No es una entidad excluida (R08)"] },
  { id: "DOC-08", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "Vida laboral de la persona promotora o contrato laboral", eu: "Sustatzailearen lan-bizitza edo lan-kontratua" }, descripcion: { es: "Acredita el alta nueva en la Seguridad Social (R05). Si viene de una contratación, contrato indefinido con jornada ≥ 50 %.", eu: "Gizarte Segurantzako alta berria egiaztatzen du (R05). Kontratazio batetik badator, kontratu mugagabea, lanaldiaren ≥ % 50." }, comprobaciones: ["Alta en 2025", "Contrato indefinido y jornada ≥ 50 % (R05)", "No fijo discontinuo"] },
  { id: "DOC-09", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "DNI de las personas promotoras", eu: "Sustatzaileen NANa" }, descripcion: { es: "De todas las personas socias que optan a la ayuda.", eu: "Laguntza eskatzen duten bazkide guztiena." }, comprobaciones: ["Legibles y en vigor", "Coinciden con las personas socias declaradas", "Edad o sexo acreditan el incremento por colectivo, si se pide"] },
  { id: "DOC-10", grupo: "empresa", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.altaReta, condicion: { es: "Si el alta nueva es en el régimen de autónomos (RETA).", eu: "Alta berria autonomoen erregimenean (RETA) bada." }, nombre: { es: "Alta en el régimen de autónomos", eu: "Autonomoen erregimeneko alta" }, descripcion: { es: "Resolución de alta en el RETA.", eu: "RETAko alta-ebazpena." }, comprobaciones: ["Fecha de alta en 2025", "Titular coincide con la persona promotora"] },
  { id: "DOC-11", grupo: "oficio", firma: false, validezMeses: null, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio, salvo oposición.", eu: "Ofiziozko kontsulta, aurka egin ezean." }, nombre: { es: "Certificado de deudas con la Seguridad Social (promotores)", eu: "Gizarte Segurantzarekiko zorren ziurtagiria (sustatzaileak)" }, descripcion: { es: "Fomento lo consulta por interoperabilidad.", eu: "Sustapenak elkarreragingarritasunez kontsultatzen du." }, comprobaciones: ["Sin deudas", "Vigente"] },
  { id: "DOC-12", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud", aplica: siempre, condicion: null, nombre: { es: "Certificado de formación o exención", eu: "Prestakuntza-ziurtagiria edo salbuespena" }, descripcion: { es: "Diploma Pack Inicio o plan de empresa con el contenido mínimo (R06).", eu: "Hasiera Pack diploma edo gutxieneko edukia duen enpresa-plana (R06)." }, comprobaciones: ["Diploma a nombre de una persona socia, o", "Plan de empresa con: promotor, idea, DAFO, mercado y estrategia comercial, análisis económico"] },
  { id: "DOC-13", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.incrementos.includes("alquiler_hipoteca") && !c.hipoteca, condicion: { es: "Si se pide el incremento por alquiler.", eu: "Alokairuaren igoera eskatzen bada." }, nombre: { es: "Contrato de arrendamiento", eu: "Errentamendu-kontratua" }, descripcion: { es: "Contrato del local a pie de calle, firmado por ambas partes.", eu: "Kalean bertako lokalaren kontratua, bi aldeek sinatua." }, comprobaciones: ["Firmado por ambas partes", "Local a pie de calle en San Sebastián", "Arrendador no es socio ni familiar hasta 2.º grado (G07)", "Distrito Este si se pide ese incremento"] },
  { id: "DOC-14", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud", aplica: (c) => c.incrementos.includes("alquiler_hipoteca") && c.hipoteca === true, condicion: { es: "Si se pide el incremento por hipoteca.", eu: "Hipotekaren igoera eskatzen bada." }, nombre: { es: "Préstamo hipotecario", eu: "Hipoteka-mailegua" }, descripcion: { es: "Escritura del préstamo hipotecario del local.", eu: "Lokalaren hipoteka-maileguaren eskritura." }, comprobaciones: ["Titular coincide con la empresa", "Local a pie de calle"] },
  { id: "DOC-15", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud_o_justificacion", aplica: siempre, condicion: null, nombre: { es: "Justificantes de gasto (facturas, nóminas, TC)", eu: "Gastu-frogagiriak (fakturak, nominak, TC)" }, descripcion: { es: "Facturas de los gastos. Obras: facturas previas a la solicitud (presupuesto para altas de noviembre y diciembre).", eu: "Gastuen fakturak. Obrak: eskaera aurreko fakturak (aurrekontua azaro-abenduko altentzat)." }, comprobaciones: ["Base imponible ≥ 100 € (G01)", "A nombre de la empresa", "Fecha dentro de la ventana (G09)", "Concepto subvencionable (G06)"] },
  { id: "DOC-16", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud_o_justificacion", aplica: siempre, condicion: null, nombre: { es: "Justificantes de pago", eu: "Ordainagiriak" }, descripcion: { es: "Uno por gasto, con beneficiario, concepto, importe y fecha.", eu: "Gastu bakoitzeko bat, onuraduna, kontzeptua, zenbatekoa eta datarekin." }, comprobaciones: ["Medio de pago admitido: tarjeta, transferencia o domiciliación (G03)", "Detalla beneficiario, concepto, importe y fecha (G04)", "Pago total (G02)"] },
  { id: "DOC-17", grupo: "oficio", firma: false, validezMeses: 2, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio.", eu: "Ofiziozko kontsulta." }, nombre: { es: "Histórico de actividades económicas (IAE)", eu: "Jarduera ekonomikoen historikoa (JEZ)" }, descripcion: { es: "Validez de 2 meses.", eu: "2 hilabeteko balioa." }, comprobaciones: ["Alta inicial en 2025 (R02)", "Sin actividad similar previa (R03)", "Emitido hace menos de 2 meses"] },
  { id: "DOC-18", grupo: "oficio", firma: false, validezMeses: null, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio.", eu: "Ofiziozko kontsulta." }, nombre: { es: "Histórico IAE de las personas promotoras", eu: "Sustatzaileen JEZ historikoa" }, descripcion: { es: "Comprueba que no hubo la misma actividad en los 6 meses anteriores (R04).", eu: "Aurreko 6 hilabeteetan jarduera bera ez zegoela egiaztatzen du (R04)." }, comprobaciones: ["Sin titularidad previa de la misma actividad (R04)"] },
  { id: "DOC-19", grupo: "oficio", firma: false, validezMeses: 6, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio.", eu: "Ofiziozko kontsulta." }, nombre: { es: "Certificado de obligaciones tributarias (Hacienda Foral)", eu: "Zerga-betebeharren ziurtagiria (Foru Ogasuna)" }, descripcion: { es: "Validez de 6 meses.", eu: "6 hilabeteko balioa." }, comprobaciones: ["Al corriente (R09)", "Emitido hace menos de 6 meses"] },
  { id: "DOC-20", grupo: "oficio", firma: false, validezMeses: 6, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio.", eu: "Ofiziozko kontsulta." }, nombre: { es: "Certificado de deudas con la Seguridad Social (empresa)", eu: "Gizarte Segurantzarekiko zorren ziurtagiria (enpresa)" }, descripcion: { es: "Validez de 6 meses.", eu: "6 hilabeteko balioa." }, comprobaciones: ["Al corriente (R09)", "Emitido hace menos de 6 meses"] },
  { id: "DOC-21", grupo: "oficio", firma: false, validezMeses: 6, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Consulta de oficio.", eu: "Ofiziozko kontsulta." }, nombre: { es: "Certificado del Ayuntamiento", eu: "Udalaren ziurtagiria" }, descripcion: { es: "Validez de 6 meses.", eu: "6 hilabeteko balioa." }, comprobaciones: ["Sin deudas con el Ayuntamiento ni Fomento (R09)", "Emitido hace menos de 6 meses"] },
  { id: "DOC-22", grupo: "subvencion", firma: false, validezMeses: null, momento: "solicitud", aplica: () => "opcional", condicion: { es: "Opcional. Varios archivos van en un zip.", eu: "Aukerakoa. Hainbat fitxategi zip batean." }, nombre: { es: "Otros documentos", eu: "Beste dokumentu batzuk" }, descripcion: { es: "Cualquier otro documento de apoyo.", eu: "Laguntzeko beste edozein agiri." }, comprobaciones: [] },
];

export function documentosRequeridos(caso: CasoDocumentos) {
  return DOCUMENTOS.filter((d) => d.aplica(caso) === true && d.momento !== "justificacion");
}

// Caducidad de certificados: un documento con validez limitada emitido hace más meses de los permitidos queda obsoleto.
export function estaObsoleto(docId: string, fechaEmision: string | null, hoy = new Date()) {
  const def = DOCUMENTOS.find((d) => d.id === docId);
  if (!def?.validezMeses || !fechaEmision) return false;
  const limite = new Date(fechaEmision);
  if (Number.isNaN(limite.getTime())) return false;
  limite.setMonth(limite.getMonth() + def.validezMeses);
  return limite < hoy;
}

// ───────────── Ficha (formato común de la plataforma) ─────────────

const cita = (seccion: string, pagina: number) => ({ seccion, pagina });

// Construye la ficha estructurada a partir de las reglas codificadas (sin IA). Las páginas son de 01_Bases_Creacion_2025_ES.pdf.
export function fichaCreacion2025(): Ficha {
  return {
    objeto: "Ayudas para nuevas empresas creadas en 2025 en San Sebastián que generen al menos un alta nueva en la Seguridad Social, con incrementos por colectivo, itinerario de Fomento, local comercial a pie de calle (alquiler u obras), Distrito Este y proyecto innovador.",
    beneficiarios: "Personas físicas o jurídicas (autónomas, sociedades mercantiles, comunidades de bienes, cooperativas…) con domicilio fiscal y centro de trabajo en San Sebastián y alta en el IAE en 2025. Excluidas fundaciones, asociaciones sin ánimo de lucro, sociedades patrimoniales, colegios profesionales y entidades participadas en más del 25 % por el sector público.",
    cuantia: {
      base: CUANTIA.base,
      maximo: CUANTIA.topeConLocal,
      maximo_sin_local: CUANTIA.topeSinLocal,
      pregunta_local_es: LOCAL_PREGUNTA.es,
      pregunta_local_eu: LOCAL_PREGUNTA.eu,
      explicacion: `Ayuda base de ${CUANTIA.base} € más los incrementos marcados en la solicitud. Tope de ${CUANTIA.topeConLocal} € con local comercial a pie de calle y de ${CUANTIA.topeSinLocal} € sin él. El pago se hace en dos veces: hasta el 80 % al resolver, por los gastos justificados, y el resto a los 12 meses del alta tras la justificación final.`,
      incrementos: INCREMENTOS.map((i) => ({
        id: i.id,
        etiqueta: i.etiqueta.es,
        etiqueta_eu: i.etiqueta.eu,
        importe: i.hasta ? null : i.importe,
        importe_maximo: i.hasta ? i.importe : null,
        condicion: i.condicion.es,
        condicion_eu: i.condicion.eu,
        pregunta_es: i.pregunta.es,
        pregunta_eu: i.pregunta.eu,
        incompatible_con: i.incompatibleCon,
        requiere: [],
        requiere_local: i.requiereLocal,
        cita: cita("ARTÍCULO 5", 7),
      })),
      cita: cita("ARTÍCULO 5", 7),
    },
    requisitos: REQUISITOS.map((r) => ({
      id: r.id,
      tipo: "acceso" as const,
      texto: r.texto.es,
      texto_eu: r.texto.eu,
      pregunta_es: r.pregunta.es,
      pregunta_eu: r.pregunta.eu,
      respuesta_que_cumple: true,
      aplica_a: r.aplicaA === "sociedad" ? "Sociedades (personas jurídicas)" : null,
      aplica_forma: r.aplicaA ?? null,
      cita: cita(r.art.toUpperCase().replace("ART.", "ARTÍCULO").replace(/S\b/, ""), r.id === "R09" ? 4 : r.id === "R10" ? 7 : 5),
    })),
    exclusiones: [{ texto: REQUISITOS.find((r) => r.id === "R08")!.texto.es, cita: cita("ARTÍCULO 3", 4) }],
    documentos: DOCUMENTOS.map((d) => ({
      id: d.id,
      nombre: d.nombre.es,
      nombre_eu: d.nombre.eu,
      descripcion: d.descripcion.es,
      descripcion_eu: d.descripcion.eu,
      obligatoriedad: d.aplica({ forma: "autonomo", incrementos: [], altaReta: false }) === true && d.aplica({ forma: "sociedad", incrementos: [], altaReta: false }) === true ? ("siempre" as const) : ("condicional" as const),
      condicion: d.condicion?.es ?? null,
      condicion_eu: d.condicion?.eu ?? null,
      grupo: d.grupo,
      firma: d.firma,
      validez_meses: d.validezMeses,
      momento: d.momento,
      comprobaciones: d.comprobaciones,
      cita: cita("ARTÍCULO 8", 13),
    })),
    gastos: {
      periodo: "Desde 2 meses antes del alta en el IAE hasta 12 meses después. Las obras del local pueden ser anteriores.",
      subvencionables: ["Constitución (licencias, notaría, registro, tasas)", "Compra de una empresa existente", "Inversiones afectas (leasing: cuotas sin intereses)", "Vehículos solo con uso exclusivo demostrable", "Patentes y marcas", "Formación ligada a la actividad", "Cuotas de autónomo y de la Seguridad Social", "Nóminas (si el alta se justifica con contrato indefinido)", "Obras de acondicionamiento", "Comunicación (publicidad, web, redes)", "Con incremento de alquiler: alquiler, hipoteca y gestión inmobiliaria", "Con incremento de obras: escaparates, iluminación, albañilería, fachada, accesibilidad, proyecto técnico y licencias"],
      excluidos: Object.values(REGLAS_GASTO).map((g) => g.texto.es),
      reglas_justificantes: ["Facturas de al menos 100 € sin impuestos (salvo cuotas de autónomo) (G01)", "Pagadas en su totalidad (G02)", "Solo tarjeta, transferencia o domiciliación; nada de efectivo ni Bizum (G03)", "Justificante con beneficiario, concepto, importe y fecha; no valen listados de movimientos (G04)", "El IVA no se subvenciona (G05)"],
      cita: cita("ARTÍCULO 6", 9),
    },
    plazos: [
      { hito: "Solicitud (convocatoria de prueba SAISS)", hito_eu: "Eskaera (SAISS proba-deialdia)", plazo: "Del 1 al 30 de septiembre de 2026", plazo_eu: "2026ko irailaren 1etik 30era", cita: cita("Portal", 1) },
      { hito: "Subsanación de documentación", plazo: "10 días hábiles desde el requerimiento, solo por el portal", cita: cita("ARTÍCULO 9", 14) },
      { hito: "Resolución", plazo: "Máximo 4 meses desde el registro (sin contar la subsanación). Sin resolución no se entiende concedida.", cita: cita("ARTÍCULO 10", 15) },
      { hito: "Primer pago", plazo: "Al resolver, por los gastos justificados, hasta el 80 % de lo concedido", cita: cita("ARTÍCULO 11", 16) },
      { hito: "Justificación final", plazo: "A los 12 meses del alta en el IAE, con 1 mes de plazo", cita: cita("ARTÍCULO 11", 16) },
    ],
    presentacion: { canal: "Telemática, en el portal de Fomento de San Sebastián (Ayudas → Solicitar nueva ayuda). Los anexos completos y firmados electrónicamente (PDF con firma PAdES).", contacto: `${CONTACTO.telefono} · ${CONTACTO.email} (asunto «${CONTACTO.asunto}»)`, cita: cita("ARTÍCULO 8", 13) },
    subsanacion: { plazo_dias_habiles: PLAZOS.subsanacionDiasHabiles, canal: "Se requiere por email y por el portal; solo se puede subsanar por el portal.", consecuencia: "Si no se subsana en plazo, la solicitud queda excluida.", cita: cita("ARTÍCULO 9", 14) },
  };
}

// ───────────── Adaptador genérico sobre la ficha ─────────────

export type DatosSolicitud = {
  forma?: FormaJuridica;
  local?: boolean;
  hipoteca?: boolean;
  alta_reta?: boolean;
  innovador_via?: "programa" | "memoria";
  incrementos?: string[];
};

// Documentos que aplican a una solicitud. Si la ficha procede de las reglas codificadas (tiene `grupo`),
// se usan las condiciones programadas; si no, la obligatoriedad de la ficha.
export function documentosAplicables(ficha: Ficha, datos: DatosSolicitud) {
  const caso: CasoDocumentos = {
    forma: datos.forma ?? "autonomo",
    incrementos: (datos.incrementos ?? []) as IncrementoId[],
    innovadorVia: datos.innovador_via,
    altaReta: datos.alta_reta ?? false,
    hipoteca: datos.hipoteca,
  };
  return ficha.documentos
    .filter((d) => d.momento !== "justificacion")
    .map((d) => {
      const def = DOCUMENTOS.find((x) => x.id === d.id);
      const aplica = d.grupo && def ? def.aplica(caso) : d.obligatoriedad === "siempre" ? true : "opcional";
      return { ...d, aplica };
    });
}

export function cuantiaDesdeDatos(ficha: Ficha, datos: DatosSolicitud) {
  if (ficha.cuantia.maximo_sin_local == null) return null;
  return calcularCuantia({ local: datos.local ?? false, incrementos: (datos.incrementos ?? []) as IncrementoId[] });
}

// Código de expediente del portal: XXXX/AAAA/XXXX (secuencial / año / sufijo del programa)
export function codigoExpediente(n: number, anio = new Date().getFullYear()) {
  return `${String(n).padStart(4, "0")}/${anio}/SAIS`;
}
