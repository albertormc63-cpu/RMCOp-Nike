from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUT = Path(__file__).with_name("RMC_NIKE_PANEL_MANUAL_OPERACION_v1.0.docx")

FONT = "Calibri"
BLUE = RGBColor(46, 116, 181)
DARK_BLUE = RGBColor(31, 77, 120)
INK = RGBColor(25, 25, 25)
MUTED = RGBColor(89, 89, 89)
LIGHT_BLUE = "E8EEF5"
LIGHT_GRAY = "F2F4F7"
CALLOUT = "F4F6F9"
BORDER = "D9E2F3"


def set_run_font(run, name=FONT, size=None, color=None, bold=None, italic=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:ascii"), name)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, bottom=80, start=120, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin_name, value in (("top", top), ("bottom", bottom), ("start", start), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin_name}"))
        if node is None:
            node = OxmlElement(f"w:{margin_name}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table, color="DADCE0"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_table_width(table, width_dxa=9360, indent_dxa=120):
    tbl_pr = table._tbl.tblPr
    tbl_layout = tbl_pr.first_child_found_in("w:tblLayout")
    if tbl_layout is None:
        tbl_layout = OxmlElement("w:tblLayout")
        tbl_pr.append(tbl_layout)
    tbl_layout.set(qn("w:type"), "fixed")

    tbl_w = tbl_pr.first_child_found_in("w:tblW")
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(width_dxa))
    tbl_w.set(qn("w:type"), "dxa")

    tbl_ind = tbl_pr.first_child_found_in("w:tblInd")
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(indent_dxa))
    tbl_ind.set(qn("w:type"), "dxa")


def set_table_grid(table, widths):
    grid = table._tbl.tblGrid
    if grid is None:
        grid = OxmlElement("w:tblGrid")
        table._tbl.insert(0, grid)
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_fixed_cell_width(cell, width_dxa):
    cell.width = Inches(width_dxa / 1440)
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_dxa))
    tc_w.set(qn("w:type"), "dxa")


def style_paragraph(paragraph, before=0, after=6, line=1.1):
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = line


def add_para(doc, text="", style=None, bold=False, italic=False, color=INK, size=11, after=6):
    paragraph = doc.add_paragraph(style=style)
    style_paragraph(paragraph, after=after)
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=bold, italic=italic)
    return paragraph


def add_heading(doc, text, level=1):
    paragraph = doc.add_paragraph()
    if level == 1:
        size, color, before, after = 16, BLUE, 16, 8
    elif level == 2:
        size, color, before, after = 13, BLUE, 12, 6
    else:
        size, color, before, after = 12, DARK_BLUE, 8, 4
    style_paragraph(paragraph, before=before, after=after, line=1.1)
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=True)
    return paragraph


def add_bullet(doc, text, level=0):
    paragraph = doc.add_paragraph(style="List Bullet")
    paragraph.paragraph_format.left_indent = Inches(0.5 + (0.25 * level))
    paragraph.paragraph_format.first_line_indent = Inches(-0.25)
    style_paragraph(paragraph, after=4, line=1.15)
    run = paragraph.add_run(text)
    set_run_font(run, size=10.5, color=INK)
    return paragraph


