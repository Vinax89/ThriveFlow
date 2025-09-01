'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const PerfProvider = dynamic(() => import('@/components/perf-kit').then((m) => m.PerfProvider), { ssr: false });
const DiagnosticsPanel = dynamic(() => import('@/components/perf-kit').then((m) => m.DiagnosticsPanel), { ssr: false });

export default function PerfKitClient({ children }: { children: React.ReactNode }) {
  const showDiagnostics = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DIAGNOSTICS === '1';
  return (
    <PerfProvider>
      {children}
      {showDiagnostics ? <DiagnosticsPanel /> : null}
    </PerfProvider>
  );
}
