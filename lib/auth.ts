// One shared password (APP_PASSWORD). The cookie holds an HMAC of the password, never the password.
// With no APP_PASSWORD set (local development), the app is open.
export const COOKIE = 'fcs_auth';

async function hmac(text: string) {
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Buffer.from(sig).toString('base64url');
}
export const authEnabled = () => !!process.env.APP_PASSWORD;
export const tokenFor = () => hmac('form-copy-studio:' + (process.env.APP_PASSWORD || ''));
export async function validToken(token: string | undefined) {
  if (!authEnabled()) return true;
  return !!token && token === (await tokenFor());
}
