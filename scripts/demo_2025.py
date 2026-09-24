"""Documentos FICTICIOS para los expedientes de demo de la convocatoria 2025 (A correcto, B con errores, C innovador).
Todos los nombres, NIF, IBAN y datos son inventados. Uso: python3 scripts/demo_2025.py
"""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

SALIDA = Path(__file__).resolve().parent.parent / "data" / "demo2025"
SALIDA.mkdir(parents=True, exist_ok=True)
ANCHO, ALTO = A4


def nuevo(nombre, titulo):
    c = canvas.Canvas(str(SALIDA / nombre), pagesize=A4)
    c.setTitle("Documento ficticio de pruebas (SAISS)")
    c.setSubject("Documento ficticio generado para pruebas del prototipo SAISS. No tiene validez.")
    c.setAuthor("")
    c.setCreator("")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, ALTO - 2.5 * cm, titulo)
    c.setFont("Helvetica", 10)
    return c


def lineas(c, textos, y=None, salto=0.62):
    y = y or ALTO - 3.6 * cm
    for t in textos:
        if t.startswith("#"):
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2 * cm, y, t[1:].strip())
            c.setFont("Helvetica", 10)
        else:
            c.drawString(2 * cm, y, t)
        y -= salto * cm
    return y


def firma(c, y, izquierda, derecha=None, firma_der=True, firma_izq=True):
    c.drawString(2.5 * cm, y, izquierda)
    if derecha:
        c.drawString(11.5 * cm, y, derecha)
    c.setFont("Times-Italic", 16)
    if firma_izq:
        c.drawString(2.5 * cm, y - 1.2 * cm, izquierda.split()[0].title() + " ✓")
    if derecha and firma_der:
        c.drawString(11.5 * cm, y - 1.2 * cm, derecha.split()[0].title() + " ✓")
    c.setFont("Helvetica", 10)


def anexo_solicitud(nombre, empresa, nif, actividad, socios, alta_iae, contratados, incrementos, minimis=False, firmado=True, comunicacion="Euskara"):
    c = nuevo(nombre, "AYUDAS A LA CREACIÓN DE NUEVAS EMPRESAS 2025 · ANEXO: SOLICITUD")
    y = lineas(c, [
        f"Nombre-Apellidos: {socios[0][1]}    DNI: {socios[0][0]}    Cargo: {'Administrador/a' if 'S.L.' in empresa else 'Titular'}",
        f"Razón social: {empresa}    NIF/CIF: {nif}",
        f"Actividad de la empresa: {actividad}",
        "Calle y nº: Calle Inventada 3, bajo    Municipio: Donostia / San Sebastián    CP: 20017    Teléfono: 943 000 000",
        f"E-mail (dato obligatorio): contacto@empresa-demo.example    Idioma de comunicación: {comunicacion}",
        "# DATOS DE LA NUEVA EMPRESA",
        f"Fecha Alta IAE: {alta_iae}    Número de personas contratadas: {contratados}",
        "# DATOS DE TODAS LAS PERSONAS SOCIAS",
        *[f"  DNI {d} · {n} · Fecha alta autónomos: {a}" for d, n, a in socios],
        "# DECLARACIÓN RESPONSABLE",
        "Conoce y acepta las bases; no está sancionada ni tiene reintegros pendientes; no es fundación ni asociación sin ánimo de lucro;",
        "no está participada >25 % por el sector público; cumple los arts. 3, 4 y 7 de las bases; no existe sobrefinanciación.",
        "# DECLARACIÓN DE MINIMIS",
        ("[X] Sí se han obtenido ayudas de minimis: Programa Demo · 2.000 € · concedida" if minimis else "[X] No se ha obtenido ni solicitado ninguna otra ayuda de minimis en el ejercicio fiscal actual y los dos anteriores."),
        "# SOLICITA que se apliquen los siguientes incrementos:",
        *[f"  [X] {i}" for i in incrementos],
        "  [ ] " + " · ".join(x for x in ["Colectivo", "Itinerario de Fomento", "Alquiler/hipoteca", "Obras", "Distrito Este", "Proyecto innovador"] if x not in incrementos),
    ])
    y -= 0.8 * cm
    c.drawString(2 * cm, y, "En Donostia / San Sebastián, a 5 de septiembre de 2026")
    if firmado:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.05, 0.35, 0.4)
        c.rect(2 * cm, y - 2.6 * cm, 9 * cm, 1.6 * cm)
        c.drawString(2.3 * cm, y - 1.5 * cm, f"Firmado electrónicamente (PAdES) por {socios[0][1]}")
        c.drawString(2.3 * cm, y - 2.1 * cm, "Certificado reconocido · 05/09/2026 10:12 · Validado por el portal")
        c.setFillGray(0)
    else:
        c.drawString(2 * cm, y - 1.5 * cm, "Firma: ____________________ (sin firma electrónica)")
    c.save()


