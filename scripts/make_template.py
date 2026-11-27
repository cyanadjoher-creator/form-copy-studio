"""FORM Copy Studio: boutique stock template. Headers match the importer's column names exactly."""
import json, sys, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

V = json.load(open(os.environ.get('VOCAB', '/tmp/vocab2.json')))
DATA = json.load(open(os.environ['DATA'])) if os.environ.get('DATA') else None
OUT = os.environ.get('OUT', '/home/claude/out/FORM_Copy_Studio_Stock_Template.xlsx')
F = 'Arial'
SECTIONS = {
    'id':   ('1 · Identification', 'DCE6F0'),
    'src':  ("2 · Boutique's original listing (copy it as is)", 'FCE4D6'),
    'fact': ('3 · Item facts (checked)', 'E2EFDA'),
    'ctx':  ('4 · Context research', 'EDE2F6'),
    'int':  ('5 · Internal', 'EDEDED'),
}
# (header, section, required, width, what to put, example, list)
COLS = [
    ('Boutique', 'id', 'Yes', 18, 'Boutique name, the same spelling every time.', 'Option', None),
    ('Temp ID', 'id', 'Yes', 11, 'Tracker Temp ID. It links the row to the Copy Context research.', 'OP-7', None),
    ('Boutique ID', 'id', 'If known', 16, "The boutique's own listing or Shopify product ID. Never the code on the garment.", '10650461012234', None),
    ('SKU', 'id', 'If known', 16, "The boutique's SKU.", 'GUC-SK-0458', None),
    ('Listing URL', 'id', 'Yes', 34, "Link to the boutique's product page. Counts as the item evidence for research.", 'https://option.fashion/products/gucci-technical-skirt', None),
    ('Original title', 'id', 'If known', 30, 'The title exactly as the boutique lists it.', 'Gucci SS10 technical skirt', None),
    ('Photo folder', 'id', 'Optional', 18, 'Name of the folder or zip holding this item\'s photos (for the photo import).', 'OP-7', None),
    ('Boutique description (source)', 'src', 'Yes', 46, "The boutique's description, pasted untouched. Never rewrite it here.", 'Grey nylon skirt with lace-up detail at the hips. Size 40. Very good condition.', None),
    ('Price', 'src', 'Optional', 12, 'Boutique price, with currency.', '€420', None),
    ('Condition', 'src', 'Optional', 14, "Frozen grade: Pristine, Excellent, Good, Fair, Poor. A boutique grade like 'Very good' can stay as written: the site asks a person to place it.", 'Excellent', 'conditions'),
    ('Brand', 'fact', 'Yes', 22, 'House name from the list (type a new one if missing: it will be flagged).', 'GUCCI', 'brands'),
    ('Item name', 'fact', 'Yes', 32, 'FORM title: colour, material or feature, garment. No brand, no season.', 'Stone Grey Lace-Up Nylon Skirt', None),
    ('Category', 'fact', 'Yes', 18, 'From the list.', 'Skirts', 'categories'),
    ('Season', 'fact', 'Yes', 22, 'Spring/Summer 2010, Fall/Winter 2004, Pre-Fall 2010, Cruise / Resort 2008, or a decade (1990s). Blank if unknown.', 'Spring/Summer 2010', None),
    ('Colour', 'fact', 'Yes', 14, 'One of the 17 frozen colours. A shade (navy, stone) is matched on import; keep the shade in the Item name.', 'Grey', 'colours'),
    ('Material', 'fact', 'If on the label', 16, 'From the care label only. Blank if not legible.', 'Nylon', 'materials'),
    ('Size system', 'fact', 'If sized', 12, 'IT, FR, UK, US, JP, Letter, Shoes EU, One size.', 'IT', 'sizes'),
    ('Size', 'fact', 'If sized', 8, 'The size as on the label. Do not convert.', '40', None),
    ('Measurements', 'fact', 'Yes', 26, 'Original units and labels, flat. The site rounds and converts.', 'Waist 36 cm, length 58 cm', None),
    ('Made in', 'fact', 'If on the label', 12, 'Country as on the label.', 'Italy', None),
    ('Product code', 'fact', 'If on the label', 18, 'Style code printed on the brand label. Not the boutique ID.', '', None),
    ('Care instructions', 'fact', 'If on the label', 24, 'As on the care label.', '', None),
    ('Verified wear', 'fact', 'Optional', 16, 'Checked wear: No visible wear, Light wear, Moderate wear, Visible wear. Not the seller grade.', 'Light wear', None),
    ('Collection name', 'ctx', 'If known', 22, 'Collection or show name, if documented.', '', None),
    ('Look number', 'ctx', 'If known', 10, 'Runway look number, if documented.', '', None),
    ('Research leads', 'ctx', 'Optional', 36, 'What to look for: designer, theme, print name, who wore it. Leads, not facts.', 'Frida Giannini, sports mesh and lacing', None),
    ('Team facts', 'ctx', 'Optional', 36, 'What the team has confirmed (by hand or by eye). Used as confirmed input by Research and Generate.', "Made during Jean Paul Gaultier's time at Hermès (2004-2011)", None),
    ('Reference links', 'ctx', 'Optional', 36, 'Runway, archive or museum pages, separated by spaces.', 'https://www.vogue.com/fashion-shows/spring-2010-ready-to-wear/gucci', None),
    ('Item notes', 'int', 'Optional', 30, 'Anything internal: defects to photograph, questions for the boutique.', '', None),
    ('Shop category', 'int', 'Auto', 20, 'Filled for filtering only; the site works it out from the category. Not imported.', 'Skirts', None),
]
assert len({c[0].lower() for c in COLS}) == len(COLS)

