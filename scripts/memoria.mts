// Maqueta la memoria técnica (Sobre B) desde ../memoria/BORRADOR.md a PDF con Chrome sin interfaz.
// Formato de las bases (11.3): A4, Arial 10, interlineado sencillo, márgenes de 2 cm, máx. 30 páginas con portada e índice.
// Uso: pnpm memoria [--final]   (--final falla si quedan marcas pendientes)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import puppeteer from "puppeteer-core";

const DIR = path.resolve("../memoria");
const SALIDA = path.join(DIR, "salida");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MAX_PAGINAS = 30;
fs.mkdirSync(SALIDA, { recursive: true });

let md = fs.readFileSync(path.join(DIR, "BORRADOR.md"), "utf8");
const lema = md.match(/\*\*LEMA: ([^*]+)\*\*/)?.[1].trim() ?? "LEMA";
// Fuera: título de trabajo, línea del lema y notas de borrador
md = md
  .replace(/^# MEMORIA TÉCNICA.*\n/m, "")
  .replace(/^\*\*LEMA:.*\n/m, "")
  .replace(/^> .*\n/gm, "")
  .replace(/^---\n/gm, "");

const marcas = md.match(/`\[(CASO DE USO|MÉTRICA|DECISIÓN|CAPTURA|ENLACE ANÓNIMO|verificar|calcular)[^\]]*\]`|\[(DECISIÓN|CASO DE USO|verificar)[^\]]*\]/g) ?? [];
if (process.argv.includes("--final") && marcas.length) {
  console.error(`Quedan ${marcas.length} marcas pendientes:\n${[...new Set(marcas)].join("\n")}`);
  process.exit(1);
}

// Diagramas
const ARQUITECTURA = `<figure class="diagrama"><svg viewBox="0 0 760 330" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-size="11">
  <style>.c{fill:#e2efed;stroke:#0b5c63}.s{fill:#fff;stroke:#0b5c63}.t{fill:#f5f6f2;stroke:#8a96a3}.h{font-weight:bold;fill:#10243e}.x{fill:#10243e}.m{fill:#4a5868;font-size:10px}</style>
  <text x="10" y="18" class="h">CANALES</text>
  <rect x="10" y="26" width="360" height="54" rx="8" class="c"/><text x="190" y="48" text-anchor="middle" class="h">Portal ciudadano eu/es</text><text x="190" y="66" text-anchor="middle" class="m">Pregunta · Autodiagnóstico · Solicitud guiada · WCAG 2.2 AA</text>
  <rect x="390" y="26" width="360" height="54" rx="8" class="c"/><text x="570" y="48" text-anchor="middle" class="h">Panel técnico FSS</text><text x="570" y="66" text-anchor="middle" class="m">Revisión · Validación de fichas · Requerimientos · Indicadores</text>
  <text x="10" y="104" class="h">SERVICIOS (API REST)</text>
  ${[
    ["Conocimiento", "Bases → fragmentos citables", "→ ficha validada"],
    ["Conversacional", "Respuesta con citas", "sin fuente → derivación"],
    ["Documental", "Lectura PDF/imagen, clasificación", "extracción, comprobaciones"],
    ["Expediente", "Revisión cruzada", "gastos y pendientes"],
    ["Motor de reglas", "Autodiagnóstico e importes", "deterministas"],
  ]
    .map(([t, a, b], i) => `<rect x="${10 + i * 150}" y="112" width="140" height="70" rx="8" class="s"/><text x="${80 + i * 150}" y="134" text-anchor="middle" class="h">${t}</text><text x="${80 + i * 150}" y="152" text-anchor="middle" class="m">${a}</text><text x="${80 + i * 150}" y="166" text-anchor="middle" class="m">${b}</text>`)
    .join("")}
  <rect x="10" y="196" width="740" height="46" rx="8" class="s"/><text x="380" y="215" text-anchor="middle" class="h">Orquestador de IA</text><text x="380" y="232" text-anchor="middle" class="m">Instrucciones versionadas · salidas validadas por esquema · caché de contexto · modelo de respaldo · abstracción de proveedor (región UE)</text>
  <text x="10" y="264" class="h">DATOS Y TRANSVERSALES</text>
  <rect x="10" y="272" width="240" height="50" rx="8" class="t"/><text x="130" y="292" text-anchor="middle" class="h">PostgreSQL (UE, cifrado)</text><text x="130" y="309" text-anchor="middle" class="m">Base de conocimiento · expedientes</text>
  <rect x="260" y="272" width="240" height="50" rx="8" class="t"/><text x="380" y="292" text-anchor="middle" class="h">Registro de IA y auditoría</text><text x="380" y="309" text-anchor="middle" class="m">Fuentes · coste · decisión humana</text>
  <rect x="510" y="272" width="240" height="50" rx="8" class="t"/><text x="630" y="292" text-anchor="middle" class="h">Identidad y seguridad (ENS)</text><text x="630" y="309" text-anchor="middle" class="m">SSO/MFA · roles · interoperabilidad</text>
</svg><figcaption>Figura A. Arquitectura funcional y tecnológica por capas.</figcaption></figure>`;

