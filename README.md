# SAISS · MVP

Servicio de Atención Inteligente de Ayudas y Subvenciones. Caso de uso: **Ayudas a la creación de nuevas empresas 2025** (convocatoria de prueba SAISS). Producto anónimo: solo aparece el nombre «SAISS».

## Tres piezas

1. **Asistente conversacional** bilingüe (euskera por defecto / castellano) con citas al artículo y página de las bases, guías y manuales.
2. **Revisión documental con IA**: extracción de datos con LLM + reglas deterministas de la convocatoria (IDs R/G/DOC/F con su artículo).
3. **Panel de supervisión** para el personal técnico: expedientes `XXXX/AAAA/XXXX`, estado de cada documento (recibido / validado / rechazado / obsoleto), alertas, plazos, presupuesto (280.000 €), conversaciones y registro de IA. La IA propone y la persona decide.

## Módulos

| Módulo | Ruta | Tipo |
|---|---|---|
| Reglas de la convocatoria (cuantía, requisitos, documentos, gastos, plazos) | `src/lib/reglas/creacion2025.ts`, `plazos.ts`, `revision.ts`, `tests/reglas.test.mts` | **Específico de SAISS** (código determinista, sin IA) |
| Ficha de la convocatoria y motor de cálculo genérico | `src/lib/kb/ficha.ts`, `calculo.ts` | Genérico (cualquier convocatoria) |
| Base de conocimiento: ingesta de PDF en fragmentos citables | `src/lib/kb/segmentar.ts`, `contexto.ts`, `scripts/ingestar.mts` | Genérico |
| Motor de chat con citas nativas y registro | `src/lib/ia/chat.ts`, `prompts.ts` | Genérico |
| Extracción documental, revisión cruzada, requerimientos, valoración de memoria innovadora | `src/lib/ia/documento.ts`, `expediente.ts`, `requerimiento.ts` | Genérico con instrucciones específicas |
| Cliente LLM, registro de auditoría (`evento_ia`) y costes | `src/lib/ia/cliente.ts` | Genérico (conector a modelo, sustituible) |
| Portal ciudadano (chat, autodiagnóstico, solicitud guiada) | `src/app/(publico)`, `src/components/*` | Específico de SAISS |
| Panel técnico | `src/app/(gestion)` | Específico de SAISS |
| Evaluación automática, accesibilidad, capturas, datos de demo | `scripts/` | Herramientas |

Especificación normativa: `docs/Reglas_validacion.md` (fuente de verdad), `docs/bases_ES.txt`, `docs/bases_EUS.txt`, guías.

## Puesta en marcha

```bash
pnpm install
createdb saiss && pnpm db          # esquema PostgreSQL
pnpm ingestar --publicar           # base de conocimiento (data/convocatorias.json)
pnpm reglas                        # ficha codificada de la convocatoria 2025
python3 scripts/demo_2025.py       # documentos ficticios
pnpm demo2025 --limpiar            # expedientes A/B/C y conversaciones de demo
pnpm test                          # tests de las reglas (cuantía, gastos, documentos, caducidad)
pnpm dev                           # http://localhost:3095 → /eu
```

`.env.local`: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `SAISS_MODEL` (por defecto `claude-haiku-4-5`), `GESTION_PIN`.

Portal: `/eu` · `/es`. Panel: `/gestion` (nombre + PIN).