def datos_bancarios(nombre, empresa, nif, iban):
    c = nuevo(nombre, "AYUDAS A LA CREACIÓN DE NUEVAS EMPRESAS 2025 · ANEXO: DATOS BANCARIOS")
    y = lineas(c, [f"Titular de la cuenta: {empresa}    NIF/CIF: {nif}", f"IBAN: {iban}", "Entidad: Banco Inventado, S.A. · Oficina 0001 · Donostia", "", "Diligencia de la entidad bancaria: se certifica que la cuenta indicada existe y figura a nombre del titular."])
    c.setStrokeColorRGB(0.1, 0.3, 0.6)
    c.circle(15 * cm, y - 1.5 * cm, 1.5 * cm)
    c.setFillColorRGB(0.1, 0.3, 0.6)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(15 * cm, y - 1.4 * cm, "BANCO INVENTADO")
    c.drawCentredString(15 * cm, y - 1.8 * cm, "Sello 12/09/2026")
    c.setFillGray(0)
    c.save()


def dni(nombre, persona, numero, nacimiento, sexo):
    c = nuevo(nombre, "DOCUMENTO NACIONAL DE IDENTIDAD (reproducción ficticia)")
    lineas(c, [f"Apellidos y nombre: {persona}", f"DNI: {numero}", f"Fecha de nacimiento: {nacimiento}    Sexo: {sexo}", "Nacionalidad: ESP    Validez: hasta 01/01/2032", "Domicilio: Donostia / San Sebastián (Gipuzkoa)"])
    c.save()


def cif(nombre, empresa, nif, domicilio):
    c = nuevo(nombre, "TARJETA DE IDENTIFICACIÓN FISCAL (reproducción ficticia)")
    lineas(c, [f"Denominación: {empresa}", f"NIF: {nif}", f"Domicilio fiscal: {domicilio}", "Administración: Hacienda Foral de Gipuzkoa · Fecha: 20/02/2025"])
    c.save()


def escrituras(nombre, empresa, nif, socios, fecha):
    c = nuevo(nombre, "ESCRITURA DE CONSTITUCIÓN DE SOCIEDAD LIMITADA (extracto ficticio)")
    lineas(c, [f"Denominación: {empresa} · NIF provisional {nif}", f"Fecha de otorgamiento: {fecha} · Notaría Inventada de Donostia · Protocolo 000/2025", "Domicilio social: Calle Inventada 3, bajo, 20017 Donostia / San Sebastián", "Objeto social: comercio al por menor y actividades complementarias.", "Capital social: 3.000 €.", "# Socias/os fundadores", *[f"  {n} · DNI {d} · participación {p} %" for d, n, p in socios], "", "Inscrita en el Registro Mercantil de Gipuzkoa, tomo 0000, folio 00, hoja SS-00000."])
    c.save()


def vida_laboral(nombre, persona, numero, filas, fecha_informe="15/09/2026"):
    c = nuevo(nombre, "INFORME DE VIDA LABORAL")
    c.drawString(2 * cm, ALTO - 3.3 * cm, f"Titular: {persona} · NIF {numero} · Fecha del informe: {fecha_informe}")
    y = ALTO - 4.6 * cm
    xs = [2, 5.5, 12.5, 15.5]
    c.setFont("Helvetica-Bold", 9)
    for x, t in zip(xs, ["Régimen", "Empresa / situación", "Fecha alta", "Fecha baja"]):
        c.drawString(x * cm, y, t)
    c.setFont("Helvetica", 9)
    for fila in filas:
        y -= 0.6 * cm
        for x, t in zip(xs, fila):
            c.drawString(x * cm, y, t)
    c.save()


def alta_reta(nombre, persona, numero, fecha):
    c = nuevo(nombre, "RESOLUCIÓN DE ALTA EN EL RÉGIMEN ESPECIAL DE TRABAJADORES AUTÓNOMOS")
    lineas(c, [f"Trabajador/a: {persona} · NIF {numero}", f"Fecha de efectos del alta: {fecha}", "Actividad: comercio al por menor · CNAE 4771", "Tesorería General de la Seguridad Social · Dirección Provincial de Gipuzkoa (documento ficticio)"])
    c.save()


