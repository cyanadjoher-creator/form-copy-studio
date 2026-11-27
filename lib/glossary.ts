import FROZEN from './frozen-vocab.json' with { type: 'json' };
// The FORM garment glossary: one place where the copy vocabulary is defined.
//
// Sources, in order of authority:
//   freeze       FORM vocabulary freeze, 4 November 2026 (Soukita's review is final). Never edited here.
//   guide        FORM Copy Guide (deck): section order, part names and short-description rules.
//   prompt       The revised FORM terminology in the copy prompt (Soukita, v42).
//   fashionpedia Fashionpedia (term names only, used to choose the closest standard name).
//   sewing       Anette Fischer, Sewing for Fashion Designers (term names only).
//   studio       Terms the copy studio needs that none of the above lists yet. Shown in orange, to validate.
// Only term NAMES come from the books. No definition or text is copied.

export type GlossSource = 'freeze' | 'guide' | 'prompt' | 'fashionpedia' | 'sewing' | 'studio';
export type GlossTerm = { t: string; src: GlossSource[]; aka?: string[] };
export type GlossGroup = { key: string; label: string; tone: string; help: string; terms: GlossTerm[] };

export const SOURCE_LABEL: Record<GlossSource, string> = {
  freeze: 'Frozen vocabulary (4 Nov)', guide: 'FORM Copy Guide', prompt: 'FORM copy prompt (terminology)', fashionpedia: 'Fashionpedia', sewing: 'Sewing for Fashion Designers', studio: 'Copy studio, to validate',
};

type F = typeof FROZEN;
export const FROZEN_VOCAB = FROZEN as F;
const fz = (list: string[], aka: Record<string, string[]> = {}): GlossTerm[] => list.filter(Boolean).map((t) => ({ t, src: ['freeze'], ...(aka[t] ? { aka: aka[t] } : {}) }));
const T = (src: GlossSource[], spec: string): GlossTerm[] =>
  spec.split('|').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [t, aka] = s.split('=');
    return { t: t.trim(), src, ...(aka ? { aka: aka.split(',').map((x) => x.trim()).filter(Boolean) } : {}) };
  });
/** Adds sources to terms that several references share, so a term is listed once. */
function merge(...lists: GlossTerm[][]): GlossTerm[] {
  const out = new Map<string, GlossTerm>();
  for (const l of lists) for (const x of l) {
    const k = x.t.toLowerCase();
    const cur = out.get(k);
    if (!cur) { out.set(k, { ...x, src: [...x.src], aka: x.aka ? [...x.aka] : undefined }); continue; }
    cur.src = [...new Set([...cur.src, ...x.src])];
    if (x.aka) cur.aka = [...new Set([...(cur.aka || []), ...x.aka])];
  }
  return [...out.values()];
}

