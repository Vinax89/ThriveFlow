/* src/app/api/mirrors/route.ts
 *
 * What this provides
 * ------------------
 * GET /api/mirrors?key=cpi        -> normalized CPI mirror JSON
 * GET /api/mirrors?key=rpp        -> normalized RPP mirror JSON (state indices)
 *
 * Features:
 *  - Official-first: pulls CPI via BLS if BLS_API_KEY is set; RPP via your mirror (or BEA later).
 *  - Validates data to a stable schema so your UI never breaks unexpectedly.
 *  - Caching with TTL (defaults to 6h) to avoid hammering upstream APIs (works like a soft scheduler).
 *  - Provenance block: { source, upstreamUrl, fetchedAt, hash } for auditability.
 *  - Force refresh: add ?refresh=1 and send header x-cron-secret=DATA_SYNC_SECRET to bypass cache.
 *  - Future scraper hook included (disabled by default) with robots.txt respect + simple rate limit.
 *
 * Environment variables (optional but recommended):
 *  - BLS_API_KEY              : for live CPI (series CUUR0000SA0)
 *  - UPSTREAM_RPP_URL         : URL to your RPP JSON mirror (see template below)
 *  - MIRROR_TTL_MS            : cache time (default 21600000 = 6h)
 *  - DATA_SYNC_SECRET         : shared secret to allow ?refresh=1
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CPIRecord = {
  updatedAt: string;
  headlineIndex?: number; // CPI-U latest index
  headlineYoY?: number;   // 12-month % change
  source: 'bls' | 'mirror' | 'fallback';
  provenance: {
    upstreamUrl?: string;
    fetchedAt: string;
    hash: string;
  };
};

type RPPRecord = {
  updatedAt: string;
  scope: 'state';
  byState: Record<string, number>; // e.g., { "CA": 112.4 }
  national?: number;               // = 100 typical
  source: 'mirror' | 'fallback';
  provenance: {
    upstreamUrl?: string;
    fetchedAt: string;
    hash: string;
  };
};

type MirrorKey = 'cpi' | 'rpp';

const TTL_MS = Number(process.env.MIRROR_TTL_MS || 6 * 60 * 60 * 1000); // 6h default
const inMemCache: Record<MirrorKey, { ts: number; data: any | null }> = {
  cpi: { ts: 0, data: null },
  rpp: { ts: 0, data: null },
};

function jsonResponse(obj: unknown, status = 200, extra?: Record<string, string>) {
  const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  // CORS for Studio preview
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type,x-cron-secret');
  return new Response(JSON.stringify(obj, null, 2), { status, headers: h });
}

export async function OPTIONS() {
  return jsonResponse(null, 204);
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fetchJson<T = any>(url: string, timeoutMs = 15000): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function now() { return new Date().toISOString(); }

/* ---------- Validation (simple, fast) ---------- */
function isFiniteNum(x: any) { return typeof x === 'number' && Number.isFinite(x); }

function validateCPIShape(j: any): { ok: true } | { ok: false; reason: string } {
  if (typeof j !== 'object' || j === null) return { ok: false, reason: 'not an object' };
  if (j.updatedAt && typeof j.updatedAt !== 'string') return { ok: false, reason: 'updatedAt' };
  if (j.headlineIndex !== undefined && !isFiniteNum(j.headlineIndex)) return { ok: false, reason: 'headlineIndex' };
  if (j.headlineYoY !== undefined && !isFiniteNum(j.headlineYoY)) return { ok: false, reason: 'headlineYoY' };
  return { ok: true };
}

function validateRPPShape(j: any): { ok: true } | { ok: false; reason: string } {
  if (typeof j !== 'object' || j === null) return { ok: false, reason: 'not an object' };
  if (j.updatedAt && typeof j.updatedAt !== 'string') return { ok: false, reason: 'updatedAt' };
  if (j.scope && j.scope !== 'state') return { ok: false, reason: 'scope != state' };
  if (j.byState && typeof j.byState !== 'object') return { ok: false, reason: 'byState missing' };
  return { ok: true };
}

/* ---------- CPI: official-first via BLS ---------- */
async function pullCPI(): Promise<CPIRecord> {
  const blsKey = process.env.BLS_API_KEY?.trim();
  const upstreamUrl = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'; // series CUUR0000SA0
  if (blsKey) {
    try {
      const body = JSON.stringify({ seriesid: ['CUUR0000SA0'], latest: true, registrationkey: blsKey });
      const res = await fetch(upstreamUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, cache: 'no-store' });
      if (res.ok) {
        const j = await res.json() as any;
        const s = j?.Results?.series?.[0];
        const d = s?.data?.[0];
        const idx = d ? parseFloat(d.value) : undefined;
        const yoy = d?.calculations?.net_changes?.[12] ? parseFloat(d.calculations.net_changes[12]) : undefined;
        const core = { updatedAt: now(), headlineIndex: isFinite(idx) ? idx : undefined, headlineYoY: isFinite(yoy) ? yoy : undefined };
        const hash = await sha256(JSON.stringify(core));
        const rec: CPIRecord = { ...core, source: 'bls', provenance: { upstreamUrl, fetchedAt: now(), hash } };
        const v = validateCPIShape(rec);
        if (v.ok) return rec;
      }
    } catch { /* fall through */ }
  }

  // Mirror fallback (if you already host one elsewhere)
  const mirrorUrl = process.env.NEXT_PUBLIC_CPI_JSON_URL?.trim();
  if (mirrorUrl && !mirrorUrl.startsWith('/api/mirrors')) {
    const j = await fetchJson<any>(mirrorUrl);
    if (j) {
      const v = validateCPIShape(j);
      if (v.ok) {
        const core = {
          updatedAt: j.updatedAt || now(),
          headlineIndex: isFiniteNum(j.headlineIndex) ? j.headlineIndex : undefined,
          headlineYoY: isFiniteNum(j.headlineYoY) ? j.headlineYoY : undefined,
        };
        const hash = await sha256(JSON.stringify(core));
        return { ...core, source: 'mirror', provenance: { upstreamUrl: mirrorUrl, fetchedAt: now(), hash } };
      }
    }
  }

  // Safe fallback to keep app usable
  const core = { updatedAt: now(), headlineIndex: 310.0, headlineYoY: 3.2 };
  const hash = await sha256(JSON.stringify(core));
  return { ...core, source: 'fallback', provenance: { fetchedAt: now(), hash } };
}