def certificado_formacion(nombre, persona, fecha):
    c = nuevo(nombre, "DIPLOMA · PACK INICIO DE EMPRENDIMIENTO")
    lineas(c, [f"Se certifica que {persona} ha completado el itinerario Pack Inicio de los servicios de emprendimiento de Fomento de San Sebastián", "(sesiones de formación en emprendimiento y Modelo de Reflexión).", f"Fecha de finalización: {fecha}", "Documento ficticio para demostración."])
    c.save()


def contrato_alquiler(nombre, empresa, nif, arrendadora, direccion, renta, desde, firma_arrendataria=True):
    c = nuevo(nombre, "CONTRATO DE ARRENDAMIENTO DE LOCAL DE NEGOCIO")
    y = lineas(c, [f"En Donostia / San Sebastián, a {desde}.", "# REUNIDOS", f"De una parte, {arrendadora}, en calidad de ARRENDADORA.", f"De otra parte, {empresa}, con NIF {nif}, en calidad de ARRENDATARIA.", "# CLÁUSULAS", f"PRIMERA. Objeto: local comercial a pie de calle situado en {direccion}.", "SEGUNDA. Destino: actividad comercial de la arrendataria.", f"TERCERA. Duración: cinco años desde el {desde}.", f"CUARTA. Renta: {renta} euros mensuales más IVA, por domiciliación bancaria.", "QUINTA. Fianza: dos mensualidades.", "", "Y en prueba de conformidad, firman por duplicado."])
    firma(c, y - 0.8 * cm, "LA ARRENDADORA", "LA ARRENDATARIA", firma_der=firma_arrendataria)
    if not firma_arrendataria:
        c.setFont("Helvetica", 9)
        c.drawString(11.5 * cm, y - 2 * cm, "(sin firma)")
    c.save()


def factura(nombre, numero, fecha, emisor, cif_emisor, cliente, nif_cliente, conceptos, forma_pago, pagada=True):
    c = nuevo(nombre, f"FACTURA N.º {numero}")
    y = lineas(c, [f"Emisor: {emisor} · CIF {cif_emisor} · Donostia", f"Cliente: {cliente} · NIF {nif_cliente}", f"Fecha de emisión: {fecha}", ""])
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2 * cm, y, "Concepto")
    c.drawRightString(ANCHO - 2 * cm, y, "Importe (€)")
    c.line(2 * cm, y - 0.2 * cm, ANCHO - 2 * cm, y - 0.2 * cm)
    c.setFont("Helvetica", 10)
    base = 0
    for concepto, importe in conceptos:
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
        c.drawString(2 * cm, y - 0.6 * cm, f"Estado: PAGADA el {fecha}")
    c.save()
    return base + iva


def justificante(nombre, fecha, ordenante, iban_o, beneficiario, iban_b, concepto, importe):
    c = nuevo(nombre, "BANCO INVENTADO · Justificante de transferencia")
    lineas(c, [f"Fecha de la operación: {fecha}", f"Ordenante: {ordenante} · {iban_o}", f"Beneficiario: {beneficiario} · {iban_b}", f"Concepto: {concepto}", f"Importe: {importe:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", "."), "Estado: Ejecutada"])
    c.save()


def certificado_hacienda(nombre, empresa, nif, fecha):
    c = nuevo(nombre, "HACIENDA FORAL DE GIPUZKOA · Certificado de estar al corriente de obligaciones tributarias")
    lineas(c, [f"Contribuyente: {empresa} · NIF {nif}", "Se certifica que, a la fecha de expedición, se encuentra al corriente en el cumplimiento de sus obligaciones tributarias.", f"Fecha de expedición: {fecha}", "Validez: seis meses desde la fecha de expedición.", "Código seguro de verificación: FICTICIO-0000 (documento de demostración)."])
    c.save()


def memoria_innovador(nombre, empresa, proyecto, parrafos):
    c = nuevo(nombre, "ANEXO: MEMORIA DEL PROYECTO INNOVADOR")
    c.drawString(2 * cm, ALTO - 3.2 * cm, f"Empresa: {empresa} · Proyecto: {proyecto}")
    y = ALTO - 4.2 * cm
    for titulo, texto in parrafos:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(2 * cm, y, titulo)
        y -= 0.55 * cm
        c.setFont("Helvetica", 9.5)
        palabras = texto.split()
        linea = ""
        for p in palabras:
            if len(linea) + len(p) > 105:
                c.drawString(2 * cm, y, linea)
                y -= 0.48 * cm
                linea = p
            else:
                linea = (linea + " " + p).strip()
        c.drawString(2 * cm, y, linea)
        y -= 0.9 * cm
    c.save()


