from pathlib import Path
import re

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "Manual_RMCOp_Nike.md"
OUT = ROOT / "Manual_RMCOp_Nike.docx"

FONT = "Calibri"
BLUE = RGBColor(185, 31, 53)
DARK_BLUE = RGBColor(185, 31, 53)
INK = RGBColor(25, 25, 25)
MUTED = RGBColor(89, 89, 89)
WHITE = RGBColor(255, 255, 255)
HEADER_FILL = "E8EEF5"
LIGHT_GRAY = "F2F4F7"
CALLOUT = "F4F6F9"
PLACEHOLDER_FILL = "FFF2CC"
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


def style_paragraph(paragraph, before=0, after=6, line=1.25):
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = line


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
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
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


def set_bottom_border(paragraph, color="B91F35", size="12"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = p_bdr.find(qn("w:bottom"))
    if bottom is None:
        bottom = OxmlElement("w:bottom")
        p_bdr.append(bottom)
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), "3")
    bottom.set(qn("w:color"), color)


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

    header_p = section.header.paragraphs[0]
    header_p.text = ""
    run = header_p.add_run("RMC Control System | RMCOp-Nike")
    set_run_font(run, size=9, color=MUTED)
    style_paragraph(header_p, after=0, line=1.0)

    footer_p = section.footer.paragraphs[0]
    footer_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer_p.text = ""
    run = footer_p.add_run("Manual interno")
    set_run_font(run, size=9, color=MUTED)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal.font.size = Pt(11)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for style_name in ("List Bullet", "List Number"):
        style = styles[style_name]
        style.font.name = FONT
        style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        style.font.size = Pt(10.5)
        style.paragraph_format.left_indent = Inches(0.375)
        style.paragraph_format.first_line_indent = Inches(-0.188)
        style.paragraph_format.space_after = Pt(4)
        style.paragraph_format.line_spacing = 1.25


def add_runs_from_markdown(paragraph, text, size=11, color=INK, bold_default=False):
    tokens = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for token in tokens:
        if not token:
            continue
        bold = bold_default
        run_text = token
        font_name = FONT
        if token.startswith("**") and token.endswith("**"):
            run_text = token[2:-2]
            bold = True
        elif token.startswith("`") and token.endswith("`"):
            run_text = token[1:-1]
            font_name = "Consolas"
        run = paragraph.add_run(run_text)
        set_run_font(run, name=font_name, size=size, color=color, bold=bold)


def add_heading(doc, text, level):
    paragraph = doc.add_paragraph()
    if level == 1:
        size, color, before, after = 16, BLUE, 18, 10
    elif level == 2:
        size, color, before, after = 13, BLUE, 14, 7
    else:
        size, color, before, after = 12, DARK_BLUE, 10, 5
    style_paragraph(paragraph, before=before, after=after, line=1.25)
    run = paragraph.add_run(text)
    set_run_font(run, size=size, color=color, bold=True)
    return paragraph


def add_paragraph(doc, text):
    paragraph = doc.add_paragraph()
    style_paragraph(paragraph, after=6, line=1.25)
    add_runs_from_markdown(paragraph, text)
    return paragraph


def add_bullet(doc, text):
    paragraph = doc.add_paragraph(style="List Bullet")
    add_runs_from_markdown(paragraph, text, size=10.5)
    return paragraph


def add_numbered(doc, text):
    paragraph = doc.add_paragraph(style="List Number")
    add_runs_from_markdown(paragraph, text, size=10.5)
    return paragraph


