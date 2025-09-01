'use client';

import React from 'react';
import { doc, getDoc, Timestamp, getFirestore } from 'firebase/firestore';

// If your app already exports `db` from "@/lib/firebase", prefer that:
let db: ReturnType<typeof getFirestore> | null = null;
try {
  // Lazy require to avoid SSR issues if this file is imported in a Server Component.
  // @ts-ignore
  const firebase = require('@/lib/firebase');
  db = firebase?.db ?? null;
} catch {
  try {
    db = getFirestore();
  } catch {
    db = null;
  }
}

/** ---------- Types ---------- */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface DataSetMeta {
  id: string;
  asOf?: Date | null;
  count?: number | null;
  source?: string | null;
}

export interface UseDataConfidenceOptions {
  /** Max allowed age in days before confidence degrades (per dataset or global). */
  maxAgeDays?: number;
  maxAgeDaysByDataset?: Record<string, number>;
  /** Session cache TTL in ms (default 5 minutes). */
  cacheTtlMs?: number;
  /** If true, skip Firestore and use only cache (useful in heavy preview). */
  cacheOnly?: boolean;
}

export interface UseDataConfidenceResult {
  confidence: ConfidenceLevel;
  reasons: string[];
  perDataset: Record<
    string,
    { meta: DataSetMeta | null; ageDays: number | null; confidence: ConfidenceLevel; maxAgeDays: number }
  >;
  isLoading: boolean;
  error?: string;
  refresh: () => Promise<void>;
}

/** ---------- Small utilities ---------- */
const now = () => new Date();

const dayDiff = (a: Date, b: Date) => Math.max(0, Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));

const clampConfidence = (ageDays: number | null, maxAgeDays: number): ConfidenceLevel => {
  if (ageDays == null) return 'unknown';
  if (ageDays <= maxAgeDays) return 'high';
  if (ageDays <= maxAgeDays * 2) return 'medium';
  return 'low';
};

const minConfidence = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => {
  const rank: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
  return rank[a] < rank[b] ? a : b;
};

const cacheKey = (datasetId: string) => `thriveflow_dataset_meta::${datasetId}`;

const readCache = (datasetId: string, ttlMs: number): DataSetMeta | null => {
  try {
    const raw = sessionStorage.getItem(cacheKey(datasetId));
    if (!raw) return null;
    const obj = JSON.parse(raw) as { meta: DataSetMeta; savedAt: number };
    if (Date.now() - obj.savedAt > ttlMs) return null;
    // revive dates
    const asOf = obj.meta?.asOf ? new Date(obj.meta.asOf) : undefined;
    return { ...obj.meta, asOf: asOf ?? null };
  } catch {
    return null;
  }
};

const writeCache = (datasetId: string, meta: DataSetMeta) => {
  try {
    sessionStorage.setItem(cacheKey(datasetId), JSON.stringify({ meta, savedAt: Date.now() }));
  } catch {
    // ignore quota errors
  }
};

/** 
 * Try these in order:
 * 1) Central meta collection: dataset_meta/{datasetId}
 * 2) Per-collection meta doc: /{datasetId}/_meta
 */
async function fetchMeta(datasetId: string): Promise<DataSetMeta | null> {
  if (!db) return null;

  // 1) dataset_meta central doc
  const central = await getDoc(doc(db, 'dataset_meta', datasetId));
  if (central.exists()) {
    const d = central.data() as any;
    const asOf = tsOrDateToDate(d?.asOf);
    return {
      id: datasetId,
      asOf,
      count: numOrNull(d?.count),
      source: d?.source ?? null,
    };
  }

  // 2) collection/_meta doc
  const perColl = await getDoc(doc(db, datasetId, '_meta'));
  if (perColl.exists()) {
    const d = perColl.data() as any;
    const asOf = tsOrDateToDate(d?.asOf);
    return {
      id: datasetId,
      asOf,
      count: numOrNull(d?.count),
      source: d?.source ?? null,
    };
  }

  return null;
}

const numOrNull = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const tsOrDateToDate = (v: any): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === 'function') return v.toDate() as Date; // Firestore Timestamp
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v?.seconds === 'number' && typeof v?.nanoseconds === 'number') {
    // Plain object that looks like a Timestamp
    return new Date((v.seconds as number) * 1000);
  }
  return null;
};

