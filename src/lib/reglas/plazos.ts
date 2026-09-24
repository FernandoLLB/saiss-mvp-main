// Plazos del expediente (bloque F): días hábiles de subsanación, resolución a 4 meses y caducidad de certificados.
import { PLAZOS } from "@/lib/reglas/creacion2025";

export function sumarDiasHabiles(desde: Date, dias: number) {
  const d = new Date(desde);
  let n = 0;
  while (n < dias) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return d;
}

export function diasHabilesRestantes(desde: Date, dias: number, hoy = new Date()) {
  const fin = sumarDiasHabiles(desde, dias);
  let n = 0;
  const d = new Date(hoy);
  d.setHours(0, 0, 0, 0);
  while (d < fin) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return fin < hoy ? 0 : n;
}

export function plazosExpediente(s: { estado: string; presentada_en: Date | null; requerida_en: Date | null }, hoy = new Date()) {
  const out: { tipo: "subsanacion" | "resolucion"; texto: string; tono: "ok" | "aviso" | "error" | "neutro"; fin: Date }[] = [];
  if (s.estado === "requerimiento" && s.requerida_en) {
    const fin = sumarDiasHabiles(new Date(s.requerida_en), PLAZOS.subsanacionDiasHabiles);
    const restan = diasHabilesRestantes(new Date(s.requerida_en), PLAZOS.subsanacionDiasHabiles, hoy);
    out.push({ tipo: "subsanacion", fin, texto: restan === 0 ? "Plazo de subsanación vencido" : `Subsanación: ${restan} día${restan === 1 ? "" : "s"} hábil${restan === 1 ? "" : "es"}`, tono: restan === 0 ? "error" : restan <= 3 ? "aviso" : "neutro" });
  }
  if (["presentada", "en_revision", "requerimiento"].includes(s.estado) && s.presentada_en) {
    const fin = new Date(s.presentada_en);
    fin.setMonth(fin.getMonth() + PLAZOS.resolucionMeses);
    const dias = Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000);
    out.push({ tipo: "resolucion", fin, texto: dias < 0 ? "Plazo de resolución vencido" : `Resolución: ${dias} días (4 meses)`, tono: dias < 0 ? "error" : dias <= 30 ? "aviso" : "neutro" });
  }
  return out;
}
