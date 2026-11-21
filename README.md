# FORM Copy Studio

The working tool for FORM's garment copy, until an agent runs it natively in Shopify. It extends Soukita's garment copy tool (v42): boutique stock in, photos and labels read, fields checked against the vocabulary, copy written with a versioned prompt, approved copy pasted into Shopify. Shopify stays the source of truth for products and product-page photos.

## What it does

| Page | Purpose |
| --- | --- |
| Overview | What the stock holds, what matches the archive, which brands are missing, where the copy stands |
| Boutique stock | Import a Shopify product export (CSV) or a boutique's own file (CSV/XLSX). Columns are matched to FORM fields, the boutique description is read into empty fields, every item shows what is missing or conflicting |
| Products by brand | Every item by house, with photos and copy |
| Product code | Reference base of product codes; look up a code from a label |
| Ingestion | One product at a time: photos with roles, fields, Fill fields from photos, Generate copy, approval checks |
| Copy prompt | Versioned prompt (Soukita's v42 prompt is v2), test bench |
| Vocabulary | The lists every dropdown and import uses |

Rules that keep the copy accurate:
- A value read from the boutique text or the photos only fills an **empty** field and is marked *to check*. A disagreement between sources is a **conflict**. Approval is refused while any required field is missing, any conflict is open or any value is unchecked. This is enforced by the API, not only the page.
- With the text fields empty, photos that **exactly** match an approved entry (SHA-256, any order) bring back its approved copy and sources without calling the model (Soukita's v42 rule).
- The photo-reading instructions and the output format live in code (`lib/domain.ts → buildInput`). Editing the prompt's tone can't break them.

## Deploy on Vercel (one time, about 10 minutes)

1. **Import the repo.** vercel.com → Add New → Project → import `form-copy-studio` from GitHub. Framework: Next.js (detected). Deploy.
2. **Database.** In the project: Storage → Create → **Neon (Postgres)** → connect to the project. Vercel adds `DATABASE_URL` by itself. The photos are stored in this database too, behind the login: there is no separate photo storage to set up. (The free Neon plan holds roughly 1,000 photos; a Vercel Blob store can be connected later and is then used automatically.)
3. **Settings → Environment Variables**, add:
   - `APP_PASSWORD`: the team password.
   - `ANTHROPIC_API_KEY`: the model key (console.anthropic.com).
   - Optional, to run Soukita's Gemini setup instead: `AI_PROVIDER=gemini` and `GEMINI_API_KEY`.
4. **Redeploy** (Deployments → … → Redeploy) so the new settings apply.

On first load the database is created and filled with Soukita's test set (18 garments) and one boutique listing example. Every push to `main` deploys automatically.

The sidebar shows which model is in use. A yellow banner appears if the database or the model key is missing.

## Run locally

```sh
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without `DATABASE_URL` it uses an embedded Postgres in `.data/` (photos included). No password is asked when `APP_PASSWORD` is empty.

## Tests

```sh
npm test                                     # logic: seasons, boutique text, conflicts, Shopify merge, house style
npm run build && APP_PASSWORD=test AI_PROVIDER=mock npx next start -p 3100 &
python3 tests/e2e.py http://localhost:3100   # every page and flow in a browser (Playwright)
```

`AI_PROVIDER=mock` answers deterministically, so the flows can be tested without a key.

## Structure

```
lib/domain.ts        shared logic: seasons, vocabulary, import mapping, boutique-text reading, readiness, house style, prompt assembly
lib/db.ts            Postgres (Neon) or embedded PGlite; schema
lib/seed.ts          first-run data (Soukita's test set, prompts, vocabulary)
lib/repo.ts          data access, exact photo-set match
lib/ai.ts            Claude / Gemini / mock
lib/storage.ts       photos in the database (or a Vercel Blob store if connected)
app/api/...          REST routes (approval rule enforced in products/[id])
app/(studio)/...     pages
components/          Ingestion, data provider, shared UI
```

## Not connected yet

- **Ontology context** (Payload): the prompt has an ONTOLOGY CONTEXT block waiting for the Brand, Designer, Collection Master and Look Master records.
- **Shopify**: approved copy is copied with "Copy for Shopify". A direct write to Shopify comes with the agent.
- **Web research** (Soukita's Tavily step) is not included; sources come from the archive match or are added by hand.
