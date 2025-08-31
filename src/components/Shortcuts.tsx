'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const binds = [
  { keys: ['g','t'], desc: 'Go to Transactions', href: '/finance/transactions' },
  { keys: ['g','b'], desc: 'Go to Budgets', href: '/finance/budgets' },
  { keys: ['g','r'], desc: 'Go to Receipts', href: '/finance/receipts' },
  { keys: ['?'],     desc: 'Toggle help', href: '' }
];

export function Shortcuts(){
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(()=>{
    let seq: string[] = [];
    function onKey(e: KeyboardEvent){
      const k = e.key.toLowerCase();
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (k === '?') {
        e.preventDefault();
        setOpen(o=>!o);
        return;
      }
      seq.push(k); seq = seq.slice(-2);
      for (const b of binds) {
        if (b.keys.length === seq.length && b.keys.every((kk,i)=> kk===seq[i])) {
          if (b.href) router.push(b.href); seq = []; break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  },[router]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background text-foreground rounded p-4 w-[520px] max-w-[90vw] border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button className="border px-2" onClick={()=> setOpen(false)} aria-label="Close">×</button>
        </div>
        <ul className="mt-3 space-y-2">
          {binds.map((b,i)=> (
            <li key={i} className="flex justify-between"><span>{b.desc}</span><code>{b.keys.join(' + ')}</code></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
