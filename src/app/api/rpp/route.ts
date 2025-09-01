/* src/app/api/rpp/route.ts
 *
 * GET /api/rpp                     -> normalized RPP JSON by state
 * Force refresh: ?refresh=1 + header x-cron-secret=DATA_SYNC_SECRET
 *
 * Env:
 *  - BEA_API_KEY          (required for live pull)
 *  - BEA_TABLE=RPPALL     (optional; default RPPALL)
 *  - BEA_YEAR=LATEST      (optional; e.g. 2023 or LATEST)
 *  - BEA_GEOFIPS=STATE    (optional; default STATE)
 *  - MIRROR_TTL_MS=21600000 (optional; default 6h cache)
 *  - DATA_SYNC_SECRET     (optional; if set, required to force refresh)
 *  - UPSTREAM_RPP_URL     (optional fallback mirror URL if BEA fails)
 *
 * Output schema:
 * {
 *   "updatedAt": ISOString,
 *   "scope": "state",
 *   "byState": { "CA": 113.8, ... },
 *   "national": 100,
 *   "source": "bea" | "mirror" | "fallback",
 *   "provenance": { "upstreamUrl": string, "fetchedAt": ISOString, "hash": string }
 * }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RPPRecord = {
  updatedAt: string;
  scope: 'state';
  byState: Record<string, number>;
  national: number;
  source: 'bea' | 'mirror' | 'fallback';
  provenance: { upstreamUrl?: string; fetchedAt: string; hash: string };
};

const TTL_MS = Number(process.env.MIRROR_TTL_MS || 6 * 60 * 60 * 1000); // 6h
const cache = { ts: 0, data: null as RPPRecord | null };

function json(obj: unknown, status = 200, extra?: Record<string, string>) {
  const h = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-cron-secret',
  });
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(JSON.stringify(obj, null, 2), { status, headers: h });
}
export function OPTIONS() { return json(null, 204); }

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
const nowISO = () => new Date().toISOString();
const isNum = (x: any) => typeof x === 'number' && Number.isFinite(x);

function canRefresh(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('refresh') !== '1') return false;
  const need = (process.env.DATA_SYNC_SECRET || '').trim();
  if (!need) return false;
  const got = (req.headers.get('x-cron-secret') || '').trim();
  return got === need;
}

const USPS_BY_GEONAME: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO',
  'Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY',
  'Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
  'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH',
  'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',
  'Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
  'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};
// FIPS (2-digit) -> USPS
const USPS_BY_FIPS: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL',
  '13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME',
  '24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH',
  '34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY'
};

function validateRPP(rec: any): { ok: true } | { ok: false; reason: string } {
  if (!rec || typeof rec !== 'object') return { ok: false, reason: 'not object' };
  if (rec.scope !== 'state') return { ok: false, reason: 'scope' };
  if (!rec.byState || typeof rec.byState !== 'object') return { ok: false, reason: 'byState' };
  for (const [k, v] of Object.entries(rec.byState)) {
    if (!/^[A-Z]{2}$/.test(k) || !isNum(v)) return { ok: false, reason: `bad entry ${k}:${v}` };
  }
  return { ok: true };
}

async function fetchJson(url: string, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

function pickLatestYear(data: any[]): string | null {
  const ys = data.map(d => String(d.Year || d.year || '').trim()).filter(Boolean);
  const nums = ys.map(y => parseInt(y, 10)).filter(n => Number.isFinite(n));
  if (nums.length === 0) return null;
  return String(Math.max(...nums));
}

function toUSPS(geo: any): string | null {
  const name = String(geo.GeoName || geo.Geography || geo.Area || '').trim();
  const fips = String(geo.GeoFIPS || geo.FIPS || '').trim().padStart(2, '0');
  if (USPS_BY_GEONAME[name]) return USPS_BY_GEONAME[name];
  if (USPS_BY_FIPS[fips]) return USPS_BY_FIPS[fips];
  // Some APIs return 'STATE' like 'CA' directly:
  const code = String(geo.Geo || geo.State || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  return null;
}

// Heuristic parser for BEA RPP shapes
function parseBeaRpp(json: any, preferYear?: string) {
  const arr: any[] =
    json?.BEAAPI?.Results?.Data ??
    json?.Results?.Data ??
    json?.data ??
    json?.Data ??
    [];

  if (!Array.isArray(arr) || arr.length === 0) return { ok: false, reason: 'no data array', sample: json?.BEAAPI?.Results ?? json };

  const desiredYear = preferYear && preferYear !== 'LATEST' ? String(preferYear) : pickLatestYear(arr) ?? null;
  const rows = desiredYear ? arr.filter(d => String(d.Year || d.year) === desiredYear) : arr;

  // Try to narrow to "All items" if present
  const labelKeys = ['Item', 'SeriesID', 'LineDescription', 'RPPItem', 'RPP'];
  const valueKeys = ['DataValue', 'value', 'Data', 'Index', 'RPPValue'];
  const allItemsPred = (r: any) => {
    const val = labelKeys.map(k => String(r[k] ?? '')).join(' ').toLowerCase();
    return /all\s*items/.test(val) || val.includes('rpp all') || val.includes('overall');
  };

  let candidates = rows.filter(allItemsPred);
  if (candidates.length === 0) candidates = rows; // fallback: take all and let last-write-wins per state

  const byState: Record<string, number> = {};
  for (const r of candidates) {
    const code = toUSPS(r);
    if (!code) continue;

    let num: number | null = null;
    for (const k of valueKeys) {
      const raw = r[k];
      if (raw === undefined) continue;
      const parsed = typeof raw === 'string' ? parseFloat(raw.replace(/[,]+/g, '')) : Number(raw);
      if (Number.isFinite(parsed)) { num = parsed; break; }
    }
    if (num == null) continue;

    byState[code] = num;
  }

  const keys = Object.keys(byState);
  if (keys.length < 40) {
    return { ok: false, reason: `parsed only ${keys.length} states`, sample: candidates.slice(0, 5) };
  }

  const updatedAt = nowISO();
  return { ok: true, byState, year: desiredYear || 'LATEST', updatedAt };
}

async function beaUrl(params: Record<string, string | number>) {
  const key = (process.env.BEA_API_KEY || '').trim();
  if (!key) return null;
  const q = new URLSearchParams({ UserID: key, method: 'GetData', ...Object.fromEntries(Object.entries(params).map(([k,v]) => [k, String(v)])) });
  return `https://apps.bea.gov/api/data/?${q.toString()}`;
}

async function pullFromBEA(): Promise<RPPRecord | { error: string; details?: any }> {
  const TABLE = (process.env.BEA_TABLE || 'RPPALL').trim();
  const YEAR = (process.env.BEA_YEAR || 'LATEST').trim();
  const GEOFIPS = (process.env.BEA_GEOFIPS || 'STATE').trim();

  // Try two likely dataset spellings.
  const tries: Array<Record<string, string>> = [
    { DataSetName: 'RegionalPriceParities', TableName: TABLE, Year: YEAR, GeoFIPS: GEOFIPS },
    { DataSetName: 'RPP',                     TableName: TABLE, Year: YEAR, GeoFIPS: GEOFIPS },
  ];

  for (const p of tries) {
    const url = await beaUrl(p);
    if (!url) return { error: 'BEA_API_KEY missing' };
    const json = await fetchJson(url);
    if (!json) continue;

    const parsed = parseBeaRpp(json, YEAR);
    if ((parsed as any).ok) {
      const { byState, updatedAt } = parsed as any;
      const body = { updatedAt, scope: 'state' as const, byState, national: 100, source: 'bea' as const };
      const hash = await sha256(JSON.stringify(body));
      return { ...body, provenance: { upstreamUrl: url, fetchedAt: nowISO(), hash } };
    }
    // continue to next try; if final fails, return detailed error
    if (p === tries[tries.length - 1]) {
      return { error: (parsed as any).reason || 'parse failed', details: (parsed as any).sample };
    }
  }

  return { error: 'All BEA attempts failed' };
}

async function pullFromMirror(): Promise<RPPRecord | null> {
  const upstream = (process.env.UPSTREAM_RPP_URL || '').trim();
  if (!upstream) return null;
  const json = await fetchJson(upstream);
  if (!json) return null;

  const body: RPPRecord = {
    updatedAt: json.updatedAt || nowISO(),
    scope: 'state',
    byState: json.byState || {},
    national: isNum(json.national) ? json.national : 100,
    source: 'mirror',
    provenance: { upstreamUrl: upstream, fetchedAt: nowISO(), hash: await sha256(JSON.stringify(json)) }
  };
  const v = validateRPP(body);
  return v.ok ? body : null;
}

function fallbackRPP(): RPPRecord {
  const states = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  const byState: Record<string, number> = {}; for (const s of states) byState[s] = 100;
  const base = { updatedAt: nowISO(), scope: 'state' as const, byState, national: 100, source: 'fallback' as const };
  return { ...base, provenance: { fetchedAt: nowISO(), hash: '0'.repeat(64) } };
}

export async function GET(req: Request) {
  if (!canRefresh(req) && cache.data && Date.now() - cache.ts < TTL_MS) {
    return json({ ok: true, cached: true, data: cache.data, ttlMs: TTL_MS });
  }

  // 1) Try BEA
  const bea = await pullFromBEA();
  if (!('error' in bea)) {
    const v = validateRPP(bea);
    if (v.ok) {
      cache.data = bea; cache.ts = Date.now();
      return json({ ok: true, cached: false, data: bea, ttlMs: TTL_MS });
    }
  }

  // 2) Try mirror fallback if configured
  const mirror = await pullFromMirror();
  if (mirror) {
    cache.data = mirror; cache.ts = Date.now();
    return json({ ok: true, cached: false, data: mirror, ttlMs: TTL_MS, warning: 'BEA fetch/parse failed; using mirror' });
  }

  // 3) Safe fallback
  const fb = fallbackRPP();
  cache.data = fb; cache.ts = Date.now();
  return json({
    ok: true,
    cached: false,
    data: fb,
    ttlMs: TTL_MS,
    warning: 'BEA fetch/parse failed and no mirror set; using neutral fallback (100)',
    error: 'details' in bea ? bea : undefined
  });
}