def add_quote(doc, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    set_table_width(table, width_dxa=9000, indent_dxa=120)
    set_table_borders(table, BORDER)
    cell = table.cell(0, 0)
    set_cell_margins(cell, top=100, bottom=100, start=160, end=160)
    set_cell_shading(cell, CALLOUT)
    p = cell.paragraphs[0]
    style_paragraph(p, after=0, line=1.2)
    add_runs_from_markdown(p, text, size=10.5, color=DARK_BLUE, bold_default=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_placeholder(doc, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    set_table_width(table, width_dxa=9000, indent_dxa=120)
    set_table_borders(table, "D6B656")
    cell = table.cell(0, 0)
    set_cell_margins(cell, top=130, bottom=130, start=160, end=160)
    set_cell_shading(cell, PLACEHOLDER_FILL)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_paragraph(p, after=0, line=1.15)
    run = p.add_run(text)
    set_run_font(run, size=10.5, color=RGBColor(122, 90, 0), bold=True)
    doc.add_paragraph().paragraph_format.space_after = Pt(3)


def split_table_row(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def widths_for_table(col_count):
    patterns = {
        2: [2300, 7060],
        3: [2100, 3900, 3360],
        4: [1850, 2700, 2700, 2110],
        5: [1700, 1900, 2550, 1610, 1600],
    }
    return patterns.get(col_count, [9360 // col_count] * col_count)


def add_table(doc, headers, rows):
    col_count = len(headers)
    widths = widths_for_table(col_count)
    table = doc.add_table(rows=1, cols=col_count)
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    set_table_width(table)
    set_table_grid(table, widths)
    set_table_borders(table)
    set_repeat_table_header(table.rows[0])

    for idx, header in enumerate(headers):
        cell = table.rows[0].cells[idx]
        set_fixed_cell_width(cell, widths[idx])
        set_cell_margins(cell)
        set_cell_shading(cell, HEADER_FILL)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = cell.paragraphs[0]
        style_paragraph(p, after=0, line=1.1)
        add_runs_from_markdown(p, header, size=9.2, color=DARK_BLUE, bold_default=True)

    for row in rows:
        cells = table.add_row().cells
        for idx, value in enumerate(row):
            cell = cells[idx]
            set_fixed_cell_width(cell, widths[idx])
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = cell.paragraphs[0]
            style_paragraph(p, after=0, line=1.08)
            add_runs_from_markdown(p, value, size=8.9, color=INK)

    doc.add_paragraph().paragraph_format.space_after = Pt(5)


def add_cover(doc):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_paragraph(p, before=52, after=8, line=1.1)
    run = p.add_run("Manual de RMCOp-Nike")
    set_run_font(run, size=28, color=RGBColor(11, 37, 69), bold=True)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_paragraph(p, after=22, line=1.15)
    run = p.add_run("Parte del RMC Control System")
    set_run_font(run, size=15, color=BLUE, bold=True)

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_paragraph(p, after=28, line=1.2)
    run = p.add_run("Herramienta interna para apoyo operativo de Nike On Demand")
    set_run_font(run, size=13, color=MUTED)

    meta = doc.add_table(rows=4, cols=2)
    meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta.autofit = False
    set_table_width(meta, width_dxa=6500, indent_dxa=0)
    set_table_grid(meta, [2300, 4200])
    set_table_borders(meta, BORDER)
    rows = [
        ("Sistema paraguas", "RMC Control System"),
        ("Herramienta", "RMCOp-Nike"),
        ("Fecha de generación", "1 de julio de 2026"),
        ("Desarrollado y documentado por", "Alberto Villarreal"),
    ]
    for row_idx, (label, value) in enumerate(rows):
        for col_idx, text in enumerate((label, value)):
            cell = meta.cell(row_idx, col_idx)
            set_fixed_cell_width(cell, [2300, 4200][col_idx])
            set_cell_margins(cell, top=100, bottom=100, start=140, end=140)
            if col_idx == 0:
                set_cell_shading(cell, LIGHT_GRAY)
            p = cell.paragraphs[0]
            style_paragraph(p, after=0, line=1.15)
            run = p.add_run(text)
            set_run_font(run, size=10.5, color=DARK_BLUE if col_idx == 0 else INK, bold=col_idx == 0)

    p = doc.add_paragraph()
    style_paragraph(p, before=28, after=0, line=1.15)
    set_bottom_border(p, color="B91F35", size="10")

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    style_paragraph(p, before=10, after=0, line=1.1)
    run = p.add_run("Documento para junta interna de RMC")
    set_run_font(run, size=10, color=MUTED)

    doc.add_page_break()


def parse_markdown(doc, lines):
    index = 0
    skipping_intro = True

    while index < len(lines):
        raw = lines[index].rstrip("\n")
        line = raw.strip()

        if skipping_intro:
            if line == "---":
                skipping_intro = False
            index += 1
            continue

        if not line:
            index += 1
            continue

        if line == "---":
            index += 1
            continue

        if line.startswith("|") and index + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{3,}:?\s*\|", lines[index + 1]):
            headers = split_table_row(line)
            index += 2
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(split_table_row(lines[index]))
                index += 1
            add_table(doc, headers, rows)
            continue

        if line.startswith("[INSERTAR IMAGEN:"):
            add_placeholder(doc, line)
            index += 1
            continue

        if line.startswith("> "):
            add_quote(doc, line[2:].strip())
            index += 1
            continue

        if line.startswith("### "):
            add_heading(doc, line[4:].strip(), 3)
            index += 1
            continue

        if line.startswith("## "):
            add_heading(doc, line[3:].strip(), 2)
            index += 1
            continue

        if line.startswith("# "):
            add_heading(doc, line[2:].strip(), 1)
            index += 1
            continue

        if line.startswith("- "):
            add_bullet(doc, line[2:].strip())
            index += 1
            continue

        if re.match(r"^\d+\.\s+", line):
            add_numbered(doc, re.sub(r"^\d+\.\s+", "", line))
            index += 1
            continue

        add_paragraph(doc, line)
        index += 1


def main():
    doc = Document()
    setup_document(doc)
    add_cover(doc)
    parse_markdown(doc, SOURCE.read_text(encoding="utf-8").splitlines())
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
