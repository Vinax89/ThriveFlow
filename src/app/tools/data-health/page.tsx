'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { Timestamp } from 'firebase/firestore'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

// ---------- CONFIG ----------
// Required datasets, with recommended freshness windows (days)
const REQUIRED: Array<{
  key: string
  label: string
  freshnessDays: number
  weight: number // contribution to confidence (0–1 sum)
}> = [
  { key: 'col_rpp_state', label: 'BEA Regional Price Parities (RPP)', freshnessDays: 400, weight: 0.18 },
  { key: 'col_cpi_regions', label: 'BLS CPI (inflation)', freshnessDays: 120, weight: 0.18 },
  { key: 'col_housing_zip', label: 'Housing Rent (HUD FMR / Zillow)', freshnessDays: 210, weight: 0.20 },
  { key: 'utilities_cbsa', label: 'Utilities Baselines', freshnessDays: 365, weight: 0.06 },
  { key: 'taxes_federal', label: 'Federal Tax Tables', freshnessDays: 400, weight: 0.12 },
  { key: 'taxes_state', label: 'State Tax Tables', freshnessDays: 400, weight: 0.16 },
  { key: 'taxes_local_zip', label: 'Local/ZIP Tax Tables', freshnessDays: 400, weight: 0.10 },
]

// Household inputs we strongly recommend collecting in the UI
const DEFAULT_HOUSEHOLD = {
  filingStatus: 'single' as 'single' | 'married' | 'hoh',
  dependents: 0,
  pretaxPct: 0, // 401k/403b/457 etc. (percent of wages)
  renter: true,
}

type HealthRow = {
  key: string
  label: string
  present: boolean
  recencyDays: number | null
  fresh: boolean | null
  countHint?: number
}

function daysBetween(a: Date, b: Date) {
  const ONE = 1000 * 60 * 60 * 24
  return Math.floor((a.getTime() - b.getTime()) / ONE)
}

async function getCollectionMeta(colKey: string): Promise<{ asOf?: Date; count?: number }> {
  // 1) try well-known metadata doc `_meta/asOf`
  try {
    const metaRef = doc(collection(db, colKey), '_meta')
    const metaSnap = await getDoc(metaRef)
    if (metaSnap.exists()) {
      const data: any = metaSnap.data()
      let asOf: Date | undefined
      const raw = data.asOf ?? data.updatedAt ?? data.lastIngestedAt
      if (raw instanceof Date) asOf = raw
      else if (raw && typeof raw.toDate === 'function') asOf = (raw as Timestamp).toDate()
      else if (typeof raw === 'number') asOf = new Date(raw)
      else if (typeof raw === 'string') asOf = new Date(raw)
      return { asOf, count: typeof data.count === 'number' ? data.count : undefined }
    }
  } catch {}

  // 2) fall back to newest doc by asOf/updatedAt/createdAt
  try {
    const coll = collection(db, colKey)
    const tryFields = ['asOf', 'updatedAt', 'createdAt']
    for (const f of tryFields) {
      try {
        const q = query(coll, orderBy(f as any, 'desc'), limit(1))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const d = snap.docs[0].data() as any
          const v = d[f]
          let asOf: Date | undefined
          if (v instanceof Date) asOf = v
          else if (v && typeof v?.toDate === 'function') asOf = (v as Timestamp).toDate()
          else if (typeof v === 'number') asOf = new Date(v)
          else if (typeof v === 'string') asOf = new Date(v)
          return { asOf }
        }
      } catch {}
    }
    // 3) as a last resort, check if any docs exist
    const existence = await getDocs(query(coll, limit(1)))
    if (!existence.empty) return {}
  } catch {}

  return {}
}

function score(rows: HealthRow[]) {
  // Confidence is 1 - sum(weight * penalty)
  // penalty = 0 (fresh) | 0.35 (stale) | 1 (missing)
  let s = 1
  for (const def of REQUIRED) {
    const row = rows.find(r => r.key === def.key)
    if (!row) continue
    let penalty = 0
    if (!row.present) penalty = 1
    else if (row.fresh === false) penalty = 0.35
    s -= def.weight * penalty
  }
  return Math.max(0, Math.min(1, s))
}

function bandFromScore(s: number) {
  if (s >= 0.85) return { label: 'High', color: 'bg-emerald-500', ring: 'ring-emerald-500' }
  if (s >= 0.65) return { label: 'Medium', color: 'bg-amber-500', ring: 'ring-amber-500' }
  return { label: 'Low', color: 'bg-rose-500', ring: 'ring-rose-500' }
}

function pct(n: number) {
  return Math.round(n * 100)
}

