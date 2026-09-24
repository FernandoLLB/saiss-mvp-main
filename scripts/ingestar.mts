// Carga las convocatorias de data/convocatorias.json en la base de conocimiento.
// Uso: pnpm ingestar [--publicar]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import { pool } from "../src/lib/db";
import { segmentar } from "../src/lib/kb/segmentar";

type Manifest = {
  slug: string;
  titulo_es: string;
  titulo_eu: string;
  resumen_es: string;
  resumen_eu: string;
  fuente_url: string;
  carpeta: string;
  documentos: { fichero: string; tipo: "bases" | "anexo" | "faq"; titulo: string }[];
};

const ORIGEN = process.env.KB_ORIGEN ?? path.resolve("../app-data/convocatorias");
const DESTINO = path.resolve("data/kb");
const publicar = process.argv.includes("--publicar");

const manifest: Manifest[] = JSON.parse(fs.readFileSync("data/convocatorias.json", "utf8"));

for (const c of manifest) {
  await pool.query(
    `INSERT INTO convocatoria (slug, titulo_es, titulo_eu, resumen_es, resumen_eu, fuente_url, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (slug) DO UPDATE SET titulo_es=$2, titulo_eu=$3, resumen_es=$4, resumen_eu=$5, fuente_url=$6,
       estado = CASE WHEN $8 THEN 'publicada' ELSE convocatoria.estado END`,
    [c.slug, c.titulo_es, c.titulo_eu, c.resumen_es, c.resumen_eu, c.fuente_url, publicar ? "publicada" : "borrador", publicar],
  );

  for (const d of c.documentos) {
    const origen = path.join(ORIGEN, c.carpeta, d.fichero);
    const relativo = path.join(c.slug, d.fichero);
    fs.mkdirSync(path.join(DESTINO, c.slug), { recursive: true });
    fs.copyFileSync(origen, path.join(DESTINO, relativo));

    const bytes = fs.readFileSync(origen);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const fragmentos = segmentar(text);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO kb_documento (convocatoria, tipo, titulo, fichero, sha256, paginas, validado)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (convocatoria, fichero) DO UPDATE SET tipo=$2, titulo=$3, sha256=$5, paginas=$6, cargado_en=now()
         RETURNING id`,
        [c.slug, d.tipo, d.titulo, relativo, sha256, totalPages],
      );
      const documentoId = rows[0].id;
      await client.query("DELETE FROM kb_fragmento WHERE documento=$1", [documentoId]);
      for (const [orden, f] of fragmentos.entries()) {
        await client.query(
          "INSERT INTO kb_fragmento (documento, orden, pagina, seccion, texto) VALUES ($1,$2,$3,$4,$5)",
          [documentoId, orden, f.pagina, f.seccion, f.texto],
        );
      }
      await client.query("COMMIT");
      console.log(`✓ ${c.slug} · ${d.fichero}: ${totalPages} págs, ${fragmentos.length} fragmentos`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

await pool.end();