/* ---------- the Copy Guide: order of the long description, per item type ---------- */
export type GuideType = 'Bags' | 'Hats' | 'Sunglasses' | 'Belts' | 'Shoes' | 'T-shirts' | 'Tank tops' | 'Shirts' | 'Shorts' | 'Jeans & Trousers' | 'Skirts' | 'Dresses' | 'Books' | 'CDs & Films' | 'Outerwear & knitwear';
export const COPY_ORDER: Record<GuideType, { order: string[]; notes: string[]; fromGuide: boolean }> = {
  Bags: { order: ['Straps / Handle', 'Face', 'Side / Sides', 'Closure', 'Interior', 'Back', 'Lining', 'Hardware'], notes: ['Colour goes in the short description for accessories.', 'Use face, back face, side, sides, throat, open throat.'], fromGuide: true },
  Hats: { order: ['Crown', 'Face', 'Brim', 'Closure', 'Browband', 'Lining', 'Hardware'], notes: ['Colour goes in the short description for accessories.'], fromGuide: true },
  Sunglasses: { order: ['Lens', 'Nose bridge / pads', 'Temples', 'Arms', 'Accessories'], notes: ['Colour goes in the short description for accessories.'], fromGuide: true },
  Belts: { order: ['Length', 'Keeper loop', 'Fastening', 'Interior', 'Hardware'], notes: ['Colour goes in the short description for accessories.'], fromGuide: true },
  Shoes: { order: ['Toe', 'Closure', 'Tongue', 'Collar', 'Footbed', 'Sides', 'Heel', 'Midsole', 'Sole', 'Packaging'], notes: ['Colour goes in the short description for accessories.'], fromGuide: true },
  'T-shirts': { order: ['Collar', 'Front', 'Hem', 'Shoulders', 'Cuffs', 'Sides', 'Back'], notes: [], fromGuide: true },
  'Tank tops': { order: ['Collar', 'Front', 'Hem', 'Shoulders', 'Armscyes', 'Sides', 'Back'], notes: [], fromGuide: true },
  Shirts: { order: ['Collar', 'Closure', 'Front', 'Hem', 'Shoulders', 'Cuffs', 'Sides', 'Back'], notes: [], fromGuide: true },
  Shorts: { order: ['Fit', 'Rise', 'Waist', 'Pockets', 'Fly', 'Legs', 'Hem', 'Outseams', 'Inner seams', 'Hardware', 'Stitching'], notes: [], fromGuide: true },
  'Jeans & Trousers': { order: ['Fit', 'Rise', 'Waist', 'Pockets', 'Fly', 'Legs', 'Hem', 'Cuffs', 'Outseams', 'Inner seams', 'Hardware', 'Stitching'], notes: [], fromGuide: true },
  Skirts: { order: ['Waist', 'Pockets', 'Closure', 'Front', 'Hem', 'Side seams', 'Back', 'Lining', 'Hardware', 'Stitching'], notes: ['Mini, Midi or Maxi in the title and the short description.', 'Always mention the lining.'], fromGuide: true },
  Dresses: { order: ['Collar', 'Front', 'Hem', 'Shoulders', 'Cuffs', 'Side seams', 'Back', 'Lining', 'Hardware'], notes: ['Length (Mini, Midi, Maxi) in the title.', 'Always mention the lining.'], fromGuide: true },
  Books: { order: ['Cover design', 'Composition', 'Pages', 'Edition', 'Size'], notes: [], fromGuide: true },
  'CDs & Films': { order: ['Case', 'Content', 'Publisher', 'Publishing date'], notes: [], fromGuide: true },
  // Not in the Copy Guide yet: the shirt order, plus lining and hardware. To validate with Soukita.
  'Outerwear & knitwear': { order: ['Collar', 'Closure', 'Front', 'Pockets', 'Hem', 'Shoulders', 'Cuffs', 'Sides', 'Back', 'Lining', 'Hardware'], notes: ['Not in the Copy Guide yet: follows the shirt order with lining and hardware (to validate).'], fromGuide: false },
};
const CATEGORY_TO_GUIDE: Record<string, GuideType> = {
  Bags: 'Bags', 'Small leather goods': 'Bags', Hats: 'Hats', Sunglasses: 'Sunglasses', Belts: 'Belts', Shoes: 'Shoes', Boots: 'Shoes',
  'T-shirts': 'T-shirts', 'Tank tops': 'Tank tops', Shirts: 'Shirts', Blouses: 'Shirts', Tops: 'Shirts', Shorts: 'Shorts',
  Jeans: 'Jeans & Trousers', Trousers: 'Jeans & Trousers', Skirts: 'Skirts', Dresses: 'Dresses', Books: 'Books', 'CDs & Films': 'CDs & Films',
};
export const ACCESSORY_TYPES: GuideType[] = ['Bags', 'Hats', 'Sunglasses', 'Belts', 'Shoes'];
export function guideFor(category: string) {
  const type: GuideType = CATEGORY_TO_GUIDE[category] || 'Outerwear & knitwear';
  return { type, ...COPY_ORDER[type], accessory: ACCESSORY_TYPES.includes(type) };
}
export const SHORT_DESCRIPTION_RULE = 'Short description: a fragment, Material + Item type (+ colour only for accessories). A repeated element gets its own "X throughout" line.';
export const SECTION_ORDER = ['History', 'Short description', 'Long description', 'Country', 'Composition', 'Size'];

