"""Genera documentos FICTICIOS para demostrar y evaluar la revisión documental.
Todos los nombres, NIF y datos son inventados. Uso: python3 scripts/demo_documentos.py
"""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

SALIDA = Path(__file__).resolve().parent.parent / "data" / "demo"
SALIDA.mkdir(parents=True, exist_ok=True)

ANCHO, ALTO = A4


def pie(c):
    # La marca de documento ficticio va en los metadatos para no interferir con la revisión en la demo
    c.setTitle("Documento ficticio de pruebas (SAISS)")
    c.setSubject("Documento ficticio generado para pruebas del prototipo SAISS. No tiene validez.")
    c.setAuthor("")
    c.setCreator("")


def factura(nombre, numero, fecha, emisor, cif_emisor, lineas, forma_pago, pagada=True):
    c = canvas.Canvas(str(SALIDA / nombre), pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(2 * cm, ALTO - 2.5 * cm, emisor)
    c.setFont("Helvetica", 9)
    c.drawString(2 * cm, ALTO - 3.0 * cm, f"CIF {cif_emisor} · Calle Inventada 12, 20013 Donostia / San Sebastián")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(2 * cm, ALTO - 4.3 * cm, f"FACTURA N.º {numero}")
    c.setFont("Helvetica", 10)
    c.drawString(2 * cm, ALTO - 4.9 * cm, f"Fecha de emisión: {fecha}")
    c.drawString(11 * cm, ALTO - 4.3 * cm, "Cliente: Muestra Ejemplo Cocina S.L.")
    c.drawString(11 * cm, ALTO - 4.9 * cm, "CIF B00000000 · Altza, Donostia")
    y = ALTO - 6.5 * cm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2 * cm, y, "Concepto")
    c.drawRightString(ANCHO - 2 * cm, y, "Importe (€)")
    c.line(2 * cm, y - 0.2 * cm, ANCHO - 2 * cm, y - 0.2 * cm)
    c.setFont("Helvetica", 10)
    base = 0
    for concepto, importe in lineas:
        y -= 0.7 * cm
        c.drawString(2 * cm, y, concepto)
        c.drawRightString(ANCHO - 2 * cm, y, f"{importe:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
        base += importe
    iva = round(base * 0.21, 2)
    for etiqueta, valor in (("Base imponible", base), ("IVA 21 %", iva), ("TOTAL", base + iva)):
        y -= 0.8 * cm
        c.setFont("Helvetica-Bold" if etiqueta == "TOTAL" else "Helvetica", 10)
        c.drawString(11 * cm, y, etiqueta)
        c.drawRightString(ANCHO - 2 * cm, y, f"{valor:,.2f} €".replace(",", "X").replace(".", ",").replace("X", "."))
    y -= 1.4 * cm
    c.setFont("Helvetica", 10)
    c.drawString(2 * cm, y, f"Forma de pago: {forma_pago}")
    if pagada:
        y -= 0.6 * cm
        c.drawString(2 * cm, y, f"Estado: PAGADA el {fecha}")
    pie(c)
    c.save()


factura(
    "factura_reforma_escaparate.pdf", "2026-0142", "12/03/2026", "Reformas Ejemplo Donosti S.L.", "B00000001",
    [("Sustitución de escaparate del local comercial a pie de calle", 2400.00), ("Pintura interior del local", 800.00)],
    "Transferencia bancaria a ES00 0000 0000 0000 0000 0000",
)
factura(
    "factura_diseno_web_bizum.pdf", "W-0088", "20/04/2026", "Estudio Creativo Ficticio", "00000000T",
    [("Diseño de logotipo y página web del negocio", 450.00)],
    "Bizum",
)
factura(
    "factura_sillas_85.pdf", "M-311", "02/05/2026", "Muebles Inventados S.A.", "A00000002",
    [("Dos sillas para zona de clientes", 85.00)],
    "Tarjeta de débito",
)

# Contrato de alquiler con firma solo de la parte arrendadora (incidencia: debe estar firmado por ambas partes)
c = canvas.Canvas(str(SALIDA / "contrato_alquiler_local.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 14)
c.drawCentredString(ANCHO / 2, ALTO - 2.5 * cm, "CONTRATO DE ARRENDAMIENTO DE LOCAL DE NEGOCIO")
texto = [
    "En Donostia / San Sebastián, a 1 de febrero de 2026.",
    "",
    "REUNIDOS",
    "De una parte, D.ª Itziar Ficticia Ejemplo, con NIF 00000001R, en calidad de ARRENDADORA.",
    "De otra parte, Muestra Ejemplo Cocina S.L., con CIF B00000000, representada por D.ª Ane Muestra",
    "Prueba, con NIF 00000002W, en calidad de ARRENDATARIA.",
    "",
    "CLÁUSULAS",
    "PRIMERA. Objeto. La arrendadora cede en arrendamiento el local comercial situado a pie de calle",
    "en Calle Inventada 3, bajo, barrio de Altza, 20017 Donostia / San Sebastián.",
    "SEGUNDA. Destino. El local se destinará a la actividad de cocina para llevar.",
    "TERCERA. Duración. Cinco años desde el 1 de febrero de 2026.",
    "CUARTA. Renta. 950 euros mensuales más IVA, pagaderos por domiciliación bancaria.",
    "QUINTA. Fianza. Dos mensualidades.",
    "",
    "Y en prueba de conformidad, firman el presente contrato por duplicado.",
]
y = ALTO - 4 * cm
for linea in texto:
    c.setFont("Helvetica-Bold" if linea in ("REUNIDOS", "CLÁUSULAS") else "Helvetica", 10)
    c.drawString(2 * cm, y, linea)
    y -= 0.6 * cm
y -= 1 * cm
c.drawString(2.5 * cm, y, "LA ARRENDADORA")
c.drawString(12 * cm, y, "LA ARRENDATARIA")
c.setFont("Times-Italic", 18)
c.drawString(2.5 * cm, y - 1.3 * cm, "I. Ficticia")
c.setFont("Helvetica", 9)
c.drawString(12 * cm, y - 1.3 * cm, "(sin firma)")
pie(c)
c.save()

# Certificado de titularidad bancaria
c = canvas.Canvas(str(SALIDA / "certificado_titularidad.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 14)
c.drawString(2 * cm, ALTO - 2.5 * cm, "BANCO INVENTADO · Certificado de titularidad de cuenta")
lineas = [
    "Banco Inventado, S.A. certifica que la cuenta con IBAN ES00 0000 0000 0000 0000 0001",
    "figura abierta en esta entidad a nombre de MUESTRA EJEMPLO COCINA S.L., CIF B00000000,",
    "desde el 15 de enero de 2026.",
    "",
    "Y para que conste, se expide el presente certificado en Donostia, a 18 de marzo de 2026.",
]
y = ALTO - 4 * cm
c.setFont("Helvetica", 10)
for linea in lineas:
    c.drawString(2 * cm, y, linea)
    y -= 0.6 * cm
c.setStrokeColorRGB(0.1, 0.3, 0.6)
c.circle(15 * cm, y - 2 * cm, 1.6 * cm)
c.setFont("Helvetica-Bold", 8)
c.setFillColorRGB(0.1, 0.3, 0.6)
c.drawCentredString(15 * cm, y - 2 * cm, "BANCO INVENTADO")
c.drawCentredString(15 * cm, y - 2.4 * cm, "Oficina 0001")
c.setFillGray(0)
pie(c)
c.save()

# Vida laboral (informe) con alta en RETA en 2026
c = canvas.Canvas(str(SALIDA / "vida_laboral.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 13)
c.drawString(2 * cm, ALTO - 2.5 * cm, "INFORME DE VIDA LABORAL")
c.setFont("Helvetica", 10)
c.drawString(2 * cm, ALTO - 3.3 * cm, "Titular: ANE MUESTRA PRUEBA · NIF 00000002W · Fecha del informe: 25/03/2026")
y = ALTO - 4.6 * cm
cab = ["Régimen", "Empresa / situación", "Fecha alta", "Fecha baja"]
xs = [2, 5.5, 12.5, 15.5]
c.setFont("Helvetica-Bold", 9)
for x, t in zip(xs, cab):
    c.drawString(x * cm, y, t)
filas = [
    ["General", "Hostelería Imaginaria S.L.", "01/06/2021", "31/12/2025"],
    ["General", "Prestación por desempleo", "01/01/2026", "28/02/2026"],
    ["Autónomos", "RETA · Cocina para llevar", "01/03/2026", "—"],
]
c.setFont("Helvetica", 9)
for fila in filas:
    y -= 0.6 * cm
    for x, t in zip(xs, fila):
        c.drawString(x * cm, y, t)
pie(c)
c.save()

# Factura correcta con justificante de transferencia (caso sin incidencias)
factura(
    "factura_licencia_apertura.pdf", "T-2026-031", "05/03/2026", "Gestoría Ejemplo Urgull S.L.", "B00000003",
    [("Tramitación de licencia de apertura y actividad del local", 620.00)],
    "Transferencia bancaria (se adjunta justificante)",
)
c = canvas.Canvas(str(SALIDA / "justificante_transferencia.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 13)
c.drawString(2 * cm, ALTO - 2.5 * cm, "BANCO INVENTADO · Justificante de transferencia")
datos = [
    ("Fecha de la operación", "06/03/2026"),
    ("Ordenante", "MUESTRA EJEMPLO COCINA S.L. · ES00 0000 0000 0000 0000 0001"),
    ("Beneficiario", "GESTORÍA EJEMPLO URGULL S.L. · ES00 0000 0000 0000 0000 0003"),
    ("Concepto", "Pago factura T-2026-031 licencia de apertura"),
    ("Importe", "750,20 EUR"),
    ("Estado", "Ejecutada"),
]
y = ALTO - 4 * cm
for k, v in datos:
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2 * cm, y, k)
    c.setFont("Helvetica", 10)
    c.drawString(7 * cm, y, v)
    y -= 0.7 * cm
pie(c)
c.save()

# Factura anterior al periodo subvencionable (alta IAE 01/03/2026; gasto de octubre de 2025)
factura(
    "factura_horno_octubre2025.pdf", "H-7781", "10/10/2025", "Equipamientos Hosteleros Inventados S.L.", "B00000004",
    [("Horno de convección profesional", 2900.00)],
    "Transferencia bancaria",
)

# Contrato indefinido a jornada parcial del 40 % (no cumple el mínimo del 50 %)
c = canvas.Canvas(str(SALIDA / "contrato_indefinido_parcial.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 13)
c.drawCentredString(ANCHO / 2, ALTO - 2.5 * cm, "CONTRATO DE TRABAJO INDEFINIDO A TIEMPO PARCIAL")
lineas = [
    "Empresa: MUESTRA EJEMPLO COCINA S.L. · CIF B00000000 · Centro de trabajo: Altza, Donostia.",
    "Persona trabajadora: Jon Inventado Ejemplo · NIF 00000003A.",
    "Categoría: ayudante de cocina.",
    "Fecha de inicio: 15/04/2026. Duración: indefinida.",
    "Jornada: 16 horas semanales (40 % de la jornada ordinaria a tiempo completo de 40 horas).",
    "Distribución: martes a jueves por la tarde.",
    "Salario: según convenio de hostelería de Gipuzkoa, en proporción a la jornada.",
]
y = ALTO - 4 * cm
c.setFont("Helvetica", 10)
for linea in lineas:
    c.drawString(2 * cm, y, linea)
    y -= 0.7 * cm
y -= 1 * cm
c.drawString(2.5 * cm, y, "La empresa")
c.drawString(12 * cm, y, "La persona trabajadora")
c.setFont("Times-Italic", 16)
c.drawString(2.5 * cm, y - 1.2 * cm, "A. Muestra")
c.drawString(12 * cm, y - 1.2 * cm, "J. Inventado")
pie(c)
c.save()

# Documento no relacionado con la solicitud
c = canvas.Canvas(str(SALIDA / "carta_menu.pdf"), pagesize=A4)
c.setFont("Helvetica-Bold", 20)
c.drawCentredString(ANCHO / 2, ALTO - 3 * cm, "Cocina para llevar · Carta de otoño")
y = ALTO - 5 * cm
c.setFont("Helvetica", 12)
for plato, precio in (("Txangurro al horno", "14,50"), ("Bacalao al pil-pil", "16,00"), ("Pantxineta", "5,50")):
    c.drawString(4 * cm, y, plato)
    c.drawRightString(ANCHO - 4 * cm, y, precio + " €")
    y -= 1 * cm
pie(c)
c.save()

print("Documentos ficticios en", SALIDA)
for f in sorted(SALIDA.iterdir()):
    print(" -", f.name)
