'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';

export default function SuggestedRules(){
  const [uid, setUid] = useState<string|null>(null);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(()=> onAuthStateChanged(auth, u=> setUid(u?.uid ?? null)), []);
  useEffect(()=> { (async()=>{
    if (!uid) return;
    const s = await getDocs(query(collection(db,'rules_suggested'), where('userId','==', uid), orderBy('suggestedAt','desc')));
    setRows(s.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
  })(); }, [uid]);

  async function accept(r:any){
    const id = crypto.randomUUID();
    await setDoc(doc(db,'rules', id), { id, userId: uid, priority: r.priority, enabled: true, match: r.match, action: r.action }, { merge: true });
    await deleteDoc(doc(db,'rules_suggested', r.id));
    location.reload();
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Suggested Rules</h1>
      <ul className="divide-y max-w-3xl">
        {rows.map(r=> (
          <li key={r.id} className="py-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{r.action?.nurseCategory} (conf {r.confidence})</div>
              <div className="text-sm text-gray-600">merchant contains [{(r.match?.merchantContains||[]).join(', ')}] · amount ±$0.05 around {Math.abs(r.match?.minAmount ?? 0).toFixed(2)}</div>
            </div>
            <div className="flex gap-2">
              <button className="border px-2 py-1 text-xs" onClick={()=> accept(r)}>Accept</button>
              <button className="border px-2 py-1 text-xs" onClick={async()=> { await deleteDoc(doc(db,'rules_suggested', r.id)); location.reload(); }}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
