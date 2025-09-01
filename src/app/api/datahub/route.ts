/* src/app/api/datahub/route.ts
 *
 * Purpose:
 * - One-stop "data hub" endpoint your UI can call for:
 *   - Latest CPI (national or region proxy) and RPP (state cost index)
 *   - ZIP→state inference
 *   - Tax totals by delegating to /api/taxes
 *
 * Design:
 * - Prioritizes official JSON mirrors you host (fast + stable).
 * - Optionally calls official APIs if keys are present (BLS).
 * - No scraping here; you can add a "connector" later if needed.
 *
 * Env knobs (any can be omitted; sensible fallbacks exist):
 *   NEXT_PUBLIC_CPI_JSON_URL      -> your JSON mirror of CPI headline (12-mo YoY, index, etc.)
 *   NEXT_PUBLIC_RPP_JSON_URL      -> your JSON mirror of BEA RPP (state or metro -> index)
 *   NEXT_PUBLIC_TAXPACK_URL       -> already used by /api/taxes (from earlier patch)
 *   BLS_API_KEY                   -> if set, DataHub can query BLS directly for headline CPI series
 *
 * Usage examples:
 *   GET /api/datahub?zip=94103&wages=120000&status=single
 *   GET /api/datahub?zip=10001&wages=95000&status=married&include=cpi,rpp
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type FilingStatus = 'single' | 'married' | 'hoh';

type DataHubRequest = {
  zip?: string;
  wages?: number;
  status?: FilingStatus;
  include?: string; // comma: 'cpi,rpp,taxes'
};

type CPIRecord = {
  updatedAt: string;
  headlineIndex?: number;     // e.g., CPI-U latest index
  headlineYoY?: number;       // 12-month % change
  source?: string;
};

type RPPRecord = {
  updatedAt: string;
  scope: 'state' | 'metro';
  index: number;               // 100 = national average
  state?: string;
  metro?: string;
  source?: string;
};

type TaxBlock = {
  totalTax: number;
  netIncome: number;
  federal: unknown;
  state: unknown;
  local: unknown;
  derivedState?: string;
  source?: string;
};

type DataHubResponse = {
  ok: true;
  inputs: {
    zip?: string | null;
    wages?: number | null;
    status?: FilingStatus;
    include: string[];
    derivedState?: string | null;
  };
  data: {
    cpi?: CPIRecord;
    rpp?: RPPRecord;
    taxes?: TaxBlock;
  };
  diagnostics: {
    used: {
      cpi: string | null;
      rpp: string | null;
      taxes: string | null;
    };
    warnings: string[];
    fetchedAt: string;
  };
};

/** ------------ ZIP→state inference (prefix ranges fallback) ------------ */
const ZIP_PREFIX_FALLBACK: Record<string, Array<[number, number]>> = {
  AL: [[350, 369]], AK: [[995, 999]], AZ: [[850, 869]], AR: [[716, 729]],
  CA: [[900, 961]], CO: [[800, 816]], CT: [[60, 69]],  DC: [[200, 205]],
  DE: [[197, 199]], FL: [[320, 349]], GA: [[300, 319]], HI: [[967, 968]],
  ID: [[832, 838]], IL: [[600, 629]], IN: [[460, 479]], IA: [[500, 528]],
  KS: [[660, 679]], KY: [[400, 427]], LA: [[700, 715]], ME: [[39, 49]],
  MD: [[206, 219]], MA: [[10, 27]],  MI: [[480, 499]], MN: [[550, 567]],
  MS: [[386, 397]], MO: [[630, 658]], MT: [[590, 599]], NE: [[680, 693]],
  NV: [[889, 898]], NH: [[30, 38]],  NJ: [[70, 89]],  NM: [[870, 884]],
  NY: [[100, 149]], NC: [[270, 289]], ND: [[580, 588]], OH: [[430, 459]],
  OK: [[730, 749]], OR: [[970, 979]], PA: [[150, 196]], RI: [[28, 29]],
  SC: [[290, 299]], SD: [[570, 577]], TN: [[370, 385]], TX: [[750, 799], [885, 885]],
  UT: [[840, 847]], VT: [[50, 59]],  VA: [[201, 201], [220, 246]],
  WA: [[980, 994]], WV: [[247, 268]], WI: [[530, 549]], WY: [[820, 831]],
};

