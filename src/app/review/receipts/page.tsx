'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, orderBy, query, where, limit } from 'firebase/firestore';

// A mock auth fetch. In a real app, this would use the user's token.
async function authedFetch(url:string, options: any){
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}

export default function ReceiptReview(){
  const [uid, setUid] = useState<string|null>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(()=> {
    const auth = getAuth();
    return onAuthStateChanged(auth, u=> setUid(u?.uid ?? null))
  }, []);

  useEffect(()=> { (async()=>{
    if (!uid) {
      setRows([]);
      return;
    }
    const db = getFirestore();
    const snap = await getDocs(query(collection(db,'receipt_reviews'), where('userId','==', uid), where('resolvedAt', '==', null), orderBy('createdAt','desc'), limit(200)));
    setRows(snap.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
  })(); }, [uid]);

  async function resolveLink(receiptId: string, txId: string){ await authedFetch('/api/review/resolve', { method:'POST', body: JSON.stringify({ receiptId, txId }) }); location.reload(); }
  async function resolveCorrect(receiptId: string){
    const date = prompt('Correct date (YYYY-MM-DD):') || undefined;
    const amount = Number(prompt('Correct amount (e.g., 12.34):') || '') || undefined;
    const merchant = prompt('Correct merchant:') || undefined;
    await authedFetch('/api/review/resolve', { method:'POST', body: JSON.stringify({ receiptId, corrected: { date, amount, merchant } }) });
    location.reload();
  }
  async function resolveIgnore(receiptId: string){ await authedFetch('/api/review/resolve', { method:'POST', body: JSON.stringify({ receiptId }) }); location.reload(); }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Receipt Review</h1>
      <ul className="divide-y border-t border-b">
        {rows.filter(r => !r.resolvedAt).map(r => (
          <li key={r.id} className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Receipt {r.receiptId.slice(-6)}</div>
                <div className="text-sm text-muted-foreground">reason: {r.reason}</div>
              </div>
              <div className="text-sm text-muted-foreground">candidates: {r.candidates.length}</div>
            </div>
            <div className="flex gap-2">
              {r.candidates.map((id:string)=> <button key={id} className="border px-2 py-1 text-xs" onClick={()=> resolveLink(r.receiptId, id)}>Link {id.slice(-6)}</button>)}
              <button className="border px-2 py-1 text-xs" onClick={()=> resolveCorrect(r.receiptId)}>Correct fields</button>
              <button className="border px-2 py-1 text-xs" onClick={()=> resolveIgnore(r.receiptId)}>Ignore</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
