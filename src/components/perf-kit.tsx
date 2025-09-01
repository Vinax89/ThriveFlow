/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

'use client';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type PerfCtx = { appStartedAt: number; mark: (name: string) => void };
const Ctx = createContext<PerfCtx | null>(null);

export function PerfProvider({ children }: { children: React.ReactNode }) {
  const appStartedAt = useMemo(() => performance.timeOrigin || Date.now(), []);
  const marks = useRef<Record<string, number>>({});
  const mark = (name: string) => { marks.current[name] = performance.now(); };
  useEffect(() => {
    mark('hydrated');
  }, []);
  return <Ctx.Provider value={{ appStartedAt, mark }}>{children}</Ctx.Provider>;
}

export function usePerf() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePerf must be used within PerfProvider');
  return ctx;
}

export function DiagnosticsPanel() {
  const [open, setOpen] = useState(true);
  const [r, setR] = useState<{rt:number; dcl:number; lcp?:number}>({rt:0, dcl:0});
  useEffect(() => {
    const perf = performance as any;
    const nav = perf.getEntriesByType?.('navigation')?.[0];
    const lcpEntryHandler = (entry: any) => setR(prev => ({...prev, lcp: entry.startTime}));
    const po = ('PerformanceObserver' in window)
      ? new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (e.name === 'largest-contentful-paint') lcpEntryHandler(e);
        })
      : null;
    try { po?.observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
    setR({
      rt: Math.round(nav?.responseEnd || 0),
      dcl: Math.round(nav?.domContentLoadedEventEnd || 0),
      lcp: undefined
    });
    return () => po?.disconnect();
  }, []);
  if (!open) return null;
  return (
    <div style={{
      position:'fixed', right:8, bottom:8, zIndex:9999,
      background:'rgba(18,18,18,.9)', color:'#d1d5db', padding:'10px 12px',
      borderRadius:12, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize:12, boxShadow:'0 8px 30px rgba(0,0,0,.35)', backdropFilter:'blur(6px)'
    }}>
      <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:6}}>
        <strong>Diagnostics</strong>
        <button onClick={()=>setOpen(false)} style={{marginLeft:8, opacity:.7}}>✕</button>
      </div>
      <div>RT: {r.rt}ms · DCL: {r.dcl}ms · LCP: {r.lcp ? Math.round(r.lcp)+'ms' : '—'}</div>
      <div style={{opacity:.7, marginTop:4}}>Set NEXT_PUBLIC_ENABLE_DIAGNOSTICS=1 to toggle</div>
    </div>
  );
}
