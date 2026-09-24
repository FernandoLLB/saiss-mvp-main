// Auditoría automática de accesibilidad (axe-core, reglas WCAG 2.0/2.1/2.2 A y AA) sobre las páginas principales.
// Uso: pnpm accesibilidad   (servidor de desarrollo arrancado)
// Informe: ../memoria/evaluacion/accesibilidad-<fecha>.md
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { one, pool } from "../src/lib/db";

const BASE = "http://localhost:3095";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const AXE = fs.readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const ETIQUETAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const borrador = await one<{ codigo: string }>("SELECT codigo FROM solicitud WHERE estado='borrador' ORDER BY creada_en DESC LIMIT 1");
const expediente = await one<{ codigo: string }>("SELECT codigo FROM solicitud WHERE estado<>'borrador' ORDER BY creada_en DESC LIMIT 1");
const paginas: [string, string, ((p: Page) => Promise<void>)?][] = [
  ["Portada (es)", "/es"],
  ["Portada (eu)", "/eu"],
  ["Convocatoria · chat (es)", "/es/ayudas/creacion-empresas-2026"],
  [
    "Convocatoria · autodiagnóstico (eu)",
    "/eu/ayudas/creacion-empresas-2026",
    async (p) => {
      await p.locator("::-p-text(Eska dezaket?)").click();
      await p.waitForSelector("[role=radiogroup]");
    },
  ],
  ...(borrador ? ([["Solicitud guiada (es)", `/es/solicitud/${borrador.codigo}`]] as [string, string][]) : []),
  ["Panel · acceso", "/gestion"],
];
const paginasGestion: [string, string][] = [
  ["Panel · resumen", "/gestion"],
  ...(expediente ? ([["Panel · expediente", `/gestion/solicitudes/${expediente.codigo}`]] as [string, string][]) : []),
  ["Panel · ficha de convocatoria", "/gestion/convocatorias/creacion-empresas-2026"],
];

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1280, height: 900 } });
const p = await navegador.newPage();
type Resultado = { pagina: string; violaciones: { id: string; impacto: string | null; ayuda: string; nodos: number; ejemplo: string }[]; superadas: number };
const resultados: Resultado[] = [];

async function auditar(nombre: string, ruta: string, preparar?: (p: Page) => Promise<void>) {
  await p.goto(`${BASE}${ruta}`, { waitUntil: "networkidle0" });
  if (preparar) await preparar(p);
  await p.evaluate(AXE);
  const r = (await p.evaluate(
    (etiquetas) => (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<unknown> } }).axe.run(document, { runOnly: { type: "tag", values: etiquetas } }),
    ETIQUETAS,
  )) as { violations: { id: string; impact: string | null; help: string; nodes: { target: string[] }[] }[]; passes: unknown[] };
  resultados.push({
    pagina: nombre,
    superadas: r.passes.length,
    violaciones: r.violations.map((v) => ({ id: v.id, impacto: v.impact, ayuda: v.help, nodos: v.nodes.length, ejemplo: v.nodes[0]?.target.join(" ") ?? "" })),
  });
  console.log(`${r.violations.length ? "✗" : "✓"} ${nombre}: ${r.violations.length} tipos de incumplimiento, ${r.passes.length} reglas superadas`);
}

for (const [nombre, ruta, preparar] of paginas) await auditar(nombre, ruta, preparar);
await p.type("#nombre", "Auditoría");
await p.type("#pin", process.env.GESTION_PIN ?? "2026");
await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.locator("::-p-text(Entrar)").click()]);
for (const [nombre, ruta] of paginasGestion) await auditar(nombre, ruta);
await navegador.close();

const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const md = [
  `# Auditoría automática de accesibilidad · ${new Date().toLocaleString("es-ES")}`,
  "",
  `Herramienta: axe-core ${JSON.parse(fs.readFileSync("node_modules/axe-core/package.json", "utf8")).version} · reglas ${ETIQUETAS.join(", ")}. La auditoría automática no sustituye la revisión manual ni las pruebas con personas usuarias.`,
  "",
  "| Página | Reglas superadas | Incumplimientos |",
  "|---|---|---|",
  ...resultados.map((r) => `| ${r.pagina} | ${r.superadas} | ${r.violaciones.length === 0 ? "0" : r.violaciones.map((v) => `${v.id} (${v.impacto}, ${v.nodos})`).join("; ")} |`),
  "",
  ...resultados.flatMap((r) => r.violaciones.map((v) => `- **${r.pagina}** · ${v.id}: ${v.ayuda} · ej. \`${v.ejemplo}\``)),
];
const salida = path.resolve("../memoria/evaluacion", `accesibilidad-${fecha}.md`);
fs.writeFileSync(salida, md.join("\n"));
console.log(`Informe: ${salida}`);
await pool.end();