/* ---------- the glossary, by highlighted category ---------- */
const houses = FROZEN_VOCAB.FASHION_HOUSE;
export const GLOSSARY: GlossGroup[] = [
  { key: 'types', label: 'Item types', tone: 'ink', help: 'What the piece is. Shop categories follow the Copy Guide item types.', terms: merge(
    T(['guide'], 'Bag|Hat|Sunglasses|Belt|Shoes|T-shirt|Tank top|Shirt|Shorts|Jeans|Trousers|Skirt|Dress|Book|CD|Film'),
    T(['fashionpedia'], 'Blazer|Bolero jacket|Bomber jacket=flight jacket|Trench coat|Chesterfield coat|Peacoat=pea coat|Duffle coat=duffel coat|Parka|Cape|Poncho|Gilet|Waistcoat|Cardigan|Jumper=sweater,pullover|Polo shirt|Henley|Hoodie=hooded sweatshirt|Sweatshirt|Blouse|Camisole|Bodysuit|Corset|Bustier|Kaftan=caftan|Slip dress|Shirt dress|Sheath dress|Wrap dress|Babydoll dress=babydoll|Jumpsuit|Dungarees=overalls|Culottes|Palazzo trousers=palazzo pants|Cargo trousers=cargo pants|Chinos|Joggers|Leggings|Pencil skirt|A-line skirt|Wrap skirt|Kilt|Sarong|Bermuda shorts|Suit|Three-piece suit|Tuxedo jacket=dinner jacket'),
    T(['fashionpedia'], 'Tote bag=tote|Clutch|Shoulder bag|Crossbody bag|Backpack|Bucket bag|Loafers|Mules|Ballet flats|Pumps|Sandals|Trainers=sneakers|Ankle boots|Knee-high boots|Chelsea boots|Beret|Bucket hat|Baseball cap|Beanie')) },
  { key: 'parts', label: 'Parts and zones (Copy Guide order)', tone: 'guide', help: 'The words that open each long-description line, in the order the Copy Guide sets per item type.', terms: merge(
    T(['guide'], 'Collar|Closure|Front|Hem|Shoulders|Cuffs|Sides|Side seams|Back|Armscyes=armholes,arm holes|Waist|Rise|Fit|Pockets|Fly|Legs|Outseams|Inner seams=inseams|Hardware|Stitching|Lining'),
    T(['guide'], 'Straps|Handle|Face|Back face|Side|Throat|Open throat|Interior|Crown|Brim|Browband|Lens|Nose bridge|Nose pads|Temples|Arms|Length|Keeper loop|Fastening|Toe|Tongue|Footbed=insole|Heel|Midsole|Sole=outsole|Packaging|Cover design|Pages|Edition|Case'),
    T(['fashionpedia', 'sewing'], 'Yoke|Placket|Waistband|Belt loops|Vent|Facing|Collar stand|Lapel|Gorge|Break point|Roll line'),
    T(['prompt'], 'Bound edge=bound|Raw edge|Rolled edge|Banded hem|Shirttail hem=curved shirt hem|Curved hem|Dropped shoulder=drop shoulder')) },
  { key: 'knit', label: 'Knit and jersey', tone: 'detail', help: 'The revised FORM terminology in the copy prompt.', terms: T(['prompt'], 'Rib knit=ribbed knit|Rib-knit cuffs=ribbed cuffs|Rib-knit hem=ribbed hem|Cable knit|Intarsia|Jacquard knit|Openwork knit=open knit|Loopback jersey=french terry|Brushed fleece|Fine knit|Chunky knit') },
  { key: 'necklines', label: 'Necklines', tone: 'detail', help: 'Fashionpedia names.', terms: T(['fashionpedia'], 'Crewneck=crew neck,round neck|V-neck=v neck|Scoop neck|Boat neck=bateau neck|Square neck|Sweetheart neck|Halterneck=halter neck|Asymmetric neck|High neck|Bottle neck|Turtleneck=polo neck,roll neck|Funnel neck|Surplice neck|Notched neck|Slashed neck|Off-the-shoulder|One-shoulder|Henley neck|Gathered neck|Cowl neck|Keyhole neck|Mock neck') },
  { key: 'collars', label: 'Collars and lapels', tone: 'detail', help: 'Fashionpedia names, plus the frozen Peter Pan collar.', terms: merge(
    T(['freeze', 'fashionpedia'], 'Peter Pan collar'),
    T(['fashionpedia'], 'Camp collar=cuban collar,revere collar|Point collar=regular collar|Spread collar|Long point collar=pointed collar|Button-down collar|Barrymore collar|Tab collar|Cutaway collar=full cutaway collar|Mitred collar=mitered collar|Round collar|Eton collar|Edwardian collar|Wing collar|Stand collar=band collar,banded collar,mandarin collar,mao collar|Clerical collar|Pinned collar|Chelsea collar|Johnny collar|Shawl collar|Notched lapel|Peak lapel=peaked lapel|Ulster lapel|Chesterfield lapel|Napoleon lapel|L-shaped lapel|T-shaped lapel|Hood')) },
  { key: 'sleeves', label: 'Sleeves and cuffs', tone: 'detail', help: 'Sleeve lengths are frozen; sleeve and cuff types come from Fashionpedia.', terms: merge(
    fz(FROZEN_VOCAB.SLEEVE_LENGTH.filter((x) => x !== 'N/A')),
    T(['freeze', 'fashionpedia'], 'Puff sleeves=puff sleeve,puffed sleeves'),
    T(['fashionpedia', 'sewing'], 'Set-in sleeve|Raglan sleeve|Semi-raglan sleeve|Epaulette sleeve=epaulet sleeve|Yoke sleeve|Tulip sleeve|Tucked sleeve|Flared sleeve=flare sleeve|Angel sleeve|Bouffant sleeve|Bishop sleeve|Batwing sleeve|Dolman sleeve|Kimono sleeve|Cap sleeve|Two-piece sleeve|Sleeve placket|Barrel cuff=button cuff|French cuff=double cuff|Edge cuff|Trim cuff|Western cuff|Banded cuff|Piped cuff|Fringed cuff|Ribbed cuff|Turn-up=turn-ups,cuffed hem')) },
  { key: 'closures', label: 'Closures and openings', tone: 'detail', help: 'Fashionpedia names in British spelling.', terms: T(['fashionpedia', 'sewing'], 'Single-breasted|Double-breasted|Button fastening=button closure|Zip=zipper,zip fastener|Two-way zip=two way zipper,2-way zipper|Concealed zip=invisible zip,invisible zipper,hidden zipper|Exposed zip=exposed zipper|Button fly|Zip fly=zipper fly|Fly front|Placket|Hidden placket=concealed placket,fly placket|Wrap front|Button and loop=button & loop|Lacing|Buckle|Chinese knot button=chinese button,frog fastening|Toggle|Press studs=snap buttons,snaps,poppers|Hook and eye|Drawstring|Velcro=hook-and-loop') },
  { key: 'pockets', label: 'Pockets', tone: 'detail', help: 'Fashionpedia names.', terms: T(['fashionpedia', 'sewing'], 'Patch pocket|Flap pocket|Welt pocket|Jetted pocket=besom pocket|Ticket pocket|Coin pocket|Five-pocket=5-pocket,jeans five-pocket|Back pockets with flaps|Mitred patch pocket=mitered patch pocket|Slant pocket=slanted pocket,slash pocket|Side-seam pocket=in-seam pocket|Cargo pocket|Kangaroo pocket|Pencil pocket|Chest pocket|Breast pocket') },
  { key: 'construction', label: 'Construction', tone: 'freeze', help: 'Frozen construction techniques, completed with sewing terms.', terms: merge(
    fz(FROZEN_VOCAB.CONSTRUCTION_TECHNIQUE, { Lacing: ['corset lacing'], Tailoring: ['tailored'] }),
    T(['sewing', 'fashionpedia'], 'Darts|Princess seams|Pleats|Box pleats|Knife pleats|Inverted pleat|Tucks|Pintucks=pin tucks|French seams|Flat-felled seams=flat felled seams|Bound seams|Topstitching=top stitching,top-stitching|Edge stitching|Bias binding|Piping|Interfacing|Shoulder pads|Back vent|Side vents|Godet|Gusset|Facings|Bar tacks=bartacks|Rivets|Selvedge=selvage,selvedge denim')) },
  { key: 'silhouette', label: 'Silhouette and fit', tone: 'freeze', help: 'All frozen.', terms: merge(
    fz(FROZEN_VOCAB.SILHOUETTE_TYPE), fz(FROZEN_VOCAB.FIT_DEGREE),
    fz(FROZEN_VOCAB.WAIST_PLACEMENT.filter((x) => x !== 'N/A')), fz(FROZEN_VOCAB.HEM_LEG_VOLUME.filter((x) => x !== 'N/A'))) },
  { key: 'surface', label: 'Surface and finish', tone: 'freeze', help: 'All frozen.', terms: fz(FROZEN_VOCAB.SURFACE_TREATMENT) },
  { key: 'ornament', label: 'Ornament and details', tone: 'freeze', help: 'Frozen aesthetic tags for garment details.', terms: fz(FROZEN_VOCAB.ORNAMENT) },
  { key: 'materials', label: 'Materials', tone: 'material', help: 'Fibre and fabric names (Fashionpedia), plus the studio leathers.', terms: merge(
    T(['studio'], 'Calfskin|Lambskin|Leather|Suede|Shearling|Patent leather|Nubuck|Pony hair|Fur|Wool and silk|Wool-blend|Modal jersey|Cotton jersey'),
    T(['fashionpedia'], 'Cotton|Linen|Wool|Virgin wool|Merino wool|Silk|Cashmere|Mohair|Alpaca|Angora|Camel hair|Ramie|Hemp|Viscose=rayon|Acetate|Polyamide|Nylon|Polyester|Acrylic|Elastane=spandex,lycra|Cupro|Lyocell'),
    T(['fashionpedia'], 'Denim|Jersey|Poplin|Oxford|Twill|Gabardine|Crepe=crêpe|Georgette|Chiffon|Organza|Taffeta|Satin|Velvet|Corduroy|Tweed|Flannel|Canvas|Seersucker|Jacquard|Brocade|Lamé|Lace|Tulle|Mesh|Neoprene|Moleskin|Bouclé=boucle|Fleece|Terry=terry cloth|Melton|Loden|Herringbone tweed')) },
  { key: 'pattern', label: 'Pattern and print', tone: 'freeze', help: 'All frozen.', terms: fz(FROZEN_VOCAB.PATTERN_MOTIF, { 'Snakeskin pattern': ['snakeskin print', 'python print'], 'Check': ['checked', 'checks'], 'Leopard': ['leopard print'], 'Polka dot': ['polka dots'] }) },
  { key: 'colour', label: 'Colour', tone: 'freeze', help: 'The colour field takes the frozen colours. A shade word (navy, ecru) can still be written in the copy.', terms: merge(fz(FROZEN_VOCAB.COLOUR), fz(FROZEN_VOCAB.COLOUR_PALETTE, { 'Skin-tone matched': ['nude'], 'Ecru colour': ['ecru'] })) },
  { key: 'condition', label: 'Condition', tone: 'freeze', help: 'Frozen grades, best to worst.', terms: fz(FROZEN_VOCAB.CONDITION) },
  { key: 'season', label: 'Season', tone: 'freeze', help: 'Frozen season types.', terms: fz(FROZEN_VOCAB.SEASON_V1) },
  { key: 'houses', label: 'Fashion houses', tone: 'freeze', help: 'Frozen house names (' + houses.length + '). Dior is the house, Christian Dior the designer.', terms: fz(houses) },
  { key: 'countries', label: 'Countries (Made in)', tone: 'freeze', help: 'Frozen country names.', terms: fz(FROZEN_VOCAB.COUNTRY) },
];

