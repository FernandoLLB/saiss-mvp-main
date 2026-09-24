// Genera las capturas de la memoria con Chrome sin interfaz (el servidor de desarrollo debe estar arrancado).
// Uso: pnpm capturas [--base http://localhost:3095]
// Las imágenes no contienen URL, marcas ni datos identificativos (requisito de anonimato del Sobre B).
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";

const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3095";
const SALIDA = path.resolve("../memoria/capturas");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CONV = "creacion-empresas-2025";
fs.mkdirSync(SALIDA, { recursive: true });

const navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1360, height: 900, deviceScaleFactor: 2 } });
const pagina = await navegador.newPage();

async function guardar(p: Page, nombre: string, selector?: string) {
  const ruta = path.join(SALIDA, `${nombre}.png`) as `${string}.png`;
  if (selector) {
    const el = await p.waitForSelector(selector, { timeout: 15_000 });
    await el!.screenshot({ path: ruta });
  } else {
    await p.screenshot({ path: ruta });
  }
  console.log(`✓ ${nombre}`);
}

async function clicTexto(p: Page, texto: string) {
  await p.locator(`::-p-text(${texto})`).click();
}

async function preguntar(p: Page, pregunta: string) {
  await p.type("#pregunta", pregunta);
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => document.querySelector("details summary")?.textContent?.match(/Fuentes|Iturriak/), { timeout: 120_000 });
  await p.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
    // Muestra la conversación completa (sin scroll interno) y sin foco en el campo de texto
    document.querySelectorAll<HTMLElement>("[aria-live=polite].overflow-y-auto").forEach((el) => {
      el.style.maxHeight = "none";
    });
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

// 1. Portada en euskera
await pagina.goto(`${BASE}/eu`, { waitUntil: "networkidle0" });
await guardar(pagina, "01-portada-eu");

// 2. Chat en castellano con cálculo y fuentes
await pagina.goto(`${BASE}/es/ayudas/${CONV}`, { waitUntil: "networkidle0" });
await preguntar(pagina, "Soy una mujer de 30 años, autónoma, y he alquilado un local a pie de calle en Intxaurrondo. ¿Cuánto podría recibir?");
await guardar(pagina, "02-chat-calculo-fuentes", "[role=tabpanel]");

// 3. Chat en euskera
await pagina.goto(`${BASE}/eu/ayudas/${CONV}`, { waitUntil: "networkidle0" });
await preguntar(pagina, "2025ean Altzan denda bat ireki nuen, alokairuan, eta emakumea naiz. Laguntza eska dezaket eta zenbat dagokit?");
await guardar(pagina, "03-chat-euskera", "[role=tabpanel]");

// 4. Autodiagnóstico
await pagina.goto(`${BASE}/es/ayudas/${CONV}`, { waitUntil: "networkidle0" });
await clicTexto(pagina, "¿Puedo solicitarla?");
await pagina.waitForSelector("[role=group]");
await pagina.evaluate(() => {
  for (const b of document.querySelectorAll<HTMLButtonElement>("[role=radio]")) if (b.textContent?.trim().startsWith("Sociedad")) b.click();
});
await new Promise((r) => setTimeout(r, 300));
// Local: sí; requisitos: sí; incrementos del expediente A (colectivo, itinerario, alquiler, distrito)
await pagina.evaluate(() => {
  const grupos = [...document.querySelectorAll<HTMLElement>("[role=group]")];
  const si = ["colectivo", "itinerario", "alquiler_hipoteca", "distrito_este"];
  for (const g of grupos) {
    const id = g.getAttribute("aria-labelledby") ?? "";
    if (id === "forma") continue;
    const botones = [...g.querySelectorAll<HTMLButtonElement>("[role=radio]")];
    const esInc = id.startsWith("i-");
    const marcarSi = !esInc || si.includes(id.slice(2));
    (marcarSi ? botones[0] : botones[1])?.click();
  }
});
await new Promise((r) => setTimeout(r, 500));
await guardar(pagina, "04-autodiagnostico", "[role=tabpanel]");

// 5. Solicitud guiada con documentos revisados
const { codigo } = await (await fetch(`${BASE}/api/solicitudes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ convocatoria: CONV, idioma: "es" }) })).json();
await fetch(`${BASE}/api/solicitudes/${codigo}`, {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ datos: { solicitante: "Jon Demo Prueba", nif: "00000021K", forma: "autonomo", fecha_alta_iae: "2025-04-15", via_empleo: "alta_reta", local: true, incrementos: ["alquiler_hipoteca"] } }),
});
for (const [fichero, nombre, tipo] of [["B_factura_candados.pdf", "factura_herramientas.pdf", "DOC-15"], ["B_factura_web_bizum.pdf", "factura_web.pdf", "DOC-15"], ["B_certificado_hacienda.pdf", "certificado_hacienda.pdf", "DOC-19"], ["B_datos_bancarios.pdf", "datos_bancarios.pdf", "DOC-02"]]) {
  const form = new FormData();
  form.set("fichero", new File([fs.readFileSync(path.resolve("data/demo2025", fichero))], nombre, { type: "application/pdf" }));
  form.set("tipo", tipo);
  await fetch(`${BASE}/api/solicitudes/${codigo}/documentos`, { method: "POST", body: form });
}
await pagina.goto(`${BASE}/es/solicitud/${codigo}`, { waitUntil: "networkidle0" });
await guardar(pagina, "05-solicitud-datos", "section[aria-labelledby=paso1]");
await guardar(pagina, "06-solicitud-documentos", "section[aria-labelledby=paso2]");

// 6. Panel técnico
await pagina.goto(`${BASE}/gestion`, { waitUntil: "networkidle0" });
await pagina.type("#nombre", "Técnica FSS");
await pagina.type("#pin", process.env.GESTION_PIN ?? "2026");
await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), clicTexto(pagina, "Entrar")]);
await guardar(pagina, "07-panel-resumen");

const expediente = await pagina.$eval("table a[href^='/gestion/solicitudes/']", (a) => a.getAttribute("href"));
await pagina.goto(`${BASE}${expediente}`, { waitUntil: "networkidle0" });
await guardar(pagina, "08-expediente");
await pagina.setViewport({ width: 1360, height: 2400, deviceScaleFactor: 2 });
await guardar(pagina, "08b-expediente-completo");
await pagina.setViewport({ width: 1360, height: 900, deviceScaleFactor: 2 });

await pagina.goto(`${BASE}/gestion/convocatorias/${CONV}`, { waitUntil: "networkidle0" });
await guardar(pagina, "09-ficha-convocatoria");

await pagina.goto(`${BASE}/gestion/actividad`, { waitUntil: "networkidle0" });
await guardar(pagina, "10-registro-ia");

// 7. Móvil
await pagina.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true });
await pagina.goto(`${BASE}/eu/ayudas/${CONV}`, { waitUntil: "networkidle0" });
await guardar(pagina, "11-movil-eu");

await navegador.close();
console.log(`Capturas en ${SALIDA}`);
