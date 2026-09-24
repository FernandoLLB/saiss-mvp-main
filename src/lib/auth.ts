import crypto from "node:crypto";
import { cookies } from "next/headers";

// Acceso de demostración al panel técnico (nombre + PIN). En el piloto se sustituye por el SSO corporativo de FSS.
const COOKIE = "saiss_gestion";
const secreto = () => `${process.env.GESTION_PIN ?? ""}:${process.env.ANTHROPIC_API_KEY?.slice(-12) ?? "saiss"}`;

const firmar = (valor: string) => crypto.createHmac("sha256", secreto()).update(valor).digest("base64url");

export async function tecnicoActual(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return null;
  const [nombre64, firma] = valor.split(".");
  if (!nombre64 || !firma) return null;
  const esperada = firmar(nombre64);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  return Buffer.from(nombre64, "base64url").toString("utf8");
}

export async function iniciarSesion(nombre: string, pin: string) {
  if (!process.env.GESTION_PIN || pin !== process.env.GESTION_PIN || !nombre.trim()) return false;
  const nombre64 = Buffer.from(nombre.trim().slice(0, 60)).toString("base64url");
  (await cookies()).set(COOKIE, `${nombre64}.${firmar(nombre64)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 10 });
  return true;
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

export async function exigirTecnico() {
  const nombre = await tecnicoActual();
  if (!nombre) throw new Error("No autorizado");
  return nombre;
}