# ───────────── Expediente A · correcto ─────────────
A = "Txoko Berri Denda, S.L."
A_NIF = "B00000010"
A_SOC = [("00000011H", "Maddi Demo Ejemplo", "01/03/2025"), ("00000012J", "Iker Demo Ejemplo", "01/03/2025")]
anexo_solicitud("A_anexo_solicitud.pdf", A, A_NIF, "Comercio de productos locales", A_SOC, "01/03/2025", 0, ["Colectivo", "Itinerario de Fomento", "Alquiler/hipoteca", "Distrito Este"])
datos_bancarios("A_datos_bancarios.pdf", A, A_NIF, "ES00 0000 0000 0000 0000 0010")
dni("A_dni_maddi.pdf", "DEMO EJEMPLO, MADDI", "00000011H", "14/06/1992", "F")
dni("A_dni_iker.pdf", "DEMO EJEMPLO, IKER", "00000012J", "02/11/1988", "M")
cif("A_cif.pdf", A, A_NIF, "Calle Inventada 3, bajo, 20017 Donostia / San Sebastián")
escrituras("A_escrituras.pdf", A, A_NIF, [("00000011H", "Maddi Demo Ejemplo", 60), ("00000012J", "Iker Demo Ejemplo", 40)], "20/02/2025")
vida_laboral("A_vida_laboral.pdf", "MADDI DEMO EJEMPLO", "00000011H", [["General", "Comercio Imaginario S.A.", "01/09/2019", "31/12/2024"], ["Autónomos", "RETA · Txoko Berri Denda S.L.", "01/03/2025", "—"]])
alta_reta("A_alta_reta.pdf", "MADDI DEMO EJEMPLO", "00000011H", "01/03/2025")
certificado_formacion("A_pack_inicio.pdf", "Maddi Demo Ejemplo", "10/12/2024")
contrato_alquiler("A_contrato_alquiler.pdf", A, A_NIF, "D.ª Itziar Ficticia Ejemplo, NIF 00000001R", "Calle Inventada 3, bajo, barrio de Altza, 20017 Donostia / San Sebastián", 850, "1 de febrero de 2025")
t1 = factura("A_factura_licencia.pdf", "T-2025-031", "05/03/2025", "Gestoría Ejemplo Urgull S.L.", "B00000003", A, A_NIF, [("Tramitación de licencia de apertura y actividad del local", 620.00)], "Transferencia bancaria")
justificante("A_justificante_licencia.pdf", "06/03/2025", A, "ES00 0000 0000 0000 0000 0010", "GESTORÍA EJEMPLO URGULL S.L.", "ES00 0000 0000 0000 0000 0003", "Pago factura T-2025-031 licencia apertura", t1)
t2 = factura("A_factura_rotulo.pdf", "R-118", "20/03/2025", "Rótulos Inventados S.L.", "B00000005", A, A_NIF, [("Rótulo luminoso y vinilos de escaparate", 1180.00)], "Transferencia bancaria")
justificante("A_justificante_rotulo.pdf", "21/03/2025", A, "ES00 0000 0000 0000 0000 0010", "RÓTULOS INVENTADOS S.L.", "ES00 0000 0000 0000 0000 0005", "Pago factura R-118 rótulo", t2)
certificado_hacienda("A_certificado_hacienda.pdf", A, A_NIF, "02/09/2026")

# ───────────── Expediente B · con errores ─────────────
B = "Jon Demo Prueba (autónomo)"
B_NIF = "00000021K"
anexo_solicitud("B_anexo_solicitud.pdf", "Jon Demo Prueba", B_NIF, "Reparación de bicicletas", [("00000021K", "Jon Demo Prueba", "15/04/2025")], "15/04/2025", 0, ["Alquiler/hipoteca"])
datos_bancarios("B_datos_bancarios.pdf", "Jon Demo Prueba", B_NIF, "ES00 0000 0000 0000 0000 0021")
dni("B_dni.pdf", "DEMO PRUEBA, JON", "00000021K", "23/05/1979", "M")
vida_laboral("B_vida_laboral.pdf", "JON DEMO PRUEBA", "00000021K", [["General", "Talleres Ficticios S.L.", "01/02/2015", "31/03/2025"], ["Autónomos", "RETA · Reparación de bicicletas", "15/04/2025", "—"]])
alta_reta("B_alta_reta.pdf", "JON DEMO PRUEBA", "00000021K", "15/04/2025")
certificado_formacion("B_pack_inicio.pdf", "Jon Demo Prueba", "20/01/2025")
factura("B_factura_candados.pdf", "C-77", "02/06/2025", "Suministros Inventados S.L.", "B00000007", "Jon Demo Prueba", B_NIF, [("Juego de llaves dinamométricas", 80.00)], "Tarjeta de débito")
factura("B_factura_web_bizum.pdf", "W-0088", "20/05/2025", "Estudio Creativo Ficticio", "00000000T", "Jon Demo Prueba", B_NIF, [("Diseño de logotipo y página web del negocio", 450.00)], "Bizum")
certificado_hacienda("B_certificado_hacienda.pdf", "Jon Demo Prueba", B_NIF, "10/01/2026")
# Falta a propósito: B_contrato_alquiler (ha marcado el incremento por alquiler)