/* ---------- field values: boutique wording to the frozen term ---------- */
/** Field-level synonyms. A string means a safe, automatic match; an array means several frozen terms fit, so a person picks. */
export const FIELD_ALIASES: Record<'colours' | 'conditions' | 'seasonTypes' | 'brands', Record<string, string | string[]>> = {
  colours: {
    gray: 'Grey', charcoal: 'Grey', anthracite: 'Grey', 'off-white': 'White', 'off white': 'White', ivory: 'White', cream: 'White', ecru: 'White', beige: 'Beige / Tan', tan: 'Beige / Tan', camel: 'Beige / Tan', sand: 'Beige / Tan', nude: 'Beige / Tan', stone: 'Beige / Tan',
    navy: 'Blue', 'navy blue': 'Blue', indigo: 'Blue', 'sky blue': 'Blue', teal: ['Blue', 'Green'], turquoise: ['Blue', 'Green'], burgundy: 'Red', bordeaux: 'Red', wine: 'Red', oxblood: 'Red', maroon: 'Red', crimson: 'Red',
    khaki: 'Green', olive: 'Green', 'army green': 'Green', taupe: ['Brown', 'Grey'], chocolate: 'Brown', cognac: 'Brown', rust: 'Orange', mustard: 'Yellow', fuchsia: 'Pink', magenta: 'Pink', lilac: 'Purple', lavender: 'Purple', violet: 'Purple', plum: 'Purple',
    bronze: 'Metallic', copper: 'Metallic', multicolor: 'Multicolour', multicolored: 'Multicolour', multicoloured: 'Multicolour', multi: 'Multicolour', 'black and white': 'Multicolour',
  },
  conditions: {
    'new with tags': 'Pristine', nwt: 'Pristine', unworn: 'Pristine', deadstock: 'Pristine', new: 'Pristine', mint: 'Pristine', 'never worn': 'Pristine',
    'near mint': 'Excellent', 'like new': 'Excellent', 'very good': ['Excellent', 'Good'], used: ['Good', 'Fair'], 'as is': 'Poor', damaged: 'Poor', 'vintage condition': ['Good', 'Fair'],
  },
  seasonTypes: { artisanal: 'Artisanal', resort: 'Cruise / Resort', cruise: 'Cruise / Resort', 'pre-spring': 'Cruise / Resort', 'autumn/winter': 'Fall/Winter', 'a/w': 'Fall/Winter', aw: 'Fall/Winter', 'spring summer': 'Spring/Summer', 'haute couture': 'Couture' },
  brands: {
    'maison margiela': 'MAISON MARTIN MARGIELA', 'martin margiela': 'MAISON MARTIN MARGIELA', mmm: 'MAISON MARTIN MARGIELA', 'comme des garcons': 'COMME DES GARÇONS', cdg: 'COMME DES GARÇONS',
    'christian dior': 'DIOR', 'dior homme': 'DIOR', céline: 'CELINE', 'yohji yamamoto pour homme': 'YOHJI YAMAMOTO', ysl: 'YVES SAINT LAURENT', 'saint laurent': ['YVES SAINT LAURENT'],
    'jun takahashi': ['UNDERCOVER'], 'hermes': 'HERMÈS', 'issey miyake men': 'ISSEY MIYAKE', 'mcqueen': 'ALEXANDER MCQUEEN', 'gaultier': 'JEAN PAUL GAULTIER', 'jean-paul gaultier': 'JEAN PAUL GAULTIER',
  },
};
export const FROZEN_FIELD_LISTS = {
  colours: FROZEN_VOCAB.COLOUR,
  conditions: FROZEN_VOCAB.CONDITION,
  seasonTypes: [...FROZEN_VOCAB.SEASON_V1.filter((x) => x !== 'Unknown'), 'Decade', 'Unknown'],
  brands: houses.map((h) => h.toUpperCase()),
};
/** Terms the studio keeps although they are not in the freeze (shown in orange). */
export const STUDIO_ONLY: Record<string, string[]> = { seasonTypes: ['Decade'] };