thin = Side(style='thin', color='BFBFBF')
box = Border(left=thin, right=thin, top=thin, bottom=thin)
wb = Workbook()

# ---------- Items (must stay the FIRST sheet: the site reads only the first sheet) ----------
ws = wb.active; ws.title = 'Items'
for i, (h, sec, req, w, what, ex, lst) in enumerate(COLS, 1):
    c = ws.cell(row=1, column=i, value=h)
    c.font = Font(name=F, bold=True, size=10)
    c.fill = PatternFill('solid', fgColor=SECTIONS[sec][1])
    c.alignment = Alignment(wrap_text=True, vertical='center')
    c.border = box
    note = f"{SECTIONS[sec][0]}\nRequired: {req}\n{what}"
    if ex: note += f"\nExample: {ex}"
    c.comment = Comment(note, 'FORM'); c.comment.width = 300; c.comment.height = 150
    ws.column_dimensions[get_column_letter(i)].width = w
ws.row_dimensions[1].height = 34
ws.freeze_panes = 'C2'
for r in range(2, 502):
    for i in range(1, len(COLS) + 1):
        cell = ws.cell(row=r, column=i); cell.font = Font(name=F, size=10); cell.border = box
        cell.alignment = Alignment(vertical='top', wrap_text=COLS[i-1][0] in ('Boutique description (source)', 'Research leads', 'Item notes'))
        if COLS[i-1][0] in ('Boutique ID', 'SKU', 'Size', 'Temp ID'): cell.number_format = '@'
ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}1"

# ---------- Lists ----------
ls = wb.create_sheet('Lists')
lists = {k: V[k] for k in ('brands', 'categories', 'colours', 'materials', 'conditions', 'sizes', 'seasonTypes')}
ranges = {}
for j, (k, vals) in enumerate(lists.items(), 1):
    col = get_column_letter(j)
    h = ls.cell(row=1, column=j, value=k.capitalize() if k != 'seasonTypes' else 'Season types')
    h.font = Font(name=F, bold=True)
    for r, v in enumerate(vals, 2): ls.cell(row=r, column=j, value=v).font = Font(name=F)
    ls.column_dimensions[col].width = 24
    ranges[k] = f"Lists!${col}$2:${col}${len(vals)+1}"
for i, (h, sec, req, w, what, ex, lst) in enumerate(COLS, 1):
    if not lst: continue
    col = get_column_letter(i)
    strict = lst != 'brands'
    dv = DataValidation(type='list', formula1=ranges[lst], allow_blank=True,
                        errorStyle='stop' if strict else 'warning', showErrorMessage=True,
                        errorTitle='Not in the FORM list', error=('Pick a value from the list.' if strict else 'This house is not in the list yet. Keep it only if the name is right: it will be flagged for the Vocabulary.'))
    dv.add(f"{col}2:{col}501"); ws.add_data_validation(dv)

# ---------- How to fill ----------
g = wb.create_sheet('How to fill', 1)
g.column_dimensions['A'].width = 30; g.column_dimensions['B'].width = 30; g.column_dimensions['C'].width = 14; g.column_dimensions['D'].width = 70; g.column_dimensions['E'].width = 42
rows = [
    ('FORM Copy Studio · boutique stock template', None),
    ('One row per item on the Items sheet (keep Items as the first sheet). Fill only the white cells under the coloured headers; hover a header for its rule. Do not rename, move or delete columns: the site recognises them by name.', None),
    ('Import: Copy Studio › Boutique stock › Import stock list › choose this file › check the column matching › Import.', None),
    ('Photos are added per item in Ingestion for now (up to 9: garment views, brand label, care label, details, measurements).', None),
    ('Then, per item: Fill fields from photos › Generate copy (it researches the history if the tracker has none) › edit the proposal › Approve (open checks are allowed and recorded).', None),
    ('', None),
]
r = 1
for text, _ in rows:
    c = g.cell(row=r, column=1, value=text); c.font = Font(name=F, bold=(r == 1), size=13 if r == 1 else 10)
    c.alignment = Alignment(wrap_text=True, vertical='top'); g.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
    g.row_dimensions[r].height = 22 if r == 1 else 30
    r += 1
