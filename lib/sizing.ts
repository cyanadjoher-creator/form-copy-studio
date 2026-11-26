// Convert original, labelled garment measurements without doubling flat widths.
const GROUPS: [RegExp, string[]][] = [
  [/skirts?/i, ['W', 'B', 'L']], [/dresses?/i, ['C', 'W', 'L']],
  [/jumpsuits?/i, ['C', 'I', 'L']], [/trousers|jeans|shorts|pants|bottoms/i, ['W', 'R', 'I']],
  [/bags|books|ephemera|objects|small leather goods/i, ['H', 'W', 'D']],
  [/footwear|boots|shoes/i, ['H']], [/belts?/i, ['L', 'W']], [/scarves/i, ['W', 'L']],
  [/hats/i, ['C']], [/eyewear/i, ['L','B','T']], [/watches/i, ['W','L']],
  [/cuffs|rings/i, ['D']], [/necklaces/i, ['L','W','H']], [/earrings/i, ['L','W']],
];
const names: Record<string, string> = {
  'chest': 'C', 'bust': 'C', 'waist': 'W', 'sleeve': 'S', 'length': 'L', 'total length': 'L',
  'inseam': 'I', 'rise': 'R', 'front rise': 'R', 'back rise': 'back rise', 'height': 'H',
  'width': 'W', 'depth': 'D', 'hem width': 'B', 'bottom width': 'B', 'hem': 'B', 'heel height': 'H',
  'shoulders': 'shoulders', 'shoulder width': 'shoulders', 'raglan sleeve': 'raglan sleeve',
  'hips': 'hips', 'hip': 'hips', 'inside circumference': 'C', 'diameter': 'D',
  'chain length': 'L', 'pendant width': 'W', 'pendant height': 'H', 'case width': 'W',
  'lens width': 'L', 'bridge': 'B', 'temple': 'T',
};
const label = Object.keys(names).sort((a,b)=>b.length-a.length).join('|');
const unit = 'cm|mm|inches|inch|in\\b|"';
const re = new RegExp(`(?:^|[\\s,;/××x])(${label}|[CBSRWLHDIT])\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)(?:\\s*[-–—]\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${unit})?`, 'gi');
const u = (x: string) => x.startsWith('cm') ? 'cm' : x.startsWith('mm') ? 'mm' : 'in';

export function sizeInches(raw: string, category: string): { text: string; conflict: boolean } {
  const s = raw.trim().replace(/(\d)[x×](?=[A-Z])/g,'$1 x ');
  const groups = [...s.matchAll(new RegExp(unit, 'gi'))].map(m=>u(m[0].toLowerCase()));
  const distinct = new Set(groups);
  const defaultUnit = distinct.size === 1 ? groups[0] : '';
  const order = GROUPS.find(([pattern])=>pattern.test(category))?.[1] || ['C','S','L'];
  const found = new Map<string,{ns:number[]; metric:boolean}>();
  let conflict = false;
  for (const m of s.matchAll(re)) {
    const k = names[m[1].toLowerCase()] || m[1].toUpperCase();
    if (k === 'hips' && /skirts?/i.test(category)) continue;
    const rawUnit = m[4] ? u(m[4].toLowerCase()) : defaultUnit;
    if (!rawUnit) continue;
    const metric = rawUnit !== 'in';
    const ns = [m[2],m[3]].filter(Boolean).map(x=>Number(x.replace(',', '.')) / (rawUnit === 'cm' ? 2.54 : rawUnit === 'mm' ? 25.4 : 1));
    if (ns.some(n=>n <= 0 || n > 300) || (ns.length===2 && ns[0]>ns[1])) { conflict = true; continue; }
    const old = found.get(k);
    if (old && (old.ns.length!==ns.length || old.ns.some((n,i)=>Math.abs(n-ns[i]) > (old.metric===metric ? 0.05 : 0.26)))) conflict = true;
    if (!old || (metric && !old.metric)) found.set(k,{ns,metric});
  }
  const extras = [...found.keys()].filter(k=>!order.includes(k));
  const text = [...order,...extras].filter(k=>found.has(k)).map(k=>`${k}${k.length===1?'':' '}${found.get(k)!.ns.map(n=>Math.round((n + Number.EPSILON)*4)/4).join('-')}`).join(' x ');
  return { text: text ? text + ' in' : '', conflict };
}