function inferStateFromZip(zip?: string): string | undefined {
  const z = (zip || '').trim();
  if (!/^\d{5}$/.test(z)) return;
  const first3 = parseInt(z.slice(0, 3), 10);
  const first2 = parseInt(z.slice(0, 2), 10);
  for (const [state, ranges] of Object.entries(ZIP_PREFIX_FALLBACK)) {
    for (const [from, to] of ranges) {
      if (from < 10 || to < 10) {
        if (first2 >= from && first2 <= to) return state;
      } else if (from < 100) {
        if (first2 >= from && first2 <= to) return state;
      } else {
        if (first3 >= from && first3 <= to) return state;
      }
    }
  }
}

/** ------------ utils ------------ */
async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function nowIso() {
  return new Date().toISOString();
}

/** ------------ connectors: CPI ------------ */
async function getCPI(): Promise<{ rec?: CPIRecord; source: string; warn?: string }> {
  // 1) Preferred: your own mirror (fast/stable)
  const mirror = process.env.NEXT_PUBLIC_CPI_JSON_URL?.trim();
  if (mirror) {
    const j = await fetchJson<any>(mirror);
    if (j) {
      // Expect a simple structure; adapt as needed in your mirror:
      // { updatedAt, headlineIndex, headlineYoY }
      if (typeof j.headlineIndex === 'number' || typeof j.headlineYoY === 'number') {
        return { rec: { updatedAt: j.updatedAt || nowIso(), headlineIndex: j.headlineIndex, headlineYoY: j.headlineYoY, source: 'mirror' }, source: 'mirror' };
      }
    }
  }

  // 2) Optional: BLS API headline CPI-U (series CUUR0000SA0)
  const key = process.env.BLS_API_KEY?.trim();
  if (key) {
    // BLS v2: POST { "seriesid": ["CUUR0000SA0"], "latest": true, "registrationkey": key }
    try {
      const body = JSON.stringify({ seriesid: ['CUUR0000SA0'], latest: true, registrationkey: key });
      const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        const j = (await res.json()) as any;
        const s = j?.Results?.series?.[0];
        const d = s?.data?.[0];
        const idx = d ? parseFloat(d.value) : undefined;
        const yoy = d?.calculations?.net_changes?.[12] ? parseFloat(d.calculations.net_changes[12]) : undefined;
        return { rec: { updatedAt: nowIso(), headlineIndex: isFinite(idx!) ? idx : undefined, headlineYoY: isFinite(yoy!) ? yoy : undefined, source: 'bls' }, source: 'bls' };
      }
    } catch (e) {
      return { source: 'bls', warn: 'BLS API call failed' };
    }
  }

  // 3) Fallback: static placeholder to keep app functional
  return {
    rec: { updatedAt: nowIso(), headlineIndex: 310.0, headlineYoY: 3.2, source: 'fallback' },
    source: 'fallback',
    warn: 'Using CPI fallback. Provide NEXT_PUBLIC_CPI_JSON_URL or BLS_API_KEY for live data.',
  };
}

