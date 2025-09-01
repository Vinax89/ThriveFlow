/* src/app/api/taxes/route.ts
 *
 * Lightweight tax API with:
 * - External "tax pack" support via NEXT_PUBLIC_TAXPACK_URL (optional)
 * - ZIP → State resolution using exact map, then ZIP-prefix fallback
 * - Federal + state + local (by ZIP) calculation
 * - Works on Edge or Node runtimes
 *
 * This is a baseline. Numbers in the DEFAULT_PACK are placeholders where noted.
 * Plug in a full pack (JSON below) to get 50-state + ZIP coverage.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FilingStatus = 'single' | 'married' | 'hoh';

type ProgressiveBrackets = Array<[threshold: number, rate: number]>;

interface FederalConfig {
  year: number;
  standardDeduction: Record<FilingStatus, number>;
  brackets: Record<FilingStatus, ProgressiveBrackets>;
  fica: {
    socialSecurityRate: number;
    medicareRate: number;
    ssWageBase: number;
    addlMedicareRate: number;
    addlMedicareThresholds: Record<FilingStatus, number>;
  };
}

type StateTax =
  | { type: 'none' }
  | { type: 'flat'; rate: number; deduction?: Partial<Record<FilingStatus, number>> }
  | { type: 'progressive'; brackets: ProgressiveBrackets; standardDeduction?: Partial<Record<FilingStatus, number>> };

interface TaxPack {
  schemaVersion: string;
  updatedAt: string;
  federal?: FederalConfig;
  states: Record<string, StateTax>; // keys: "AL"…"WY","DC"
  locals?: {
    byZip?: Record<string, { rate: number; cap?: number }>;
  };
  zipToState?: Record<string, string>; // exact 5-digit ZIP -> state
  zipPrefixes?: Record<string, Array<[from3: number, to3: number]>>; // optional, preferred if provided
  notes?: string;
}

/** ---------- ZIP prefix fallback (only used if pack.zipPrefixes missing) ---------- */
// 3-digit prefix ranges per state (50 + DC). Source: USPS prefix ranges (simplified).
const ZIP_PREFIX_FALLBACK: Record<string, Array<[number, number]>> = {
  AL: [[350, 369]],
  AK: [[995, 999]],
  AZ: [[850, 869]],
  AR: [[716, 729]],
  CA: [[900, 961]],
  CO: [[800, 816]],
  CT: [[60, 69]],
  DC: [[200, 205]],
  DE: [[197, 199]],
  FL: [[320, 349]],
  GA: [[300, 319]],
  HI: [[967, 968]],
  ID: [[832, 838]],
  IL: [[600, 629]],
  IN: [[460, 479]],
  IA: [[500, 528]],
  KS: [[660, 679]],
  KY: [[400, 427]],
  LA: [[700, 715]],
  ME: [[39, 49]],
  MD: [[206, 219]],
  MA: [[10, 27]],
  MI: [[480, 499]],
  MN: [[550, 567]],
  MS: [[386, 397]],
  MO: [[630, 658]],
  MT: [[590, 599]],
  NE: [[680, 693]],
  NV: [[889, 898]],
  NH: [[30, 38]],
  NJ: [[70, 89]],
  NM: [[870, 884]],
  NY: [[100, 149]],
  NC: [[270, 289]],
  ND: [[580, 588]],
  OH: [[430, 459]],
  OK: [[730, 749]],
  OR: [[970, 979]],
  PA: [[150, 196]],
  RI: [[28, 29]],
  SC: [[290, 299]],
  SD: [[570, 577]],
  TN: [[370, 385]],
  TX: [[750, 799], [885, 885]],
  UT: [[840, 847]],
  VT: [[50, 59]],
  VA: [[201, 201], [220, 246]],
  WA: [[980, 994]],
  WV: [[247, 268]],
  WI: [[530, 549]],
  WY: [[820, 831]],
};