const semanas = 21;
const tareas: [string, number, number, string][] = [
  ["F1 · Planificación y diseño detallado (UX research, EIPD, riesgos)", 1, 4, "f1"],
  ["F2 · Base de conocimiento y asistente del caso de uso", 5, 8, "f2"],
  ["F2 · Revisión documental, expediente y panel técnico", 6, 12, "f2"],
  ["F2 · Integraciones mínimas, seguridad y accesibilidad", 9, 14, "f2"],
  ["F2 · Batería de evaluación ampliada y revisión lingüística", 11, 14, "f2"],
  ["F3 · Piloto interno en paralelo", 15, 16, "f3"],
  ["F3 · Piloto con personas solicitantes", 17, 20, "f3"],
  ["F3 · Formación, informe de resultados y cierre", 19, 21, "f3"],
];
const GANTT = `<figure class="diagrama"><table class="gantt"><thead><tr><th></th>${Array.from({ length: semanas }, (_, i) => `<th>${i + 1}</th>`).join("")}</tr></thead><tbody>${tareas
  .map(
    ([t, a, b, f]) =>
      `<tr><td class="tarea">${t}</td>${Array.from({ length: semanas }, (_, i) => `<td class="${i + 1 >= a && i + 1 <= b ? f : ""}">${[4, 14, 21].includes(i + 1) && i + 1 === b ? "◆" : ""}</td>`).join("")}</tr>`,
  )
  .join("")}</tbody></table><figcaption>Figura B. Cronograma del MVP en semanas. ◆ Hitos de aceptación y pago: H1 (S4), H2 (S14), H3 (S21).</figcaption></figure>`;

md = md.replace("<!--DIAGRAMA:arquitectura-->", ARQUITECTURA).replace("<!--DIAGRAMA:gantt-->", GANTT);
let cuerpo = await marked.parse(md, { gfm: true });
// Marcas pendientes resaltadas en el borrador
cuerpo = cuerpo.replace(/<code>\[([^\]]+)\]<\/code>/g, '<mark>[$1]</mark>');

// Encabezados con id para el índice
const titulos: { nivel: number; texto: string; id: string }[] = [];
cuerpo = cuerpo.replace(/<h([23])>(.*?)<\/h\1>/g, (_m, nivel, texto) => {
  const id = `s${titulos.length}`;
  titulos.push({ nivel: Number(nivel), texto: texto.replace(/<[^>]+>/g, ""), id });
  return `<h${nivel} id="${id}">${texto}</h${nivel}>`;
});

