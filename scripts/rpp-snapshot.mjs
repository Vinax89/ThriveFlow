// scripts/rpp-snapshot.mjs
//
// Create/refresh a pinned RPP mirror at public/data/rpp.json
// Usage:
//   node scripts/rpp-snapshot.mjs
//   node scripts/rpp-snapshot.mjs --refresh           # forces API refresh (needs DATA_SYNC_SECRET)
//   SNAPSHOT_BASE_URL=https://your-domain.com node scripts/rpp-snapshot.mjs
//
// Env:
//   SNAPSHOT_BASE_URL   (default: http://localhost:9002)
//   DATA_SYNC_SECRET    (optional; required to use --refresh)
//   SNAPSHOT_OUT        (optional; default: public/data/rpp.json)
//   FETCH_TIMEOUT_MS    (optional; default: 20000)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const argv = new Set(process.argv.slice(2));
const WANT_REFRESH = argv.has('--refresh');
const CWD = process.cwd();
const OUT = process.env.SNAPSHOT_OUT || path.join('public', 'data', 'rpp.json');
const DEST = path.isAbsolute(OUT) ? OUT : path.join(CWD, OUT);
const BASE = process.env.SNAPSHOT_BASE_URL || 'http://localhost:9002';
const TIMEOUT = Number(process.env.FETCH_TIMEOUT_MS || 20000);

function log(...a) { console.log('[rpp-snapshot]', ...a); }
function fail(msg, extra) {
  console.error('[rpp-snapshot] ERROR:', msg);
  if (extra) console.error(extra);
  process.exitCode = 1;
}

function validate(rec) {
  if (!rec || typeof rec !== 'object') return 'not an object';
  if (rec.scope !== 'state') return 'scope must be "state"';
  if (!rec.byState || typeof rec.byState !== 'object') return 'missing byState';
  const keys = Object.keys(rec.byState);
  if (keys.length < 40) return `only ${keys.length} states parsed`;
  for (const k of keys) {
    if (!/^[A-Z]{2}$/.test(k)) return `bad state key ${k}`;
    const v = rec.byState[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return `bad value for ${k}`;
  }
  return null;
}

async function fetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    try { return JSON.parse(text); } catch (e) {
      throw new Error(`Invalid JSON from ${url}: ${e.message}`);
    }
  } finally {
    clearTimeout(t);
  }
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const url = new URL('/api/rpp', BASE);
  const headers = new Headers({ 'Accept': 'application/json' });

  if (WANT_REFRESH) {
    url.searchParams.set('refresh', '1');
    const secret = (process.env.DATA_SYNC_SECRET || '').trim();
    if (!secret) {
      log('NOTE: --refresh requested but DATA_SYNC_SECRET is not set; proceeding without refresh.');
    } else {
      headers.set('x-cron-secret', secret);
    }
  }

  log('Fetching:', url.toString());
  let payload;
  try {
    payload = await fetchJson(url.toString(), { headers });
  } catch (e) {
    return fail(`Failed to fetch ${url}: ${e.message}`);
  }

  // Accept either { ok:true, data:{...} } or a raw record
  const record = payload?.data?.byState ? payload.data : payload;
  const err = validate(record);
  if (err) return fail(`Snapshot validation failed: ${err}`, record);

  // Pretty print with stable key order
  const stable = (obj) => JSON.stringify(obj, Object.keys(obj).sort(), 2);
  const body = stable({
    updatedAt: record.updatedAt,
    scope: 'state',
    byState: record.byState,
    national: typeof record.national === 'number' ? record.national : 100,
    source: 'mirror',
    provenance: {
      // Keep original provenance alongside snapshot metadata
      upstreamUrl: payload?.data?.provenance?.upstreamUrl || payload?.provenance?.upstreamUrl,
      fetchedAt: new Date().toISOString(),
      snapOf: (record.source || 'unknown')
    }
  });

  await ensureDirFor(DEST);
  await fs.writeFile(DEST, body + '\n', 'utf8');

  const bytes = Buffer.byteLength(body);
  log(`Wrote ${OUT} (${bytes} bytes).`);
  log('Done ✅');
}

main().catch((e) => fail(e.message, e));