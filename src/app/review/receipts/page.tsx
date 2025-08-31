'use client';
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';
import { authedFetch } from '@/lib/authFetch';

function uploadReceipt(storage: any, file: File, uid: string, onProgress: (pct:number)=>void): Promise<string> {
  const yyyy = new Date().getFullYear();
  const mm = String(new Date().getMonth()+1).padStart(2,'0');
  const id = crypto.randomUUID();
  const path = `receipts/${uid}/${yyyy}/${mm}/${id}.jpg`;
  const metadata = { customMetadata: { uid } } as any;
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, metadata);
    task.on('state_changed', s => {
      onProgress(Math.round((s.bytesTransferred / s.totalBytes)*100));
    }, reject, () => resolve(path));
  });
}

function Thumb({ path }:{ path:string }){
  const [url, setUrl] = useState<string>('');
  const auth = getAuth();
  useEffect(()=> { (async()=>{
    const t = await auth.currentUser?.getIdToken();
    const r = await fetch('/api/receipts/url', { method:'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ path }) });
    const j = await r.json(); setUrl(j.url);
  })(); }, [path, auth]);
  if (!url) return null; return <img src={url} alt="Receipt thumbnail" className="max-h-48 border rounded" />;
}

function ManualLink({ uid, receiptId, onLink }: { uid:string, receiptId:string, onLink: () => void }){
  const [tx, setTx] = useState<any[]>([]);
  const [picked, setPicked] = useState('');
  const [db, setDb] = useState<any>(null);

  useEffect(()=> { (async()=>{
    const { getFirestore } = await import('firebase/firestore');
    const firestore = getFirestore();
    setDb(firestore);
    const snap = await getDocs(query(collection(firestore,'transactions'), where('userId','==', uid), orderBy('date','desc'), limit(200)));
    setTx(snap.docs.map(d=> ({ id:d.id, ...(d.data() as any) })));
  })(); }, [uid]);

  async function handleLink() {
      if (!db || !picked) return;
      await setDoc(doc(db,'transactions', picked), { receiptId: receiptId }, { merge: true });
      await setDoc(doc(db,'receipts', receiptId), { linkedTx: [picked] }, { merge: true });
      onLink();
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <select className="border p-2" value={picked} onChange={e=> setPicked(e.target.value)}>
        <option value="">Select transaction…</option>
        {tx.map(t=> <option key={t.id} value={t.id}>{t.date} · {t.description ?? '—'} · ${t.amount.toFixed(2)}</option>)}
      </select>
      <button className="border px-3 py-2" disabled={!picked} onClick={handleLink}>Link</button>
    </div>
  );
}


export default function ReceiptsPage(){
  const [uid, setUid] = useState<string|null>(null);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [auth, setAuth] = useState<any>(null);
  const [db, setDb] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);

  useEffect(() => {
    const authInstance = getAuth();
    setAuth(authInstance);
    setDb(getFirestore());
    setStorage(getStorage());
    onAuthStateChanged(authInstance, user => setUid(user?.uid ?? null));
  }, []);

  async function refresh(){
    if(!uid || !db) return; 
    const qs = await getDocs(query(collection(db,'receipt_reviews'), where('userId','==', uid), orderBy('createdAt','desc'), limit(200)));
    setRows(qs.docs.map(d => ({id: d.id, ...d.data()})));
  }

  useEffect(()=> { refresh(); }, [uid, db]);

  async function onFile(f?: File){ 
      if(!f || !uid || !storage) return; 
      setProgress(1); 
      await uploadReceipt(storage, f, uid, setProgress); 
      setProgress(100); 
      setTimeout(()=> setProgress(0), 1500); 
      setTimeout(()=> refresh(), 1500); 
  }

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
      <input type="file" accept="image/*" onChange={e=> onFile(e.target.files?.[0])} />
      {progress>0 && <div>Upload: {progress}%</div>}
      <ul className="divide-y max-w-3xl">
        {rows.map(r => (
          <li key={r.id} className="py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Receipt {r.receiptId}</div>
                <div className="text-sm text-gray-600">reason: {r.reason}</div>
              </div>
              <div className="text-sm text-gray-600">candidates: {r.candidates.length}</div>
            </div>
             {r.receiptId && <Thumb path={`receipts_thumbs/${r.userId}/${new Date(r.createdAt).getFullYear()}/${String(new Date(r.createdAt).getMonth()+1).padStart(2,'0')}/${r.receiptId}_768.jpg`} />}
            <div className="flex gap-2">
              {r.candidates.map((id:string)=> <button key={id} className="border px-2 py-1 text-xs" onClick={()=> resolveLink(r.receiptId, id)}>Link {id.slice(-6)}</button>)}
              <button className="border px-2 py-1 text-xs" onClick={()=> resolveCorrect(r.receiptId)}>Correct fields</button>
              <button className="border px-2 py-1 text-xs" onClick={()=> resolveIgnore(r.receiptId)}>Ignore</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="text-sm">
                <div className="font-medium">Extracted</div>
                <dl>
                  <dt>Amount</dt><dd>${r.corrected?.amount ?? r.kv?.amount ?? '—'}</dd>
                  <dt>Date</dt><dd>{r.corrected?.date ?? r.kv?.date ?? '—'}</dd>
                  <dt>Merchant</dt><dd>{r.corrected?.merchant ?? r.kv?.merchant ?? '—'}</dd>
                </dl>
              </div>
              <div className="text-sm">
                <div className="font-medium">Candidate transaction (first)</div>
                <div className="text-gray-600">Compare visually in Transactions page; future: fetch tx fields</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