const CSS = `
@page { size: A4; margin: 2cm 2cm 2.2cm 2cm; }
* { box-sizing: border-box; }
html { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.15; color: #10243e; }
body { margin: 0; }
h2 { font-size: 13pt; color: #0b5c63; margin: 14pt 0 5pt; border-bottom: 1.5pt solid #0b5c63; padding-bottom: 2pt; break-after: avoid; }
h2.nueva { break-before: page; }
h3 { font-size: 11pt; margin: 10pt 0 4pt; break-after: avoid; }
h4 { font-size: 10pt; margin: 8pt 0 3pt; break-after: avoid; }
p { margin: 0 0 5pt; text-align: justify; }
ul, ol { margin: 0 0 5pt; padding-left: 14pt; }
li { margin: 0 0 2pt; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 8pt; break-inside: auto; }
th, td { border: 0.5pt solid #b9c1c9; padding: 2.5pt 4pt; vertical-align: top; text-align: left; font-size: 10pt; }
th { background: #e2efed; }
tr { break-inside: avoid; }
code { font-family: Arial; font-size: 10pt; }
mark { background: #fde68a; color: #7c2d12; }
figure { margin: 6pt 0 10pt; break-inside: avoid; }
figure.dos { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; align-items: start; }
figure.dos img, figure.una img { width: 100%; border: 0.5pt solid #b9c1c9; border-radius: 4pt; object-fit: cover; object-position: top; }
figure.dos img { height: 7cm; }
figure.dos.alta img { height: 10.5cm; }
figure.una img { max-height: 11cm; }
figcaption { grid-column: 1 / -1; font-size: 10pt; color: #4a5868; font-style: italic; margin-top: 2pt; }
.diagrama svg { width: 100%; height: auto; }
table.gantt th, table.gantt td { padding: 1.5pt 0; text-align: center; font-size: 10pt; border-color: #dfe3e8; }
table.gantt td.tarea { text-align: left; padding: 1.5pt 4pt; width: 44%; }
td.f1 { background: #7fb3b8; } td.f2 { background: #0b5c63; color: #fff; } td.f3 { background: #b4400b; color: #fff; }
.portada { height: 25.5cm; display: flex; flex-direction: column; justify-content: center; text-align: center; break-after: page; }
.portada .lema { font-size: 34pt; font-weight: bold; color: #0b5c63; letter-spacing: 2pt; margin: 18pt 0; }
.portada p { text-align: center; font-size: 12pt; }
.indice { break-after: page; }
.indice ol { list-style: none; padding: 0; }
.indice li { display: flex; gap: 4pt; margin: 0 0 3pt; }
.indice li.n3 { padding-left: 14pt; }
.indice .puntos { flex: 1; border-bottom: 0.8pt dotted #8a96a3; margin-bottom: 3pt; }
`;

function html(paginas: Record<string, number>) {
  const indice = titulos
    .filter((t) => t.nivel === 2 || t.nivel === 3)
    .map((t) => `<li class="n${t.nivel}"><span>${t.texto}</span><span class="puntos"></span><span>${paginas[t.id] ?? ""}</span></li>`)
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Memoria técnica · ${lema}</title><style>${CSS}</style></head><body>
<section class="portada">
  <p>CONCURSO DE PROYECTOS</p>
  <p><strong>Diseñar, desarrollar, implantar y validar un MVP del Servicio de Atención Inteligente de Fomento de San Sebastián (SAISS)</strong></p>
  <p>SOBRE B · Propuesta técnica anónima</p>
  <div class="lema">${lema}</div>
  <p>Memoria técnica</p>
</section>
<section class="indice"><h2>Índice</h2><ol>${indice}</ol></section>
${cuerpo}
</body></html>`;
}

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true });
const pagina = await navegador.newPage();
const pdf = path.join(SALIDA, "memoria-sobre-b.pdf");
const htmlRuta = path.join(SALIDA, "memoria-sobre-b.html");

async function render(paginas: Record<string, number>) {
  fs.writeFileSync(htmlRuta, html(paginas));
  await pagina.goto(`file://${htmlRuta}`, { waitUntil: "load" });
  await pagina.pdf({
    path: pdf,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-family:Arial;font-size:9pt;color:#4a5868;padding:0 2cm;display:flex;justify-content:space-between"><span>${lema}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
}

// Las imágenes se referencian desde ../ respecto a salida/
cuerpo = cuerpo.replaceAll('src="capturas/', 'src="../capturas/');

// Primera pasada sin números; segunda con la página real de cada apartado
await render({});
const localizar = () => {
  const total = Number(execFileSync("pdfinfo", [pdf]).toString().match(/Pages:\s+(\d+)/)![1]);
  const textos = Array.from({ length: total }, (_, i) => execFileSync("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), "-layout", pdf, "-"]).toString());
  const paginas: Record<string, number> = {};
  for (const t of titulos) {
    const clave = t.texto.replace(/\s+/g, " ").slice(0, 40);
    const n = textos.findIndex((txt, i) => i > 1 && txt.replace(/\s+/g, " ").includes(clave));
    if (n !== -1) paginas[t.id] = n + 1;
  }
  return { total, paginas };
};
const primera = localizar();
await render(primera.paginas);
const { total } = localizar();
await navegador.close();

// Metadatos: sin autor ni organización (anonimato, bases 13.3)
const info = execFileSync("pdfinfo", [pdf]).toString();
console.log(info.split("\n").filter((l) => /Title|Author|Creator|Producer|Pages/.test(l)).join("\n"));
console.log(`\n${total <= MAX_PAGINAS ? "✓" : "✗"} ${total} páginas (máximo ${MAX_PAGINAS})${marcas.length ? ` · ${marcas.length} marcas pendientes resaltadas` : ""}`);
console.log(pdf);