# ───────────── Expediente C · proyecto innovador ─────────────
C = "Bidasoa Sensor Lab, S.L."
C_NIF = "B00000030"
C_SOC = [("00000031L", "Nerea Demo Ikerketa", "10/05/2025"), ("00000032C", "Aitor Demo Ikerketa", "10/05/2025")]
anexo_solicitud("C_anexo_solicitud.pdf", C, C_NIF, "Desarrollo de sensores IoT para agricultura", C_SOC, "10/05/2025", 1, ["Colectivo", "Proyecto innovador"], comunicacion="Euskara")
datos_bancarios("C_datos_bancarios.pdf", C, C_NIF, "ES00 0000 0000 0000 0000 0030")
dni("C_dni_nerea.pdf", "DEMO IKERKETA, NEREA", "00000031L", "30/09/1995", "F")
cif("C_cif.pdf", C, C_NIF, "Paseo Imaginario 12, 20018 Donostia / San Sebastián")
escrituras("C_escrituras.pdf", C, C_NIF, [("00000031L", "Nerea Demo Ikerketa", 50), ("00000032C", "Aitor Demo Ikerketa", 50)], "28/04/2025")
vida_laboral("C_vida_laboral.pdf", "NEREA DEMO IKERKETA", "00000031L", [["General", "Universidad Imaginaria", "01/10/2020", "30/04/2025"], ["Autónomos", "RETA · Bidasoa Sensor Lab S.L.", "10/05/2025", "—"]])
certificado_formacion("C_pack_inicio.pdf", "Nerea Demo Ikerketa", "15/03/2025")
memoria_innovador("C_memoria_innovador.pdf", C, "Red de sensores de humedad de suelo con IA para pequeñas explotaciones", [
    ("1. Identificación de la empresa y del proyecto", "Bidasoa Sensor Lab desarrolla nodos de sensores de bajo coste (humedad, temperatura y conductividad) y una plataforma que recomienda riego a pequeñas explotaciones hortícolas de Gipuzkoa. El equipo lo forman una ingeniera electrónica con doctorado y un agrónomo con diez años de experiencia."),
    ("2. Grado de innovación y viabilidad", "Frente a los sistemas de riego programado, la solución ajusta el riego con un modelo entrenado con datos locales y reduce el consumo de agua un 30 % en las pruebas piloto realizadas en 2025 con tres explotaciones. Se ha validado un prototipo funcional (TRL 6) y existe una carta de intenciones de una cooperativa agraria para 40 nodos. Plan de negocio: venta de nodos más suscripción anual; punto de equilibrio en el tercer año."),
    ("3. Vinculación con I+D+i y tecnología", "El proyecto nace de una colaboración con un centro tecnológico vasco (convenio de transferencia firmado en 2025) y solicita una patente de utilidad sobre el sistema de calibración automática. Se ha obtenido una ayuda Hazitek para el desarrollo experimental y se participa en el programa de aceleración agrotech de una universidad."),
    ("4. Impacto esperado", "Ahorro de agua y fertilizante, digitalización de un sector poco atendido y creación de dos empleos técnicos en 2026."),
])
factura("C_factura_prototipos.pdf", "E-2025-014", "12/06/2025", "Electrónica Ficticia Donostia S.L.", "B00000009", C, C_NIF, [("Fabricación de 20 placas de sensores (prototipos)", 2340.00)], "Transferencia bancaria")
justificante("C_justificante_prototipos.pdf", "13/06/2025", C, "ES00 0000 0000 0000 0000 0030", "ELECTRÓNICA FICTICIA DONOSTIA S.L.", "ES00 0000 0000 0000 0000 0009", "Pago factura E-2025-014 prototipos", 2340.00 * 1.21)
certificado_hacienda("C_certificado_hacienda.pdf", C, C_NIF, "01/09/2026")

print("Documentos ficticios en", SALIDA)
for f in sorted(SALIDA.iterdir()):
    print(" -", f.name)