const nrm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/]+/g, ' ').trim();
/** The frozen term for a field value: exact (accent and case free) or through a safe alias. */
export function frozenTerm(key: keyof typeof FIELD_ALIASES, value: string): { term: string; choices: string[]; how: 'exact' | 'alias' | 'choose' | 'none' } {
  const list = FROZEN_FIELD_LISTS[key];
  const n = nrm(value);
  if (!n) return { term: '', choices: [], how: 'none' };
  const exact = list.find((x) => nrm(x) === n);
  if (exact) return { term: exact, choices: [exact], how: 'exact' };
  const a = Object.entries(FIELD_ALIASES[key]).find(([k]) => nrm(k) === n)?.[1];
  if (typeof a === 'string') return { term: a, choices: [a], how: 'alias' };
  if (Array.isArray(a)) return { term: a.length === 1 ? a[0] : '', choices: a, how: 'choose' };
  return { term: '', choices: [], how: 'none' };
}

/* ---------- copy text: boutique or model wording to FORM wording ---------- */
// Safe, automatic rewrites applied to the drafted short and long description (never to an accepted history paragraph).
// Each one is a spelling or a standard-name change; anything that could change the meaning is only suggested.
const AUTO: [RegExp, string, string][] = [
  [/\bcolou?r(ed|s|way|ways)?\b/gi, 'colour$1', 'color → colour'],
  [/\bgray\b/gi, 'grey', 'gray → grey'],
  [/\bzippers?\b/gi, 'zip', 'zipper → zip'],
  [/\bzippered\b/gi, 'zipped', 'zippered → zipped'],
  [/\bfiber(s)?\b/gi, 'fibre$1', 'fiber → fibre'],
  [/\bcenter(ed)?\b/gi, 'centre$1', 'center → centre'],
  [/\bjewelry\b/gi, 'jewellery', 'jewelry → jewellery'],
  [/\bmitered\b/gi, 'mitred', 'mitered → mitred'],
  [/\bepaulet\b/gi, 'epaulette', 'epaulet → epaulette'],
  [/\bselvage\b/gi, 'selvedge', 'selvage → selvedge'],
  [/\bsnaps?\b|\bsnap buttons?\b/gi, 'press studs', 'snaps → press studs'],
  [/\btop[- ]stitch(ing|ed)\b/gi, 'topstitch$1', 'top stitching → topstitching'],
  [/\barm ?holes?\b/gi, 'armscyes', 'armholes → armscyes'],
  [/\binseams?\b/gi, 'inner seams', 'inseams → inner seams'],
  [/\bpants\b/gi, 'trousers', 'pants → trousers'],
  [/\bmulticolou?red\b|\bmulticolor\b/gi, 'multicolour', 'multicolor → multicolour'],
  [/\bMaison Margiela\b/g, 'Maison Martin Margiela', 'Maison Margiela → Maison Martin Margiela'],
  [/\blady-like\b/gi, 'ladylike', 'lady-like → ladylike'],
  [/\bcrew neck\b/gi, 'crewneck', 'crew neck → crewneck'],
  [/\bribbed (cuffs|hem|collar|neckline|trim)\b/gi, 'rib-knit $1', 'ribbed → rib-knit'],
  [/\bdrop shoulders?\b/gi, 'dropped shoulder', 'drop shoulder → dropped shoulder'],
  [/\b(?:polo|roll) neck\b/gi, 'turtleneck', 'polo neck → turtleneck'],
  [/\b(?:invisible|hidden) zip\b/gi, 'concealed zip', 'invisible zip → concealed zip'],
  [/\bmock[- ]turtleneck\b/gi, 'mock neck', 'mock turtleneck → mock neck'],
  [/\s*[—–]\s*/g, ', ', 'dash → comma'],
];
// Suggested only: a person decides, because the closest frozen term may change the meaning.
const SUGGEST: [RegExp, string][] = [
  [/\bsneakers?\b/i, 'trainers (FORM British usage), or keep the brand line name'],
  [/\bsweaters?\b/i, 'jumper'],
  [/\bvests?\b/i, 'waistcoat (tailoring) or tank top (jersey)'],
  [/\bmandarin collar|\bmao collar|\bband(ed)? collar/i, 'stand collar (Fashionpedia name)'],
  [/\bsnakeskin\b(?! pattern| print)/i, 'snakeskin pattern if it is a print (frozen term); keep snakeskin for real skin'],
  [/\bnude\b/i, 'skin-tone matched (frozen palette term) or a named colour'],
  [/\bfaux\b/i, 'name the actual material (e.g. polyurethane-coated cotton)'],
];
const keepCase = (from: string, to: string) => (from[0] && from[0] === from[0].toUpperCase() && /[a-z]/i.test(from[0]) ? to[0].toUpperCase() + to.slice(1) : to);
export function adaptText(text: string): { text: string; changes: string[]; suggestions: string[] } {
  let out = String(text || '');
  const changes: string[] = [];
  for (const [re, to, label] of AUTO) {
    const next = out.replace(re, (m, ...g) => keepCase(m, to.replace(/\$1/g, typeof g[0] === 'string' ? g[0] : '')));
    if (next !== out) { changes.push(label); out = next; }
  }
  out = out.replace(/,\s*,/g, ',').replace(/\s+,/g, ',');
  const suggestions = SUGGEST.filter(([re]) => re.test(out)).map(([re, s]) => `"${out.match(re)?.[0]}" → ${s}`);
  return { text: out, changes: [...new Set(changes)], suggestions };
}

