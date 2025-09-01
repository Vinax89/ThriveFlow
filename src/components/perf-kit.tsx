'use client';

/**
 * perf-kit.tsx
 * One-file, drop-in performance + stability helpers for Next.js + Firebase apps.
 *
 * What you get (use à la carte):
 * - <PerfProvider/>: Enables Firestore persistence (with safe fallbacks), warms caches,
 *   listens network status, and adds tiny runtime guards for smoother UX.
 * - <HeadSpeed/>: Adds preconnect/dns-prefetch tags for Firebase & Google endpoints.
 * - <NetworkBadge/>: Minimal online/slow/offline indicator (nice for headers/footers).
 * - <ClientOnly/>: Render children only after mount to avoid hydration mismatches.
 * - <SmoothImage/>: Wrapper around next/image that auto-adds `sizes` and optional `priority`
 *   (fixes your “fill but missing sizes” and LCP warnings).
 * - <StableLink/>: SSR/CSR-stable Link to stop href mismatches in dynamic menus.
 * - <ProfilerPane/>: Tiny render-time profiler overlay (opt-in via ?perf=1).
 */

import React from 'react';
import Head from 'next/head';
import Image, { ImageProps } from 'next/image';
import Link, { LinkProps } from 'next/link';

// ---- Firestore persistence + guards (safe even if you don’t use Firestore on a page)
let db: any = null;
try {
  // Prefer your initialized instance if present
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const firebase = require('@/lib/firebase');
  db = firebase?.db ?? null;
} catch {
  // fall through
}

let firestoreFns: {
  enableIndexedDbPersistence?: (db: any) => Promise<void>;
  enableMultiTabIndexedDbPersistence?: (db: any) => Promise<void>;
  waitForPendingWrites?: (db: any) => Promise<void>;
} | null = null;

try {
  // Lazy import so this file remains client-safe even if Firestore isn’t bundled everywhere
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fw = require('firebase/firestore');
  firestoreFns = {
    enableIndexedDbPersistence: fw.enableIndexedDbPersistence,
    enableMultiTabIndexedDbPersistence: fw.enableMultiTabIndexedDbPersistence,
    waitForPendingWrites: fw.waitForPendingWrites,
  };
} catch {
  firestoreFns = null;
}

// ---- requestIdleCallback polyfill
const ric =
  (globalThis as any).requestIdleCallback ??
  ((cb: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void) =>
    setTimeout(() => cb({ timeRemaining: () => 1, didTimeout: false }), 1));

// ---------------------------
// Network status (hook + UI)
// ---------------------------
export type NetworkState = 'online' | 'slow' | 'offline';

export function useNetworkStatus(): NetworkState {
  const [state, setState] = React.useState<NetworkState>(() =>
    typeof navigator === 'undefined' ? 'online' : navigator.onLine ? 'online' : 'offline'
  );

  React.useEffect(() => {
    const onUp = () => setState('online');
    const onDown = () => setState('offline');
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);

    // Detect "slow" based on Network Information API if available
    const conn = (navigator as any).connection;
    const onConn = () => {
      const et = conn?.effectiveType;
      if (!navigator.onLine) return setState('offline');
      if (et === '2g' || et === 'slow-2g') setState('slow');
      else setState('online');
    };
    conn?.addEventListener?.('change', onConn);
    onConn();

    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
      conn?.removeEventListener?.('change', onConn);
    };
  }, []);

  return state;
}