/** ---------- Default Pack (safe placeholders) ---------- */
const DEFAULT_PACK: TaxPack = {
  schemaVersion: '1.1',
  updatedAt: '2025-09-01',
  notes:
    'Skeleton defaults. Federal rough baseline; states mostly placeholders. Provide a full pack for accuracy.',
  federal: {
    year: 2024,
    standardDeduction: { single: 14600, married: 29200, hoh: 21900 },
    brackets: {
      // thresholds are inclusive floor values for each bracket
      single: [
        [0, 0.1],
        [11600, 0.12],
        [47150, 0.22],
        [100525, 0.24],
        [191950, 0.32],
        [243725, 0.35],
        [609350, 0.37],
      ],
      married: [
        [0, 0.1],
        [23200, 0.12],
        [94300, 0.22],
        [201050, 0.24],
        [383900, 0.32],
        [487450, 0.35],
        [731200, 0.37],
      ],
      hoh: [
        [0, 0.1],
        [16550, 0.12],
        [63100, 0.22],
        [100500, 0.24],
        [191950, 0.32],
        [243700, 0.35],
        [609350, 0.37],
      ],
    },
    fica: {
      socialSecurityRate: 0.062,
      medicareRate: 0.0145,
      ssWageBase: 168600,
      addlMedicareRate: 0.009,
      addlMedicareThresholds: { single: 200000, married: 250000, hoh: 200000 },
    },
  },
  states: {
    AL: { type: 'progressive', brackets: [[0, 0.02], [3000, 0.04], [6000, 0.05]] },
    AK: { type: 'none' },
    AZ: { type: 'flat', rate: 0.025 }, // placeholder
    AR: { type: 'progressive', brackets: [[0, 0.02], [4500, 0.04], [8500, 0.049]] }, // placeholder
    CA: { type: 'progressive', brackets: [[0, 0.01], [10000, 0.02], [30000, 0.04], [50000, 0.06], [100000, 0.08], [200000, 0.093]] }, // placeholder
    CO: { type: 'flat', rate: 0.044 }, // placeholder
    CT: { type: 'progressive', brackets: [[0, 0.03], [10000, 0.05], [50000, 0.055], [100000, 0.06]] }, // placeholder
    DC: { type: 'progressive', brackets: [[0, 0.04], [10000, 0.06], [40000, 0.065], [60000, 0.085], [250000, 0.1]] }, // placeholder
    DE: { type: 'progressive', brackets: [[0, 0.022], [5000, 0.039], [10000, 0.048], [20000, 0.052], [25000, 0.055], [60000, 0.066]] }, // placeholder
    FL: { type: 'none' },
    GA: { type: 'flat', rate: 0.0499 }, // placeholder
    HI: { type: 'progressive', brackets: [[0, 0.014], [2400, 0.032], [4800, 0.055], [9600, 0.064]] }, // placeholder
    ID: { type: 'flat', rate: 0.058 }, // placeholder
    IL: { type: 'flat', rate: 0.0495 },
    IN: { type: 'flat', rate: 0.0315 }, // placeholder
    IA: { type: 'flat', rate: 0.044 }, // placeholder
    KS: { type: 'progressive', brackets: [[0, 0.031], [15000, 0.0525], [30000, 0.057]] }, // placeholder
    KY: { type: 'flat', rate: 0.045 },
    LA: { type: 'progressive', brackets: [[0, 0.0185], [12500, 0.035], [50000, 0.0425]] }, // placeholder
    ME: { type: 'progressive', brackets: [[0, 0.058], [24500, 0.0675], [58050, 0.0715]] }, // placeholder
    MD: { type: 'progressive', brackets: [[0, 0.02], [1000, 0.03], [2000, 0.04], [3000, 0.0475], [100000, 0.05]] }, // placeholder (locals exist)
    MA: { type: 'flat', rate: 0.05 },
    MI: { type: 'flat', rate: 0.0425 }, // placeholder
    MN: { type: 'progressive', brackets: [[0, 0.0535], [30000, 0.068], [100000, 0.0785]] }, // placeholder
    MS: { type: 'progressive', brackets: [[0, 0.0], [10000, 0.05]] }, // placeholder
    MO: { type: 'progressive', brackets: [[0, 0.02], [1000, 0.025], [2000, 0.03], [3000, 0.035], [4000, 0.04]] }, // placeholder
    MT: { type: 'flat', rate: 0.047 }, // placeholder
    NE: { type: 'progressive', brackets: [[0, 0.0246], [3000, 0.0351], [19000, 0.0501]] }, // placeholder
    NV: { type: 'none' },
    NH: { type: 'none' }, // (I&D tax not modeled here)
    NJ: { type: 'progressive', brackets: [[0, 0.014], [20000, 0.0175], [35000, 0.035], [40000, 0.05525], [75000, 0.0637], [500000, 0.0897]] }, // placeholder
    NM: { type: 'progressive', brackets: [[0, 0.017], [8000, 0.032], [16000, 0.047], [24000, 0.049]] }, // placeholder
    NY: { type: 'progressive', brackets: [[0, 0.04], [8500, 0.045], [11700, 0.0525], [13900, 0.059], [80650, 0.0621], [215400, 0.0649]] }, // placeholder (NYC local not here)
    NC: { type: 'flat', rate: 0.0475 }, // placeholder
    ND: { type: 'flat', rate: 0.015 }, // placeholder
    OH: { type: 'progressive', brackets: [[26050, 0.0275], [46300, 0.03225], [92650, 0.03688]] }, // placeholder
    OK: { type: 'progressive', brackets: [[0, 0.0025], [1000, 0.0075], [2000, 0.0175], [3000, 0.0275], [4400, 0.0375], [7200, 0.0475]] }, // placeholder
    OR: { type: 'progressive', brackets: [[0, 0.0475], [4200, 0.0675], [10500, 0.0875]] }, // placeholder
    PA: { type: 'flat', rate: 0.0307 },
    RI: { type: 'progressive', brackets: [[0, 0.0375], [47601, 0.0475], [108701, 0.0599]] }, // placeholder
    SC: { type: 'progressive', brackets: [[0, 0.0], [3200, 0.03], [16040, 0.064]] }, // placeholder
    SD: { type: 'none' },
    TN: { type: 'none' },
    TX: { type: 'none' },
    UT: { type: 'flat', rate: 0.0485 },
    VT: { type: 'progressive', brackets: [[0, 0.0355], [42150, 0.068], [102200, 0.078]] }, // placeholder
    VA: { type: 'progressive', brackets: [[0, 0.02], [3000, 0.03], [5000, 0.05]] }, // placeholder
    WA: { type: 'none' }, // wages none (capital gains not modeled)
    WV: { type: 'progressive', brackets: [[0, 0.03], [10000, 0.04], [25000, 0.045]] }, // placeholder
    WI: { type: 'progressive', brackets: [[0, 0.0354], [12030, 0.0465], [24060, 0.0531]] }, // placeholder
    WY: { type: 'none' },
  },
  locals: { byZip: {} },
  zipToState: {},
  zipPrefixes: ZIP_PREFIX_FALLBACK, // can be overridden by a real pack
};

