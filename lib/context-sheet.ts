// Server-only. Never send the credential or full tracker to a browser or model.
import { lookupContext, snapshotContext, type ContextResult, type CopyContext } from './context';
import type { Product } from './domain';
import { listBoutiques } from './repo';
import { fetchSheetRows } from './sheets-reader';

const TTL = 60_000;
let cache: { expires: number; rows: CopyContext[] } | undefined;
let pending: Promise<CopyContext[]> | undefined;

export async function contextFor(p: Product): Promise<ContextResult> {
  const boutique = (await listBoutiques()).find(b=>b.id===p.boutiqueId)?.name || '';
  const id = process.env.COPY_CONTEXT_SHEET_ID;
  const credentials = process.env.COPY_CONTEXT_SERVICE_ACCOUNT_JSON;
  if (!id && !credentials) return lookupContext(snapshotContext(),p,boutique,'snapshot');
  if (!id || !credentials) return {origin:'unavailable',issue:'Copy Context is partly configured. Add the sheet ID and read-only service account.'};
  try {
    if (!cache || cache.expires < Date.now()) {
      pending ||= fetchSheetRows(id,credentials).finally(()=>{pending=undefined;});
      cache = {expires:Date.now()+TTL,rows:await pending};
    }
    return lookupContext(cache.rows,p,boutique,'sheets');
  } catch {
    return {origin:'unavailable',issue:'Copy Context could not be read. Check service-account access and sheet headers, then retry.'};
  }
}