/** The vocabulary block given to the model with each draft: the Copy Guide order and the preferred terms. */
export function vocabularyBrief(category: string) {
  const g = guideFor(category);
  const groups = ['parts', 'knit', 'closures', 'pockets', 'construction', 'surface', 'ornament', 'pattern', 'silhouette'].concat(g.accessory ? [] : ['necklines', 'collars', 'sleeves']);
  const pick = GLOSSARY.filter((x) => groups.includes(x.key)).map((x) => x.label + ': ' + x.terms.map((t) => t.t).join(', '));
  const avoid = GLOSSARY.flatMap((x) => x.terms.filter((t) => t.aka?.length).map((t) => `${t.aka!.join(' / ')} → ${t.t}`)).slice(0, 120);
  return [
    'FORM VOCABULARY AND COPY GUIDE (preferred over the boutique wording)',
    `Copy Guide sections, in order: ${SECTION_ORDER.join(' › ')}.`,
    SHORT_DESCRIPTION_RULE + (g.accessory ? ' This is an accessory: include the colour.' : ' This is not an accessory: no colour in the short description.'),
    `Long description for ${g.type}${g.fromGuide ? '' : ' (no Copy Guide order yet, studio default)'}: one line per element, in this order: ${g.order.join(' → ')}. Start each "construction" line with the element it describes. Skip an element that is not visible or not documented.`,
    ...g.notes,
    'Use these FORM terms where they fit the piece (frozen vocabulary first, then Fashionpedia names), in British spelling:',
    ...pick,
    'When the boutique uses another word, write the FORM term instead: ' + avoid.join('; '),
  ].join('\n');
}