/** ------------ connectors: RPP (state cost index) ------------ */
async function getRPP(state?: string): Promise<{ rec?: RPPRecord; source: string; warn?: string }> {
  const url = process.env.NEXT_PUBLIC_RPP_JSON_URL?.trim();
  if (url) {
    const j = await fetchJson<any>(url);
    // Expect structure like: { updatedAt, byState: { "CA": 112.4, ... }, scope: "state" }
    const idx = state ? j?.byState?.[state] : undefined;
    if (typeof idx === 'number') {
      return { rec: { updatedAt: j.updatedAt || nowIso(), scope: (j.scope as 'state') || 'state', index: idx, state, source: 'mirror' }, source: 'mirror' };
    }
    if (j?.national) {
      return { rec: { updatedAt: j.updatedAt || nowIso(), scope: 'state', index: j.national, source: 'mirror' }, source: 'mirror', warn: 'State not found in RPP mirror; used national.' };
    }
  }

  // Fallback: neutral 100
  return { rec: { updatedAt: nowIso(), scope: 'state', index: 100, state, source: 'fallback' }, source: 'fallback', warn: 'Using RPP fallback. Provide NEXT_PUBLIC_RPP_JSON_URL for real values.' };
}

/** ------------ taxes: delegate to existing /api/taxes ------------ */
async function getTaxes(baseUrl: string, zip?: string, wages?: number, status?: FilingStatus): Promise<{ rec?: TaxBlock; source: string; warn?: string }> {
  // If /api/taxes exists (from earlier patch), call it.
  try {
    const u = new URL('/api/taxes', baseUrl);
    if (zip) u.searchParams.set('zip', zip);
    if (wages && isFinite(wages)) u.searchParams.set('wages', String(wages));
    if (status) u.searchParams.set('status', status);
    const res = await fetch(u.toString(), { cache: 'no-store' });
    if (res.ok) {
      const j = (await res.json()) as any;
      return {
        rec: {
          totalTax: j?.results?.totals?.totalTax ?? 0,
          netIncome: j?.results?.totals?.netIncome ?? 0,
          federal: j?.results?.federal,
          state: j?.results?.state,
          local: j?.results?.local,
          derivedState: j?.inputs?.derivedState,
          source: j?.sources?.packSource || 'taxpack',
        },
        source: 'internal:/api/taxes',
      };
    }
    return { source: 'internal:/api/taxes', warn: `Tax API ${res.status}` };
  } catch {
    return { source: 'internal:/api/taxes', warn: 'Tax API call failed' };
  }
}

/** ------------ main handler ------------ */
function cors(h: Headers) {
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return h;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors(new Headers()) });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zip = searchParams.get('zip') ?? undefined;
  const wages = Number(searchParams.get('wages') ?? '') || undefined;
  const status = (searchParams.get('status') as FilingStatus) || 'single';
  const includeRaw = (searchParams.get('include') || 'cpi,rpp,taxes').toLowerCase();
  const include = includeRaw.split(',').map(s => s.trim()).filter(Boolean);

  const derivedState = zip ? inferStateFromZip(zip) : undefined;

  const [cpiOut, rppOut, taxOut] = await Promise.all([
    include.includes('cpi') ? getCPI() : Promise.resolve(undefined),
    include.includes('rpp') ? getRPP(derivedState) : Promise.resolve(undefined),
    include.includes('taxes') ? getTaxes(req.url, zip, wages, status) : Promise.resolve(undefined),
  ]);

  const warnings: string[] = [];
  if (cpiOut?.warn) warnings.push(cpiOut.warn);
  if (rppOut?.warn) warnings.push(rppOut.warn);
  if (taxOut?.warn) warnings.push(taxOut.warn);

  const body: DataHubResponse = {
    ok: true,
    inputs: {
      zip: zip || null,
      wages: wages ?? null,
      status,
      include,
      derivedState: derivedState || null,
    },
    data: {
      cpi: cpiOut?.rec,
      rpp: rppOut?.rec,
      taxes: taxOut?.rec,
    },
    diagnostics: {
      used: {
        cpi: cpiOut?.source ?? null,
        rpp: rppOut?.source ?? null,
        taxes: taxOut?.source ?? null,
      },
      warnings,
      fetchedAt: nowIso(),
    },
  };

  const headers = cors(new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }));
  return new Response(JSON.stringify(body, null, 2), { status: 200, headers });
}
