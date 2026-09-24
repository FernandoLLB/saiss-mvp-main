"use server";

import { revalidatePath } from "next/cache";
import { exigirTecnico } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { generarFicha } from "@/lib/ia/ficha";
import { FichaSchema } from "@/lib/kb/ficha";

// Publicar la ficha exige una persona técnica: la ciudadanía nunca ve reglas extraídas por IA sin validar.
export async function validarFicha(formData: FormData) {
  const tecnico = await exigirTecnico();
  const slug = String(formData.get("slug"));
  const json = String(formData.get("ficha") ?? "");
  const actual = await one<{ ficha: unknown }>("SELECT ficha FROM convocatoria WHERE slug=$1", [slug]);
  if (!actual) return;

  let ficha = actual.ficha;
  let editada = false;
  if (json.trim()) {
    ficha = FichaSchema.parse(JSON.parse(json));
    editada = JSON.stringify(ficha) !== JSON.stringify(actual.ficha);
  }
  await query("UPDATE convocatoria SET ficha=$1, validada_por=$2, validada_en=now(), estado='publicada' WHERE slug=$3", [JSON.stringify(ficha), tecnico, slug]);
  await query(
    `UPDATE evento_ia SET decision_humana=$1, decision_por=$2, decision_en=now()
      WHERE id = (SELECT max(id) FROM evento_ia WHERE tipo='ficha_convocatoria' AND convocatoria=$3)`,
    [editada ? "corregida" : "aceptada", tecnico, slug],
  );
  revalidatePath(`/gestion/convocatorias/${slug}`);
}

export async function regenerarFicha(formData: FormData) {
  await exigirTecnico();
  const slug = String(formData.get("slug"));
  await generarFicha(slug);
  revalidatePath(`/gestion/convocatorias/${slug}`);
}