/** ---------- small in-memory cache for fetched pack ---------- */
let cachedPack: TaxPack | null = null;
let cachedFromUrl = '';

async function getPack(): Promise<{ pack: TaxPack; source: 'env-url' | 'default'; url?: string }> {
  const url = process.env.NEXT_PUBLIC_TAXPACK_URL?.trim();
  if (url) {
    if (cachedPack && cachedFromUrl === url) return { pack: cachedPack, source: 'env-url', url };
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as TaxPack;
        cachedPack = {
          ...DEFAULT_PACK,
          ...json,
          states: { ...DEFAULT_PACK.states, ...(json.states || {}) },
          locals: { ...DEFAULT_PACK.locals, ...(json.locals || {}) },
          zipToState: { ...(json.zipToState || {}) },
          zipPrefixes: json.zipPrefixes || DEFAULT_PACK.zipPrefixes,
        };
        cachedFromUrl = url;
        return { pack: cachedPack, source: 'env-url', url };
      }
    } catch {
      // fall through
    }
  }
  return { pack: DEFAULT_PACK, source: 'default' };
}

/** ---------- helpers ---------- */
function applyProgressive(amount: number, brackets: ProgressiveBrackets): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i];
    const nextFloor = i + 1 < brackets.length ? brackets[i + 1][0] : Number.POSITIVE_INFINITY;
    if (amount <= floor) break;
    const slice = Math.min(amount, nextFloor) - floor;
    if (slice > 0) tax += slice * rate;
  }
  return Math.max(0, tax);
}

function inferStateFromZip(zip: string, pack: TaxPack): { state?: string; method: 'exact' | 'prefix' | 'none' } {
  const z = (zip || '').trim();
  if (!/^\d{5}$/.test(z)) return { method: 'none' };
  if (pack.zipToState && pack.zipToState[z]) return { state: pack.zipToState[z], method: 'exact' };

  const first3 = parseInt(z.slice(0, 3), 10);
  const first2 = parseInt(z.slice(0, 2), 10); // for CT/MA/etc where leading 0 exists

  const ranges = pack.zipPrefixes || ZIP_PREFIX_FALLBACK;
  for (const [state, arr] of Object.entries(ranges)) {
    for (const [from, to] of arr) {
      // allow 2-digit ranges too (e.g., 05–09 encoded as 5–9 or 50–59). Normalize:
      if (from < 10 || to < 10) {
        if (first2 >= from && first2 <= to) return { state, method: 'prefix' };
      } else if (from < 100) {
        if (first2 >= from && first2 <= to) return { state, method: 'prefix' };
      } else {
        if (first3 >= from && first3 <= to) return { state, method: 'prefix' };
      }
    }
  }
  return { method: 'none' };
}

