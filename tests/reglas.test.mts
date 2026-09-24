import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularCuantia, documentosRequeridos, estaObsoleto, evaluarGasto } from "../src/lib/reglas/creacion2025";

test("sin local: base + colectivo, tope 5.100", () => {
  const r = calcularCuantia({ local: false, incrementos: ["colectivo", "itinerario", "proyecto_innovador"] });
  assert.equal(r.importe, 1500 + 150 + 450 + 3000);
  assert.equal(r.tope, 5100);
  assert.equal(r.importe, 5100);
});
test("sin local no aplica alquiler ni distrito", () => {
  const r = calcularCuantia({ local: false, incrementos: ["alquiler_hipoteca", "distrito_este"] });
  assert.equal(r.importe, 1500);
  assert.deepEqual(r.descartados.map((d) => d.id), ["alquiler_hipoteca", "distrito_este"]);
});
test("expediente A: sociedad, mujer, itinerario, alquiler en Altza = 4.600", () => {
  const r = calcularCuantia({ local: true, incrementos: ["colectivo", "itinerario", "alquiler_hipoteca", "distrito_este"] });
  assert.equal(r.importe, 4600);
});
test("local, obras, distrito e innovador: 10.600 se queda en 10.000", () => {
  const r = calcularCuantia({ local: true, incrementos: ["colectivo", "itinerario", "obras_local", "distrito_este", "proyecto_innovador"] });
  assert.equal(r.bruto, 10600);
  assert.equal(r.importe, 10000);
});
test("alquiler y obras incompatibles: gana obras (mayor)", () => {
  const r = calcularCuantia({ local: true, incrementos: ["alquiler_hipoteca", "obras_local"] });
  assert.equal(r.importe, 6500);
  assert.equal(r.descartados[0].id, "alquiler_hipoteca");
});
test("gastos: G01, G03, G09", () => {
  assert.deepEqual(evaluarGasto({ concepto: "sillas", fecha: "2025-05-02", base_imponible: 85, forma_pago: "tarjeta", pagada: true }, "2025-03-01").map((i) => i.regla), ["G01"]);
  assert.deepEqual(evaluarGasto({ concepto: "web", fecha: "2025-04-20", base_imponible: 450, forma_pago: "Bizum", pagada: true }, "2025-03-01").map((i) => i.regla), ["G03"]);
  assert.deepEqual(evaluarGasto({ concepto: "horno", fecha: "2024-10-10", base_imponible: 2900, forma_pago: "transferencia", pagada: true }, "2025-03-01").map((i) => i.regla), ["G09"]);
  assert.deepEqual(evaluarGasto({ concepto: "cuota", fecha: "2025-04-01", base_imponible: 80, forma_pago: "domiciliación", pagada: true, es_cuota_autonomos: true }, "2025-03-01"), []);
});
test("documentos según el caso", () => {
  const auto = documentosRequeridos({ forma: "autonomo", incrementos: ["alquiler_hipoteca"], altaReta: true }).map((d) => d.id);
  assert.ok(auto.includes("DOC-13") && auto.includes("DOC-10") && !auto.includes("DOC-05") && !auto.includes("DOC-07"));
  const soc = documentosRequeridos({ forma: "sociedad", incrementos: ["proyecto_innovador"], innovadorVia: "memoria", altaReta: false }).map((d) => d.id);
  assert.ok(soc.includes("DOC-04") && soc.includes("DOC-05") && soc.includes("DOC-07") && !soc.includes("DOC-13"));
});
test("certificado de Hacienda caducado a los 6 meses", () => {
  assert.equal(estaObsoleto("DOC-19", "2026-01-10", new Date("2026-09-24")), true);
  assert.equal(estaObsoleto("DOC-19", "2026-06-10", new Date("2026-09-24")), false);
  assert.equal(estaObsoleto("DOC-17", "2026-06-10", new Date("2026-09-24")), true);
});
