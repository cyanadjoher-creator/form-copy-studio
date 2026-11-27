'use client';
import { useState } from 'react';
import { useRegion } from '@/components/region';
import { useData } from '@/components/data';
import { REGIONS, REGION_LABEL, WOMEN, MEN, MEN_TROUSERS, SHOES_W, SHOES_M, US_ERAS, convertSize, eraNote, sizeIn, type Region } from '@/lib/size-conversion';

const COLS: (Region | 'JP designer')[] = ['Letter', 'EU', 'FR', 'IT', 'UK', 'US', 'JP', 'JP designer'];
function Table({ title, rows, note, region }: { title: string; rows: Record<string, string | undefined>[]; note: string; region: Region }) {
  const cols = COLS.filter((c) => rows.some((r) => r[c]));
  return (
    <div style={{ marginTop: 22 }}>
      <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      <p className="small muted" style={{ margin: '0 0 8px' }}>{note}</p>
      <table><thead><tr>{cols.map((c) => <th key={c} style={c === region ? { background: '#111', color: '#fff' } : {}}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} style={c === region ? { fontWeight: 700 } : {}}>{r[c] || ''}</td>)}</tr>)}</tbody></table>
    </div>
  );
}

export default function Sizes() {
  const { data } = useData();
  const [region, setRegion] = useRegion();
  const [sys, setSys] = useState('IT'); const [size, setSize] = useState('40'); const [line, setLine] = useState('Womenswear'); const [cat, setCat] = useState('Dresses'); const [year, setYear] = useState('1998');
  const c = convertSize(sys, size, cat, line);
  const note = eraNote(sys, size, Number(year) || null, line);
  const stock = data?.products || [];
  const noLine = stock.filter((p) => p.size && !p.sizeLine).length;
  return (
    <>
      <div className="eyebrow">Reference</div><h1>Sizes</h1>
      <p className="lede">The label size is kept as written. Next to it the studio shows the same size in the region you choose, and warns when the label's era changes what the number meant. The measurements in the copy stay the reference: every house cuts to its own block.</p>
      <div className="card">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <b>Show sizes for</b>
          {REGIONS.map((r) => <button key={r} className={'btn sm' + (r === region ? ' dark' : ' ghost')} onClick={() => setRegion(r)}>{REGION_LABEL[r]}</button>)}
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>Saved in this browser. Ingestion shows every piece's size in this region. {noLine ? `${noLine} pieces in stock have no line (Womenswear or Menswear) yet: womenswear is assumed for them.` : ''}</p>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Convert one size</h2>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={line} onChange={(e) => setLine(e.target.value)}><option>Womenswear</option><option>Menswear</option></select>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{['Dresses', 'Jackets', 'Trousers', 'Shoes'].map((x) => <option key={x}>{x}</option>)}</select>
          <select value={sys} onChange={(e) => setSys(e.target.value)}>{['IT', 'FR', 'EU', 'UK', 'US', 'JP', 'Letter', 'Shoes EU'].map((x) => <option key={x}>{x}</option>)}</select>
          <input value={size} onChange={(e) => setSize(e.target.value)} style={{ width: 80 }} aria-label="Size" />
          <input value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 90 }} aria-label="Year" placeholder="Year" />
        </div>
        {c ? <p style={{ marginTop: 12 }}><b>{c.from}</b> = {(['Letter', 'EU', 'FR', 'IT', 'UK', 'US', 'JP'] as Region[]).map((r) => sizeIn(c, r)).filter(Boolean).join(' · ')} <span className="small muted">({c.table})</span>
          {c.row[region] && <><br /><span className="small">In your region: <b>{sizeIn(c, region)}</b></span></>}</p> : <p className="small muted" style={{ marginTop: 12 }}>Not on the table for this line and type: go by the measurements.</p>}
        {note && <p className="flag" style={{ marginTop: 8 }}>{note}</p>}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Conversion tables</h2>
        <Table title="Women's clothing" rows={WOMEN} region={region} note="Dresses, tops, jackets, coats, skirts. EU is the German, Dutch and Nordic numbering; France is EU + 2, Italy EU + 4. Japan: JIS odd sizes; 'JP designer' is the 0-5 numbering used by Japanese houses (Yohji Yamamoto, Comme des Garçons), which each house sets itself." />
        <Table title="Men's tailoring, coats and knitwear" rows={MEN} region={region} note="UK and US numbers are the chest in inches; European numbers are the same in Italy and France." />
        <Table title="Men's trousers" rows={MEN_TROUSERS} region={region} note="UK and US numbers are the waist in inches. European number ≈ waist + 16." />
        <Table title="Women's shoes" rows={SHOES_W} region={region} note="EU and IT share numbers; Italian lasts often run about half a size small. JP in centimetres." />
        <Table title="Men's shoes" rows={SHOES_M} region={region} note="As above." />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>What a size meant by era</h2>
        <p className="small">US women's numbers moved most. Manufacturers stopped following the official US tables in 1983, and the same number has been cut for a larger body ever since: by the 2008 standard a size 8 had grown five to six inches at bust, waist and hip compared with 1958. Body measurements behind each US label (inches, bust / waist / hip):</p>
        <table><thead><tr><th>Size</th>{US_ERAS.map((e) => <th key={e.label}>{e.label}</th>)}</tr></thead>
          <tbody>{['0', '2', '4', '6', '8', '10', '12', '14', '16'].map((s) => <tr key={s}><td><b>US {s}</b></td>{US_ERAS.map((e) => <td key={e.label}>{e.sizes[s] ? e.sizes[s].join(' / ') : ''}</td>)}</tr>)}</tbody></table>
        <ul className="small" style={{ marginTop: 12, paddingLeft: 18 }}>
          <li><b>Early 2000s:</b> US labels follow the 1995 tables (size 8 = 35 in bust). A US 8 from 2002 is about a US 6 today.</li>
          <li><b>2010s:</b> the 2011 tables (size 8 = 36¼ in bust) are still the current reference; labels from 2011 on match today's chart.</li>
          <li><b>2020s:</b> ASTM revised the tables in 2021 (sizes 00-20); its figures are paid-for, so the 2011 values are kept here. Brands keep their own charts either way.</li>
          <li><b>Europe:</b> French and Italian numbers stayed broadly stable, but follow each house's block; the European body-measurement standard (EN 13402) came in from the early 2000s and was adopted unevenly. Pre-1990s European pieces often fit one or two sizes smaller than the same number now. Italian houses differ among themselves (an IT 40 at Dolce & Gabbana is not an IT 40 at Max Mara).</li>
          <li><b>Japan:</b> designer numbers (1, 2, 3) mean different things from house to house and line to line (Y's 1 = XS/S, Yohji Yamamoto Pour Homme 3 = M). Always read them with the measurements.</li>
        </ul>
        <p className="small muted">Sources: Hugo Boss size chart (EU, FR, IT, UK, US); sizeguide.net (menswear); Wikipedia, Vanity sizing (1958, 1995 and 2011 US tables); Time, The bizarre history of women's clothing sizes; EN 13402; La Garçonne (Japanese designer sizing); ReSee size and fit guide (vintage fit). Conversions are indicative.</p>
      </div>
    </>
  );
}