for k, (label, colour) in SECTIONS.items():
    c = g.cell(row=r, column=1, value=label); c.fill = PatternFill('solid', fgColor=colour); c.font = Font(name=F, bold=True, size=10)
    d = {'id': 'Who sold it and where: links the row to the boutique, the tracker and the photos.',
         'src': "The boutique's own words and grade, untouched. Used as a lead and as the item evidence, never as FORM copy.",
         'fact': 'What FORM confirms from the garment and its labels. Leave a cell blank rather than guess: blanks are flagged, guesses are not.',
         'ctx': 'Where the history research starts. Kept apart from the facts so leads never become claims.',
         'int': 'Notes for the team; never published.'}[k]
    g.cell(row=r, column=2, value=d).font = Font(name=F, size=10)
    g.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
    g.cell(row=r, column=2).alignment = Alignment(wrap_text=True); g.row_dimensions[r].height = 28
    r += 1
r += 1
for j, h in enumerate(['Column', 'Section', 'Required', 'What to put', 'Example'], 1):
    c = g.cell(row=r, column=j, value=h); c.font = Font(name=F, bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='404040')
r += 1
for (h, sec, req, w, what, ex, lst) in COLS:
    vals = [h, SECTIONS[sec][0], req, what + (' (dropdown)' if lst else ''), ex]
    for j, v in enumerate(vals, 1):
        c = g.cell(row=r, column=j, value=v); c.font = Font(name=F, size=10, bold=(j == 1)); c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = box
    g.cell(row=r, column=1).fill = PatternFill('solid', fgColor=SECTIONS[sec][1])
    r += 1
r += 1
g.cell(row=r, column=1, value='Example row (OP-7, from the tracker). Do not paste it into Items unless it is a real item.').font = Font(name=F, bold=True, size=10)
r += 1
for j, (h, sec, *_rest) in enumerate(COLS, 1):
    pass
ex_sheet_row = r
for j, (h, sec, req, w, what, ex, lst) in enumerate(COLS):
    g.cell(row=r + j, column=1, value=h).font = Font(name=F, size=10)
    g.cell(row=r + j, column=2, value=ex).font = Font(name=F, size=10, color='0000FF')
g.freeze_panes = 'A2'
wb.move_sheet('Lists', offset=0)
assert wb.sheetnames[0] == 'Items', wb.sheetnames
if DATA:
    head = [c[0] for c in COLS]
    for ri, row in enumerate(DATA['items'], 2):
        for k, v in row.items():
            if k in head and v not in (None, ''):
                ws.cell(row=ri, column=head.index(k) + 1, value=v)
    for ri, flags in enumerate(DATA.get('flags', []), 2):
        for k in flags:
            ws.cell(row=ri, column=[c[0] for c in COLS].index(k) + 1).fill = PatternFill('solid', fgColor='FCD5B4')
    pdv = wb.create_sheet('Previous drafts')
    ph = ['Temp ID', 'Boutique', 'FORM title draft', 'FORM description draft', 'Copy status (tracker)']
    for j, h in enumerate(ph, 1):
        c = pdv.cell(row=1, column=j, value=h); c.font = Font(name=F, bold=True)
    for ri, d in enumerate(DATA['drafts'], 2):
        for j, h in enumerate(ph, 1):
            c = pdv.cell(row=ri, column=j, value=d.get(h)); c.font = Font(name=F, size=10); c.alignment = Alignment(wrap_text=True, vertical='top')
    for j, w in enumerate([22, 18, 40, 90, 18], 1): pdv.column_dimensions[get_column_letter(j)].width = w
    pdv.freeze_panes = 'A2'
    cs = wb.create_sheet('Shop categories')
    for j, h in enumerate(['Shop category', 'Items in this file', 'Measurements', 'Note'], 1):
        c = cs.cell(row=1, column=j, value=h); c.font = Font(name=F, bold=True)
    for ri, rr in enumerate(DATA['categories'], 2):
        for j, v in enumerate(rr, 1):
            c = cs.cell(row=ri, column=j, value=v); c.font = Font(name=F, size=10, color=('A35400' if rr[3] else '000000'))
    for j, w in enumerate([30, 16, 50, 60], 1): cs.column_dimensions[get_column_letter(j)].width = w
    g.cell(row=4, column=1, value='This file was converted from the FORM Capture Master Tracker: one row per tracker item. Orange cells were inferred (category, colour, season, size) or left for a person to place. "Previous drafts" keeps the tracker copy for comparison; it is not imported.')
wb.save(OUT)
print(wb.sheetnames)