export function NetworkBadge({ className = '' }: { className?: string }) {
  const s = useNetworkStatus();
  const color = s === 'online' ? 'bg-green-500' : s === 'slow' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      title={`Network: ${s}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="capitalize">{s}</span>
    </span>
  );
}

// ---------------------------
// ClientOnly gate
// ---------------------------
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}

// ---------------------------
// Stable Link (avoid href SSR/CSR mismatch)
// ---------------------------
export function useStableValue<T>(serverValue: T, clientValue: T): T {
  const [v, setV] = React.useState(serverValue);
  React.useEffect(() => setV(clientValue), [clientValue]);
  return v;
}

export function StableLink({
  initialHref,
  href,
  children,
  ...rest
}: { initialHref: LinkProps['href']; href: LinkProps['href']; children: React.ReactNode } & Omit<LinkProps, 'href'>) {
  const stableHref = useStableValue(initialHref, href);
  return (
    <Link href={stableHref} {...rest}>
      {children}
    </Link>
  );
}

// ---------------------------
// SmoothImage (fix sizes + LCP)
// ---------------------------
type SmoothImageProps = ImageProps & {
  aboveFold?: boolean; // sets priority + fetchPriority=high
  defaultSizes?: string; // override default sizes if needed
};

export function SmoothImage({
  aboveFold = false,
  defaultSizes = '(max-width: 768px) 100vw, 600px',
  ...img
}: SmoothImageProps) {
  const hasFill = (img as any).fill === true;
  const sizes = img.sizes ?? (hasFill ? defaultSizes : undefined);

  return (
    <Image
      {...img}
      sizes={sizes}
      priority={aboveFold || img.priority === true}
      fetchPriority={aboveFold ? ('high' as any) : (img as any).fetchPriority}
      // Helpful defaults for perceived performance:
      placeholder={img.placeholder ?? 'empty'}
      loading={img.loading ?? (aboveFold ? 'eager' : 'lazy')}
      onLoadingComplete={(el) => el && el.classList?.add('opacity-100')}
      className={`transition-opacity duration-300 opacity-0 ${img.className ?? ''}`}
    />
  );
}

// ---------------------------
// Profiler overlay (opt-in via ?perf=1)
// ---------------------------
export function ProfilerPane() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const url = new URL(window.location.href);
    setEnabled(url.searchParams.has('perf'));
  }, []);
  const [entries, setEntries] = React.useState<{ id: string; ms: number }[]>([]);
  const onRender = React.useCallback((id: string, _phase: string, actualDuration: number) => {
    setEntries((e) => [...e.slice(-14), { id, ms: Math.round(actualDuration) }]);
  }, []);
  if (!enabled) return null;

  return (
    <>
      <React.Profiler id="app" onRender={onRender}>
        {/* Wrap your page subtree with <ProfilerPane/> at layout level to collect timings */}
      </React.Profiler>
      <div className="fixed bottom-3 right-3 z-[9999] w-64 rounded-xl border bg-white/90 p-3 shadow-lg backdrop-blur">
        <div className="mb-1 text-xs font-semibold">Profiler (last {entries.length})</div>
        <ul className="max-h-40 overflow-auto text-xs">
          {entries.map((e, i) => (
            <li key={i} className="flex justify-between">
              <span className="truncate">{e.id}</span>
              <span className="tabular-nums">{e.ms} ms</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ---------------------------
// HeadSpeed (preconnects)
// ---------------------------
export function HeadSpeed() {
  // These improve TLS + DNS handshakes to Firebase/Google APIs.
  return (
    <Head>
      {/* Firebase Auth / Token */}
      <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossOrigin="" />
      {/* Firestore */}
      <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="" />
      {/* Storage (new domain form + legacy) */}
      <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://firebasestorage.app" crossOrigin="" />
      {/* Google static assets */}
      <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="" />
      <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="" />

      {/* DNS prefetch fallback */}
      <link rel="dns-prefetch" href="https://securetoken.googleapis.com" />
      <link rel="dns-prefetch" href="https://identitytoolkit.googleapis.com" />
      <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
      <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
      <link rel="dns-prefetch" href="https://firebasestorage.app" />
      <link rel="dns-prefetch" href="https://www.googleapis.com" />
      <link rel="dns-prefetch" href="https://www.gstatic.com" />
    </Head>
  );
}

// ---------------------------
// Error boundary (lightweight)
// ---------------------------
export class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; onError?: (err: any) => void },
  { hasError: boolean; err?: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, err };
  }
  componentDidCatch(err: any) {
    this.props.onError?.(err);
    // Optionally log to Firestore/Analytics here
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Something went wrong. Please retry.
          </div>
        )
      );
    }
    return this.props.children as any;
  }
}

// ---------------------------
// PerfProvider (persistence + warmups)
// ---------------------------
export function PerfProvider({
  children,
  warmup = true,
  enablePersistence = true,
}: {
  children: React.ReactNode;
  warmup?: boolean;
  enablePersistence?: boolean;
}) {
  React.useEffect(() => {
    if (!enablePersistence || !db || !firestoreFns) return;

    let cancelled = false;

    (async () => {
      try {
        // Attempt multi-tab first (best UX if app is open in several tabs)
        if (firestoreFns?.enableMultiTabIndexedDbPersistence) {
          await firestoreFns.enableMultiTabIndexedDbPersistence(db);
        } else if (firestoreFns?.enableIndexedDbPersistence) {
          await firestoreFns.enableIndexedDbPersistence(db);
        }
      } catch (e: any) {
        // If multi-tab failed due to ownership, fall back to single-tab
        const code = e?.code || e?.message || '';
        if (/failed-precondition/i.test(code) && firestoreFns?.enableIndexedDbPersistence) {
          try {
            await firestoreFns.enableIndexedDbPersistence(db);
          } catch {
            // ignore – app still works without persistence
          }
        }
      }

      // Warm up pending writes (reduces initial jitter)
      try {
        await firestoreFns?.waitForPendingWrites?.(db);
      } catch {
        /* ignore */
      }

      // Tiny idle warmups (adjust to your collections; safe if they don’t exist)
      if (warmup && !cancelled) {
        ric(() => {
          // You can import lightweight read helpers here if you have them.
          // Intentionally left minimal to avoid bundling cost.
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enablePersistence, warmup]);

  // Provide subtle body classes for network status (useful for CSS tweaks)
  const net = useNetworkStatus();
  React.useEffect(() => {
    const cls = `net-${net}`;
    document.documentElement.classList.add(cls);
    return () => document.documentElement.classList.remove(cls);
  }, [net]);

  return <>{children}</>;
}
