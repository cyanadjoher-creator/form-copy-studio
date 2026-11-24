import { handle } from '@/lib/http';
import { buildInput, parseModelJson, placeContext } from '@/lib/domain';
import { getProduct, getVocab } from '@/lib/repo';
import { callModel } from '@/lib/ai';
import { readPhoto } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Copy prompt test bench: runs an unsaved prompt on one product without changing it. */
export const POST = handle(async (req: Request) => {
  const { id, text, rules } = await req.json();
  const p = await getProduct(id);
  const images = await Promise.all(p.photos.map(async (ph, i) => {
    const { data, mime } = await readPhoto(ph.url);
    return { data: data.toString('base64'), mime, label: `Photo ${i + 1} — ${ph.role}` };
  }));
  const { text: out } = await callModel(buildInput(p, { text, rules }, await getVocab(), { webSearch: true }), images, { webSearch: true });
  try {
    const j = parseModelJson(out);
    return { websiteCopy: placeContext(String(j.website_copy || ''), String(j.context_status).toLowerCase() === 'missing' ? '' : String(j.history_paragraph || '')), boutiqueText: j.boutique_text || '', flags: j.flags || [] };
  } catch { return { websiteCopy: out, boutiqueText: '', flags: ['Answer was not JSON'] }; }
});
