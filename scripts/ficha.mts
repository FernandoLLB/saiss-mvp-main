// Genera (o regenera) la ficha estructurada de una o varias convocatorias.
// Uso: pnpm ficha creacion-empresas-2026 [otra-convocatoria…]
import { pool } from "../src/lib/db";
import { generarFicha } from "../src/lib/ia/ficha";

const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error("Indica al menos un slug de convocatoria");
  process.exit(1);
}

for (const slug of slugs) {
  const t = Date.now();
  const { ficha, eventoId, costeUsd } = await generarFicha(slug);
  console.log(
    `✓ ${slug}: ${ficha.requisitos.length} requisitos, ${ficha.documentos.length} documentos, ${ficha.cuantia.incrementos.length} incrementos · evento ${eventoId} · ${costeUsd.toFixed(3)} USD · ${((Date.now() - t) / 1000).toFixed(0)} s`,
  );
}
await pool.end();
