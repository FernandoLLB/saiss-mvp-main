import { z } from "zod";

const Cita = z.object({
  seccion: z.string().describe("Artículo o anexo, p. ej. 'ARTÍCULO 4'"),
  pagina: z.number().int(),
});

// La ficha se genera en partes: un único esquema completo supera el tamaño de gramática de la salida estructurada.
export const FichaCuantiaSchema = z.object({
  objeto: z.string().describe("Para qué es la ayuda, en una o dos frases claras"),
  beneficiarios: z.string(),
  cuantia: z.object({
    base: z.number().nullable().describe("Importe base en euros, si existe"),
    maximo: z.number().nullable(),
    maximo_sin_local: z.number().nullable().optional(),
    pregunta_local_es: z.string().optional(),
    pregunta_local_eu: z.string().optional(),
    explicacion: z.string(),
    incrementos: z.array(
      z.object({
        id: z.string().describe("identificador corto en snake_case"),
        etiqueta: z.string(),
        etiqueta_eu: z.string().optional(),
        importe: z.number().nullable().describe("Importe fijo en euros, si lo hay"),
        importe_maximo: z.number().nullable().describe("Tope en euros cuando el importe depende de facturas o presupuestos"),
        condicion: z.string(),
        condicion_eu: z.string().optional(),
        pregunta_es: z.string(),
        pregunta_eu: z.string(),
        requiere_local: z.boolean().optional(),
        incompatible_con: z.array(z.string()).describe("ids de incrementos incompatibles"),
        requiere: z.array(z.string()).describe("ids de incrementos que deben cumplirse también"),
        cita: Cita,
      }),
    ),
    cita: Cita,
  }),
});

export const FichaRequisitosSchema = z.object({
  requisitos: z.array(
    z.object({
      id: z.string(),
      tipo: z
        .enum(["acceso", "tramite", "compromiso"])
        .describe("acceso: condición para poder ser beneficiaria · tramite: cómo presentar · compromiso: obligación posterior a la concesión"),
      texto: z.string(),
      texto_eu: z.string().optional(),
      pregunta_es: z.string().describe("Pregunta sí/no para comprobar el requisito"),
      pregunta_eu: z.string(),
      respuesta_que_cumple: z.boolean(),
      aplica_a: z.string().nullable().describe("Solo si aplica a un tipo de solicitante (p. ej. personas jurídicas)"),
      aplica_forma: z.enum(["autonomo", "sociedad"]).nullable().optional(),
      cita: Cita,
    }),
  ),
  exclusiones: z.array(z.object({ texto: z.string(), cita: Cita })),
});

export const FichaDocumentosSchema = z.object({
  documentos: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      nombre_eu: z.string().optional(),
      descripcion: z.string(),
      descripcion_eu: z.string().optional(),
      grupo: z.enum(["subvencion", "empresa", "oficio"]).optional(),
      firma: z.boolean().optional(),
      validez_meses: z.number().nullable().optional(),
      obligatoriedad: z.enum(["siempre", "condicional"]),
      condicion: z.string().nullable(),
      condicion_eu: z.string().nullable().optional(),
      momento: z.enum(["solicitud", "justificacion", "solicitud_o_justificacion"]),
      comprobaciones: z.array(z.string()),
      cita: Cita,
    }),
  ),
});

export const FichaTramitacionSchema = z.object({
  gastos: z.object({
    periodo: z.string(),
    subvencionables: z.array(z.string()),
    excluidos: z.array(z.string()),
    reglas_justificantes: z.array(z.string()).describe("Formas de pago admitidas, importes mínimos, IVA…"),
    cita: Cita,
  }),
  plazos: z.array(z.object({ hito: z.string(), hito_eu: z.string().optional(), plazo: z.string(), plazo_eu: z.string().optional(), cita: Cita })),
  presentacion: z.object({ canal: z.string(), contacto: z.string(), cita: Cita }),
  subsanacion: z.object({ plazo_dias_habiles: z.number().nullable(), canal: z.string(), consecuencia: z.string(), cita: Cita }),
});

export const FichaSchema = FichaCuantiaSchema.extend(FichaRequisitosSchema.shape)
  .extend(FichaDocumentosSchema.shape)
  .extend(FichaTramitacionSchema.shape);

export type Ficha = z.infer<typeof FichaSchema>;
