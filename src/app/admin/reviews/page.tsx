'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getFirestore, collectionGroup, getDocs, orderBy, query, limit } from 'firebase/firestore';

export default function AdminReviews(){
  const [rows, setRows] = useState<any[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(true);
  useEffect(()=> { (async()=>{
    // Fetch across users via collectionGroup
    const db = getFirestore();
    const cq = query(collectionGroup(db, 'receipt_reviews'), orderBy('createdAt','desc'), limit(500));
    const s = await getDocs(cq);
    setRows(s.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
  })(); },[]);

  const filtered = rows.filter(r => onlyOpen ? !r.resolution : true);

  async function setAdmin(uid: string, val: boolean){
    const t = await auth.currentUser?.getIdToken();
    await fetch('/api/admin/set-claim', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${t}` }, body: JSON.stringify({ uid, admin: val }) });
    alert('Updated admin claim');
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin — Receipt Reviews</h1>
      <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={e=> setOnlyOpen(e.target.checked)} /> Show only open</label>
      <ul className="divide-y">
        {filtered.map(r => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{r.receiptId} · user {r.userId.slice(0,6)}…</div>
                <div className="text-sm text-gray-600">{r.createdAt} · reason: {r.reason} · candidates: {r.candidates?.length ?? 0}</div>
              </div>
              <div className="text-sm">
                {r.resolution ? <span className="text-green-700">resolved: {r.resolution}</span> : <span className="text-amber-700">open</span>}
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              {r.candidates?.map((id:string)=> <a key={id} className="underline" href={`/review/receipts`}>Open review</a>)}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 p-3 border rounded">
        <h2 className="font-medium mb-2">Admin tools</h2>
        <label className="flex gap-2 items-center">Grant admin to UID (danger):
          <input id="uid" className="border p-1" />
          <button className="border px-2 py-1 text-xs" onClick={()=> {
            const v = (document.getElementById('uid') as HTMLInputElement).value.trim(); if (!v) return; setAdmin(v, true);
          }}>Grant</button>
        </label>
      </div>
    </main>
  );
}