def add_numbered(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    paragraph.paragraph_format.left_indent = Inches(0.5)
    paragraph.paragraph_format.first_line_indent = Inches(-0.25)
    style_paragraph(paragraph, after=4, line=1.15)
    run = paragraph.add_run(text)
    set_run_font(run, size=10.5, color=INK)
    return paragraph


def add_callout(doc, title, text):
    table = doc.add_table(rows=1, cols=1)
    set_table_width(table)
    set_table_borders(table, BORDER)
    cell = table.cell(0, 0)
    set_cell_shading(cell, CALLOUT)
    set_cell_margins(cell, top=120, bottom=120, start=160, end=160)
    paragraph = cell.paragraphs[0]
    style_paragraph(paragraph, after=2, line=1.1)
    run = paragraph.add_run(title)
    set_run_font(run, size=10.5, color=DARK_BLUE, bold=True)
    paragraph = cell.add_paragraph()
    style_paragraph(paragraph, after=0, line=1.1)
    run = paragraph.add_run(text)
    set_run_font(run, size=10.5, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    set_table_width(table)
    set_table_borders(table)
    set_repeat_table_header(table.rows[0])
    if widths is None:
        widths = [9360 // len(headers)] * len(headers)
    set_table_grid(table, widths)

    for idx, header in enumerate(headers):
        cell = table.rows[0].cells[idx]
        set_cell_shading(cell, LIGHT_GRAY)
        set_cell_margins(cell)
        set_fixed_cell_width(cell, widths[idx])
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        paragraph = cell.paragraphs[0]
        style_paragraph(paragraph, after=0, line=1.05)
        run = paragraph.add_run(header)
        set_run_font(run, size=9.5, color=DARK_BLUE, bold=True)

    for row in rows:
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cell = cells[idx]
            set_cell_margins(cell)
            set_fixed_cell_width(cell, widths[idx])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            paragraph = cell.paragraphs[0]
            style_paragraph(paragraph, after=0, line=1.05)
            run = paragraph.add_run(str(value))
            set_run_font(run, size=9.3, color=INK)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return table


def setup_document(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal.font.size = Pt(11)
    normal.font.color.rgb = INK

    for style_name in ("List Bullet", "List Number"):
        style = styles[style_name]
        style.font.name = FONT
        style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        style.font.size = Pt(10.5)

    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = header.add_run("RMC Nike Panel | Manual de Operacion")
    set_run_font(run, size=9, color=MUTED)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = footer.add_run("Documento interno RMC")
    set_run_font(run, size=9, color=MUTED)


def add_cover(doc):
    add_para(doc, "RMC Nike Panel", bold=True, color=BLUE, size=24, after=2)
    add_para(doc, "Manual de operacion", color=DARK_BLUE, size=16, after=14)
    add_para(
        doc,
        "Panel CEP para Adobe Illustrator orientado a crear copias de plantillas Nike Lacrosse, renombrar pedidos y aplicar nombre/numero sobre archivos PDF.",
        size=11,
        color=INK,
        after=14,
    )
    add_table(
        doc,
        ["Campo", "Detalle"],
        [
            ("Version del manual", "1.0"),
            ("Fecha", date(2026, 6, 2).strftime("%d/%m/%Y")),
            ("Proyecto", "RMCOp-Nike"),
            ("Extension CEP", "com.rmc.nike.panel.\nmain"),
            ("Aplicacion destino", "Adobe Illustrator / CEP"),
        ],
        widths=[2200, 7160],
    )
    add_callout(
        doc,
        "Objetivo operativo",
        "Reducir captura manual y errores repetitivos: seleccionar equipo, resolver plantilla, copiar PDF a la carpeta On Demand, abrir en Illustrator y aplicar datos variables usando reglas controladas.",
    )


def build_manual():
    doc = Document()
    setup_document(doc)
    add_cover(doc)

    add_heading(doc, "1.- Descripcion general", 1)
    add_para(
        doc,
        "RMC Nike Panel es una extension CEP para Illustrator. La interfaz corre como HTML/CSS/JavaScript, usa Node.js dentro de CEP para leer rutas y copiar archivos, y ejecuta ExtendScript para abrir y modificar el documento activo de Illustrator.",
    )
    add_table(
        doc,
        ["Capa", "Responsabilidad", "Archivos principales"],
        [
            ("Panel CEP", "Muestra el flujo por pasos, captura pedido y presenta logs.", "index.html, css/styles.css, js/main.js"),
            ("Servicios Node", "Carga configuracion, resuelve rutas, copia plantillas y lee carpetas destino.", "js/services/nodeServices.js, js/utils/pathBuilder.js, js/services/copyTemplate.js"),
            ("Reglas UI/catalogo", "Define lineas, equipos, variantes, previews, styles y validaciones.", "js/config/productCatalog.js, js/ui/*.js"),
            ("Bridge Illustrator", "Comunica el panel con Illustrator mediante CSInterface.evalScript.", "js/illustrator/illustratorBridge.js"),
            ("ExtendScript", "Abre PDF, reemplaza texto, arma numeros IH y extrae muestras.", "jsx/rmcNike.jsx, jsx/standardText.jsx, jsx/ihNumbers.jsx, jsx/swatches.jsx"),
        ],
        widths=[1800, 3600, 3960],
    )

    add_heading(doc, "2.- Requisitos del sistema", 1)
    for item in [
        "macOS con Adobe Illustrator compatible con CEP.",
        "Extension instalada en la carpeta CEP correspondiente y registrada por CSXS/manifest.xml.",
        "Node habilitado en CEP; el manifest activa --enable-nodejs, --mixed-context y permisos de acceso a archivos.",
        "Dependencia fs-extra instalada en el proyecto para copiar plantillas.",
        "Acceso a las rutas configuradas de plantillas y ordenes, ya sea en modo local o en volumen de servidor.",
        "Plantillas PDF con textos/grupos compatibles con las reglas Standard o Indigenous Heritage.",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "3.- Rutas y modo de trabajo", 1)
    add_para(doc, "La ruta activa se define en js/config/config.js mediante la propiedad mode. Para pruebas se usa local; para produccion se cambia a server.")
    add_table(
        doc,
        ["Modo", "Templates base", "Ordenes base"],
        [
            ("local", "/Users/rmlsub1/Documents/pruebas/PATRONES PARA ROLLO/NIKE LACROSSE", "/Users/rmlsub1/Documents/pruebas/TO PRINT/NIKE ORDERS"),
            ("server", "/Volumes/Fullsize/PATRONES ACOMODADOS PARA ROLLO/NIKE LACROSSE", "/Volumes/Fullsize/TO PRINT/NIKE ORDERS"),
        ],
        widths=[1200, 4680, 3480],
    )
    add_callout(
        doc,
        "Importante",
        "El panel busca carpetas dentro de ordersBase cuyo nombre contenga NIKE ON DEMAND. Si no aparecen en el selector, revisar que el volumen este montado y que la carpeta exista con ese texto en el nombre.",
    )

    add_heading(doc, "4.- Flujo operativo diario", 1)
    for step in [
        "Abrir Adobe Illustrator y cargar el panel RMC Nike Panel.",
        "En el paso 1 Equipo, seleccionar la linea Masculino o Femenino y elegir el equipo.",
        "En el paso 2 Pedido, seleccionar variante, Home/Away si aplica, Work Order, Style, talla, numero, nombre y destino.",
        "Presionar Revisar pedido para validar datos y ver plantilla, nombre final y carpeta destino.",
        "Presionar Crear copia de plantilla. Si ya existe un archivo igual, confirmar solo cuando se quiera reemplazar por una copia limpia.",
        "Presionar Abrir y aplicar datos. Illustrator abre el PDF copiado y reemplaza nombre/numero conforme a la variante.",
        "Revisar visualmente el archivo en Illustrator antes de continuar con salida/impresion.",
    ]:
        add_numbered(doc, step)

    add_heading(doc, "5.- Campos del pedido", 1)
    add_table(
        doc,
        ["Campo", "Uso", "Regla"],
        [
            ("Linea", "Determina equipos visibles y styles disponibles.", "Masculino: PLL/A1000/Y1000. Femenino: WLL/A2000/Y2000."),
            ("Equipo", "Determina codigo corto, nickname y placeholders de texto.", "Debe existir en catalogo y teams.js."),
            ("Variante", "Cambia ruta de plantilla y modo de reemplazo.", "Standard usa texto editable. Indigenous Heritage arma arte raster/expandido."),
            ("Version", "Home o Away para Standard.", "IH deshabilita Home/Away y usa estructura propia."),
            ("Work Order", "Prefijo del archivo final.", "Acepta numeros y guiones."),
            ("Style", "Define PLL/WLL y carpeta de producto.", "A1000/Y1000/A2000/Y2000 con sufijo H, A o IH."),
            ("Talla", "Selecciona la plantilla correspondiente.", "XS, SM, MD, LG, XL, 2X, 3X."),
            ("Numero", "Dato aplicado al PDF y usado como identificador final.", "Solo digitos."),
            ("Nombre", "Dato aplicado al PDF si existe.", "Se convierte a mayusculas."),
            ("Destino", "Carpeta NIKE ON DEMAND o carpeta manual.", "Examinar anula temporalmente el selector On Demand."),
        ],
        widths=[1300, 3300, 4760],
    )

    add_heading(doc, "6.- Estructura de plantillas", 1)
    add_para(doc, "El resolvedor de rutas tolera diferencias de mayusculas/minusculas en carpetas y tiene fallback para nombres antiguos, pero la estructura esperada es la siguiente.")
    add_table(
        doc,
        ["Variante", "Estructura esperada", "Ejemplo de archivo"],
        [
            ("Standard", "STANDARD / NIKE Mens and Youth / MENS|YOUTH / HOME|AWAY / Equipo Version", "PLL-BOS-A1000H SM.pdf"),
            ("Standard femenino", "STANDARD / NIKE Girls and Ladies / Ladies|Girls / HOME|AWAY / Equipo Version", "WLL-BOS-A2000A SM.pdf"),
            ("Indigenous Heritage", "INDIGENOUS HERITAGE / NIKE IH Mens and Youth|Girls and Ladies / Producto / Equipo IH", "PLL-BOSTON IH A1000 SM.pdf"),
        ],
        widths=[1800, 4600, 2960],
    )
    add_para(doc, "Si no se encuentra el nombre canonico, el sistema busca un PDF que contenga el style o familia de style y la talla. Para SM tambien acepta SML como alias.")

    add_heading(doc, "7.- Formato del archivo final", 1)
    add_para(doc, "El nombre final se genera desde js/utils/pathBuilder.js. La forma general es:")
    add_callout(doc, "Formato", "WO PLL|WLL-Equipo Nickname Style Talla Identificador.pdf")
    add_table(
        doc,
        ["Elemento", "Ejemplo", "Origen"],
        [
            ("WO", "172539", "Campo Work Order."),
            ("Codigo Nike", "PLL o WLL", "Detectado desde style: 1000 = PLL, 2000 = WLL."),
            ("Equipo + nickname", "Boston Cannons", "Catalogo por linea."),
            ("Style", "A1000H, A1000A, A1000IH", "Style seleccionado y variante."),
            ("Talla", "LG", "Campo Talla."),
            ("Identificador", "7 o MARTINEZ", "Numero si existe; si no, nombre; si no, numero default del equipo."),
        ],
        widths=[1800, 2200, 5360],
    )

    add_heading(doc, "8.- Reemplazo Standard", 1)
    add_para(doc, "En Standard, Illustrator reemplaza textos exactos importados desde el PDF. El sistema normaliza apostrofes, espacios y mayusculas para reducir fallas por importacion.")
    add_table(
        doc,
        ["Equipo masculino", "Numero", "Nombre", "Equipo femenino", "Numero", "Nombre"],
        [
            ("Boston", "1", "HOLMAN", "Boston", "8", "NORTH"),
            ("California", "96", "KAVANAGH", "California", "12", "MASTROIANNI"),
            ("Carolina", "0", "RIORDEN", "Maryland", "11", "BLACK"),
            ("Denver", "42", "O'NEILL", "New York", "27", "SCANE"),
            ("Maryland", "7", "MALONE", "", "", ""),
            ("New York", "9", "BAPTISTE", "", "", ""),
            ("Philadelphia", "22", "SOWERS", "", "", ""),
            ("Utah", "26", "SCHREIBER", "", "", ""),
        ],
        widths=[1700, 900, 1900, 1700, 900, 2260],
    )
    add_callout(
        doc,
        "Regla de plantillas Standard",
        "Los textos base de nombre y numero deben conservar los placeholders esperados por equipo. Si se cambia el nombre del jugador de referencia dentro del PDF, el panel no encontrara que reemplazar.",
    )

    add_heading(doc, "9.- Ajuste automatico de texto", 1)
    add_para(doc, "Despues de reemplazar, el sistema mide el ancho visible del texto. Si rebasa el maximo configurado, reduce horizontalScale y, como respaldo, escala el objeto.")
    add_table(
        doc,
        ["Config", "Valor actual", "Funcion"],
        [
            ("unit", "in", "Las medidas de reglas estan en pulgadas y se convierten a puntos de Illustrator."),
            ("buffer", "1", "Factor aplicado al calculo de escala."),
            ("minScale", "50", "Escala minima permitida para evitar deformaciones extremas."),
            ("A1000 name/number", "11 / 13.5", "Limites base para adulto masculino."),
            ("Y1000 name/number", "7.5 / 11", "Limites base para youth masculino."),
        ],
        widths=[2100, 1900, 5360],
    )
    add_para(doc, "El archivo js/config/textFitRules.json permite definir excepciones por equipo, familia de style y talla.")

    add_heading(doc, "10.- Reemplazo Indigenous Heritage", 1)
    add_para(doc, "En Indigenous Heritage el nombre se reemplaza como texto, pero el numero no se escribe como texto editable. El panel duplica arte desde capas de numeros y arma el grupo final.")
    add_table(
        doc,
        ["Zona", "Capa fuente", "Grupo guia", "Base", "Grupo creado", "Ajuste"],
        [
            ("front", "NUMEROS F", "N FRONT", "BASE FRONT", "RMC FRONT NUMBER", "No ajusta a ancho maximo."),
            ("back", "NUMEROS B", "N BACK", "BASE BACK", "RMC BACK NUMBER", "Ajusta si rebasa ancho maximo."),
        ],
        widths=[1100, 1650, 1500, 1500, 2250, 1960],
    )
    for item in [
        "Cada digito debe existir como grupo con nombre exacto: 0 F, 1 F, etc. para frente y 0 B, 1 B, etc. para espalda.",
        "El sistema prende temporalmente la capa fuente, duplica los digitos, los alinea, centra sobre el grupo guia y restaura visibilidad/bloqueo.",
        "Antes de crear un numero nuevo, elimina grupos previos RMC FRONT NUMBER y RMC BACK NUMBER para evitar duplicados.",
        "Si falta una capa o grupo, Illustrator devuelve error al log del panel.",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "11.- Muestras oficiales de color", 1)
    add_para(doc, "El panel incluye herramientas de apoyo en la vista Rutas para controlar muestras de Illustrator.")
    add_table(
        doc,
        ["Boton", "Que hace", "Resultado esperado"],
        [
            ("Extraer muestras oficiales", "Lee las muestras del documento activo, ignorando muestras basicas y patrones.", "Actualiza js/config/officialSwatches.json."),
            ("Validar muestras de documento", "Compara el documento activo contra la lista oficial guardada.", "Advierte en consola nombres fuera de lista."),
        ],
        widths=[2400, 4100, 2860],
    )
    add_callout(doc, "Uso recomendado", "Extraer la lista oficial desde una plantilla autorizada y despues validar documentos abiertos antes de liberar produccion.")

    add_heading(doc, "12.- Mantenimiento del catalogo", 1)
    add_table(
        doc,
        ["Cambio requerido", "Archivos a revisar", "Nota"],
        [
            ("Agregar equipo", "js/config/productCatalog.js, js/data/teams.js, js/illustrator/textRules.js", "Tambien agregar previews si se desea mostrar imagen."),
            ("Agregar linea/style", "js/config/productCatalog.js, js/utils/pathBuilder.js", "Debe poder mapear PLL/WLL y carpeta de producto."),
            ("Cambiar rutas", "js/config/config.js", "Cambiar mode o rutas local/server."),
            ("Ajustar ancho de nombres/numeros", "js/config/textFitRules.json", "Preferir reglas por equipo/style/talla si el problema es especifico."),
            ("Modificar IH", "js/config/ihNumberRules.json, jsx/ihNumbers.jsx", "Mantener nombres de capas y grupos sincronizados con plantilla."),
            ("Actualizar colores oficiales", "Vista Rutas del panel, js/config/officialSwatches.json", "Extraer desde documento autorizado."),
        ],
        widths=[2600, 3600, 3160],
    )

    add_heading(doc, "13.- Diagnostico y solucion de problemas", 1)
    add_table(
        doc,
        ["Sintoma", "Causa probable", "Revision"],
        [
            ("El panel abre pero no copia.", "Node no esta disponible o fallo require.", "Revisar log de consola y manifest con --enable-nodejs."),
            ("No aparecen carpetas On Demand.", "ordersBase incorrecto, volumen no montado o nombres sin NIKE ON DEMAND.", "Ir a Rutas y confirmar Ordenes."),
            ("No existe la plantilla.", "Ruta/carpeta/nombre/talla/style no coinciden.", "Revisar preview de Plantilla antes de copiar."),
            ("El archivo ya existe.", "Mismo WO/style/talla/identificador.", "Confirmar reemplazo solo si se quiere plantilla limpia."),
            ("No reemplaza nombre/numero Standard.", "Placeholder de plantilla no coincide con textRules.js.", "Revisar textos base exactos por equipo."),
            ("IH marca que falta grupo.", "Plantilla sin NUMEROS F/B, N FRONT/BACK, BASE o digitos.", "Revisar nombres de capas y grupos en Illustrator."),
            ("Texto queda demasiado ancho.", "Regla textFit insuficiente o objeto importado no responde bien.", "Ajustar maxWidth/minScale y revisar manualmente."),
            ("Muestras fuera de lista.", "Documento trae swatches no autorizadas.", "Validar contra officialSwatches.json y limpiar documento."),
        ],
        widths=[2600, 3100, 3660],
    )

    add_heading(doc, "14.- Checklist antes de produccion", 1)
    for item in [
        "Configurar mode: server en js/config/config.js.",
        "Confirmar que /Volumes/Fullsize este montado.",
        "Verificar que templatesBase y ordersBase existan.",
        "Abrir una plantilla Standard y procesar una orden de prueba.",
        "Abrir una plantilla Indigenous Heritage y procesar numero de uno y dos digitos.",
        "Validar que el nombre final coincida con el formato interno.",
        "Validar muestras oficiales si el flujo de color aplica.",
        "Revisar visualmente el PDF abierto en Illustrator antes de liberar corrida real.",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "15.- Resumen tecnico del flujo", 1)
    add_numbered(doc, "DOMContentLoaded carga servicios Node, catalogos, UI, reglas y eventos.")
    add_numbered(doc, "El usuario selecciona equipo/variante y orderView.collectOrder arma el objeto de pedido.")
    add_numbered(doc, "pathBuilder.buildTemplatePath resuelve la plantilla y buildOutputName genera el nombre final.")
    add_numbered(doc, "copyTemplate hace dryRun para detectar reemplazo y luego copia con overwrite controlado.")
    add_numbered(doc, "illustratorBridge carga jsx/rmcNike.jsx y llama funciones globales de Illustrator.")
    add_numbered(doc, "RMCNike_applyNameNumber reemplaza textos Standard o arma numeros IH segun la variante.")

    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build_manual()