export default function DataHealthAndConfidencePanel() {
  const [rows, setRows] = useState<HealthRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [household, setHousehold] = useState(DEFAULT_HOUSEHOLD)
  const [sendMetrics, setSendMetrics] = useState(true)

  const conf = useMemo(() => (rows ? score(rows) : 0), [rows])
  const band = useMemo(() => bandFromScore(conf), [conf])

  async function refresh() {
    if (!db) {
      setError('Firebase not initialized. Ensure src/lib/firebase.ts exports a configured Firestore "db".')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const now = new Date()
      const checks: HealthRow[] = []
      for (const def of REQUIRED) {
        const meta = await getCollectionMeta(def.key)
        let present = false
        let fresh: boolean | null = null
        let recencyDays: number | null = null
        if (meta.asOf) {
          present = true
          recencyDays = daysBetween(now, meta.asOf)
          fresh = recencyDays <= def.freshnessDays
        } else if (typeof meta.count === 'number') {
          present = meta.count > 0
          fresh = null
        } else {
          // We don't know; assume missing
          present = false
          fresh = null
        }
        checks.push({ key: def.key, label: def.label, present, recencyDays, fresh })
      }
      setRows(checks)

      if (sendMetrics) {
        try {
          await setDoc(doc(collection(db, 'metrics_calculator_deltas')), {
            ts: new Date(),
            client: typeof window !== 'undefined' ? {
              ua: navigator.userAgent,
              lang: navigator.language,
            } : null,
            rows: checks.map(c => ({ key: c.key, present: c.present, recencyDays: c.recencyDays ?? null, fresh: c.fresh })),
            confidence: conf,
          })
        } catch {}
      }
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error running checks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function writePrefsToLocalStorage() {
    try {
      const payload = {
        v: 1,
        when: Date.now(),
        household,
      }
      localStorage.setItem('thriveflow_calc_prefs', JSON.stringify(payload))
      alert('Saved defaults. Calculators can now read from local storage key "thriveflow_calc_prefs".')
    } catch {}
  }

  const tips = useMemo(() => {
    if (!rows) return [] as string[]
    const missing = rows.filter(r => !r.present).map(r => r.label)
    const stale = rows.filter(r => r.present && r.fresh === false).map(r => r.label)
    const out: string[] = []
    if (missing.length) out.push(`Load missing datasets: ${missing.join(', ')}`)
    if (stale.length) out.push(`Refresh stale datasets: ${stale.join(', ')}`)
    out.push('Ensure background refresh jobs are scheduled (Cloud Scheduler + Functions).')
    out.push('Collect household inputs (filing status, dependents, pretax %, renter/owner) in the UI for accuracy.')
    out.push('Instrument calculators to log when fallbacks trigger (this panel already emits basic metrics).')
    return out
  }, [rows])

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Data Health & Confidence</h1>
          <p className="text-sm text-muted-foreground">Live check of datasets powering the cost-of-living & tax calculators, plus household inputs and logging.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`relative flex h-14 w-14 items-center justify-center rounded-full ring-4 ${band.ring}`}>
            <div className={`h-10 w-10 rounded-full ${band.color}`} />
            <span className="absolute text-xs font-medium text-white">{pct(conf)}%</span>
          </div>
          <div>
            <div className="text-sm font-medium">Confidence: {band.label}</div>
            <div className="text-xs text-muted-foreground">Aggregated dataset presence & freshness</div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Datasets</h2>
          <div className="flex items-center gap-3">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={sendMetrics} onChange={e => setSendMetrics(e.target.checked)} />
              Send anonymous health metrics
            </label>
            <button onClick={refresh} disabled={loading} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">{loading ? 'Checking…' : 'Recheck'}</button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 font-normal">Collection</th>
                <th className="py-2 font-normal">Status</th>
                <th className="py-2 font-normal">Recency</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map(r => (
                <tr key={r.key} className="border-t">
                  <td className="py-2">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.key}</div>
                  </td>
                  <td className="py-2">
                    {!r.present && <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">Missing</span>}
                    {r.present && r.fresh === false && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Stale</span>
                    )}
                    {r.present && (r.fresh || r.fresh === null) && (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Present</span>
                    )}
                  </td>
                  <td className="py-2">
                    {typeof r.recencyDays === 'number' ? (
                      <span className="tabular-nums">{r.recencyDays} days ago</span>
                    ) : (
                      <span className="text-muted-foreground">n/a</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">{error}</div>}
      </section>

      <section className="rounded-2xl border p-4 space-y-4">
        <h2 className="text-lg font-medium">Household Inputs (recommended)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">Filing status</label>
            <select
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2"
              value={household.filingStatus}
              onChange={e => setHousehold(h => ({ ...h, filingStatus: e.target.value as any }))}
            >
              <option value="single">Single</option>
              <option value="married">Married filing jointly</option>
              <option value="hoh">Head of household</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dependents</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2"
              value={household.dependents}
              min={0}
              onChange={e => setHousehold(h => ({ ...h, dependents: Number(e.target.value || 0) }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Pretax retirement %</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2"
              value={household.pretaxPct}
              min={0}
              max={100}
              step={1}
              onChange={e => setHousehold(h => ({ ...h, pretaxPct: Math.min(100, Math.max(0, Number(e.target.value || 0))) }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Housing</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="housing"
                  checked={household.renter}
                  onChange={() => setHousehold(h => ({ ...h, renter: true }))}
                />
                Renter
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="housing"
                  checked={!household.renter}
                  onChange={() => setHousehold(h => ({ ...h, renter: false }))}
                />
                Homeowner
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={writePrefsToLocalStorage} className="rounded-xl border px-3 py-2 text-sm hover:bg-muted">Save as defaults</button>
          <span className="text-xs text-muted-foreground">Calculators can import from <code>localStorage['thriveflow_calc_prefs']</code>.</span>
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-medium">Next Actions</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-6 text-sm">
          {tips.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
        <div className="mt-3 text-xs text-muted-foreground">
          Scheduler bootstrap (optional): if you have a callable function named <code>jobs_bootstrap</code>, invoke it from your admin panel to create Cloud Scheduler jobs.
        </div>
      </section>

      <footer className="text-xs text-muted-foreground">
        Pro tip: Surface this panel for admins only and link it from your sidebar under Tools → Data Health.
      </footer>
    </div>
  )
}
