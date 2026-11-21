// Model calls. Claude by default; Gemini (Soukita's v42 setup) when AI_PROVIDER=gemini.
// The key lives in the Vercel project settings, never in the browser.
import { HttpError } from './http';

export type ModelImage = { data: string; mime: string; label: string };

export function aiProvider(): 'claude' | 'gemini' | 'mock' | 'none' {
  const p = (process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'claude' || p === 'gemini' || p === 'mock') return p;
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return 'none';
}
export function aiModel() {
  const p = aiProvider();
  if (p === 'claude') return process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  if (p === 'gemini') return process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  return p;
}

export async function callModel(input: string, images: ModelImage[]): Promise<string> {
  const p = aiProvider();
  if (p === 'none') throw new HttpError(503, 'No model is configured. Add ANTHROPIC_API_KEY (or GEMINI_API_KEY with AI_PROVIDER=gemini) in the Vercel project settings.');
  if (p === 'mock') return mockAnswer(input, images);
  if (p === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'ANTHROPIC_API_KEY is missing.');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const content: Record<string, unknown>[] = [];
    images.forEach((im) => {
      content.push({ type: 'text', text: im.label });
      content.push({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } });
    });
    content.push({ type: 'text', text: input });
    const res = await client.messages.create({
      model: aiModel(), max_tokens: 4000,
      messages: [{ role: 'user', content: content as never }],
    });
    return res.content.map((b) => ('text' in b ? (b as { text: string }).text : '')).join('');
  }
  // Gemini
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, 'GEMINI_API_KEY is missing.');
  const parts: Record<string, unknown>[] = [];
  images.forEach((im) => { parts.push({ text: im.label }); parts.push({ inlineData: { mimeType: im.mime, data: im.data } }); });
  parts.push({ text: input });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${aiModel()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 5500 } }),
  });
  if (res.status === 429) throw new HttpError(429, 'Gemini usage limit reached. Try again later.');
  if (!res.ok) throw new HttpError(502, `Gemini error ${res.status}`);
  const j = await res.json();
  return (j.candidates?.[0]?.content?.parts || []).filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text || '').join('');
}

/** Deterministic answer for automated tests (AI_PROVIDER=mock). */
function mockAnswer(input: string, images: ModelImage[]) {
  const roles = images.map((i) => i.label).join(' | ');
  const label = /Brand label/.test(roles);
  const care = /Care or composition label/.test(roles);
  const fieldsOnly = /Do not write any copy/.test(input);
  return JSON.stringify({
    fields: { colour: 'Black', category: 'Jackets', material: 'Wool', condition: '', size_system: '', size: '', season_type: '', season_year: '', made_in: label ? 'Italy' : '', measurements: '', product_code: label ? 'MOCK-CODE-1' : '', care_instructions: care ? 'Dry clean only.' : '' },
    website_copy: fieldsOnly ? '' : 'MOCK BRAND\nMock item\nFall/Winter 2004\n\nWool jacket.\n\n· Button closure',
    boutique_text: fieldsOnly ? '' : 'Mock boutique text.',
    flags: [`Mock model saw ${images.length} photo(s): ${roles}`],
  });
}
