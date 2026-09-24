-- SAISS · modelo de datos del prototipo
-- Base de conocimiento validada → atención conversacional → solicitud guiada → revisión documental → supervisión

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ───────────── Base de conocimiento ─────────────

CREATE TABLE IF NOT EXISTS convocatoria (
  slug            text PRIMARY KEY,
  titulo_es       text NOT NULL,
  titulo_eu       text,
  resumen_es      text,
  resumen_eu      text,
  fuente_url      text,
  -- borrador: ficha extraída por IA pendiente de validar · publicada: visible para la ciudadanía
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicada','archivada')),
  -- ficha estructurada (requisitos, documentos, cuantías, gastos, plazos), cada elemento con su cita
  ficha           jsonb,
  ficha_version   int NOT NULL DEFAULT 0,
  validada_por    text,
  validada_en     timestamptz,
  creada_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_documento (
  id              serial PRIMARY KEY,
  convocatoria    text NOT NULL REFERENCES convocatoria(slug) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('bases','anexo','faq')),
  titulo          text NOT NULL,
  fichero         text NOT NULL,
  sha256          text NOT NULL,
  paginas         int NOT NULL,
  validado        boolean NOT NULL DEFAULT false,
  cargado_en      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (convocatoria, fichero)
);

-- Fragmentos citables (párrafos). El índice del fragmento dentro del documento es la unidad de cita.
CREATE TABLE IF NOT EXISTS kb_fragmento (
  id              serial PRIMARY KEY,
  documento       int NOT NULL REFERENCES kb_documento(id) ON DELETE CASCADE,
  orden           int NOT NULL,
  pagina          int NOT NULL,
  seccion         text,
  texto           text NOT NULL,
  tsv             tsvector GENERATED ALWAYS AS (to_tsvector('spanish', texto)) STORED,
  UNIQUE (documento, orden)
);
CREATE INDEX IF NOT EXISTS kb_fragmento_tsv ON kb_fragmento USING gin (tsv);

-- ───────────── Atención conversacional ─────────────

CREATE TABLE IF NOT EXISTS conversacion (
  id              uuid PRIMARY KEY,
  convocatoria    text REFERENCES convocatoria(slug),
  idioma          text NOT NULL DEFAULT 'es',
  canal           text NOT NULL DEFAULT 'web',
  tema            text,               -- clasificación heurística: cuantia · requisitos · documentacion · gastos · plazos · firma · otro
  creada_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensaje (
  id              serial PRIMARY KEY,
  conversacion    uuid NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE,
  rol             text NOT NULL CHECK (rol IN ('user','assistant')),
  texto           text NOT NULL,
  citas           jsonb,
  -- respondida · sin_fuente (no hay base documental) · derivada (a persona técnica)
  resultado       text,
  valoracion      smallint,           -- 1 útil · -1 no útil
  evento_ia       int,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Solicitudes y documentación ─────────────

CREATE TABLE IF NOT EXISTS solicitud (
  codigo          text PRIMARY KEY,
  convocatoria    text NOT NULL REFERENCES convocatoria(slug),
  idioma          text NOT NULL DEFAULT 'es',
  solicitante     text,
  datos           jsonb NOT NULL DEFAULT '{}',
  estado          text NOT NULL DEFAULT 'borrador'
                  CHECK (estado IN ('borrador','presentada','en_revision','requerimiento','completa','resuelta','concedida','denegada')),
  expediente      text,               -- código del portal, formato XXXX/AAAA/XXXX
  presentada_en   timestamptz,
  requerida_en    timestamptz,        -- inicio del plazo de subsanación
  resuelta_en     timestamptz,
  resuelta_por    text,
  importe_concedido numeric(10,2),
  importe_estimado numeric(10,2),
  -- revisión cruzada de todos los documentos del expediente (propuesta IA)
  revision_cruzada jsonb,
  revision_cruzada_en timestamptz,
  revision_cruzada_evento int,
  creada_en       timestamptz NOT NULL DEFAULT now(),
  actualizada_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documento (
  id              serial PRIMARY KEY,
  solicitud       text NOT NULL REFERENCES solicitud(codigo) ON DELETE CASCADE,
  nombre          text NOT NULL,
  mime            text NOT NULL,
  ruta            text NOT NULL,
  bytes           int NOT NULL,
  contenido       bytea,
  -- análisis IA: tipo detectado, datos extraídos, comprobaciones
  tipo_detectado  text,
  confianza       real,
  analisis        jsonb,
  -- supervisión humana
  revision        text NOT NULL DEFAULT 'pendiente' CHECK (revision IN ('pendiente','validado','corregido','rechazado','obsoleto')),
  tipo_declarado  text,               -- tipo elegido por la persona al subir (tabla D)
  firma_ok        boolean,            -- resultado simulado de la validación de firma del portal (F02-F04)
  revision_nota   text,
  revisado_por    text,
  revisado_en     timestamptz,
  evento_ia       int,
  subido_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requerimiento (
  id              serial PRIMARY KEY,
  solicitud       text NOT NULL REFERENCES solicitud(codigo) ON DELETE CASCADE,
  borrador_es     text NOT NULL,
  borrador_eu     text,
  incidencias     jsonb NOT NULL,
  estado          text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','aprobado','descartado')),
  aprobado_por    text,
  aprobado_en     timestamptz,
  evento_ia       int,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Trazabilidad y supervisión ─────────────

-- Registro de cada uso de IA: qué modelo, con qué versión de instrucciones, qué fuentes, qué coste
-- y qué decidió después la persona. Base para auditoría, métricas y obligaciones del AI Act.
CREATE TABLE IF NOT EXISTS evento_ia (
  id              serial PRIMARY KEY,
  origen          text NOT NULL DEFAULT 'piloto', -- piloto · evaluacion
  tipo            text NOT NULL,        -- chat · clasificacion_documento · ficha_convocatoria · requerimiento · evaluacion
  convocatoria    text,
  solicitud       text,
  modelo          text NOT NULL,
  modelo_servido  text,                 -- modelo que respondió realmente (fallback)
  prompt_version  text NOT NULL,
  entrada_resumen text,
  salida          jsonb,
  fuentes         jsonb,
  tokens_entrada  int,
  tokens_salida   int,
  tokens_cache_lectura int,
  tokens_cache_escritura int,
  latencia_ms     int,
  coste_usd       numeric(10,5),
  stop_reason     text,
  error           text,
  -- supervisión humana posterior
  decision_humana text,                 -- aceptada · corregida · rechazada
  decision_por    text,
  decision_en     timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS evento_ia_tipo_fecha ON evento_ia (tipo, creado_en DESC);
