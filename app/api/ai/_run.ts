import { buildInput, parseModelJson, applyModelFields, type Product } from '@/lib/domain';
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
  const text = await callModel(buildInput(p, prompt, vocab, opts), images);
  let j: Record<string, unknown>;
  try { j = parseModelJson(text); } catch { throw new HttpError(502, 'The model answer could not be read. Try again.'); }
  const flags = Array.isArray(j.flags) ? (j.flags as string[]).map(String) : [];
  const filled = applyModelFields(p, j.fields as Record<string, unknown>);
  if (filled.length) flags.unshift('Filled from the photos, check: ' + filled.join(', '));
  p.flags = flags;
  const note = `${aiProvider()} ${aiModel()} · ${p.photos.length} photo(s)`;
  if (!opts.fieldsOnly) {
    p.copy = String(j.website_copy || '').trim();
    p.boutiqueText = String(j.boutique_text || '').trim();
    p.promptV = prompt.v;
    if (!['Approved', 'In Shopify'].includes(p.status)) p.status = 'Drafted';
    p.history.push({ t: new Date().toISOString().slice(0, 16).replace('T', ' '), s: p.status, n: `generated with prompt v${prompt.v} · ${note}` });
  } else {
    p.history.push({ t: new Date().toISOString().slice(0, 16).replace('T', ' '), s: p.status, n: `fields read from photos · ${note}${filled.length ? ': ' + filled.join(', ') : ''}` });
  }
  return { product: await saveProduct(p), filled };
}