/** ---------- The Hook ---------- */
export function useDataConfidence(
  datasets: string[],
  opts: UseDataConfidenceOptions = {}
): UseDataConfidenceResult {
  const {
    maxAgeDays = 35, // default: roughly monthly refresh
    maxAgeDaysByDataset = {},
    cacheTtlMs = 5 * 60 * 1000,
    cacheOnly = false,
  } = opts;

  const [state, setState] = React.useState<UseDataConfidenceResult>({
    confidence: 'unknown',
    reasons: [],
    perDataset: {},
    isLoading: true,
    refresh: async () => {},
  });

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: undefined }));
    try {
      const entries = await Promise.all(
        datasets.map(async (id) => {
          const ttl = cacheTtlMs;
          const cached = readCache(id, ttl);
          let meta: DataSetMeta | null = cached;

          if (!cached && !cacheOnly) {
            meta = await fetchMeta(id);
            if (meta) writeCache(id, meta);
          }

          const kMax = maxAgeDaysByDataset[id] ?? maxAgeDays;
          const age = meta?.asOf ? dayDiff(now(), meta.asOf) : null;
          const conf = clampConfidence(age, kMax);
          return [id, { meta: meta ?? null, ageDays: age, confidence: conf, maxAgeDays: kMax }] as const;
        })
      );

      const perDataset = Object.fromEntries(entries);
      // overall confidence = min rank across datasets used
      const overall = entries.reduce<ConfidenceLevel>((acc, [, v]) => minConfidence(acc, v.confidence), 'high');

      const reasons: string[] = [];
      for (const [id, v] of entries) {
        if (!v.meta?.asOf) {
          reasons.push(`${id}: no 'asOf' timestamp found (missing meta).`);
        } else if (v.ageDays! > v.maxAgeDays * 2) {
          reasons.push(`${id}: very stale (${v.ageDays}d > ${v.maxAgeDays * 2}d).`);
        } else if (v.ageDays! > v.maxAgeDays) {
          reasons.push(`${id}: slightly stale (${v.ageDays}d > ${v.maxAgeDays}d).`);
        }
      }

      setState((s) => ({
        ...s,
        isLoading: false,
        perDataset,
        confidence: entries.length ? overall : 'unknown',
        reasons,
        refresh: load,
      }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: e?.message ?? 'Failed to load data meta',
        confidence: 'unknown',
        refresh: load,
      }));
    }
  }, [datasets.join('|'), cacheOnly, cacheTtlMs, maxAgeDays, JSON.stringify(maxAgeDaysByDataset)]);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return state;
}

/** ---------- The Badge Component ---------- */
export interface DataConfidenceBadgeProps {
  datasets: string[];
  label?: string;
  className?: string;
  compact?: boolean;
  maxAgeDays?: number;
  maxAgeDaysByDataset?: Record<string, number>;
  cacheTtlMs?: number;
  cacheOnly?: boolean;
  showOpenPanelLink?: boolean;
}

export function DataConfidenceBadge({
  datasets,
  label = 'Data Confidence',
  className,
  compact = false,
  maxAgeDays,
  maxAgeDaysByDataset,
  cacheTtlMs,
  cacheOnly,
  showOpenPanelLink = true,
}: DataConfidenceBadgeProps) {
  const { confidence, reasons, perDataset, isLoading, error, refresh } = useDataConfidence(datasets, {
    maxAgeDays,
    maxAgeDaysByDataset,
    cacheTtlMs,
    cacheOnly,
  });

  const color =
    confidence === 'high' ? 'bg-green-500' : confidence === 'medium' ? 'bg-yellow-500' : confidence === 'low' ? 'bg-red-500' : 'bg-gray-400';

  const text =
    confidence === 'high' ? 'High' : confidence === 'medium' ? 'Medium' : confidence === 'low' ? 'Low' : 'Unknown';

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${className ?? ''}`}
        title={`${label}: ${text}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span>{text}</span>
      </span>
    );
  }

  return (
    <details className={`group inline-block ${className ?? ''}`}>
      <summary className="list-none cursor-pointer select-none">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          <span className="font-medium">{label}:</span>
          <span className="font-semibold">{isLoading ? 'Loading…' : text}</span>
        </span>
      </summary>

      <div className="mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl border p-3 shadow-sm">
        {error && (
          <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {!error && (
          <>
            <ul className="mb-3 space-y-1 text-sm">
              {Object.entries(perDataset).map(([id, v]) => {
                const dot =
                  v.confidence === 'high'
                    ? 'bg-green-500'
                    : v.confidence === 'medium'
                    ? 'bg-yellow-500'
                    : v.confidence === 'low'
                    ? 'bg-red-500'
                    : 'bg-gray-400';
                const ageTxt =
                  v.ageDays == null ? 'no asOf' : v.ageDays === 0 ? 'today' : `${v.ageDays}d ago`;
                return (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      <span className="font-medium">{id}</span>
                    </div>
                    <div className="text-neutral-600">
                      <span className="mr-2">asOf: {ageTxt}</span>
                      <span className="text-xs text-neutral-500">max {v.maxAgeDays}d</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {reasons.length > 0 ? (
              <div className="mb-3 rounded-md border bg-amber-50 px-3 py-2">
                <div className="mb-1 text-xs font-semibold text-amber-800">Attention</div>
                <ul className="list-inside list-disc text-xs text-amber-800">
                  {reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mb-3 text-xs text-neutral-500">All datasets look fresh.</p>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => refresh()}
                className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-50 active:bg-neutral-100"
              >
                Refresh
              </button>
              {showOpenPanelLink && (
                <a
                  href="/tools/data-health"
                  className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-neutral-50 active:bg-neutral-100"
                >
                  Open Data Health
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
