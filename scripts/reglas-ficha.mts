// Carga la ficha codificada de la convocatoria 2025 (sin IA) y la deja validada por el equipo técnico.
import { pool, query } from "../src/lib/db";
import { fichaCreacion2025, SLUG } from "../src/lib/reglas/creacion2025";
import { FichaSchema } from "../src/lib/kb/ficha";
const ficha = FichaSchema.parse(fichaCreacion2025());
await query(
  `UPDATE convocatoria SET ficha=$1, ficha_version=ficha_version+1, validada_por='Reglas de la convocatoria (código)', validada_en=now(), estado='publicada' WHERE slug=$2`,
  [JSON.stringify(ficha), SLUG],
);
console.log(`✓ Ficha de ${SLUG} cargada: ${ficha.requisitos.length} requisitos, ${ficha.documentos.length} documentos, ${ficha.cuantia.incrementos.length} incrementos`);
await pool.end();