/* ---------- RPP: mirror-first (hook up BEA later) ---------- */
async function pullRPP(): Promise<RPPRecord> {
  // Expect mirror schema: { updatedAt, scope:"state", byState: { "CA": 112.4, ... }, national: 100 }
  const upstream = process.env.UPSTREAM_RPP_URL?.trim() || process.env.NEXT_PUBLIC_RPP_JSON_URL?.trim();
  if (upstream) {
    const j = await fetchJson<any>(upstream);
    if (j) {
      const v = validateRPPShape(j);
      if (v.ok && j.byState) {
        const body = { updatedAt: j.updatedAt || now(), scope: 'state' as const, byState: j.byState as Record<string, number>, national: isFiniteNum(j.national) ? j.national : 100 };
        const hash = await sha256(JSON.stringify(body));
        return { ...body, source: 'mirror', provenance: { upstreamUrl: upstream, fetchedAt: now(), hash } };
      }
    }
  }

  // Minimal fallback: all states at 100 (neutral)
  const states = ["AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
  const byState: Record<string, number> = {};
  for (const s of states) byState[s] = 100;
  const body = { updatedAt: now(), scope: 'state' as const, byState, national: 100 };
  const hash = await sha256(JSON.stringify(body));
  return { ...body, source: 'fallback', provenance: { fetchedAt: now(), hash } };
}

/* ---------- simple in-memory cache ---------- */
function cacheFresh(key: MirrorKey) {
  const c = inMemCache[key];
  return c.data && Date.now() - c.ts < TTL_MS;
}

function setCache(key: MirrorKey, data: any) {
  inMemCache[key] = { data, ts: Date.now() };
}

/* ---------- optional: guard refresh with shared secret ---------- */
function canRefresh(req: Request) {
  const url = new URL(req.url);
  const wants = url.searchParams.get('refresh') === '1';
  if (!wants) return false;
  const need = (process.env.DATA_SYNC_SECRET || '').trim();
  if (!need) return false; // if no secret set, disable forced refresh
  const got = req.headers.get('x-cron-secret')?.trim();
  return got && need && got === need;
}

/* ---------- future: targeted scraper hook (disabled by default) ---------- */
async function robotsAllows(target: string): Promise<boolean> {
  try {
    const u = new URL(target);
    const robots = `${u.origin}/robots.txt`;
    const txt = await (await fetch(robots, { cache: 'no-store' })).text();
    // Very simple check: if Disallow: / present for user-agent: * and target path starts with it -> block
    const lines = txt.split(/\r?\n/).map(l => l.trim());
    let uaAny = false, disallows: string[] = [];
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) { uaAny = true; continue; }
      if (uaAny && /^disallow:\s*/i.test(line)) {
        const p = line.split(':')[1]?.trim() || '/';
        disallows.push(p);
      }
      if (/^user-agent:/i.test(line) && !/^user-agent:\s*\*/i.test(line)) {
        // new UA block starts
        uaAny = false; disallows = [];
      }
    }
    const path = u.pathname;
    return !disallows.some(d => d !== '' && path.startsWith(d));
  } catch { return false; }
}

let lastScrapeAt = 0;
async function maybeScrapeExample(url: string) {
  // Not used by default. If you add a custom connector with ALLOW_SCRAPERS=true, it’ll respect robots and rate-limit.
  if (process.env.ALLOW_SCRAPERS !== 'true') return null;
  if (!(await robotsAllows(url))) return null;
  const nowMs = Date.now();
  if (nowMs - lastScrapeAt < 10_000) return null; // 1 req / 10s simple throttle
  lastScrapeAt = nowMs;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    // TODO: parse HTML to structured JSON matching your mirror schema.
    return { htmlLen: html.length };
  } catch { return null; }
}

/* ---------- handler ---------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get('key') || '').toLowerCase() as MirrorKey;

  if (!['cpi', 'rpp'].includes(key)) {
    return jsonResponse({ ok: false, error: 'invalid key; use ?key=cpi or ?key=rpp' }, 400);
  }

  const force = canRefresh(req);
  if (!force && cacheFresh(key)) {
    return jsonResponse({ ok: true, cached: true, data: inMemCache[key].data, ttlMs: TTL_MS });
  }

  try {
    const rec = key === 'cpi' ? await pullCPI() : await pullRPP();

    // final schema validation (belt & suspenders)
    const ok = key === 'cpi' ? validateCPIShape(rec) : validateRPPShape(rec);
    if (!ok.ok) {
      return jsonResponse({ ok: false, error: `schema validation failed: ${ok.reason}` }, 500);
    }

    setCache(key, rec);
    return jsonResponse({ ok: true, cached: false, data: rec, ttlMs: TTL_MS });
  } catch (e: any) {
    return jsonResponse({ ok: false, error: e?.message || 'unknown failure' }, 500);
  }
}
