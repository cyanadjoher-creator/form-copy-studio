# End-to-end check of every page and flow against a running server (AI_PROVIDER=mock, APP_PASSWORD=test).
# Usage: python3 tests/e2e.py http://localhost:3100
import random, sys, time
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3100'
SEED = 'public/seed/'
CSV = '/tmp/fcs-stock.csv'
open(CSV, 'w').write('SKU,Designer,Item,Season,Couleur,Description\n'
  'A1,Maison Martin Margiela,Wool blazer,FW05,,"Black wool blazer with notch lapels. Size IT 42. Very good condition. Made in Italy. Chest 50 cm, length 70 cm."\n'
  'A2,Comme des Garçons,Shirt,,Navy,"Cotton shirt in white with pointed collar. Size M. Good condition."\n'
  'A3,Raf Simons,Hoodie,SS03,Black,"Black cotton jersey hoodie, Spring/Summer 2003. Excellent."\n')
ok = []
def check(cond, label):
    print(('PASS ' if cond else 'FAIL ') + label); ok.append(cond)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1500, 'height': 1100})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'status of 401' not in m.text and 'status of 409' not in m.text and errors.append(m.text))
    toast = lambda: pg.inner_text('.toast')

    # Login
    pg.goto(BASE + '/stock')
    check('/login' in pg.url, 'unauthenticated visit redirects to login')
    pg.fill('#pw', 'nope'); pg.click('text=Sign in'); pg.wait_for_selector('text=Wrong password')
    check(True, 'wrong password refused')
    pg.fill('#pw', 'test'); pg.click('text=Sign in'); pg.wait_for_url('**/stock')
    pg.wait_for_selector('h1:has-text("Boutique stock")')
    check(pg.locator('tbody tr').count() == 19, 'seed: 19 products in stock')

    # Every page renders
    for path, h in [('/', 'Overview'), ('/brands', 'Products by brand'), ('/codes', 'Product code'), ('/ingestion', 'Ingestion'), ('/prompt', 'Copy prompt'), ('/vocabulary', 'Vocabulary')]:
        pg.goto(BASE + path); pg.wait_for_selector(f'h1:has-text("{h}")')
        check(True, f'{path} renders')
    pg.goto(BASE + '/'); pg.wait_for_selector('.gal img')
    pg.wait_for_timeout(800)
    loaded = pg.evaluate("[...document.querySelectorAll('.gal img')].filter(i=>i.naturalWidth>0).length")
    check(loaded >= 19, f'overview gallery photos load ({loaded})')
    check(pg.locator('text=In stock, missing from the archive').count() == 1, 'archive coverage block shown')

    # Import with column mapping, colour column and boutique text reading
    pg.goto(BASE + '/stock'); pg.wait_for_selector('h1')
    pg.set_input_files('input[type=file]', CSV)
    pg.wait_for_selector('text=Map columns to FORM fields')
    pg.select_option('.modal select >> nth=0', 'new')
    pg.fill('input[placeholder="New boutique name"]', 'Test Boutique')
    pg.click('text=Import 3 items'); pg.wait_for_selector('text=3 items imported')
    check(pg.locator('tbody tr').count() == 3, 'import: 3 items in the new boutique')
    row = pg.locator('tbody tr', has_text='A2')
    check('1 conflict' in row.inner_text(), 'import: colour conflict caught (file Navy, text white)')
    row.click(); pg.wait_for_selector('h2:has-text("Shirt")')
    check(pg.locator('button.ftag.bad').count() == 1, 'ingestion: conflict tag shown')
    check(pg.locator('text=from boutique text · check').count() >= 3, 'ingestion: values from the boutique text marked to check')
    pg.click('button:has-text("Approve")'); pg.wait_for_timeout(600)
    check('Before approving' in toast(), 'approval blocked while fields are open: ' + toast())

    # Manual edit persists
    pg.select_option('label:has-text("Colour") + select', 'White'); pg.wait_for_timeout(1500)
    pg.reload(); pg.wait_for_selector('h2:has-text("Shirt")')
    check(pg.locator('label:has-text("Colour") + select').input_value() == 'White', 'edits are saved (colour after reload)')
    check(pg.locator('button.ftag.bad').count() == 0, 'manual edit clears the conflict')

    # New product: Balenciaga photos in shuffled order, no notes -> approved copy restored without the model
    pg.goto(BASE + '/ingestion'); pg.wait_for_selector('h2:has-text("New product")')
    files = [SEED + f'p1001-{i}.jpg' for i in (4, 2, 6, 1, 5, 3)]
    pg.set_input_files('input[type=file][accept="image/*"]', files)
    pg.wait_for_selector('text=6 photos added', timeout=20000)
    check('/ingestion/P' in pg.url, 'new product created on first photo')
    pg.click('button:has-text("Generate copy")'); pg.wait_for_selector('text=Approved copy loaded from the archive', timeout=20000)
    copy = pg.locator('.out textarea >> nth=0').input_value()
    check('Diagonal zips at waist' in copy, 'Balenciaga: approved copy restored ("Diagonal zips at waist")')
    check(pg.locator('ul.src li').count() == 2, 'Balenciaga: both sources restored')
    check('Mock model' not in pg.inner_text('.out'), 'Balenciaga: no model call')

    # New product: D&G nine photos, label + care tagged -> all nine reach the model
    pg.click('button:has-text("+ New product")'); pg.wait_for_selector('h2:has-text("New product")')
    pg.set_input_files('input[type=file][accept="image/*"]', [SEED + f'p1000-{i}.jpg' for i in range(1, 10)])
    pg.wait_for_selector('text=9 photos added', timeout=30000)
    pg.select_option('.thumb select >> nth=7', 'Brand label'); pg.wait_for_timeout(700)
    pg.select_option('.thumb select >> nth=8', 'Care or composition label'); pg.wait_for_timeout(700)
    pg.click('button:has-text("Fill fields from photos")'); pg.wait_for_selector('text=Mock model saw 9 photo(s)', timeout=20000)
    flags = pg.inner_text('.out .flag')
    check('Brand label' in flags and 'Care or composition label' in flags, 'D&G: nine photos reach the model with their roles')
    check(pg.locator('input[placeholder="Style or model number"]').input_value() == 'MOCK-CODE-1', 'D&G: product code filled from the label photo')
    check('Dry clean only.' in pg.inner_text('.out'), 'D&G: care filled from the care label')
    check(pg.locator('text=from photos · check').count() >= 3, 'D&G: values from photos marked to check')
    pg.set_input_files('input[type=file][accept="image/*"]', [SEED + 'p1002-1.jpg']); pg.wait_for_timeout(1200)
    check('up to 9 photos' in toast(), 'tenth photo refused')

    # Lightbox
    pg.click('.thumb img >> nth=0'); pg.wait_for_selector('.lb figcaption')
    pg.keyboard.press('ArrowRight'); check('2 / 9' in pg.inner_text('.lb figcaption'), 'lightbox arrows')
    pg.keyboard.press('Escape')

    # Prompt version
    pg.goto(BASE + '/prompt'); pg.wait_for_selector('h1')
    pg.fill('input[placeholder="What changed and why"]', 'e2e'); pg.click('button:has-text("Save as v3")'); pg.wait_for_selector('text=v3 saved and active')
    check(True, 'prompt: new version saved and active')

    # Vocabulary
    pg.goto(BASE + '/vocabulary?v=colours'); pg.wait_for_selector('h2:has-text("Colours")')
    pg.fill('input[placeholder="Add a term"]', 'Chartreuse'); pg.click('button:has-text("Add") >> nth=0'); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_selector('h2:has-text("Colours")')
    check(pg.locator('.vchip', has_text='Chartreuse').count() == 1, 'vocabulary: term saved')

    # Product codes
    pg.goto(BASE + '/codes'); pg.wait_for_selector('h1')
    pg.fill('input[type=search]', '1649 3691 0769 43'); pg.wait_for_timeout(300)
    check(pg.locator('tbody tr').count() == 1, 'product code lookup ignores spaces')
    before = pg.locator('text=Codes in the base').locator('..').inner_text()
    pg.click('button:has-text("Add all")'); pg.wait_for_timeout(800)
    check('codes added' in toast(), 'codes from stock added to the base')

    check(not errors, 'no browser errors' + (': ' + '; '.join(errors[:3]) if errors else ''))
    b.close()
print(f'\n{sum(ok)}/{len(ok)} checks passed')
sys.exit(0 if all(ok) else 1)