function computeFederal(wages: number, status: FilingStatus, fed: FederalConfig) {
  const sd = fed.standardDeduction[status] ?? 0;
  const taxable = Math.max(0, wages - sd);
  const it = applyProgressive(taxable, fed.brackets[status]);

  const ssTax = Math.min(wages, fed.ssWageBase) * fed.fica.socialSecurityRate;
  const medTax = wages * fed.fica.medicareRate;
  const addlMed = Math.max(0, wages - (fed.fica.addlMedicareThresholds[status] ?? 0)) * fed.fica.addlMedicareRate;

  return {
    standardDeduction: sd,
    taxableIncome: taxable,
    incomeTax: it,
    socialSecurity: ssTax,
    medicare: medTax + addlMed,
    ficaTotal: ssTax + medTax + addlMed,
    total: it + ssTax + medTax + addlMed,
  };
}

function computeState(wages: number, status: FilingStatus, stateCode: string, pack: TaxPack) {
  const s = pack.states[stateCode];
  if (!s) return { stateCode, type: 'unknown', incomeTax: 0, total: 0 };

  if (s.type === 'none') return { stateCode, type: 'none', incomeTax: 0, total: 0 };

  if (s.type === 'flat') {
    const ded = s.deduction?.[status] ?? 0;
    const taxable = Math.max(0, wages - ded);
    const t = taxable * (s.rate ?? 0);
    return { stateCode, type: 'flat', deduction: ded, taxableIncome: taxable, incomeTax: t, total: t };
  }

  if (s.type === 'progressive') {
    const sd = s.standardDeduction?.[status] ?? 0;
    const taxable = Math.max(0, wages - sd);
    const t = applyProgressive(taxable, s.brackets);
    return { stateCode, type: 'progressive', standardDeduction: sd, taxableIncome: taxable, incomeTax: t, total: t };
  }

  return { stateCode, type: 'unknown', incomeTax: 0, total: 0 };
}

/** ---------- Request / Response ---------- */
type Input = {
  zip?: string;
  stateOverride?: string; // e.g. "CA"
  filingStatus?: FilingStatus;
  wages?: number; // annual wages
  pretaxDeductions?: number; // 401k, HSA etc to remove from wages before tax calc
};

function cors(headers: Headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return headers;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors(new Headers()) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = searchParams.get('zip') ?? '';
  const stateOverride = searchParams.get('state') ?? undefined;
  const filingStatus = (searchParams.get('status') as FilingStatus) || 'single';
  const wages = parseFloat(searchParams.get('wages') || '0') || 0;
  const pretax = parseFloat(searchParams.get('pretaxDeductions') || '0') || 0;
  return handle({ zip, stateOverride, filingStatus, wages, pretaxDeductions: pretax });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Input;
  return handle(body);
}

async function handle(input: Input) {
  const headers = cors(new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }));
  const { pack, source, url } = await getPack();

  const status: FilingStatus = input.filingStatus || 'single';
  const gross = Math.max(0, input.wages || 0);
  const wages = Math.max(0, gross - (input.pretaxDeductions || 0));

  const stateCode =
    (input.stateOverride?.toUpperCase() as string) ||
    inferStateFromZip(input.zip || '', pack).state ||
    'NA';

  const fed = computeFederal(wages, status, pack.federal!);
  const state = stateCode === 'NA' ? { stateCode: 'NA', type: 'none', incomeTax: 0, total: 0 } : computeState(wages, status, stateCode, pack);

  const localRate = (pack.locals?.byZip?.[(input.zip || '').trim()]?.rate ?? 0);
  const localCap = pack.locals?.byZip?.[(input.zip || '').trim()]?.cap ?? Infinity;
  const localTax = Math.min(wages, localCap) * localRate;

  const totalTax = fed.total + state.total + localTax;
  const net = gross - totalTax - 0; // (pretax already excluded before calc)

  const resp = {
    ok: true,
    inputs: {
      zip: input.zip || null,
      stateOverride: input.stateOverride || null,
      derivedState: stateCode,
      filingStatus: status,
      grossWages: gross,
      pretaxDeductions: input.pretaxDeductions || 0,
      wagesUsedForCalc: wages,
    },
    results: {
      federal: fed,
      state,
      local: { zip: input.zip || null, rate: localRate, cap: isFinite(localCap) ? localCap : null, total: localTax },
      totals: { totalTax, netIncome: net },
    },
    sources: {
      packSource: source,
      packUrl: url || null,
      usedZipExact: !!(pack.zipToState && input.zip && pack.zipToState[input.zip]),
      usedPrefixFallback: !(!input.zip || (pack.zipToState && pack.zipToState[input.zip])),
      schemaVersion: pack.schemaVersion,
      packUpdatedAt: pack.updatedAt,
    },
  };

  return new Response(JSON.stringify(resp, null, 2), { status: 200, headers });
}
