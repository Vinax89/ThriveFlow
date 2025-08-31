'use client';
import { useEffect, useState } from 'react';
export default function ThemeToggle(){
  const [hc, setHc] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hc') === '1'
    }
    return false;
  });
  useEffect(()=> {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-hc', hc ? 'true' : 'false');
      localStorage.setItem('hc', hc ? '1' : '0');
    }
  }, [hc]);
  return (
    <button aria-pressed={hc} className="border px-3 py-1 text-sm" onClick={()=> setHc(v=>!v)}>{hc ? 'High contrast: ON' : 'High contrast: OFF'}</button>
  );
}
