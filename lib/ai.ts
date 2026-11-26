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

export type ModelResult = { text: string; notes: string[]; searches: number; searchUrls?: string[] };

/** One model call. With webSearch, Claude can research the garment's history on the web (Anthropic's web search tool). */
export async function callModel(input: string, images: ModelImage[], opts: { webSearch?: boolean } = {}): Promise<ModelResult> {
  const p = aiProvider();
  if (p === 'none') throw new HttpError(503, 'No model is configured. Add ANTHROPIC_API_KEY (or GEMINI_API_KEY with AI_PROVIDER=gemini) in the Vercel project settings.');
  if (p === 'mock') return input.startsWith('You are researching the design history')
    ? { text: JSON.stringify({ history_paragraph: 'Mock researched history for the given season.', sources: [{ title: 'Mock review', url: 'https://www.vogue.com/mock-review', supports: 'Collection idea', evidence_role: 'collection' }], findings: ['Mock search found the season review.'], history_from_boutique: '' }), notes: [], searches: 2, searchUrls: ['https://www.vogue.com/mock-review'] }
    : { text: mockAnswer(input, images), notes: [], searches: 0 };
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
    const notes: string[] = [];
    const run = async (search: boolean) => {
      const messages: Record<string, unknown>[] = [{ role: 'user', content }];
      const tools = search ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: Number(process.env.WEB_SEARCH_MAX || 6) }] : undefined;
      let searches = 0;
      const searchUrls = new Set<string>();
      // A long research turn can pause: send it back as is so Claude finishes (at most a few rounds).
      for (let round = 0; round < 4; round++) {
        const res = await client.messages.create({ model: aiModel(), max_tokens: 8000, messages: messages as never, ...(tools ? { tools: tools as never } : {}) });
        const blocks = res.content as unknown as { type: string; text?: string; content?: unknown }[];
        for (const b of blocks) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const hit of b.content) if (hit?.type === 'web_search_result' && typeof hit.url === 'string') searchUrls.add(hit.url);
        searches += blocks.filter((b) => b.type === 'server_tool_use').length;
        if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
        // The answer is the text written after the last search result.
        const last = blocks.map((b) => b.type).lastIndexOf('web_search_tool_result');
        const text = blocks.slice(last + 1).filter((b) => b.type === 'text').map((b) => b.text || '').join('');
        return { text: text || blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join(''), searches, searchUrls:[...searchUrls] };
      }
      throw new HttpError(504, 'The research took too long. Try again.');
    };
    if (opts.webSearch) {
      try { const r = await run(true); return { ...r, notes }; }
      catch (e) {
        const msg = String((e as Error).message || e);
        if (e instanceof HttpError || !/web.?search|tool|not enabled|permission/i.test(msg)) throw e;
        notes.push('Web search is turned off for this API key, so no history research was done. Turn it on in Claude Console (Settings › Privacy › Web search), then regenerate.');
      }
    }
    const r = await run(false);
    return { ...r, notes };
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
  return { text: (j.candidates?.[0]?.content?.parts || []).filter((x: { thought?: boolean }) => !x.thought).map((x: { text?: string }) => x.text || '').join(''), notes: opts.webSearch ? ['Gemini runs without web search here: history comes only from FORM records and research leads.'] : [], searches: 0 };
}

/** Deterministic answer for automated tests (AI_PROVIDER=mock). */
function mockAnswer(input: string, images: ModelImage[]) {
  const roles = images.map((i) => i.label).join(' | ');
  const label = /Brand label/.test(roles);
  const care = /Care or composition label/.test(roles);
  const fieldsOnly = /Do not write any copy/.test(input);
  return JSON.stringify({
    fields: { colour: images.length ? 'Black' : '', category: images.length ? 'Jackets' : '', material: images.length ? 'Wool' : '', condition: '', size_system: '', size: '', season_type: '', season_year: '', made_in: label ? 'Italy' : '', measurements: '', product_code: label ? 'MOCK-CODE-1' : '', care_instructions: care ? 'Dry clean only.' : '' },
    photo_set_status:'consistent', product_name:'Mock Jacket', product_sentence:fieldsOnly?'':'Tweed jacket', construction:fieldsOnly?[]:['Button closure'], damage:[], history_paragraph:'',
    sources: [],
    boutique_text: fieldsOnly ? '' : 'Mock boutique text.',
    flags: [`Mock model saw ${images.length} photo(s): ${roles}`],
  });
}
