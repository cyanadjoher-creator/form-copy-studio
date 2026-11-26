import { createSign } from 'node:crypto';
import { parseContextGrid, type CopyContext } from './context.ts';

export async function fetchSheetRows(id: string, credentials: string, fetcher = fetch, now = Date.now): Promise<CopyContext[]> {
  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(id)) throw new Error('Invalid spreadsheet ID.');
  const sa = JSON.parse(credentials);
  if (typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') throw new Error('Incomplete Sheets service account.');
  const jwtPart = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const iat = Math.floor(now()/1000);
  const unsigned = [jwtPart({alg:'RS256',typ:'JWT'}), jwtPart({
    iss:sa.client_email, scope:'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud:'https://oauth2.googleapis.com/token',iat,exp:iat+300,
  })].join('.');
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key,'base64url');
  const tokenRes = await fetcher('https://oauth2.googleapis.com/token',{
    method:'POST', body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+sig}),
    signal:AbortSignal.timeout(8000), cache:'no-store',
  });
  if (!tokenRes.ok) throw new Error('Sheets authorization was refused.');
  const {access_token} = await tokenRes.json();
  if (typeof access_token !== 'string') throw new Error('Missing Sheets access token.');
  const range = encodeURIComponent("'Copy Context'!A1:R");
  const response = await fetcher('https://sheets.googleapis.com/v4/spreadsheets/'+id+'/values/'+range,{
    headers:{Authorization:'Bearer '+access_token}, signal:AbortSignal.timeout(8000), cache:'no-store',
  });
  if (!response.ok) throw new Error('Could not read Copy Context.');
  const {values} = await response.json();
  if (!Array.isArray(values)) throw new Error('Copy Context is empty.');
  return parseContextGrid(values);
}
