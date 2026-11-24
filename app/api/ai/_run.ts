import { buildInput, parseModelJson, applyModelFields, historyMatch, placeContext, CONTEXT_MISSING, type Product, type Source } from '@/lib/domain';
import { activePrompt, getVocab, saveProduct } from '@/lib/repo';
import { callModel, aiModel, aiProvider } from '@/lib/ai';
import { readPhoto } from '@/lib/storage';
import { HttpError } from '@/lib/http';

/** Sends the product, its photos (with their roles) and the prompt to the model; fills empty fields. */
export async function runModel(p: Product, opts: { fieldsOnly: boolean }) {
  const [prompt, vocab] = await Promise.all([activePrompt(), getVocab()]);
  const images = await Promise.all(p.photos.map(async (ph, i) => {
    const { data, mime } = await readPhoto(ph.url);
    return { data: data.toString('base64'), mime, label: `Photo ${i + 1} — ${ph.role}` };
  }));
  const webSearch = !opts.fieldsOnly && process.env.WEB_SEARCH !== 'off';
  const { text, notes, searches } = await callModel(buildInput(p, prompt, vocab, { ...opts, webSearch }), images, { webSearch });
  let j: Record<string, unknown>;
  try { j = parseModelJson(text); } catch { throw new HttpError(502, 'The model answer could not be read. Try again.'); }
  const flags = Array.isArray(j.flags) ? (j.flags as string[]).map(String) : [];
  const filled = applyModelFields(p, j.fields as Record<string, unknown>);
  if (filled.length) flags.unshift('Filled from the photos, check: ' + filled.join(', '));
  p.flags = flags;
  flags.push(...notes);
  const note = `${aiProvider()} ${aiModel()} · ${p.photos.length} photo(s)${searches ? ` · ${searches} web search(es)` : ''}`;
  if (!opts.fieldsOnly) {
    // History: the paragraph sits right after the title lines, or the CONTEXT MISSING marker does.
    const rec = historyMatch(p);
    const missing = String(j.context_status || '').toLowerCase() === 'missing';
    const history = missing ? '' : String(j.history_paragraph || '').trim();
    p.copy = placeContext(String(j.website_copy || ''), history);
    if (!history) flags.unshift(`Context missing: no documented history was found for ${p.brand || 'this piece'}${p.season ? ' · ' + p.season : ''}. Add research leads (or a FORM record), then regenerate.`);
    const got: Source[] = (Array.isArray(j.sources) ? j.sources as Record<string, unknown>[] : [])
      .map((s) => ({ title: String(s.title || '').trim(), url: String(s.url || '').trim(), supports: String(s.supports || '').trim() }))
      .filter((s) => s.title || s.url);
    if (history && rec && rec.status === 'Ready for review') rec.sources.forEach((s) => got.push({ title: s.title, url: s.url, supports: s.kind }));
    const seen = new Set<string>();
    if (history) p.sources = got.filter((s) => { const k = s.url || s.title; if (seen.has(k)) return false; seen.add(k); return true; });
    p.historyRow = rec ? rec.row : null;
    if (rec) flags.push(`FORM history record used: row ${rec.row} (${rec.name}, ${rec.scope}).`);
    if (p.copy.includes(CONTEXT_MISSING) && history) p.copy = placeContext(p.copy, history);
    p.boutiqueText = String(j.boutique_text || '').trim();
    p.promptV = prompt.v;
    if (!['Approved', 'In Shopify'].includes(p.status)) p.status = 'Drafted';
    p.history.push({ t: new Date().toISOString().slice(0, 16).replace('T', ' '), s: p.status, n: `generated with prompt v${prompt.v} · ${note}` });
  } else {
    p.history.push({ t: new Date().toISOString().slice(0, 16).replace('T', ' '), s: p.status, n: `fields read from photos · ${note}${filled.length ? ': ' + filled.join(', ') : ''}` });
  }
  return { product: await saveProduct(p), filled };
}
