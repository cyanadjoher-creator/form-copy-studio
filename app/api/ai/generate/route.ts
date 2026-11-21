import { handle } from '@/lib/http';
import { now } from '@/lib/domain';
import { findExactPhotoMatch, getProduct, saveProduct } from '@/lib/repo';
import { runModel } from '../_run';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Soukita v42: with the optional text fields blank, an exact photo-set match restores the approved copy, no model call. */
export const POST = handle(async (req: Request) => {
  const { id } = await req.json();
  const p = await getProduct(id);
  const blank = [p.seasonYear, p.notes, p.research, p.boutiqueDesc, p.measurements].every((v) => !String(v || '').trim());
  if (blank) {
    const m = await findExactPhotoMatch(p);
    if (m) {
      Object.assign(p, { copy: m.copy, boutiqueText: m.boutiqueText, sources: m.sources, promptV: null });
      if (!p.brand) { p.brand = m.brand; p.fieldSrc.brand = 'checked'; }
      if (!p.name) { p.name = m.name; p.fieldSrc.name = 'checked'; }
      if (!p.seasonYear && m.seasonYear) Object.assign(p, { seasonType: m.seasonType, seasonYear: m.seasonYear, season: m.season, year: m.year });
      p.flags = [`Approved copy loaded from the archive: the photos exactly match "${m.name}" (${m.id}). No model or web call was made.`];
      if (!['Approved', 'In Shopify'].includes(p.status)) p.status = 'Drafted';
      p.history.push({ t: now(), s: p.status, n: `approved copy restored from ${m.id} (exact photo match)` });
      return { product: await saveProduct(p), matched: m.id };
    }
  }
  return runModel(p, { fieldsOnly: false });
});
